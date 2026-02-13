import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, personas, users } from "@/db";
import { eq, desc } from "drizzle-orm";

// GET /api/personas - List all active personas (for scholars) or all personas (for teachers)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const isTeacher = session.user.role === "teacher" || session.user.role === "admin";

    const personaList = await db
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
      .where(isTeacher ? undefined : eq(personas.isActive, true))
      .orderBy(desc(personas.createdAt));

    return NextResponse.json({ personas: personaList });
  } catch (error) {
    console.error("Error fetching personas:", error);
    return NextResponse.json(
      { error: "Failed to fetch personas" },
      { status: 500 }
    );
  }
}

// POST /api/personas - Create a new persona (teachers only)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "teacher" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { title, emoji, description, systemPrompt } = body;

    if (!title?.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    if (!emoji?.trim()) {
      return NextResponse.json(
        { error: "Emoji is required" },
        { status: 400 }
      );
    }

    const personaId = crypto.randomUUID();
    const now = new Date();

    await db.insert(personas).values({
      id: personaId,
      teacherId: session.user.id,
      title: title.trim(),
      emoji: emoji.trim(),
      description: description?.trim() || null,
      systemPrompt: systemPrompt?.trim() || null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const newPersona = await db
      .select()
      .from(personas)
      .where(eq(personas.id, personaId))
      .limit(1);

    return NextResponse.json({ persona: newPersona[0] }, { status: 201 });
  } catch (error) {
    console.error("Error creating persona:", error);
    return NextResponse.json(
      { error: "Failed to create persona" },
      { status: 500 }
    );
  }
}
