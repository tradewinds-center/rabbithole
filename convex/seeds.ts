import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { authedQuery, authedMutation, teacherMutation } from "./lib/customFunctions";
import { ROLES } from "./lib/roles";

/**
 * Record a seed from the AI observer (status: "pending", awaits teacher review).
 * Deduplicates: if a pending seed for the same scholar+topic exists, update it.
 */
export const record = internalMutation({
  args: {
    scholarId: v.id("users"),
    projectId: v.id("projects"),
    topic: v.string(),
    domain: v.optional(v.string()),
    suggestionType: v.string(),
    rationale: v.string(),
    approachHint: v.optional(v.string()),
    connectionTo: v.optional(v.string()),
    currentBloomsLevel: v.optional(v.number()),
    targetBloomsLevel: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Deduplicate: check for existing pending seed with same topic
    const existing = await ctx.db
      .query("seeds")
      .withIndex("by_scholar_status", (q) =>
        q.eq("scholarId", args.scholarId).eq("status", "pending")
      )
      .filter((q) => q.eq(q.field("topic"), args.topic))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        rationale: args.rationale,
        projectId: args.projectId,
        approachHint: args.approachHint,
        connectionTo: args.connectionTo,
        currentBloomsLevel: args.currentBloomsLevel,
        targetBloomsLevel: args.targetBloomsLevel,
      });
      return existing._id;
    }

    return await ctx.db.insert("seeds", {
      scholarId: args.scholarId,
      origin: "ai",
      status: "pending",
      topic: args.topic,
      domain: args.domain,
      suggestionType: args.suggestionType,
      rationale: args.rationale,
      approachHint: args.approachHint,
      connectionTo: args.connectionTo,
      projectId: args.projectId,
      currentBloomsLevel: args.currentBloomsLevel,
      targetBloomsLevel: args.targetBloomsLevel,
    });
  },
});

/**
 * Get active seeds for a scholar (used by observer for context).
 */
export const activeByScholar = internalQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("seeds")
      .withIndex("by_scholar_status", (q) =>
        q.eq("scholarId", args.scholarId).eq("status", "active")
      )
      .collect();
  },
});

/**
 * Teacher reviews a pending AI seed: accept or dismiss.
 */
export const review = teacherMutation({
  args: {
    id: v.id("seeds"),
    action: v.union(v.literal("accept"), v.literal("dismiss")),
    dismissedReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.action === "accept") {
      await ctx.db.patch(args.id, {
        status: "active",
        teacherId: ctx.user._id,
      });
    } else {
      await ctx.db.patch(args.id, {
        status: "dismissed",
        dismissedReason: args.dismissedReason,
        teacherId: ctx.user._id,
      });
    }
  },
});

/**
 * Teacher creates a seed directly (goes straight to "active").
 */
export const create = teacherMutation({
  args: {
    scholarId: v.id("users"),
    topic: v.string(),
    domain: v.optional(v.string()),
    rationale: v.string(),
    approachHint: v.optional(v.string()),
    targetBloomsLevel: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("seeds", {
      scholarId: args.scholarId,
      origin: "teacher",
      status: "active",
      topic: args.topic,
      domain: args.domain,
      suggestionType: "teacher_suggestion",
      rationale: args.rationale,
      approachHint: args.approachHint,
      teacherId: ctx.user._id,
      targetBloomsLevel: args.targetBloomsLevel,
    });
  },
});

/**
 * Mark a seed as introduced or dismissed.
 */
export const updateStatus = teacherMutation({
  args: {
    id: v.id("seeds"),
    status: v.string(),
    dismissedReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      dismissedReason: args.dismissedReason,
    });
  },
});

/**
 * Scholar-facing: active seeds for the current user (max 6).
 */
export const activeForSelf = authedQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("seeds")
      .withIndex("by_scholar_status", (q) =>
        q.eq("scholarId", ctx.user._id).eq("status", "active")
      )
      .order("desc")
      .take(6);
  },
});

/**
 * Teacher-facing: all seeds for a scholar.
 */
export const listByScholar = authedQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const isTeacher = ctx.user.role === ROLES.TEACHER || ctx.user.role === ROLES.ADMIN;
    if (!isTeacher && ctx.user._id !== args.scholarId) throw new Error("Forbidden");

    return await ctx.db
      .query("seeds")
      .withIndex("by_scholar_status", (q) =>
        q.eq("scholarId", args.scholarId)
      )
      .order("desc")
      .collect();
  },
});
