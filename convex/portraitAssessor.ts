"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const PORTRAIT_SYSTEM_PROMPT = `You are analyzing interview transcripts and session signals from a gifted student at Tradewinds School. Your job is to build a Scholar Portrait — a structured understanding of who this student is as a learner and person, based on what they've told you directly.

This is DIFFERENT from academic mastery. You're capturing identity, interests, personality, and learning preferences.

Score 3-6 dimensions from 0-5:
- 0: No signal
- 1: Mentioned in passing
- 2: Some evidence
- 3: Clear pattern
- 4: Consistent, well-evidenced
- 5: Deeply understood from rich evidence

Choose dimension names that reflect what you actually know about this student.
"Domain Interests" should name their actual interests if known (e.g., "Wildlife Biology Interest").

Standard dimensions to consider:
- Intellectual Curiosity
- Creative Orientation
- Learning Style
- Challenge Tolerance
- Self-Direction
- Domain Interests (name the actual interest)

Also produce:
- status: A brief label like "Just Getting Started", "Emerging Picture", "Well Understood", "Deeply Known"
- statusDetailed: 1-2 sentence first-person summary of who this learner is
- contextDigest: 1-2 paragraphs about who they are as a learner — their real interests, how they prefer to learn, what excites or frustrates them, their goals. Written for injection into a lesson AI's system prompt.
- icebreakers: 2-4 conversation topics to explore in the next interview session
- completeness: 0-100 score of how complete the portrait is

Call the record_portrait tool with your analysis.`;

const PORTRAIT_TOOL = {
  name: "record_portrait" as const,
  description: "Record the scholar portrait assessment.",
  input_schema: {
    type: "object" as const,
    required: ["dimensions", "status", "statusDetailed", "contextDigest", "icebreakers", "completeness"],
    properties: {
      dimensions: {
        type: "array" as const,
        items: {
          type: "object" as const,
          required: ["name", "score"],
          properties: {
            name: { type: "string" as const },
            score: { type: "number" as const, description: "0-5" },
          },
        },
      },
      status: { type: "string" as const },
      statusDetailed: { type: "string" as const },
      contextDigest: { type: "string" as const },
      icebreakers: {
        type: "array" as const,
        items: { type: "string" as const },
      },
      completeness: { type: "number" as const, description: "0-100" },
    },
  },
};

interface PortraitResult {
  dimensions: Array<{ name: string; score: number }>;
  status: string;
  statusDetailed: string;
  contextDigest: string;
  icebreakers: string[];
  completeness: number;
}

/**
 * Assess a scholar's portrait based on interview transcripts.
 */
export const assessScholarPortrait = internalAction({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    console.log(`[PortraitAssessor] Starting assessment for scholar ${args.scholarId}`);

    // Get interview messages
    const messages = await ctx.runQuery(internal.interviews.getRecentInterviewMessages, {
      scholarId: args.scholarId,
      limit: 50,
    });

    if (messages.length < 4) {
      console.log(`[PortraitAssessor] Not enough messages (${messages.length}), skipping`);
      return;
    }

    // Get scholar name
    const scholar = await ctx.runQuery(internal.scholars.getInternal, {
      scholarId: args.scholarId,
    });

    const transcript = messages
      .map((m: { role: string; content: string }) =>
        `${m.role === "user" ? "SCHOLAR" : "SIDEKICK"}: ${m.content}`
      )
      .join("\n\n");

    const userMessage = `## Scholar: ${scholar?.name ?? "Unknown"}\n\n## Interview Transcript\n\n${transcript}`;

    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.error("[PortraitAssessor] ANTHROPIC_API_KEY not set");
        return;
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 2048,
          system: PORTRAIT_SYSTEM_PROMPT,
          tools: [PORTRAIT_TOOL],
          tool_choice: { type: "tool", name: "record_portrait" },
          messages: [{ role: "user", content: userMessage }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[PortraitAssessor] API error (${response.status}): ${errText}`);
        return;
      }

      const data = await response.json();
      const toolBlock = data.content?.find((b: { type: string }) => b.type === "tool_use");
      if (!toolBlock) {
        console.error("[PortraitAssessor] No tool_use block in response");
        return;
      }

      const result = toolBlock.input as PortraitResult;
      console.log(`[PortraitAssessor] Portrait: ${result.status} (${result.completeness}% complete), ${result.dimensions.length} dimensions`);

      await ctx.runMutation(internal.scholarPortraits.upsertPortrait, {
        scholarId: args.scholarId,
        dimensions: result.dimensions,
        status: result.status,
        statusDetailed: result.statusDetailed,
        contextDigest: result.contextDigest,
        icebreakers: result.icebreakers,
        completeness: result.completeness,
      });

      console.log(`[PortraitAssessor] Portrait saved for scholar ${args.scholarId}`);
    } catch (err) {
      console.error(`[PortraitAssessor] Failed:`, err instanceof Error ? err.message : String(err));
    }
  },
});
