import { v } from "convex/values";
import { teacherQuery } from "./lib/customFunctions";

/**
 * Get analysis history for a conversation (most recent first).
 */
export const getHistory = teacherQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("analyses")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("desc")
      .collect();
  },
});

/**
 * Get the most recent analysis for a conversation.
 */
export const getLatest = teacherQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("analyses")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("desc")
      .first();
  },
});
