import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, suggestedTopics } from "@/db";
import { eq, desc } from "drizzle-orm";

// GET /api/scholars/[id]/suggestions - Get suggested topics for a scholar
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only teachers/admins can view suggestions
  if (session.user.role !== "teacher" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const suggestions = await db
      .select()
      .from(suggestedTopics)
      .where(eq(suggestedTopics.scholarId, params.id))
      .orderBy(desc(suggestedTopics.createdAt));

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    return NextResponse.json(
      { error: "Failed to fetch suggestions" },
      { status: 500 }
    );
  }
}

// POST /api/scholars/[id]/suggestions - Add a suggested topic for a scholar
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only teachers/admins can add suggestions
  if (session.user.role !== "teacher" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { topic, rationale, targetBloomLevel } = body;

    if (!topic) {
      return NextResponse.json(
        { error: "topic is required" },
        { status: 400 }
      );
    }

    const newSuggestion = await db
      .insert(suggestedTopics)
      .values({
        scholarId: params.id,
        teacherId: session.user.id,
        topic,
        rationale: rationale || null,
        targetBloomLevel: targetBloomLevel || null,
        createdAt: new Date(),
      })
      .returning();

    return NextResponse.json({ suggestion: newSuggestion[0] });
  } catch (error) {
    console.error("Error adding suggestion:", error);
    return NextResponse.json(
      { error: "Failed to add suggestion" },
      { status: 500 }
    );
  }
}

// DELETE /api/scholars/[id]/suggestions - Delete a suggested topic
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only teachers/admins can delete suggestions
  if (session.user.role !== "teacher" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const suggestionId = searchParams.get("suggestionId");

    if (!suggestionId) {
      return NextResponse.json(
        { error: "suggestionId is required" },
        { status: 400 }
      );
    }

    await db
      .delete(suggestedTopics)
      .where(eq(suggestedTopics.id, suggestionId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting suggestion:", error);
    return NextResponse.json(
      { error: "Failed to delete suggestion" },
      { status: 500 }
    );
  }
}
