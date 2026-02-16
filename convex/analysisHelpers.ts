import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

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
    pulseScore: v.optional(v.number()),
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

    // Update project pulse score
    await ctx.db.patch(args.projectId, {
      analysisSummary: args.summary,
      pulseScore: args.pulseScore,
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
