"use node";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { ROLES } from "./lib/roles";

const anthropic = new Anthropic();

/**
 * Teacher-triggered AI reading level analysis.
 * Fetches last 30 days of scholar user messages, calls Claude Haiku to estimate
 * reading/writing grade level, then writes to readingLevelSuggestion.
 * Returns the result so the UI can show it immediately.
 */
export const analyzeReadingLevelAI = action({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args): Promise<{ level: string; wordCount: number; rationale: string } | null> => {
    const user = await ctx.runQuery(api.users.currentUser);
    if (!user || (user.role !== ROLES.TEACHER && user.role !== ROLES.ADMIN)) {
      throw new Error("Forbidden: teacher or admin role required");
    }

    const texts = await ctx.runQuery(api.messages.getScholarUserMessages30d, {
      scholarId: args.scholarId,
    });
    const combined = texts.join(" ").trim();
    const wordCount = combined.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w)).length;
    if (wordCount < 10) return null;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      tools: [
        {
          name: "report_reading_level",
          description: "Report estimated reading/writing grade level",
          input_schema: {
            type: "object" as const,
            properties: {
              level: {
                type: "string",
                description: "Grade level: K, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, or college",
              },
              rationale: {
                type: "string",
                description: "One sentence explaining the assessment",
              },
            },
            required: ["level", "rationale"],
          },
        },
      ],
      tool_choice: { type: "any" as const },
      messages: [
        {
          role: "user",
          content: `Estimate the reading/writing level of the student who wrote these messages. Assess vocabulary, sentence structure, spelling, and conceptual expression. Use US grade levels (K, 1-12, or college).\n\nMessages:\n${combined.slice(0, 8000)}`,
        },
      ],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return null;
    const input = toolUse.input as { level: string; rationale: string };

    await ctx.runMutation(api.scholars.setReadingLevelSuggestionFromAnalysis, {
      scholarId: args.scholarId,
      suggestion: input.level,
    });

    return { level: input.level, wordCount, rationale: input.rationale };
  },
});
