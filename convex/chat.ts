import { v } from "convex/values";
import { authedMutation } from "./lib/customFunctions";

/**
 * Send a message: saves user message, creates stream ID, inserts placeholder.
 * Returns the streamId so the client can subscribe to streaming.
 * The actual Claude API call happens via the HTTP action.
 */
export const sendMessage = authedMutation({
  args: {
    conversationId: v.id("conversations"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    // Access check: teachers can send in any conversation, scholars only their own
    const isTeacher =
      ctx.user.role === "teacher" || ctx.user.role === "admin";
    if (!isTeacher && conversation.userId !== ctx.user._id) {
      throw new Error("Forbidden");
    }

    // Dimension snapshot (as strings, not IDs, for historical reference)
    const personaId = conversation.personaId
      ? String(conversation.personaId)
      : undefined;
    const projectId = conversation.projectId
      ? String(conversation.projectId)
      : undefined;
    const perspectiveId = conversation.perspectiveId
      ? String(conversation.perspectiveId)
      : undefined;

    // Save user message
    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: "user",
      content: args.message,
      personaId,
      projectId,
      perspectiveId,
      flagged: false,
    });

    // Create stream ID
    const streamId = crypto.randomUUID();

    // Insert placeholder assistant message with stream ID
    const assistantMsgId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: "assistant",
      content: "",
      streamId,
      personaId,
      projectId,
      perspectiveId,
      flagged: false,
    });

    return {
      streamId,
      assistantMsgId,
      conversationId: args.conversationId,
    };
  },
});
