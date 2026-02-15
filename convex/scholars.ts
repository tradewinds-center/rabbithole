import { v } from "convex/values";
import { teacherQuery, teacherMutation } from "./lib/customFunctions";

const bloomLevelValidator = v.union(
  v.literal("remember"),
  v.literal("understand"),
  v.literal("apply"),
  v.literal("analyze"),
  v.literal("evaluate"),
  v.literal("create")
);

const VALID_READING_LEVELS = [
  "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "college",
];

/**
 * Get a scholar's full profile with topics, suggestions, and stats.
 */
export const getProfile = teacherQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const scholar = await ctx.db.get(args.scholarId);
    if (!scholar || scholar.role !== "scholar") {
      throw new Error("Scholar not found");
    }

    // Get topics
    const topics = await ctx.db
      .query("scholarTopics")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
      .collect();

    // Sort by mention count descending
    topics.sort((a, b) => b.mentionCount - a.mentionCount);

    // Get suggestions
    const suggestions = await ctx.db
      .query("suggestedTopics")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
      .order("desc")
      .collect();

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

    return {
      scholar: {
        id: scholar._id,
        email: scholar.email,
        name: scholar.name,
        image: scholar.image,
        readingLevel: scholar.readingLevel ?? null,
        createdAt: scholar._creationTime,
      },
      topics: topics.map((t) => ({
        id: t._id,
        topic: t.topic,
        bloomLevel: t.bloomLevel,
        teacherRating: t.teacherRating,
        mentionCount: t.mentionCount,
      })),
      suggestions: suggestions.map((s) => ({
        id: s._id,
        topic: s.topic,
        rationale: s.rationale ?? null,
        targetBloomLevel: s.targetBloomLevel ?? null,
        explored: s.explored,
      })),
      stats: {
        projectCount: projects.length,
        messageCount,
        topicCount: topics.length,
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
    });
  },
});

/**
 * Rate a scholar topic (teachers only).
 */
export const rateTopic = teacherMutation({
  args: {
    topicId: v.id("scholarTopics"),
    rating: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.topicId, {
      teacherRating: args.rating,
    });
  },
});

/**
 * Add a suggested topic for a scholar (teachers only).
 */
export const addSuggestion = teacherMutation({
  args: {
    scholarId: v.id("users"),
    topic: v.string(),
    rationale: v.optional(v.string()),
    targetBloomLevel: v.optional(bloomLevelValidator),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("suggestedTopics", {
      scholarId: args.scholarId,
      teacherId: ctx.user._id,
      topic: args.topic.trim(),
      rationale: args.rationale?.trim() || undefined,
      targetBloomLevel: args.targetBloomLevel || undefined,
      explored: false,
    });

    return await ctx.db.get(id);
  },
});

/**
 * Remove a suggested topic (teachers only).
 */
export const removeSuggestion = teacherMutation({
  args: { suggestionId: v.id("suggestedTopics") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.suggestionId);
  },
});
