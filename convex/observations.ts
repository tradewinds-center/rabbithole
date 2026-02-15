import { v } from "convex/values";
import { teacherQuery, teacherMutation } from "./lib/customFunctions";

const observationTypeValidator = v.union(
  v.literal("praise"),
  v.literal("concern"),
  v.literal("suggestion"),
  v.literal("intervention")
);

/**
 * List observations for a scholar.
 */
export const listByScholar = teacherQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("observations")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
      .order("desc")
      .collect();
  },
});

/**
 * List observations for a project.
 */
export const listByProject = teacherQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("observations")
      .withIndex("by_project", (q) =>
        q.eq("projectId", args.projectId)
      )
      .order("desc")
      .collect();
  },
});

/**
 * Add an observation.
 */
export const add = teacherMutation({
  args: {
    scholarId: v.id("users"),
    projectId: v.optional(v.id("projects")),
    note: v.string(),
    type: observationTypeValidator,
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("observations", {
      teacherId: ctx.user._id,
      scholarId: args.scholarId,
      projectId: args.projectId,
      note: args.note.trim(),
      type: args.type,
    });
    return await ctx.db.get(id);
  },
});

/**
 * Delete an observation.
 */
export const remove = teacherMutation({
  args: { observationId: v.id("observations") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.observationId);
  },
});
