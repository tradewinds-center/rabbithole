import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { authedMutation, authedQuery, teacherMutation } from "./lib/customFunctions";
import { internal } from "./_generated/api";
import { ROLES } from "./lib/roles";

/**
 * Proposed-change-set generator — queries, mutations, and internal context
 * readers. The actual LLM call lives in `scholarDocumentProposalActions.ts`
 * (which is "use node" to pull in the Anthropic SDK).
 *
 * Role gating: teacher + admin only. Nothing here or downstream should leak
 * the extracted PDF text to a scholar.
 */

// ── Internal context reader (consumed by runProposal action) ────────────

export const aiGetProposalContext = internalQuery({
  args: { documentId: v.id("scholarDocuments") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return null;

    const directives = await ctx.db
      .query("teacherDirectives")
      .withIndex("by_scholar", (q) => q.eq("scholarId", doc.scholarId))
      .collect();

    const seeds = await ctx.db
      .query("seeds")
      .withIndex("by_scholar_status", (q) =>
        q.eq("scholarId", doc.scholarId).eq("status", "active")
      )
      .collect();

    const dossier = await ctx.db
      .query("scholarDossiers")
      .withIndex("by_scholar", (q) => q.eq("scholarId", doc.scholarId))
      .first();

    return {
      document: {
        _id: doc._id,
        scholarId: doc.scholarId,
        processingStatus: doc.processingStatus,
        redactedSummary: doc.redactedSummary ?? null,
        aiKeyFindings: doc.aiKeyFindings ?? [],
      },
      directives: directives.map((d) => ({
        label: d.label,
        content: d.content,
        isActive: d.isActive,
      })),
      seeds: seeds.map((s) => ({
        topic: s.topic,
        domain: s.domain,
        suggestionType: s.suggestionType,
      })),
      dossierContent: dossier?.content ?? null,
    };
  },
});

// ── Internal mutation (persist the generated proposal) ──────────────────

export const aiSaveProposal = internalMutation({
  args: {
    documentId: v.id("scholarDocuments"),
    scholarId: v.id("users"),
    generatedBy: v.id("users"),
    proposal: v.any(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    // Keep only the latest proposal per document.
    const prior = await ctx.db
      .query("documentProposals")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();
    for (const p of prior) await ctx.db.delete(p._id);

    return await ctx.db.insert("documentProposals", {
      documentId: args.documentId,
      scholarId: args.scholarId,
      generatedBy: args.generatedBy,
      proposal: args.proposal,
      model: args.model,
    });
  },
});

// ── Public: kick off proposal generation ────────────────────────────────

export const generateProposal = authedMutation({
  args: { documentId: v.id("scholarDocuments") },
  handler: async (ctx, args) => {
    const role = ctx.user.role;
    if (role !== ROLES.TEACHER && role !== ROLES.ADMIN) {
      throw new Error("Forbidden: teacher or admin role required");
    }

    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    if (doc.processingStatus !== "ready") {
      throw new Error(
        `Document is not ready for proposal generation (status=${doc.processingStatus})`
      );
    }

    await ctx.db.insert("documentAccessLog", {
      documentId: args.documentId,
      scholarId: doc.scholarId,
      userId: ctx.user._id,
      action: "generate_proposal",
    });

    await ctx.scheduler.runAfter(
      0,
      internal.scholarDocumentProposalActions.runProposal,
      {
        documentId: args.documentId,
        generatedBy: ctx.user._id,
      }
    );

    return { scheduled: true };
  },
});

// ── Public: read the latest cached proposal ─────────────────────────────

export const getLatestProposal = authedQuery({
  args: { documentId: v.id("scholarDocuments") },
  handler: async (ctx, args) => {
    const role = ctx.user.role;
    if (role !== ROLES.TEACHER && role !== ROLES.ADMIN) {
      throw new Error("Forbidden: teacher or admin role required");
    }
    return await ctx.db
      .query("documentProposals")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .first();
  },
});

// ── Public: apply (some or all of) a cached proposal ────────────────────

/**
 * Apply selected directives + seeds from the cached proposal for a document.
 *
 * The teacher picks which directives (by label) and seeds (by index into the
 * proposal.seeds array) to approve. We then:
 *   - For each approved directive: upsertByLabel — create new or patch existing
 *   - For each approved seed: insert a new row with origin="teacher" and
 *     status="active" (same shape seeds.create produces)
 *   - Mark the proposal applied (appliedAt, appliedBy)
 *   - Audit-log `apply_proposal`
 *
 * We intentionally SKIP unitSuggestion in this flow — Phase 2 doesn't wire
 * unit creation through the approval path. The UI surfaces the suggestion as
 * read-only text for the teacher to copy manually into the Curriculum tab.
 */
export const applyProposal = teacherMutation({
  args: {
    documentId: v.id("scholarDocuments"),
    approvedDirectiveLabels: v.array(v.string()),
    approvedSeedIndexes: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    const proposalRow = await ctx.db
      .query("documentProposals")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .first();
    if (!proposalRow) throw new Error("No proposal cached for this document");

    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");

    const proposal = proposalRow.proposal as {
      rationale: string;
      directives: Array<{
        action: "create" | "update";
        label: string;
        content: string;
        reason: string;
      }>;
      seeds: Array<{
        topic: string;
        domain: string;
        rationale: string;
        approachHint: string | null;
      }>;
      unitSuggestion:
        | null
        | {
            title: string;
            bigIdea: string;
            essentialQuestions: string[];
            rationale: string;
          };
    };

    const approvedLabelSet = new Set(
      args.approvedDirectiveLabels.map((l) => l.trim().toLowerCase())
    );
    const approvedSeedIndexSet = new Set(args.approvedSeedIndexes);

    // ── Apply directives ──────────────────────────────────────────────
    let directivesApplied = 0;
    for (const d of proposal.directives) {
      if (!approvedLabelSet.has(d.label.trim().toLowerCase())) continue;
      if (!d.label.trim() || !d.content.trim()) continue;

      // Mirror teacherDirectives.upsertByLabel logic inline (we can't call
      // another mutation from a mutation in Convex — and this lets us use
      // the teacher's user id as authorId).
      const existing = await ctx.db
        .query("teacherDirectives")
        .withIndex("by_scholar", (q) => q.eq("scholarId", doc.scholarId))
        .collect();
      const labelLower = d.label.trim().toLowerCase();
      const match = existing.find(
        (r) => r.label.toLowerCase() === labelLower
      );
      const now = Date.now();
      if (match) {
        await ctx.db.patch(match._id, {
          content: d.content.trim(),
          authorId: ctx.user._id,
          updatedAt: now,
          isActive: true,
        });
      } else {
        await ctx.db.insert("teacherDirectives", {
          scholarId: doc.scholarId,
          label: d.label.trim(),
          content: d.content.trim(),
          authorId: ctx.user._id,
          isActive: true,
          updatedAt: now,
        });
      }
      directivesApplied += 1;
    }

    // ── Apply seeds ───────────────────────────────────────────────────
    let seedsApplied = 0;
    for (let i = 0; i < proposal.seeds.length; i++) {
      if (!approvedSeedIndexSet.has(i)) continue;
      const s = proposal.seeds[i];
      if (!s.topic.trim()) continue;

      await ctx.db.insert("seeds", {
        scholarId: doc.scholarId,
        origin: "teacher",
        status: "active",
        topic: s.topic,
        domain: s.domain || undefined,
        suggestionType: "teacher_suggestion",
        rationale: s.rationale,
        approachHint: s.approachHint ?? undefined,
        teacherId: ctx.user._id,
      });
      seedsApplied += 1;
    }

    // ── Mark proposal applied + audit-log ─────────────────────────────
    await ctx.db.patch(proposalRow._id, {
      appliedAt: Date.now(),
      appliedBy: ctx.user._id,
    });

    await ctx.db.insert("documentAccessLog", {
      documentId: args.documentId,
      scholarId: doc.scholarId,
      userId: ctx.user._id,
      action: "apply_proposal",
    });

    return {
      directivesApplied,
      seedsApplied,
      skippedUnit: proposal.unitSuggestion !== null,
    };
  },
});

/**
 * Reject a proposal without applying anything. Sets rejectedAt + rejectedBy so
 * the UI can distinguish "pending" vs. "rejected" in future views.
 */
export const rejectProposal = teacherMutation({
  args: { documentId: v.id("scholarDocuments") },
  handler: async (ctx, args) => {
    const proposalRow = await ctx.db
      .query("documentProposals")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .first();
    if (!proposalRow) throw new Error("No proposal cached for this document");

    await ctx.db.patch(proposalRow._id, {
      rejectedAt: Date.now(),
      rejectedBy: ctx.user._id,
    });
  },
});
