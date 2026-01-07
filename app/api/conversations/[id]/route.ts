import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, conversations, messages } from "@/db";
import { eq, and, asc } from "drizzle-orm";

// GET - Get conversation with messages
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // For teachers/admins, allow viewing any conversation
    // For scholars, only allow viewing their own
    const isTeacher =
      session.user.role === "teacher" || session.user.role === "admin";

    const conversation = await db
      .select()
      .from(conversations)
      .where(
        isTeacher
          ? eq(conversations.id, id)
          : and(
              eq(conversations.id, id),
              eq(conversations.userId, session.user.id)
            )
      )
      .limit(1);

    if (conversation.length === 0) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const conversationMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt));

    return NextResponse.json({
      conversation: conversation[0],
      messages: conversationMessages,
    });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Archive conversation
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Only allow users to archive their own conversations
    const conversation = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, id),
          eq(conversations.userId, session.user.id)
        )
      )
      .limit(1);

    if (conversation.length === 0) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    await db
      .update(conversations)
      .set({ isArchived: true, updatedAt: new Date() })
      .where(eq(conversations.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error archiving conversation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - Update conversation (for teacher whispers, status, etc.)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json();

    // Teachers can update whispers and status on any conversation
    // Scholars can only update their own conversations (limited fields)
    const isTeacher =
      session.user.role === "teacher" || session.user.role === "admin";

    if (!isTeacher) {
      // Scholars can only update title
      const { title } = body;
      if (title === undefined) {
        return NextResponse.json(
          { error: "No valid fields to update" },
          { status: 400 }
        );
      }

      await db
        .update(conversations)
        .set({ title, updatedAt: new Date() })
        .where(
          and(
            eq(conversations.id, id),
            eq(conversations.userId, session.user.id)
          )
        );
    } else {
      // Teachers can update whisper, status, and analysis
      const { teacherWhisper, status, analysisSummary } = body;

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (teacherWhisper !== undefined) updateData.teacherWhisper = teacherWhisper;
      if (status !== undefined) updateData.status = status;
      if (analysisSummary !== undefined) updateData.analysisSummary = analysisSummary;

      await db
        .update(conversations)
        .set(updateData)
        .where(eq(conversations.id, id));
    }

    const updated = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);

    return NextResponse.json({ conversation: updated[0] });
  } catch (error) {
    console.error("Error updating conversation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
