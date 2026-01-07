import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, conversations } from "@/db";
import { eq } from "drizzle-orm";

// GET /api/conversations/[id]/whisper - Get current whisper for a conversation
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only teachers/admins can view whispers
  if (session.user.role !== "teacher" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const conversation = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, params.id))
      .limit(1);

    if (conversation.length === 0) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      whisper: conversation[0].teacherWhisper || "",
    });
  } catch (error) {
    console.error("Error fetching whisper:", error);
    return NextResponse.json(
      { error: "Failed to fetch whisper" },
      { status: 500 }
    );
  }
}

// POST /api/conversations/[id]/whisper - Set/update whisper for a conversation
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only teachers/admins can set whispers
  if (session.user.role !== "teacher" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { whisper } = body;

    // Update the conversation with the new whisper
    await db
      .update(conversations)
      .set({
        teacherWhisper: whisper || null,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, params.id));

    return NextResponse.json({ success: true, whisper: whisper || "" });
  } catch (error) {
    console.error("Error setting whisper:", error);
    return NextResponse.json(
      { error: "Failed to set whisper" },
      { status: 500 }
    );
  }
}

// DELETE /api/conversations/[id]/whisper - Clear whisper for a conversation
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only teachers/admins can clear whispers
  if (session.user.role !== "teacher" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await db
      .update(conversations)
      .set({
        teacherWhisper: null,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, params.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing whisper:", error);
    return NextResponse.json(
      { error: "Failed to clear whisper" },
      { status: 500 }
    );
  }
}
