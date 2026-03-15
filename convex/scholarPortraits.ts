import { v } from "convex/values";
import { authedQuery } from "./lib/customFunctions";
import { internalQuery, internalMutation } from "./_generated/server";

/**
 * Get portrait for current user or by scholarId (teachers).
 */
export const getForScholar = authedQuery({
  args: {
    scholarId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const isTeacher = ctx.user.role === "teacher" || ctx.user.role === "admin";
    const targetId = isTeacher && args.scholarId ? args.scholarId : ctx.user._id;

    return await ctx.db
      .query("scholarPortraits")
      .withIndex("by_scholar", (q) => q.eq("scholarId", targetId))
      .first();
  },
});

/**
 * Internal query for system prompt injection.
 */
export const getPortraitInternal = internalQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("scholarPortraits")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
      .first();
  },
});

/**
 * Create or update portrait.
 */
export const upsertPortrait = internalMutation({
  args: {
    scholarId: v.id("users"),
    dimensions: v.optional(v.array(v.object({
      name: v.string(),
      score: v.number(),
    }))),
    status: v.optional(v.string()),
    statusDetailed: v.optional(v.string()),
    contextDigest: v.optional(v.string()),
    icebreakers: v.optional(v.array(v.string())),
    completeness: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("scholarPortraits")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
      .first();

    const data = {
      dimensions: args.dimensions,
      status: args.status,
      statusDetailed: args.statusDetailed,
      contextDigest: args.contextDigest,
      icebreakers: args.icebreakers,
      completeness: args.completeness,
      lastAssessed: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    } else {
      return await ctx.db.insert("scholarPortraits", {
        scholarId: args.scholarId,
        ...data,
      });
    }
  },
});
