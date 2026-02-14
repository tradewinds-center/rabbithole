import { v } from "convex/values";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * Get artifact for a conversation (reactive, used by ArtifactPanel).
 */
export const getByConversation = authedQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("artifacts")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .first();
  },
});

/**
 * Scholar saves edits to artifact content.
 */
export const scholarUpdate = authedMutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const artifact = await ctx.db
      .query("artifacts")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .first();
    if (!artifact) return;
    await ctx.db.patch(artifact._id, {
      content: args.content,
      lastEditedBy: "scholar",
    });
  },
});

// ── Internal mutations for AI tool use ────────────────────────────────

/**
 * AI creates a new artifact for a conversation.
 */
export const aiCreate = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Delete any existing artifact for this conversation
    const existing = await ctx.db
      .query("artifacts")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    await ctx.db.insert("artifacts", {
      conversationId: args.conversationId,
      title: args.title,
      content: args.content,
      lastEditedBy: "ai",
    });
  },
});

/**
 * AI replaces text in artifact content (str_replace).
 * Returns { error?: string } if old_str not found.
 */
export const aiStrReplace = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    oldStr: v.string(),
    newStr: v.string(),
  },
  handler: async (ctx, args) => {
    const artifact = await ctx.db
      .query("artifacts")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .first();
    if (!artifact) {
      return { error: "Error: No document exists yet. Use create first." };
    }
    if (!artifact.content.includes(args.oldStr)) {
      return {
        error: `Error: old_str not found in document. Make sure it matches exactly, including whitespace and line breaks.`,
      };
    }
    const newContent = artifact.content.replace(args.oldStr, args.newStr);
    await ctx.db.patch(artifact._id, {
      content: newContent,
      lastEditedBy: "ai",
    });
    return {};
  },
});

/**
 * AI inserts text at a line number (0 = beginning).
 */
export const aiInsert = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    insertLine: v.number(),
    insertText: v.string(),
  },
  handler: async (ctx, args) => {
    const artifact = await ctx.db
      .query("artifacts")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .first();
    if (!artifact) return;
    const lines = artifact.content.split("\n");
    const lineNum = Math.max(0, Math.min(args.insertLine, lines.length));
    lines.splice(lineNum, 0, args.insertText);
    await ctx.db.patch(artifact._id, {
      content: lines.join("\n"),
      lastEditedBy: "ai",
    });
  },
});

/**
 * AI reads artifact content (for view command).
 */
export const aiGetContent = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("artifacts")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .first();
  },
});
