import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, conversations, messages, analyses } from "@/db";
import { eq, desc } from "drizzle-orm";
import { analyzeConversation, type ChatMessage } from "@/lib/claude";

// POST - Analyze a conversation
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only teachers and admins can trigger analysis
    if (session.user.role !== "teacher" && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { conversationId } = body;

    if (!conversationId) {
      return NextResponse.json(
        { error: "Missing conversationId" },
        { status: 400 }
      );
    }

    // Get conversation messages
    const conversationMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    if (conversationMessages.length === 0) {
      return NextResponse.json(
        { error: "No messages to analyze" },
        { status: 400 }
      );
    }

    // Prepare messages for analysis
    const chatMessages: ChatMessage[] = conversationMessages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // Run analysis
    const analysis = await analyzeConversation(chatMessages);

    // Save analysis
    const analysisId = crypto.randomUUID();
    await db.insert(analyses).values({
      id: analysisId,
      conversationId,
      engagementScore: analysis.engagementScore,
      complexityLevel: analysis.complexityLevel,
      onTaskScore: analysis.onTaskScore,
      topics: JSON.stringify(analysis.topics),
      learningIndicators: JSON.stringify(analysis.learningIndicators),
      concernFlags: JSON.stringify(analysis.concernFlags),
      summary: analysis.summary,
      suggestedIntervention: analysis.suggestedIntervention,
      createdAt: new Date(),
    });

    // Update conversation status based on analysis
    await db
      .update(conversations)
      .set({
        status: analysis.status,
        analysisSummary: analysis.summary,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));

    return NextResponse.json({
      analysis: {
        id: analysisId,
        ...analysis,
      },
    });
  } catch (error) {
    console.error("Error analyzing conversation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET - Get analysis history for a conversation
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { error: "Missing conversationId" },
        { status: 400 }
      );
    }

    const analysisHistory = await db
      .select()
      .from(analyses)
      .where(eq(analyses.conversationId, conversationId))
      .orderBy(desc(analyses.createdAt));

    // Parse JSON fields
    const parsed = analysisHistory.map((a) => ({
      ...a,
      topics: a.topics ? JSON.parse(a.topics) : [],
      learningIndicators: a.learningIndicators
        ? JSON.parse(a.learningIndicators)
        : [],
      concernFlags: a.concernFlags ? JSON.parse(a.concernFlags) : [],
    }));

    return NextResponse.json({ analyses: parsed });
  } catch (error) {
    console.error("Error fetching analyses:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
