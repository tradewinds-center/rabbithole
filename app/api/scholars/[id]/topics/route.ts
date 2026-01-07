import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, scholarTopics, users } from "@/db";
import { eq, and } from "drizzle-orm";

// GET /api/scholars/[id]/topics - Get all topics for a scholar
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only teachers/admins can view scholar topics
  if (session.user.role !== "teacher" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const topics = await db
      .select()
      .from(scholarTopics)
      .where(eq(scholarTopics.scholarId, params.id));

    return NextResponse.json({ topics });
  } catch (error) {
    console.error("Error fetching topics:", error);
    return NextResponse.json(
      { error: "Failed to fetch topics" },
      { status: 500 }
    );
  }
}

// PATCH /api/scholars/[id]/topics - Update a topic rating
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only teachers/admins can rate topics
  if (session.user.role !== "teacher" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { topicId, rating } = body;

    if (!topicId || rating === undefined) {
      return NextResponse.json(
        { error: "topicId and rating are required" },
        { status: 400 }
      );
    }

    // Validate rating is -1, 0, or 1
    if (![-1, 0, 1].includes(rating)) {
      return NextResponse.json(
        { error: "Rating must be -1, 0, or 1" },
        { status: 400 }
      );
    }

    // Update the topic rating
    await db
      .update(scholarTopics)
      .set({
        teacherRating: rating,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scholarTopics.id, topicId),
          eq(scholarTopics.scholarId, params.id)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating topic rating:", error);
    return NextResponse.json(
      { error: "Failed to update topic rating" },
      { status: 500 }
    );
  }
}
