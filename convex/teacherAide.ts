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

/**
 * Create a scholar-scoped unit. `scholarId` identifies which scholar this unit
 * belongs to; `authorId` is the teacher/admin who authored it.
 *
 * Idempotent by (scholarId, title) — case-insensitive. If a unit with the same
 * title already exists for this scholar, returns the existing unitId with
 * `existed: true` instead of creating a duplicate.
 */
export const createScholarUnit = internalMutation({
  args: {
    scholarId: v.id("users"),
    authorId: v.id("users"),
    title: v.string(),
    emoji: v.optional(v.string()),
    description: v.optional(v.string()),
    bigIdea: v.optional(v.string()),
    essentialQuestions: v.optional(v.array(v.string())),
    enduringUnderstandings: v.optional(v.array(v.string())),
    subject: v.optional(v.string()),
    gradeLevel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const title = args.title.trim();
    if (!title) throw new Error("title must be a non-empty string");

    // Idempotency: look for an existing unit for this scholar with the same
    // (case-insensitive) title.
    const existingForScholar = await ctx.db
      .query("units")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
      .collect();
    const titleLower = title.toLowerCase();
    const match = existingForScholar.find(
      (u) => u.title.trim().toLowerCase() === titleLower
    );
    if (match) {
      return { unitId: match._id, existed: true as const };
    }

    const unitId = await ctx.db.insert("units", {
      teacherId: args.authorId,
      scholarId: args.scholarId,
      title,
      emoji: args.emoji?.trim() || undefined,
      description: args.description?.trim() || undefined,
      bigIdea: args.bigIdea?.trim() || undefined,
      essentialQuestions: args.essentialQuestions,
      enduringUnderstandings: args.enduringUnderstandings,
      subject: args.subject?.trim() || undefined,
      gradeLevel: args.gradeLevel?.trim() || undefined,
      isActive: true,
    });
    return { unitId, existed: false as const };
  },
});

/**
 * Create a lesson under a given unit. Computes the next order slot.
 *
 * Idempotent by (unitId, title) — case-insensitive. If a lesson with the same
 * title already exists under this unit, returns the existing lessonId with
 * `existed: true` instead of creating a duplicate.
 */
export const createScholarLesson = internalMutation({
  args: {
    unitId: v.id("units"),
    title: v.string(),
    strand: v.optional(
      v.union(
        v.literal("core"),
        v.literal("connections"),
        v.literal("practice"),
        v.literal("identity")
      )
    ),
    systemPrompt: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const title = args.title.trim();
    if (!title) throw new Error("title must be a non-empty string");

    const existing = await ctx.db
      .query("lessons")
      .withIndex("by_unit", (q) => q.eq("unitId", args.unitId))
      .collect();

    const titleLower = title.toLowerCase();
    const match = existing.find(
      (l) => l.title.trim().toLowerCase() === titleLower
    );
    if (match) {
      return { lessonId: match._id, existed: true as const };
    }

    const maxOrder = existing.reduce((max, l) => Math.max(max, l.order), -1);
    const lessonId = await ctx.db.insert("lessons", {
      unitId: args.unitId,
      title,
      strand: args.strand,
      systemPrompt: args.systemPrompt?.trim() || undefined,
      order: maxOrder + 1,
      durationMinutes: args.durationMinutes,
    });
    return { lessonId, existed: false as const };
  },
});
