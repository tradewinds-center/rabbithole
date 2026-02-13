import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

/**
 * Get all context needed to call Claude for a conversation.
 * Called by the HTTP action before streaming.
 */
export const getConversationContext = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return null;

    // Get chat history
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();

    const chatHistory = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // Get scholar's reading level
    const scholar = await ctx.db.get(conversation.userId);
    const readingLevel = scholar?.readingLevel ?? null;

    // Get project context
    let projectContext = null;
    if (conversation.projectId) {
      const project = await ctx.db.get(conversation.projectId);
      if (project) {
        projectContext = {
          title: project.title,
          description: project.description ?? null,
          systemPrompt: project.systemPrompt ?? null,
          rubric: project.rubric ?? null,
          targetBloomLevel: project.targetBloomLevel ?? null,
        };
      }
    }

    // Get persona context
    let personaContext = null;
    if (conversation.personaId) {
      const persona = await ctx.db.get(conversation.personaId);
      if (persona) {
        personaContext = {
          title: persona.title,
          emoji: persona.emoji,
          systemPrompt: persona.systemPrompt ?? null,
        };
      }
    }

    // Get perspective context
    let perspectiveContext = null;
    if (conversation.perspectiveId) {
      const perspective = await ctx.db.get(conversation.perspectiveId);
      if (perspective) {
        perspectiveContext = {
          title: perspective.title,
          icon: perspective.icon ?? null,
          systemPrompt: perspective.systemPrompt ?? null,
        };
      }
    }

    return {
      teacherWhisper: conversation.teacherWhisper ?? null,
      readingLevel,
      projectContext,
      personaContext,
      perspectiveContext,
      chatHistory,
      title: conversation.title,
    };
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

/**
 * Finalize a stream: save full content, clear streamId, update conversation.
 */
export const finalizeStream = internalMutation({
  args: {
    messageId: v.id("messages"),
    conversationId: v.id("conversations"),
    content: v.string(),
    model: v.optional(v.string()),
    tokensUsed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Finalize the assistant message
    await ctx.db.patch(args.messageId, {
      content: args.content,
      model: args.model,
      tokensUsed: args.tokensUsed,
      streamId: undefined,
    });

    // Update conversation title if first exchange
    const conversation = await ctx.db.get(args.conversationId);
    if (conversation && conversation.title === "New Conversation") {
      // Count user messages to see if this is the first exchange
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", args.conversationId)
        )
        .collect();

      const userMessages = messages.filter((m) => m.role === "user");
      if (userMessages.length <= 1 && userMessages[0]) {
        const words = userMessages[0].content.split(" ").slice(0, 6).join(" ");
        const title =
          words.length > 40 ? words.slice(0, 40) + "..." : words;
        await ctx.db.patch(args.conversationId, { title });
      }
    }

    // Auto-trigger observer analysis in background
    await ctx.scheduler.runAfter(0, internal.analysisActions.runObserverAnalysis, {
      conversationId: args.conversationId,
    });
  },
});
