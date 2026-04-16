import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { authedQuery } from "./lib/customFunctions";
import { ROLES } from "./lib/roles";

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
export const listByScholar = authedQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const isTeacher = ctx.user.role === ROLES.TEACHER || ctx.user.role === ROLES.ADMIN;
    if (!isTeacher && ctx.user._id !== args.scholarId) throw new Error("Forbidden");

    return await ctx.db
      .query("crossDomainConnections")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
      .order("desc")
      .collect();
  },
});
