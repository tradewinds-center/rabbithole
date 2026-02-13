import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

const bloomLevelValidator = v.union(
  v.literal("remember"),
  v.literal("understand"),
  v.literal("apply"),
  v.literal("analyze"),
  v.literal("evaluate"),
  v.literal("create")
);

/**
 * Save an observer analysis result.
 */
export const saveAnalysis = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    engagementScore: v.number(),
    complexityLevel: v.number(),
    onTaskScore: v.number(),
    topics: v.array(v.string()),
    learningIndicators: v.array(v.string()),
    concernFlags: v.array(v.string()),
    summary: v.string(),
    suggestedIntervention: v.optional(v.string()),
    status: v.union(v.literal("green"), v.literal("yellow"), v.literal("red")),
  },
  handler: async (ctx, args) => {
    // Save the analysis record
    await ctx.db.insert("analyses", {
      conversationId: args.conversationId,
      engagementScore: args.engagementScore,
      complexityLevel: args.complexityLevel,
      onTaskScore: args.onTaskScore,
      topics: args.topics,
      learningIndicators: args.learningIndicators,
      concernFlags: args.concernFlags,
      summary: args.summary,
      suggestedIntervention: args.suggestedIntervention,
    });

    // Update conversation status
    await ctx.db.patch(args.conversationId, {
      status: args.status,
      analysisSummary: args.summary,
    });
  },
});

/**
 * Get a conversation (for use in actions that need the userId).
 */
export const getConversation = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.conversationId);
  },
});

/**
 * Upsert a scholar topic — increment mention count if exists, create otherwise.
 */
export const upsertScholarTopic = internalMutation({
  args: {
    scholarId: v.id("users"),
    topic: v.string(),
    bloomLevel: bloomLevelValidator,
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("scholarTopics")
      .withIndex("by_scholar_and_topic", (q) =>
        q.eq("scholarId", args.scholarId).eq("topic", args.topic)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        mentionCount: existing.mentionCount + 1,
        lastConversationId: args.conversationId,
        bloomLevel: args.bloomLevel,
      });
    } else {
      await ctx.db.insert("scholarTopics", {
        scholarId: args.scholarId,
        topic: args.topic,
        bloomLevel: args.bloomLevel,
        teacherRating: 0,
        mentionCount: 1,
        lastConversationId: args.conversationId,
      });
    }
  },
});

/**
 * Update conversation's analysis summary.
 */
export const updateConversationSummary = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conversationId, {
      analysisSummary: args.summary,
    });
  },
});
