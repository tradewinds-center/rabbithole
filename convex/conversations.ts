import { v } from "convex/values";
import { authedQuery, authedMutation, teacherMutation } from "./lib/customFunctions";
import { internal } from "./_generated/api";

/**
 * List conversations for a user (non-archived, most recent first).
 * Teachers can pass userId to view a scholar's conversations (remote mode).
 */
export const list = authedQuery({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const isTeacher =
      ctx.user.role === "teacher" || ctx.user.role === "admin";
    const targetUserId =
      isTeacher && args.userId ? args.userId : ctx.user._id;

    const convos = await ctx.db
      .query("conversations")
      .withIndex("by_user_and_archived", (q) =>
        q.eq("userId", targetUserId).eq("isArchived", false)
      )
      .order("desc")
      .collect();

    // Enrich with persona emoji for sidebar display
    return Promise.all(
      convos.map(async (conv) => {
        let personaEmoji: string | null = null;
        if (conv.personaId) {
          const persona = await ctx.db.get(conv.personaId);
          personaEmoji = persona?.emoji ?? null;
        }
        return {
          ...conv,
          id: conv._id,
          updatedAt: conv._creationTime,
          personaEmoji,
        };
      })
    );
  },
});

/**
 * Get a conversation with its messages.
 */
export const getWithMessages = authedQuery({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.id);
    if (!conversation) throw new Error("Conversation not found");

    // Access check: scholars can only view their own
    const isTeacher =
      ctx.user.role === "teacher" || ctx.user.role === "admin";
    if (!isTeacher && conversation.userId !== ctx.user._id) {
      throw new Error("Forbidden");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.id)
      )
      .order("asc")
      .collect();

    return {
      conversation: {
        ...conversation,
        id: conversation._id,
      },
      messages: messages.map((m) => ({
        ...m,
        id: m._id,
        createdAt: m._creationTime,
      })),
    };
  },
});

/**
 * Create a new conversation.
 */
export const create = authedMutation({
  args: {
    userId: v.optional(v.id("users")), // For teacher remote mode
    projectId: v.optional(v.id("projects")),
    personaId: v.optional(v.id("personas")),
    perspectiveId: v.optional(v.id("perspectives")),
    processId: v.optional(v.id("processes")),
  },
  handler: async (ctx, args) => {
    const isTeacher =
      ctx.user.role === "teacher" || ctx.user.role === "admin";
    const ownerUserId =
      isTeacher && args.userId ? args.userId : ctx.user._id;

    // Get project title if linked
    let title = "New Conversation";
    if (args.projectId) {
      const project = await ctx.db.get(args.projectId);
      if (project && project.isActive) {
        title = project.title;
      }
    }

    const id = await ctx.db.insert("conversations", {
      userId: ownerUserId,
      projectId: args.projectId,
      personaId: args.personaId,
      perspectiveId: args.perspectiveId,
      processId: args.processId,
      title,
      status: "green",
      isArchived: false,
    });

    // Initialize process state if a process was set
    if (args.processId) {
      await ctx.scheduler.runAfter(0, internal.processState.initialize, {
        conversationId: id,
        processId: args.processId,
      });
    }

    return { id };
  },
});

/**
 * Update conversation (title, dimensions, whisper, status).
 * Scholars can update title + dimensions on their own conversations.
 * Teachers can update anything on any conversation.
 */
export const update = authedMutation({
  args: {
    id: v.id("conversations"),
    title: v.optional(v.string()),
    projectId: v.optional(v.union(v.id("projects"), v.null())),
    personaId: v.optional(v.union(v.id("personas"), v.null())),
    perspectiveId: v.optional(v.union(v.id("perspectives"), v.null())),
    processId: v.optional(v.union(v.id("processes"), v.null())),
    teacherWhisper: v.optional(v.union(v.string(), v.null())),
    status: v.optional(
      v.union(v.literal("green"), v.literal("yellow"), v.literal("red"))
    ),
    analysisSummary: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.id);
    if (!conversation) throw new Error("Conversation not found");

    const isTeacher =
      ctx.user.role === "teacher" || ctx.user.role === "admin";

    // Scholars can only update their own conversations
    if (!isTeacher && conversation.userId !== ctx.user._id) {
      throw new Error("Forbidden");
    }

    const updates: Record<string, unknown> = {};

    // Both scholars and teachers can update these
    if (args.title !== undefined) updates.title = args.title;
    if (args.projectId !== undefined)
      updates.projectId = args.projectId ?? undefined;
    if (args.personaId !== undefined)
      updates.personaId = args.personaId ?? undefined;
    if (args.perspectiveId !== undefined)
      updates.perspectiveId = args.perspectiveId ?? undefined;
    if (args.processId !== undefined)
      updates.processId = args.processId ?? undefined;

    // Only teachers can update these
    if (isTeacher) {
      if (args.teacherWhisper !== undefined)
        updates.teacherWhisper = args.teacherWhisper ?? undefined;
      if (args.status !== undefined) updates.status = args.status;
      if (args.analysisSummary !== undefined)
        updates.analysisSummary = args.analysisSummary ?? undefined;
    }

    await ctx.db.patch(args.id, updates);

    // Handle processState when processId changes
    if (args.processId !== undefined) {
      const newProcessId = args.processId;
      if (newProcessId) {
        // Initialize/replace processState
        await ctx.scheduler.runAfter(0, internal.processState.initialize, {
          conversationId: args.id,
          processId: newProcessId,
        });
      } else {
        // Remove processState when process is cleared
        await ctx.scheduler.runAfter(0, internal.processState.remove, {
          conversationId: args.id,
        });
      }
    }

    return await ctx.db.get(args.id);
  },
});

/**
 * Archive a conversation (soft delete).
 */
export const archive = authedMutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.id);
    if (!conversation) throw new Error("Conversation not found");

    const isTeacher =
      ctx.user.role === "teacher" || ctx.user.role === "admin";
    if (!isTeacher && conversation.userId !== ctx.user._id) {
      throw new Error("Forbidden");
    }

    await ctx.db.patch(args.id, { isArchived: true });
  },
});
