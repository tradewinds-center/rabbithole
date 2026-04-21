import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * Teacher Aide helpers — internal mutations invoked by the curriculum-designer
 * AI tools (defined in http.ts). These exist so teachers can do through the
 * AI chat what Andy previously did via CLI-only scripts
 * (see adminSeedNoahMorphology.ts for the original pattern).
 *
 * As of Phase 1.5, teacher-authored pedagogical instructions live in the
 * dedicated `teacherDirectives` table (see `convex/teacherDirectives.ts`).
 * The old `[Teacher-authored YYYY-MM-DD: <label>]` marker-block approach on
 * the scholar dossier has been removed.
 */

/**
 * Upsert a teacher directive for a scholar by label. Delegates to the
 * `teacherDirectives.upsertByLabel` logic — kept here as a thin wrapper so the
 * curriculum-designer HTTP action keeps a stable `internal.teacherAide.*` API.
 */
export const upsertTeacherDirective = internalMutation({
  args: {
    scholarId: v.id("users"),
    label: v.string(),
    content: v.string(),
    authorId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const label = args.label.trim();
    if (!label) {
      throw new Error("label must be a non-empty string");
    }
    const content = args.content.trim();

    const existing = await ctx.db
      .query("teacherDirectives")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
      .collect();

    const labelLower = label.toLowerCase();
    const match = existing.find((r) => r.label.toLowerCase() === labelLower);

    const now = Date.now();

    if (match) {
      await ctx.db.patch(match._id, {
        content,
        authorId: args.authorId,
        updatedAt: now,
      });
      return { action: "updated" as const, id: match._id, label: match.label };
    }

    const id = await ctx.db.insert("teacherDirectives", {
      scholarId: args.scholarId,
      label,
      content,
      authorId: args.authorId,
      isActive: true,
      updatedAt: now,
    });
    return { action: "created" as const, id, label };
  },
});

/**
 * Thin wrapper: create an active teacher-origin seed for a scholar.
 * Mirrors seeds.create (teacherMutation) but callable from an internal
 * context (the curriculum-designer HTTP action runs outside user auth).
 */
export const createScholarSeed = internalMutation({
  args: {
    scholarId: v.id("users"),
    teacherId: v.id("users"),
    topic: v.string(),
    domain: v.optional(v.string()),
    rationale: v.string(),
    approachHint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("seeds", {
      scholarId: args.scholarId,
      origin: "teacher",
      status: "active",
      topic: args.topic.trim(),
      domain: args.domain?.trim() || undefined,
      suggestionType: "teacher_suggestion",
      rationale: args.rationale.trim(),
      approachHint: args.approachHint?.trim() || undefined,
      teacherId: args.teacherId,
    });
  },
});
