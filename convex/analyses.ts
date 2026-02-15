import { v } from "convex/values";
import { teacherQuery } from "./lib/customFunctions";

/**
 * Get analysis history for a project (most recent first).
 */
export const getHistory = teacherQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("analyses")
      .withIndex("by_project", (q) =>
        q.eq("projectId", args.projectId)
      )
      .order("desc")
      .collect();
  },
});

/**
 * Get the most recent analysis for a project.
 */
export const getLatest = teacherQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("analyses")
      .withIndex("by_project", (q) =>
        q.eq("projectId", args.projectId)
      )
      .order("desc")
      .first();
  },
});
