import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { authedMutation, authedQuery } from "./lib/customFunctions";
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
