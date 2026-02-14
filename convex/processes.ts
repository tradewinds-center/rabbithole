import { v } from "convex/values";
import { authedQuery, teacherMutation } from "./lib/customFunctions";

const stepValidator = v.object({
  key: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
});

/**
 * List all processes. Scholars see only active; teachers see all.
 */
export const list = authedQuery({
  args: {},
  handler: async (ctx) => {
    const isTeacher =
      ctx.user.role === "teacher" || ctx.user.role === "admin";

    let processList;
    if (isTeacher) {
      processList = await ctx.db.query("processes").order("desc").collect();
    } else {
      processList = await ctx.db
        .query("processes")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .order("desc")
        .collect();
    }

    return Promise.all(
      processList.map(async (p) => {
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
 * Get a single process.
 */
export const get = authedQuery({
  args: { id: v.id("processes") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Create a new process (teachers only).
 */
export const create = teacherMutation({
  args: {
    title: v.string(),
    emoji: v.optional(v.string()),
    description: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    steps: v.array(stepValidator),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("processes", {
      teacherId: ctx.user._id,
      title: args.title.trim(),
      emoji: args.emoji?.trim() || undefined,
      description: args.description?.trim() || undefined,
      systemPrompt: args.systemPrompt?.trim() || undefined,
      steps: args.steps,
      isActive: true,
    });
  },
});

/**
 * Update a process (teachers only).
 */
export const update = teacherMutation({
  args: {
    id: v.id("processes"),
    title: v.optional(v.string()),
    emoji: v.optional(v.string()),
    description: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    steps: v.optional(v.array(stepValidator)),
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
    if (updates.steps !== undefined) cleaned.steps = updates.steps;

    await ctx.db.patch(id, cleaned);
  },
});

/**
 * Deactivate (soft-delete) a process.
 */
export const deactivate = teacherMutation({
  args: { id: v.id("processes") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isActive: false });
  },
});
