import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, projects, users } from "@/db";
import { eq, desc, and } from "drizzle-orm";

// GET /api/projects - List all active projects (for scholars) or all projects (for teachers)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const isTeacher = session.user.role === "teacher" || session.user.role === "admin";

    // Teachers see all projects, scholars see only active ones
    const projectList = await db
      .select({
        id: projects.id,
        title: projects.title,
        description: projects.description,
        systemPrompt: projects.systemPrompt,
        rubric: projects.rubric,
        targetBloomLevel: projects.targetBloomLevel,
        isActive: projects.isActive,
        teacherId: projects.teacherId,
        teacherName: users.name,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .leftJoin(users, eq(projects.teacherId, users.id))
      .where(isTeacher ? undefined : eq(projects.isActive, true))
      .orderBy(desc(projects.createdAt));

    return NextResponse.json({ projects: projectList });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create a new project (teachers only)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only teachers/admins can create projects
  if (session.user.role !== "teacher" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { title, description, systemPrompt, rubric, targetBloomLevel } = body;

    if (!title?.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const projectId = crypto.randomUUID();
    const now = new Date();

    await db.insert(projects).values({
      id: projectId,
      teacherId: session.user.id,
      title: title.trim(),
      description: description?.trim() || null,
      systemPrompt: systemPrompt?.trim() || null,
      rubric: rubric ? JSON.stringify(rubric) : null,
      targetBloomLevel: targetBloomLevel || null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const newProject = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    return NextResponse.json({ project: newProject[0] }, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
