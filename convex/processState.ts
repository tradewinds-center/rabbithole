import { v } from "convex/values";
import { authedQuery } from "./lib/customFunctions";
import { internalMutation } from "./_generated/server";

/**
 * Get process state for a conversation (reactive, used by ProcessPanel).
 */
export const getByConversation = authedQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("processState")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .first();
  },
});

/**
 * Initialize process state when a process is set on a conversation.
 * Creates all steps as "not_started", sets currentStep to the first step.
 */
export const initialize = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    processId: v.id("processes"),
  },
  handler: async (ctx, args) => {
    // Delete existing processState for this conversation
    const existing = await ctx.db
      .query("processState")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    // Get the process to read its steps
    const process = await ctx.db.get(args.processId);
    if (!process || process.steps.length === 0) return;

    await ctx.db.insert("processState", {
      conversationId: args.conversationId,
      processId: args.processId,
      currentStep: process.steps[0].key,
      steps: process.steps.map((s) => ({
        key: s.key,
        status: "not_started" as const,
      })),
    });
  },
});

/**
 * Update a step's status and commentary. Called by AI tool handler in http.ts.
 */
export const updateStep = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    stepKey: v.string(),
    status: v.union(
      v.literal("in_progress"),
      v.literal("completed")
    ),
    commentary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("processState")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .first();
    if (!state) return;

    const updatedSteps = state.steps.map((s) => {
      if (s.key === args.stepKey) {
        return {
          ...s,
          status: args.status,
          commentary: args.commentary ?? s.commentary,
        };
      }
      return s;
    });

    await ctx.db.patch(state._id, {
      currentStep: args.stepKey,
      steps: updatedSteps,
    });
  },
});

/**
 * Remove process state for a conversation (when process is cleared).
 */
export const remove = internalMutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("processState")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
