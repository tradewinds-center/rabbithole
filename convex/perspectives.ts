import { v } from "convex/values";
import { authedQuery, curriculumMutation } from "./lib/customFunctions";

export const list = authedQuery({
  args: {},
  handler: async (ctx) => {
    const canManageCurriculum =
      ctx.user.role === "teacher" || ctx.user.role === "admin" || ctx.user.role === "curriculum_designer";

    let perspectiveList;
    if (canManageCurriculum) {
      perspectiveList = await ctx.db
        .query("perspectives")
        .order("desc")
        .collect();
    } else {
      perspectiveList = await ctx.db
        .query("perspectives")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .order("desc")
        .collect();
    }

    return Promise.all(
      perspectiveList.map(async (p) => {
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
  args: { id: v.id("perspectives") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = curriculumMutation({
  args: {
    title: v.string(),
    icon: v.optional(v.string()),
    description: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("perspectives", {
      teacherId: ctx.user._id,
      title: args.title.trim(),
      icon: args.icon?.trim() || undefined,
      description: args.description?.trim() || undefined,
      systemPrompt: args.systemPrompt?.trim() || undefined,
      isActive: true,
    });
  },
});

export const update = curriculumMutation({
  args: {
    id: v.id("perspectives"),
    title: v.optional(v.string()),
    icon: v.optional(v.string()),
    description: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const cleaned: Record<string, string | undefined> = {};
    if (updates.title !== undefined) cleaned.title = updates.title.trim();
    if (updates.icon !== undefined)
      cleaned.icon = updates.icon.trim() || undefined;
    if (updates.description !== undefined)
      cleaned.description = updates.description.trim() || undefined;
    if (updates.systemPrompt !== undefined)
      cleaned.systemPrompt = updates.systemPrompt.trim() || undefined;

    await ctx.db.patch(id, cleaned);
  },
});

export const deactivate = curriculumMutation({
  args: { id: v.id("perspectives") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isActive: false });
  },
});
