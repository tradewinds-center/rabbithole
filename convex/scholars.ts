import { v } from "convex/values";
import { teacherQuery, teacherMutation } from "./lib/customFunctions";
import { internalQuery, internalMutation } from "./_generated/server";

const VALID_READING_LEVELS = [
  "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "college",
];

/**
 * Get a scholar's profile with stats.
 * Topics and suggestions have been replaced by masteryObservations and seeds.
 */
export const getProfile = teacherQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const scholar = await ctx.db.get(args.scholarId);
    if (!scholar || scholar.role !== "scholar") {
      throw new Error("Scholar not found");
    }

    // Get project stats
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", args.scholarId))
      .collect();

    let messageCount = 0;
    for (const proj of projects) {
      const msgs = await ctx.db
        .query("messages")
        .withIndex("by_project", (q) =>
          q.eq("projectId", proj._id)
        )
        .collect();
      messageCount += msgs.length;
    }

    // Count mastery observations (replaces topicCount)
    const observations = await ctx.db
      .query("masteryObservations")
      .withIndex("by_scholar_current", (q) =>
        q.eq("scholarId", args.scholarId).eq("isSuperseded", false)
      )
      .collect();

    return {
      scholar: {
        id: scholar._id,
        email: scholar.email,
        name: scholar.name,
        image: scholar.image,
        readingLevel: scholar.readingLevel ?? null,
        readingLevelSuggestion: scholar.readingLevelSuggestion ?? null,
        guestToken: scholar.guestToken ?? null,
        createdAt: scholar._creationTime,
      },
      stats: {
        projectCount: projects.length,
        messageCount,
        observationCount: observations.length,
      },
    };
  },
});

/**
 * Update a scholar's reading level (teachers only).
 */
export const updateReadingLevel = teacherMutation({
  args: {
    scholarId: v.id("users"),
    readingLevel: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    if (
      args.readingLevel !== null &&
      !VALID_READING_LEVELS.includes(args.readingLevel)
    ) {
      throw new Error("Invalid reading level");
    }

    const scholar = await ctx.db.get(args.scholarId);
    if (!scholar || scholar.role !== "scholar") {
      throw new Error("Scholar not found");
    }

    await ctx.db.patch(args.scholarId, {
      readingLevel: args.readingLevel ?? undefined,
      // Clear suggestion when teacher explicitly sets level
      readingLevelSuggestion: undefined,
    });
  },
});

/**
 * Internal query to get a scholar's user record (for observer).
 */
export const getInternal = internalQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.scholarId);
  },
});

/**
 * Internal mutation to set reading level suggestion from observer.
 */
export const setReadingLevelSuggestion = internalMutation({
  args: {
    scholarId: v.id("users"),
    suggestion: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scholarId, {
      readingLevelSuggestion: args.suggestion,
    });
  },
});

/**
 * Teacher accepts reading level suggestion — sets readingLevel and clears suggestion.
 */
export const acceptReadingLevelSuggestion = teacherMutation({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const scholar = await ctx.db.get(args.scholarId);
    if (!scholar || !scholar.readingLevelSuggestion) return;
    await ctx.db.patch(args.scholarId, {
      readingLevel: scholar.readingLevelSuggestion,
      readingLevelSuggestion: undefined,
    });
  },
});

/**
 * Teacher dismisses reading level suggestion.
 */
export const dismissReadingLevelSuggestion = teacherMutation({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scholarId, {
      readingLevelSuggestion: undefined,
    });
  },
});
