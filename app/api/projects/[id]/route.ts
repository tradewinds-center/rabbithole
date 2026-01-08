import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, projects, users } from "@/db";
import { eq, and } from "drizzle-orm";

// GET /api/projects/[id] - Get a single project
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projectId = params.id;
    const isTeacher = session.user.role === "teacher" || session.user.role === "admin";

    const project = await db
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
      .where(eq(projects.id, projectId))
      .limit(1);

    if (project.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Scholars can only see active projects
    if (!isTeacher && !project[0].isActive) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project: project[0] });
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id] - Update a project (teachers only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only teachers/admins can update projects
  if (session.user.role !== "teacher" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const projectId = params.id;
    const body = await request.json();
    const { title, description, systemPrompt, rubric, targetBloomLevel, isActive } = body;

    // Verify project exists
    const existingProject = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (existingProject.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Build update object
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (systemPrompt !== undefined) updates.systemPrompt = systemPrompt?.trim() || null;
    if (rubric !== undefined) updates.rubric = rubric ? JSON.stringify(rubric) : null;
    if (targetBloomLevel !== undefined) updates.targetBloomLevel = targetBloomLevel || null;
    if (isActive !== undefined) updates.isActive = isActive;

    await db
      .update(projects)
      .set(updates)
      .where(eq(projects.id, projectId));

    const updatedProject = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    return NextResponse.json({ project: updatedProject[0] });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] - Delete a project (teachers only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only teachers/admins can delete projects
  if (session.user.role !== "teacher" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const projectId = params.id;

    // Verify project exists
    const existingProject = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (existingProject.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Instead of deleting, just deactivate (soft delete)
    await db
      .update(projects)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
