import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { authedQuery } from "./lib/customFunctions";

/**
 * Record a session signal (called by the observer action).
 */
export const record = internalMutation({
  args: {
    scholarId: v.id("users"),
    projectId: v.id("projects"),
    signalType: v.string(),
    description: v.string(),
    intensity: v.string(),
    transcriptExcerpt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sessionSignals", args);
  },
});

/**
 * Get recent signals for a scholar (used by observer for context).
 */
export const recentByScholar = internalQuery({
  args: { scholarId: v.id("users"), limit: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessionSignals")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
      .order("desc")
      .take(args.limit);
  },
});

/**
 * Learner profile: aggregate signals by type for a scholar.
 */
export const signalProfile = authedQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const isTeacher = ctx.user.role === "teacher" || ctx.user.role === "admin";
    if (!isTeacher && ctx.user._id !== args.scholarId) throw new Error("Forbidden");

    const signals = await ctx.db
      .query("sessionSignals")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
      .collect();

    const byType: Record<
      string,
      { count: number; highCount: number; recent: typeof signals[0] | null }
    > = {};
    for (const s of signals) {
      if (!byType[s.signalType]) {
        byType[s.signalType] = { count: 0, highCount: 0, recent: null };
      }
      byType[s.signalType].count++;
      if (s.intensity === "high") byType[s.signalType].highCount++;
      if (
        !byType[s.signalType].recent ||
        s._creationTime > byType[s.signalType].recent!._creationTime
      ) {
        byType[s.signalType].recent = s;
      }
    }
    return byType;
  },
});
