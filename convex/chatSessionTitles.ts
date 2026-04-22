"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { MODELS } from "./lib/models";

export const autoNameSession = internalAction({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    const exchange = await ctx.runQuery(
      internal.curriculumAssistant.getSessionFirstExchange,
      { sessionId: args.sessionId },
    );
    if (!exchange?.firstUserMessage) return;

    const userExcerpt = exchange.firstUserMessage.slice(0, 400);

    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const anthropic = new Anthropic();
      const response = await anthropic.messages.create({
        model: MODELS.HAIKU,
        max_tokens: 40,
        system:
          "You title a teacher's chat session based on their first message to an AI curriculum assistant. " +
          "Return ONLY a concise title, 2-5 words, title case, no punctuation, no quotes. " +
          "Examples: 'Reading Level Check', 'Upcoming Unit Planning', 'Progress Review'.",
        messages: [{ role: "user", content: `TEACHER: ${userExcerpt}\n\nTitle:` }],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") return;
      const cleaned = textBlock.text
        .trim()
        .replace(/[\r\n]+/g, " ")
        .replace(/^["'`]+|["'`]+$/g, "")
        .replace(/[.!?,:;]+$/g, "")
        .trim();
      if (!cleaned || cleaned.length > 60) return;
      await ctx.runMutation(internal.curriculumAssistant.setSessionTitle, {
        sessionId: args.sessionId,
        title: cleaned,
      });
    } catch (err) {
      console.error("[chatSessionTitles] title generation failed:", err);
    }
  },
});
