"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { MODELS } from "./lib/models";

/**
 * Generate a short (3-5 word) human-readable project title from the first
 * user/assistant exchange. Scheduled in the background after the first turn
 * completes so scholars' home cards aren't littered with truncated full
 * sentences.
 */
export const generateTitle = internalAction({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const snapshot = await ctx.runQuery(
      internal.projectHelpers.getFirstExchange,
      { projectId: args.projectId },
    );
    if (!snapshot) return;
    const { firstUserMessage, firstAssistantMessage } = snapshot;
    if (!firstUserMessage) return;

    const userExcerpt = firstUserMessage.slice(0, 600);
    const assistantExcerpt = (firstAssistantMessage ?? "").slice(0, 400);

    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const anthropic = new Anthropic();
      const response = await anthropic.messages.create({
        model: MODELS.HAIKU,
        max_tokens: 40,
        system:
          "You title a student's tutoring session based on their first question and the tutor's first reply. " +
          "Return ONLY a concise title, 2-5 words, title case, no punctuation, no quotes. Capture the topic/focus, not the format. " +
          "Examples: 'Multiplication Tables Warm-Up', 'Water Cycle Questions', 'Haiku About Volcanoes'.",
        messages: [
          {
            role: "user",
            content: `SCHOLAR: ${userExcerpt}\n\nTUTOR: ${assistantExcerpt}\n\nTitle:`,
          },
        ],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") return;
      const raw = textBlock.text.trim();
      // Defensive cleanup: strip quotes, trailing punctuation, newlines
      const cleaned = raw
        .replace(/[\r\n]+/g, " ")
        .replace(/^["'`]+|["'`]+$/g, "")
        .replace(/[.!?,:;]+$/g, "")
        .trim();
      if (!cleaned || cleaned.length > 60) return;
      await ctx.runMutation(internal.projectHelpers.setGeneratedTitle, {
        projectId: args.projectId,
        title: cleaned,
      });
    } catch (err) {
      console.error("[projectTitles] title generation failed:", err);
    }
  },
});
