import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { authedQuery, teacherQuery, adminMutation } from "./lib/customFunctions";
import { roleFromEmail } from "./lib/auth";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Get the current authenticated user document.
 */
export const currentUser = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
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
 * Returns scholars with conversation counts and status.
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
        // Get conversations (most recent 5, non-archived)
        const convos = await ctx.db
          .query("conversations")
          .withIndex("by_user", (q) => q.eq("userId", scholar._id))
          .order("desc")
          .collect();

        const activeConvos = convos.filter((c) => !c.isArchived).slice(0, 5);

        // Count messages across all conversations
        let messageCount = 0;
        for (const conv of convos) {
          const msgs = await ctx.db
            .query("messages")
            .withIndex("by_conversation", (q) =>
              q.eq("conversationId", conv._id)
            )
            .collect();
          messageCount += msgs.length;
        }

        // Determine overall status (worst status)
        const hasRed = activeConvos.some((c) => c.status === "red");
        const hasYellow = activeConvos.some((c) => c.status === "yellow");
        const overallStatus: "green" | "yellow" | "red" = hasRed
          ? "red"
          : hasYellow
            ? "yellow"
            : "green";

        return {
          _id: scholar._id,
          id: scholar._id,
          email: scholar.email,
          name: scholar.name,
          image: scholar.image,
          conversationCount: activeConvos.length,
          messageCount,
          overallStatus,
          lastActive: activeConvos[0]?._creationTime ?? scholar._creationTime,
          recentConversations: activeConvos.map((c) => ({
            id: c._id,
            title: c.title,
            status: c.status,
            updatedAt: c._creationTime,
          })),
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
