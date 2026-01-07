import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, conversations, messages } from "@/db";
import { eq, desc, and } from "drizzle-orm";

// GET - List conversations for current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userConversations = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.userId, session.user.id),
          eq(conversations.isArchived, false)
        )
      )
      .orderBy(desc(conversations.updatedAt));

    return NextResponse.json({ conversations: userConversations });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create new conversation
export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const newConversation = {
      id: crypto.randomUUID(),
      userId: session.user.id,
      title: "New Conversation",
      status: "green" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      isArchived: false,
    };

    await db.insert(conversations).values(newConversation);

    return NextResponse.json({ conversation: newConversation });
  } catch (error) {
    console.error("Error creating conversation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
