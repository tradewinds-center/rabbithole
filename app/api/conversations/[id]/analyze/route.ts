import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, conversations, messages, users, scholarTopics } from "@/db";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

// Bloom's taxonomy levels for reference
const BLOOM_LEVELS = {
  remember: "Recall facts and basic concepts",
  understand: "Explain ideas or concepts",
  apply: "Use information in new situations",
  analyze: "Draw connections among ideas",
  evaluate: "Justify a stand or decision",
  create: "Produce new or original work",
};

// POST /api/conversations/[id]/analyze - Analyze a conversation with AI
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only teachers/admins can analyze conversations
  if (session.user.role !== "teacher" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const conversationId = params.id;

  try {
    // Get conversation and messages
    const conversation = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (conversation.length === 0) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Get scholar info
    const scholar = await db
      .select()
      .from(users)
      .where(eq(users.id, conversation[0].userId))
      .limit(1);

    // Get messages
    const conversationMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    if (conversationMessages.length === 0) {
      return NextResponse.json({
        summary: "No messages in this conversation yet.",
        nudges: [],
        topics: [],
        bloomLevel: "remember",
      });
    }

    // Format messages for AI analysis
    const messageText = conversationMessages
      .map((m) => `${m.role === "user" ? "Scholar" : "AI"}: ${m.content}`)
      .join("\n\n");

    // Call Claude to analyze the conversation
    const analysisPrompt = `Analyze this conversation between a scholar (student) and an AI tutor. The scholar's name is ${scholar[0]?.name || "Unknown"}.

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

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: analysisPrompt,
        },
      ],
    });

    // Parse the response
    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";

    let analysis;
    try {
      analysis = JSON.parse(responseText);
    } catch {
      console.error("Failed to parse AI response:", responseText);
      analysis = {
        summary: "Analysis in progress...",
        topics: [],
        bloomLevel: "remember",
        nudges: [],
        suggestedFollowUps: [],
      };
    }

    // Update or create scholar topics based on analysis
    if (analysis.topics && analysis.topics.length > 0) {
      for (const topic of analysis.topics) {
        // Check if topic exists
        const existingTopic = await db
          .select()
          .from(scholarTopics)
          .where(
            and(
              eq(scholarTopics.scholarId, conversation[0].userId),
              eq(scholarTopics.topic, topic)
            )
          )
          .limit(1);

        if (existingTopic.length > 0) {
          // Update mention count
          await db
            .update(scholarTopics)
            .set({
              mentionCount: existingTopic[0].mentionCount + 1,
              lastConversationId: conversationId,
              bloomLevel: analysis.bloomLevel || existingTopic[0].bloomLevel,
              updatedAt: new Date(),
            })
            .where(eq(scholarTopics.id, existingTopic[0].id));
        } else {
          // Create new topic
          await db.insert(scholarTopics).values({
            scholarId: conversation[0].userId,
            topic,
            bloomLevel: analysis.bloomLevel || "remember",
            lastConversationId: conversationId,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    }

    // Update conversation with analysis summary
    await db
      .update(conversations)
      .set({
        analysisSummary: analysis.summary,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));

    return NextResponse.json({
      summary: analysis.summary,
      topics: analysis.topics || [],
      bloomLevel: analysis.bloomLevel || "remember",
      bloomDescription: BLOOM_LEVELS[analysis.bloomLevel as keyof typeof BLOOM_LEVELS] || BLOOM_LEVELS.remember,
      nudges: analysis.nudges || [],
      suggestedFollowUps: analysis.suggestedFollowUps || [],
      scholarName: scholar[0]?.name || "Unknown",
    });
  } catch (error) {
    console.error("Error analyzing conversation:", error);
    return NextResponse.json(
      { error: "Failed to analyze conversation" },
      { status: 500 }
    );
  }
}
