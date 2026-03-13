import { v } from "convex/values";
import { authedQuery, curriculumMutation } from "./lib/customFunctions";

export const list = authedQuery({
  args: {},
  handler: async (ctx) => {
    const canManageCurriculum =
      ctx.user.role === "teacher" || ctx.user.role === "admin" || ctx.user.role === "curriculum_designer";

    let unitList;
    if (canManageCurriculum) {
      unitList = await ctx.db.query("units").order("desc").collect();
    } else {
      unitList = await ctx.db
        .query("units")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .order("desc")
        .collect();
    }

    return Promise.all(
      unitList.map(async (u) => {
        const teacher = await ctx.db.get(u.teacherId);
        // Resolve building block names for display
        const persona = u.personaId ? await ctx.db.get(u.personaId) : null;
        const perspective = u.perspectiveId ? await ctx.db.get(u.perspectiveId) : null;
        const process = u.processId ? await ctx.db.get(u.processId) : null;
        // Count lessons
        const lessons = await ctx.db
          .query("lessons")
          .withIndex("by_unit", (q) => q.eq("unitId", u._id))
          .collect();
        return {
          ...u,
          id: u._id,
          teacherName: teacher?.name ?? null,
          personaTitle: persona?.title ?? null,
          personaEmoji: persona?.emoji ?? null,
          perspectiveTitle: perspective?.title ?? null,
          perspectiveIcon: perspective?.icon ?? null,
          processTitle: process?.title ?? null,
          processEmoji: process?.emoji ?? null,
          lessonCount: lessons.length,
          createdAt: u._creationTime,
        };
      })
    );
  },
});

export const get = authedQuery({
  args: { id: v.id("units") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = curriculumMutation({
  args: {
    title: v.string(),
    emoji: v.optional(v.string()),
    description: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    rubric: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    youtubeUrl: v.optional(v.string()),
    videoTranscript: v.optional(v.string()),
    personaId: v.optional(v.id("personas")),
    perspectiveId: v.optional(v.id("perspectives")),
    processId: v.optional(v.id("processes")),
    bigIdea: v.optional(v.string()),
    essentialQuestions: v.optional(v.array(v.string())),
    enduringUnderstandings: v.optional(v.array(v.string())),
    subject: v.optional(v.string()),
    gradeLevel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("units", {
      teacherId: ctx.user._id,
      title: args.title.trim(),
      emoji: args.emoji?.trim() || undefined,
      description: args.description?.trim() || undefined,
      systemPrompt: args.systemPrompt?.trim() || undefined,
      rubric: args.rubric?.trim() || undefined,
      durationMinutes: args.durationMinutes,
      youtubeUrl: args.youtubeUrl?.trim() || undefined,
      videoTranscript: args.videoTranscript?.trim() || undefined,
      personaId: args.personaId,
      perspectiveId: args.perspectiveId,
      processId: args.processId,
      bigIdea: args.bigIdea?.trim() || undefined,
      essentialQuestions: args.essentialQuestions,
      enduringUnderstandings: args.enduringUnderstandings,
      subject: args.subject?.trim() || undefined,
      gradeLevel: args.gradeLevel?.trim() || undefined,
      isActive: true,
    });
  },
});

export const update = curriculumMutation({
  args: {
    id: v.id("units"),
    title: v.optional(v.string()),
    emoji: v.optional(v.string()),
    description: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    rubric: v.optional(v.string()),
    durationMinutes: v.optional(v.union(v.number(), v.null())),
    youtubeUrl: v.optional(v.union(v.string(), v.null())),
    videoTranscript: v.optional(v.union(v.string(), v.null())),
    personaId: v.optional(v.union(v.id("personas"), v.null())),
    perspectiveId: v.optional(v.union(v.id("perspectives"), v.null())),
    processId: v.optional(v.union(v.id("processes"), v.null())),
    bigIdea: v.optional(v.union(v.string(), v.null())),
    essentialQuestions: v.optional(v.union(v.array(v.string()), v.null())),
    enduringUnderstandings: v.optional(v.union(v.array(v.string()), v.null())),
    subject: v.optional(v.union(v.string(), v.null())),
    gradeLevel: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const cleaned: Record<string, unknown> = {};
    if (updates.title !== undefined) cleaned.title = updates.title.trim();
    if (updates.emoji !== undefined)
      cleaned.emoji = updates.emoji.trim() || undefined;
    if (updates.description !== undefined)
      cleaned.description = updates.description.trim() || undefined;
    if (updates.systemPrompt !== undefined)
      cleaned.systemPrompt = updates.systemPrompt.trim() || undefined;
    if (updates.rubric !== undefined)
      cleaned.rubric = updates.rubric.trim() || undefined;
    if (updates.durationMinutes !== undefined)
      cleaned.durationMinutes = updates.durationMinutes ?? undefined;
    if (updates.youtubeUrl !== undefined)
      cleaned.youtubeUrl = updates.youtubeUrl?.trim() || undefined;
    if (updates.videoTranscript !== undefined)
      cleaned.videoTranscript = updates.videoTranscript?.trim() || undefined;
    if (updates.personaId !== undefined)
      cleaned.personaId = updates.personaId ?? undefined;
    if (updates.perspectiveId !== undefined)
      cleaned.perspectiveId = updates.perspectiveId ?? undefined;
    if (updates.processId !== undefined)
      cleaned.processId = updates.processId ?? undefined;
    if (updates.bigIdea !== undefined)
      cleaned.bigIdea = updates.bigIdea?.trim() || undefined;
    if (updates.essentialQuestions !== undefined)
      cleaned.essentialQuestions = updates.essentialQuestions ?? undefined;
    if (updates.enduringUnderstandings !== undefined)
      cleaned.enduringUnderstandings = updates.enduringUnderstandings ?? undefined;
    if (updates.subject !== undefined)
      cleaned.subject = updates.subject?.trim() || undefined;
    if (updates.gradeLevel !== undefined)
      cleaned.gradeLevel = updates.gradeLevel?.trim() || undefined;

    await ctx.db.patch(id, cleaned);
  },
});

export const deactivate = curriculumMutation({
  args: { id: v.id("units") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isActive: false });
  },
});
