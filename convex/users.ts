import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { authedQuery, teacherQuery, teacherMutation, adminMutation } from "./lib/customFunctions";
import { roleFromEmail, getCurrentUser } from "./lib/auth";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Get the current authenticated user document.
 */
export const currentUser = query({
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

/**
 * Store / update user on login.
 * Called after successful auth — creates user if new, updates if existing.
 */
export const storeUser = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db.get(userId);
    if (existing) {
      // Update existing user
      await ctx.db.patch(userId, {
        name: args.name,
        image: args.image,
      });
      return userId;
    }

    // This shouldn't happen with @convex-dev/auth (it creates the user),
    // but in case we need to set role after creation:
    const role = roleFromEmail(args.email);
    await ctx.db.patch(userId, {
      email: args.email,
      name: args.name,
      image: args.image,
      role,
    });
    return userId;
  },
});

/**
 * List all scholars (for teacher dashboard).
 * Returns scholars with project counts and status.
 */
export const listScholars = teacherQuery({
  args: {},
  handler: async (ctx) => {
    const scholars = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "scholar"))
      .collect();

    const scholarData = await Promise.all(
      scholars.map(async (scholar) => {
        // Get projects (most recent 5, non-archived)
        const allProjects = await ctx.db
          .query("projects")
          .withIndex("by_user", (q) => q.eq("userId", scholar._id))
          .order("desc")
          .collect();

        const activeProjects = allProjects.filter((c) => !c.isArchived).slice(0, 5);

        // Count messages across all projects
        let messageCount = 0;
        for (const proj of allProjects) {
          const msgs = await ctx.db
            .query("messages")
            .withIndex("by_project", (q) =>
              q.eq("projectId", proj._id)
            )
            .collect();
          messageCount += msgs.length;
        }

        // Get status summary, pulse score, last message, and lastMessageAt from most recent project
        const mostRecent = activeProjects[0];
        const statusSummary = mostRecent?.analysisSummary ?? null;
        const pulseScore = mostRecent?.pulseScore ?? null;
        let lastMessage: string | null = null;
        let lastMessageAt: number | null = null;
        if (mostRecent) {
          const msgs = await ctx.db
            .query("messages")
            .withIndex("by_project", (q) =>
              q.eq("projectId", mostRecent._id)
            )
            .order("desc")
            .collect();
          const lastUserMsg = msgs.find((m) => m.role === "user");
          if (lastUserMsg) {
            const text = lastUserMsg.content;
            lastMessage = text.length > 120 ? text.slice(0, 120) + "..." : text;
            lastMessageAt = lastUserMsg._creationTime;
          }
        }

        // Get process state from most recent project
        let processStep: string | null = null;
        let processTitle: string | null = null;
        if (mostRecent?.processId) {
          const pState = await ctx.db
            .query("processState")
            .withIndex("by_project", (q) =>
              q.eq("projectId", mostRecent._id)
            )
            .first();
          if (pState) {
            processStep = pState.currentStep;
            const process = await ctx.db.get(mostRecent.processId);
            processTitle = process?.title ?? null;
          }
        }

        return {
          _id: scholar._id,
          id: scholar._id,
          email: scholar.email,
          name: scholar.name,
          image: scholar.image,
          projectCount: activeProjects.length,
          messageCount,
          lastActive: mostRecent?._creationTime ?? scholar._creationTime,
          statusSummary,
          pulseScore,
          lastMessage,
          lastMessageAt,
          lastProjectTitle: mostRecent?.title ?? null,
          processStep,
          processTitle,
        };
      })
    );

    // Sort by name
    scholarData.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    return scholarData;
  },
});

/**
 * Get a single user by ID.
 */
export const getUser = authedQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * Update user role (admin only).
 */
export const updateRole = adminMutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("scholar"),
      v.literal("teacher"),
      v.literal("admin")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { role: args.role });
  },
});

// ── Guest Access ─────────────────────────────────────────────────────

/**
 * Generate a guest access token for a scholar (teacher only).
 * If the scholar already has a token, returns the existing one.
 */
export const generateGuestToken = teacherMutation({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const scholar = await ctx.db.get(args.scholarId);
    if (!scholar || scholar.role !== "scholar") {
      throw new Error("Scholar not found");
    }
    if (scholar.guestToken) {
      return scholar.guestToken;
    }
    const token = crypto.randomUUID();
    await ctx.db.patch(args.scholarId, { guestToken: token });
    return token;
  },
});

/**
 * Revoke a scholar's guest access token (teacher only).
 */
export const revokeGuestToken = teacherMutation({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scholarId, { guestToken: undefined });
  },
});

/**
 * Validate a guest token and return scholar info (public query — no auth required).
 */
export const resolveGuestToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const scholar = await ctx.db
      .query("users")
      .withIndex("by_guestToken", (q) => q.eq("guestToken", args.token))
      .unique();
    if (!scholar) return null;
    return { name: scholar.name ?? "Scholar", image: scholar.image ?? null };
  },
});

/**
 * Get existing guest token for a scholar (teacher only).
 */
export const getGuestToken = teacherQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const scholar = await ctx.db.get(args.scholarId);
    return scholar?.guestToken ?? null;
  },
});

/**
 * Create a new scholar user (teacher only).
 * Automatically generates a guest token.
 */
export const createScholar = teacherMutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const token = crypto.randomUUID();
    const userId = await ctx.db.insert("users", {
      name: args.name.trim(),
      role: "scholar",
      guestToken: token,
    });
    return { userId, guestToken: token };
  },
});
