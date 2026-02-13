"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// Bloom's taxonomy levels
const BLOOM_LEVELS: Record<string, string> = {
  remember: "Recall facts and basic concepts",
  understand: "Explain ideas or concepts",
  apply: "Use information in new situations",
  analyze: "Draw connections among ideas",
  evaluate: "Justify a stand or decision",
  create: "Produce new or original work",
};

const OBSERVER_SYSTEM_PROMPT = `You are an educational observer analyzing conversations between scholars and an AI tutor at Tradewinds School, a school for gifted children.

Your task is to analyze the conversation and provide structured insights for teachers.

## Analysis Framework

Evaluate the conversation on these dimensions:

1. **Engagement Level** (0-1 score): Is the scholar actively participating? Are they asking follow-up questions? Do they seem genuinely curious?

2. **Complexity Level** (0-1 score): What level of intellectual complexity is the scholar engaging with? Are they pushing into advanced territory?

3. **On-Task Score** (0-1 score): Is the conversation focused on learning? Is it productive?

4. **Topics**: What subjects/topics are being explored?

5. **Learning Indicators**: What signs of learning are visible? (making connections, asking deeper questions, revising understanding, etc.)

6. **Concern Flags**: Any concerns? (off-task behavior, signs of frustration, inappropriate content, etc.)

7. **Status Recommendation**: Based on your analysis, what status should this conversation have?
   - GREEN: On track, productive learning happening
   - YELLOW: Some concerns, may benefit from teacher awareness
   - RED: Requires teacher intervention (significant off-task, distress, inappropriate content)

8. **Summary**: 2-3 sentence summary of what's happening in this conversation.

9. **Suggested Intervention** (if applicable): If yellow or red, what might a teacher do to help?

Respond in JSON format:
{
  "engagementScore": 0.0-1.0,
  "complexityLevel": 0.0-1.0,
  "onTaskScore": 0.0-1.0,
  "topics": ["topic1", "topic2"],
  "learningIndicators": ["indicator1", "indicator2"],
  "concernFlags": ["concern1"] or [],
  "status": "green" | "yellow" | "red",
  "summary": "Brief summary...",
  "suggestedIntervention": "Suggestion..." or null
}`;

/**
 * Run observer analysis on a conversation (saves analysis record + updates conversation status).
 */
export const runObserverAnalysis = internalAction({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    // Get conversation context
    const context = await ctx.runQuery(
      internal.chatHelpers.getConversationContext,
      { conversationId: args.conversationId }
    );
    if (!context || context.chatHistory.length === 0) {
      return null;
    }

    const conversationText = context.chatHistory
      .map(
        (m: { role: string; content: string }) =>
          `${m.role.toUpperCase()}: ${m.content}`
      )
      .join("\n\n");

    // Call Claude Haiku for analysis
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: OBSERVER_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Please analyze this conversation:\n\n${conversationText}`,
        },
      ],
    });

    const content =
      response.content[0].type === "text" ? response.content[0].text : "{}";

    let analysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      analysis = JSON.parse(jsonMatch[0]);
    } catch {
      analysis = {
        engagementScore: 0.5,
        complexityLevel: 0.5,
        onTaskScore: 0.5,
        topics: [],
        learningIndicators: [],
        concernFlags: [],
        status: "green",
        summary: "Analysis unavailable",
        suggestedIntervention: null,
      };
    }

    // Save analysis to DB
    await ctx.runMutation(internal.analysisHelpers.saveAnalysis, {
      conversationId: args.conversationId,
      engagementScore: analysis.engagementScore,
      complexityLevel: analysis.complexityLevel,
      onTaskScore: analysis.onTaskScore,
      topics: analysis.topics || [],
      learningIndicators: analysis.learningIndicators || [],
      concernFlags: analysis.concernFlags || [],
      summary: analysis.summary || "Analysis unavailable",
      suggestedIntervention: analysis.suggestedIntervention || undefined,
      status: analysis.status || "green",
    });

    return analysis;
  },
});

/**
 * Run detailed AI analysis (with Bloom's taxonomy, nudges, follow-ups).
 */
export const runDetailedAnalysis = internalAction({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(
      internal.chatHelpers.getConversationContext,
      { conversationId: args.conversationId }
    );
    if (!context || context.chatHistory.length === 0) {
      return null;
    }

    const messageText = context.chatHistory
      .map(
        (m: { role: string; content: string }) =>
          `${m.role === "user" ? "Scholar" : "AI"}: ${m.content}`
      )
      .join("\n\n");

    const analysisPrompt = `Analyze this conversation between a scholar (student) and an AI tutor.

<conversation>
${messageText}
</conversation>

Provide your analysis in the following JSON format:
{
  "summary": "A 2-sentence summary of what the scholar is exploring and their engagement level",
  "topics": ["array", "of", "main", "topics", "discussed"],
  "bloomLevel": "one of: remember, understand, apply, analyze, evaluate, create - representing the highest cognitive level the scholar is operating at",
  "nudges": [
    {
      "type": "encourage|redirect|challenge|support",
      "message": "A specific suggestion for the teacher to help guide this scholar"
    }
  ],
  "suggestedFollowUps": [
    {
      "topic": "A topic that could push the scholar to a higher Bloom's level",
      "targetLevel": "the target Bloom level",
      "rationale": "Brief explanation of why this would be valuable"
    }
  ]
}

Focus on:
1. What concepts the scholar is grasping or struggling with
2. Their level of intellectual curiosity and engagement
3. Opportunities to push them to higher-order thinking (Bloom's taxonomy)
4. Any concerning patterns (off-task, confused, disengaged)

Respond ONLY with valid JSON, no other text.`;

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: analysisPrompt }],
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";

    let analysis;
    try {
      analysis = JSON.parse(responseText);
    } catch {
      analysis = {
        summary: "Analysis in progress...",
        topics: [],
        bloomLevel: "remember",
        nudges: [],
        suggestedFollowUps: [],
      };
    }

    // Update scholar topics based on analysis
    if (analysis.topics && analysis.topics.length > 0) {
      // Get conversation to find scholar ID
      const conv = await ctx.runQuery(
        internal.analysisHelpers.getConversation,
        { conversationId: args.conversationId }
      );
      if (conv) {
        for (const topic of analysis.topics) {
          await ctx.runMutation(internal.analysisHelpers.upsertScholarTopic, {
            scholarId: conv.userId,
            topic,
            bloomLevel: analysis.bloomLevel || "remember",
            conversationId: args.conversationId,
          });
        }
      }
    }

    // Update conversation summary
    await ctx.runMutation(internal.analysisHelpers.updateConversationSummary, {
      conversationId: args.conversationId,
      summary: analysis.summary,
    });

    return {
      summary: analysis.summary,
      topics: analysis.topics || [],
      bloomLevel: analysis.bloomLevel || "remember",
      bloomDescription:
        BLOOM_LEVELS[analysis.bloomLevel as keyof typeof BLOOM_LEVELS] ||
        BLOOM_LEVELS.remember,
      nudges: analysis.nudges || [],
      suggestedFollowUps: analysis.suggestedFollowUps || [],
    };
  },
});
