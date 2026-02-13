import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, perspectives, users } from "@/db";
import { eq } from "drizzle-orm";

// GET /api/perspectives/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const perspectiveId = params.id;
    const isTeacher = session.user.role === "teacher" || session.user.role === "admin";

    const perspective = await db
      .select({
        id: perspectives.id,
        title: perspectives.title,
        icon: perspectives.icon,
        description: perspectives.description,
        systemPrompt: perspectives.systemPrompt,
        isActive: perspectives.isActive,
        teacherId: perspectives.teacherId,
        teacherName: users.name,
        createdAt: perspectives.createdAt,
        updatedAt: perspectives.updatedAt,
      })
      .from(perspectives)
      .leftJoin(users, eq(perspectives.teacherId, users.id))
      .where(eq(perspectives.id, perspectiveId))
      .limit(1);

    if (perspective.length === 0) {
      return NextResponse.json({ error: "Perspective not found" }, { status: 404 });
    }

    if (!isTeacher && !perspective[0].isActive) {
      return NextResponse.json({ error: "Perspective not found" }, { status: 404 });
    }

    return NextResponse.json({ perspective: perspective[0] });
  } catch (error) {
    console.error("Error fetching perspective:", error);
    return NextResponse.json(
      { error: "Failed to fetch perspective" },
      { status: 500 }
    );
  }
}

// PATCH /api/perspectives/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "teacher" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const perspectiveId = params.id;
    const body = await request.json();
    const { title, icon, description, systemPrompt, isActive } = body;

    const existing = await db
      .select()
      .from(perspectives)
      .where(eq(perspectives.id, perspectiveId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Perspective not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title.trim();
    if (icon !== undefined) updates.icon = icon?.trim() || null;
    if (description !== undefined) updates.description = description?.trim() || null;
    if (systemPrompt !== undefined) updates.systemPrompt = systemPrompt?.trim() || null;
    if (isActive !== undefined) updates.isActive = isActive;

    await db
      .update(perspectives)
      .set(updates)
      .where(eq(perspectives.id, perspectiveId));

    const updated = await db
      .select()
      .from(perspectives)
      .where(eq(perspectives.id, perspectiveId))
      .limit(1);

    return NextResponse.json({ perspective: updated[0] });
  } catch (error) {
    console.error("Error updating perspective:", error);
    return NextResponse.json(
      { error: "Failed to update perspective" },
      { status: 500 }
    );
  }
}

// DELETE /api/perspectives/[id] - soft delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "teacher" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const perspectiveId = params.id;

    const existing = await db
      .select()
      .from(perspectives)
      .where(eq(perspectives.id, perspectiveId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Perspective not found" }, { status: 404 });
    }

    await db
      .update(perspectives)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(perspectives.id, perspectiveId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting perspective:", error);
    return NextResponse.json(
      { error: "Failed to delete perspective" },
      { status: 500 }
    );
  }
}
