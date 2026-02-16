import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { teacherQuery } from "./lib/customFunctions";

/**
 * Record a cross-domain connection (called by the observer action).
 */
export const record = internalMutation({
  args: {
    scholarId: v.id("users"),
    projectId: v.id("projects"),
    domains: v.array(v.string()),
    conceptLabels: v.array(v.string()),
    description: v.string(),
    studentInitiated: v.boolean(),
    transcriptExcerpt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.domains.length < 2) return null;

    return await ctx.db.insert("crossDomainConnections", {
      scholarId: args.scholarId,
      projectId: args.projectId,
      domains: args.domains,
      conceptLabels: args.conceptLabels,
      description: args.description,
      studentInitiated: args.studentInitiated,
      transcriptExcerpt: args.transcriptExcerpt,
    });
  },
});

/**
 * List all cross-domain connections for a scholar.
 */
export const listByScholar = teacherQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("crossDomainConnections")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
      .order("desc")
      .collect();
  },
});
