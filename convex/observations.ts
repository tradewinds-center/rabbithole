import { v } from "convex/values";
import { authedQuery, authedMutation, teacherQuery, teacherMutation } from "./lib/customFunctions";
import { ROLES } from "./lib/roles";

const observationTypeValidator = v.union(
  v.literal("praise"),
  v.literal("concern"),
  v.literal("suggestion"),
  v.literal("intervention")
);

/**
 * List observations for a scholar.
 */
export const listByScholar = authedQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const isTeacher = ctx.user.role === ROLES.TEACHER || ctx.user.role === ROLES.ADMIN;
    if (!isTeacher && ctx.user._id !== args.scholarId) throw new Error("Forbidden");

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
export const add = authedMutation({
  args: {
    scholarId: v.id("users"),
    projectId: v.optional(v.id("projects")),
    note: v.string(),
    type: observationTypeValidator,
  },
  handler: async (ctx, args) => {
    const isTeacher = ctx.user.role === ROLES.TEACHER || ctx.user.role === ROLES.ADMIN;
    if (!isTeacher && ctx.user._id !== args.scholarId) throw new Error("Forbidden");

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
export const remove = authedMutation({
  args: { observationId: v.id("observations") },
  handler: async (ctx, args) => {
    const isTeacher = ctx.user.role === ROLES.TEACHER || ctx.user.role === ROLES.ADMIN;
    if (!isTeacher) {
      const obs = await ctx.db.get(args.observationId);
      if (!obs || obs.scholarId !== ctx.user._id) throw new Error("Forbidden");
    }
    await ctx.db.delete(args.observationId);
  },
});
