import { v } from "convex/values";
import { authedQuery, teacherMutation } from "./lib/customFunctions";

const bloomLevelValidator = v.union(
  v.literal("remember"),
  v.literal("understand"),
  v.literal("apply"),
  v.literal("analyze"),
  v.literal("evaluate"),
  v.literal("create")
);

export const list = authedQuery({
  args: {},
  handler: async (ctx) => {
    const isTeacher =
      ctx.user.role === "teacher" || ctx.user.role === "admin";

    let projectList;
    if (isTeacher) {
      projectList = await ctx.db.query("projects").order("desc").collect();
    } else {
      projectList = await ctx.db
        .query("projects")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .order("desc")
        .collect();
    }

    return Promise.all(
      projectList.map(async (p) => {
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

export const get = authedQuery({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = teacherMutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    rubric: v.optional(v.string()),
    targetBloomLevel: v.optional(bloomLevelValidator),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("projects", {
      teacherId: ctx.user._id,
      title: args.title.trim(),
      description: args.description?.trim() || undefined,
      systemPrompt: args.systemPrompt?.trim() || undefined,
      rubric: args.rubric?.trim() || undefined,
      targetBloomLevel: args.targetBloomLevel || undefined,
      isActive: true,
    });
  },
});

export const update = teacherMutation({
  args: {
    id: v.id("projects"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    rubric: v.optional(v.string()),
    targetBloomLevel: v.optional(bloomLevelValidator),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const cleaned: Record<string, unknown> = {};
    if (updates.title !== undefined) cleaned.title = updates.title.trim();
    if (updates.description !== undefined)
      cleaned.description = updates.description.trim() || undefined;
    if (updates.systemPrompt !== undefined)
      cleaned.systemPrompt = updates.systemPrompt.trim() || undefined;
    if (updates.rubric !== undefined)
      cleaned.rubric = updates.rubric.trim() || undefined;
    if (updates.targetBloomLevel !== undefined)
      cleaned.targetBloomLevel = updates.targetBloomLevel || undefined;

    await ctx.db.patch(id, cleaned);
  },
});

export const deactivate = teacherMutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isActive: false });
  },
});
