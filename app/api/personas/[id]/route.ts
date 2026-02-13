import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, personas, users } from "@/db";
import { eq } from "drizzle-orm";

// GET /api/personas/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const personaId = params.id;
    const isTeacher = session.user.role === "teacher" || session.user.role === "admin";

    const persona = await db
      .select({
        id: personas.id,
        title: personas.title,
        emoji: personas.emoji,
        description: personas.description,
        systemPrompt: personas.systemPrompt,
        isActive: personas.isActive,
        teacherId: personas.teacherId,
        teacherName: users.name,
        createdAt: personas.createdAt,
        updatedAt: personas.updatedAt,
      })
      .from(personas)
      .leftJoin(users, eq(personas.teacherId, users.id))
      .where(eq(personas.id, personaId))
      .limit(1);

    if (persona.length === 0) {
      return NextResponse.json({ error: "Persona not found" }, { status: 404 });
    }

    if (!isTeacher && !persona[0].isActive) {
      return NextResponse.json({ error: "Persona not found" }, { status: 404 });
    }

    return NextResponse.json({ persona: persona[0] });
  } catch (error) {
    console.error("Error fetching persona:", error);
    return NextResponse.json(
      { error: "Failed to fetch persona" },
      { status: 500 }
    );
  }
}

// PATCH /api/personas/[id]
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
    const personaId = params.id;
    const body = await request.json();
    const { title, emoji, description, systemPrompt, isActive } = body;

    const existing = await db
      .select()
      .from(personas)
      .where(eq(personas.id, personaId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Persona not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title.trim();
    if (emoji !== undefined) updates.emoji = emoji.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (systemPrompt !== undefined) updates.systemPrompt = systemPrompt?.trim() || null;
    if (isActive !== undefined) updates.isActive = isActive;

    await db
      .update(personas)
      .set(updates)
      .where(eq(personas.id, personaId));

    const updated = await db
      .select()
      .from(personas)
      .where(eq(personas.id, personaId))
      .limit(1);

    return NextResponse.json({ persona: updated[0] });
  } catch (error) {
    console.error("Error updating persona:", error);
    return NextResponse.json(
      { error: "Failed to update persona" },
      { status: 500 }
    );
  }
}

// DELETE /api/personas/[id] - soft delete
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
    const personaId = params.id;

    const existing = await db
      .select()
      .from(personas)
      .where(eq(personas.id, personaId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Persona not found" }, { status: 404 });
    }

    await db
      .update(personas)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(personas.id, personaId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting persona:", error);
    return NextResponse.json(
      { error: "Failed to delete persona" },
      { status: 500 }
    );
  }
}
