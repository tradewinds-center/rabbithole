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
    projectId: v.id("projects"),
    engagementScore: v.number(),
    complexityLevel: v.number(),
    onTaskScore: v.number(),
    topics: v.array(v.string()),
    learningIndicators: v.array(v.string()),
    concernFlags: v.array(v.string()),
    summary: v.string(),
    suggestedIntervention: v.optional(v.string()),
    status: v.union(v.literal("green"), v.literal("yellow"), v.literal("red")),
    progressScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Save the analysis record
    await ctx.db.insert("analyses", {
      projectId: args.projectId,
      engagementScore: args.engagementScore,
      complexityLevel: args.complexityLevel,
      onTaskScore: args.onTaskScore,
      topics: args.topics,
      learningIndicators: args.learningIndicators,
      concernFlags: args.concernFlags,
      summary: args.summary,
      suggestedIntervention: args.suggestedIntervention,
    });

    // Update project status + progress score
    await ctx.db.patch(args.projectId, {
      status: args.status,
      analysisSummary: args.summary,
      progressScore: args.progressScore,
    });
  },
});

/**
 * Get a project (for use in actions that need the userId).
 */
export const getProject = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.projectId);
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
    projectId: v.id("projects"),
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
        lastProjectId: args.projectId,
        bloomLevel: args.bloomLevel,
      });
    } else {
      await ctx.db.insert("scholarTopics", {
        scholarId: args.scholarId,
        topic: args.topic,
        bloomLevel: args.bloomLevel,
        teacherRating: 0,
        mentionCount: 1,
        lastProjectId: args.projectId,
      });
    }
  },
});

/**
 * Update project's analysis summary.
 */
export const updateProjectSummary = internalMutation({
  args: {
    projectId: v.id("projects"),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, {
      analysisSummary: args.summary,
    });
  },
});
