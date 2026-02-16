import { v } from "convex/values";
import { teacherMutation } from "./lib/customFunctions";

/**
 * Teacher overrides a specific observation's mastery level.
 * Points at an observation, not a standard or concept.
 * "I disagree with THIS assessment."
 */
export const setOverride = teacherMutation({
  args: {
    observationId: v.id("masteryObservations"),
    masteryLevel: v.number(),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const observation = await ctx.db.get(args.observationId);
    if (!observation) throw new Error("Observation not found");

    // Remove existing override for this observation if any
    const existing = await ctx.db
      .query("teacherMasteryOverrides")
      .withIndex("by_observation", (q) =>
        q.eq("observationId", args.observationId)
      )
      .first();
    if (existing) await ctx.db.delete(existing._id);

    return await ctx.db.insert("teacherMasteryOverrides", {
      scholarId: observation.scholarId,
      observationId: args.observationId,
      teacherId: ctx.user._id,
      masteryLevel: args.masteryLevel,
      notes: args.notes,
    });
  },
});

export const removeOverride = teacherMutation({
  args: { observationId: v.id("masteryObservations") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("teacherMasteryOverrides")
      .withIndex("by_observation", (q) =>
        q.eq("observationId", args.observationId)
      )
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});
