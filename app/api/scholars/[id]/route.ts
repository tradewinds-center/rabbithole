import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, users, conversations, messages, scholarTopics, suggestedTopics } from "@/db";
import { eq, desc, and } from "drizzle-orm";

const VALID_READING_LEVELS = [
  "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "college"
];

// GET /api/scholars/[id] - Get scholar profile with topics and stats
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only teachers/admins can view scholar profiles
  if (session.user.role !== "teacher" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const scholarId = params.id;

  try {
    // Get scholar info
    const scholar = await db
      .select()
      .from(users)
      .where(and(eq(users.id, scholarId), eq(users.role, "scholar")))
      .limit(1);

    if (scholar.length === 0) {
      return NextResponse.json({ error: "Scholar not found" }, { status: 404 });
    }

    // Get scholar's topics with ratings
    const topics = await db
      .select()
      .from(scholarTopics)
      .where(eq(scholarTopics.scholarId, scholarId))
      .orderBy(desc(scholarTopics.mentionCount));

    // Get suggested topics for this scholar
    const suggestions = await db
      .select()
      .from(suggestedTopics)
      .where(eq(suggestedTopics.scholarId, scholarId))
      .orderBy(desc(suggestedTopics.createdAt));

    // Get conversation stats
    const scholarConversations = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, scholarId));

    const conversationIds = scholarConversations.map((c) => c.id);

    let totalMessages = 0;
    if (conversationIds.length > 0) {
      for (const convId of conversationIds) {
        const msgs = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, convId));
        totalMessages += msgs.length;
      }
    }

    return NextResponse.json({
      scholar: {
        id: scholar[0].id,
        email: scholar[0].email,
        name: scholar[0].name,
        image: scholar[0].image,
        readingLevel: scholar[0].readingLevel,
        createdAt: scholar[0].createdAt,
      },
      topics,
      suggestions,
      stats: {
        conversationCount: scholarConversations.length,
        messageCount: totalMessages,
        topicCount: topics.length,
      },
    });
  } catch (error) {
    console.error("Error fetching scholar profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch scholar profile" },
      { status: 500 }
    );
  }
}

// PATCH /api/scholars/[id] - Update scholar reading level
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only teachers/admins can update scholar profiles
  if (session.user.role !== "teacher" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const scholarId = params.id;

  try {
    const body = await request.json();
    const { readingLevel } = body;

    // Validate reading level
    if (readingLevel !== null && !VALID_READING_LEVELS.includes(readingLevel)) {
      return NextResponse.json(
        { error: "Invalid reading level" },
        { status: 400 }
      );
    }

    // Verify scholar exists
    const scholar = await db
      .select()
      .from(users)
      .where(and(eq(users.id, scholarId), eq(users.role, "scholar")))
      .limit(1);

    if (scholar.length === 0) {
      return NextResponse.json({ error: "Scholar not found" }, { status: 404 });
    }

    // Update reading level
    await db
      .update(users)
      .set({
        readingLevel: readingLevel || null,
        updatedAt: new Date()
      })
      .where(eq(users.id, scholarId));

    return NextResponse.json({
      success: true,
      readingLevel: readingLevel || null
    });
  } catch (error) {
    console.error("Error updating scholar reading level:", error);
    return NextResponse.json(
      { error: "Failed to update reading level" },
      { status: 500 }
    );
  }
}
