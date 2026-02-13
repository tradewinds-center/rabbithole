import { v } from "convex/values";
import { authedQuery, teacherMutation } from "./lib/customFunctions";

/**
 * List all personas. Scholars see only active; teachers see all.
 */
export const list = authedQuery({
  args: {},
  handler: async (ctx) => {
    const isTeacher =
      ctx.user.role === "teacher" || ctx.user.role === "admin";

    let personaList;
    if (isTeacher) {
      personaList = await ctx.db.query("personas").order("desc").collect();
    } else {
      personaList = await ctx.db
        .query("personas")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .order("desc")
        .collect();
    }

    // Enrich with teacher name
    return Promise.all(
      personaList.map(async (p) => {
        const teacher = await ctx.db.get(p.teacherId);
        return {
          ...p,
          id: p._id,
          teacherName: teacher?.name ?? null,
          createdAt: p._creationTime,
        };
      })
    );
  },
});

/**
 * Get a single persona.
 */
export const get = authedQuery({
  args: { id: v.id("personas") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Create a new persona (teachers only).
 */
export const create = teacherMutation({
  args: {
    title: v.string(),
    emoji: v.string(),
    description: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("personas", {
      teacherId: ctx.user._id,
      title: args.title.trim(),
      emoji: args.emoji.trim(),
      description: args.description?.trim() || undefined,
      systemPrompt: args.systemPrompt?.trim() || undefined,
      isActive: true,
    });
  },
});

/**
 * Update a persona (teachers only).
 */
export const update = teacherMutation({
  args: {
    id: v.id("personas"),
    title: v.optional(v.string()),
    emoji: v.optional(v.string()),
    description: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const cleaned: Record<string, string | undefined> = {};
    if (updates.title !== undefined) cleaned.title = updates.title.trim();
    if (updates.emoji !== undefined) cleaned.emoji = updates.emoji.trim();
    if (updates.description !== undefined)
      cleaned.description = updates.description.trim() || undefined;
    if (updates.systemPrompt !== undefined)
      cleaned.systemPrompt = updates.systemPrompt.trim() || undefined;

    await ctx.db.patch(id, cleaned);
  },
});

/**
 * Deactivate (soft-delete) a persona.
 */
export const deactivate = teacherMutation({
  args: { id: v.id("personas") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isActive: false });
  },
});
