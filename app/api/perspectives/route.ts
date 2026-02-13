import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, perspectives, users } from "@/db";
import { eq, desc } from "drizzle-orm";

// GET /api/perspectives - List all active perspectives (for scholars) or all (for teachers)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const isTeacher = session.user.role === "teacher" || session.user.role === "admin";

    const perspectiveList = await db
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
      .where(isTeacher ? undefined : eq(perspectives.isActive, true))
      .orderBy(desc(perspectives.createdAt));

    return NextResponse.json({ perspectives: perspectiveList });
  } catch (error) {
    console.error("Error fetching perspectives:", error);
    return NextResponse.json(
      { error: "Failed to fetch perspectives" },
      { status: 500 }
    );
  }
}

// POST /api/perspectives - Create a new perspective (teachers only)
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
    const { title, icon, description, systemPrompt } = body;

    if (!title?.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const perspectiveId = crypto.randomUUID();
    const now = new Date();

    await db.insert(perspectives).values({
      id: perspectiveId,
      teacherId: session.user.id,
      title: title.trim(),
      icon: icon?.trim() || null,
      description: description?.trim() || null,
      systemPrompt: systemPrompt?.trim() || null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const newPerspective = await db
      .select()
      .from(perspectives)
      .where(eq(perspectives.id, perspectiveId))
      .limit(1);

    return NextResponse.json({ perspective: newPerspective[0] }, { status: 201 });
  } catch (error) {
    console.error("Error creating perspective:", error);
    return NextResponse.json(
      { error: "Failed to create perspective" },
      { status: 500 }
    );
  }
}
