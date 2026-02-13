import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { authedQuery } from "./lib/customFunctions";

/**
 * List messages for a conversation (used by reactive subscribers).
 */
export const listByConversation = authedQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return [];

    // Access check
    const isTeacher =
      ctx.user.role === "teacher" || ctx.user.role === "admin";
    if (!isTeacher && conversation.userId !== ctx.user._id) {
      return [];
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();

    return messages.map((m) => ({
      ...m,
      id: m._id,
      createdAt: m._creationTime,
    }));
  },
});

/**
 * Get stream body for persistent-text-streaming.
 * This is a public query used by the useStream hook.
 */
export const getStreamBody = query({
  args: { streamId: v.string() },
  handler: async (ctx, args) => {
    const message = await ctx.db
      .query("messages")
      .withIndex("by_stream", (q) => q.eq("streamId", args.streamId))
      .first();

    if (!message) return null;
    return {
      body: message.content,
      status: message.streamId ? "streaming" : "done",
    };
  },
});

/**
 * Insert a user message (internal, called from chat mutation).
 */
export const insertUserMessage = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    personaId: v.optional(v.string()),
    projectId: v.optional(v.string()),
    perspectiveId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: "user",
      content: args.content,
      personaId: args.personaId,
      projectId: args.projectId,
      perspectiveId: args.perspectiveId,
      flagged: false,
    });
  },
});

/**
 * Insert an assistant message placeholder (internal, called from chat action).
 */
export const insertAssistantPlaceholder = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    streamId: v.string(),
    personaId: v.optional(v.string()),
    projectId: v.optional(v.string()),
    perspectiveId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: "assistant",
      content: "",
      streamId: args.streamId,
      personaId: args.personaId,
      projectId: args.projectId,
      perspectiveId: args.perspectiveId,
      flagged: false,
    });
  },
});

/**
 * Finalize an assistant message after streaming completes.
 */
export const finalizeAssistantMessage = internalMutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
    model: v.optional(v.string()),
    tokensUsed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      content: args.content,
      model: args.model,
      tokensUsed: args.tokensUsed,
      streamId: undefined, // Clear stream ID to mark as done
    });
  },
});

/**
 * Update streaming message content (called periodically during stream).
 */
export const updateStreamContent = internalMutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      content: args.content,
    });
  },
});
