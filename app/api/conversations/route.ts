import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, conversations, messages, projects, personas, perspectives } from "@/db";
import { eq, desc, and } from "drizzle-orm";

// GET - List all non-archived conversations for current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Teachers can pass ?userId= to view a scholar's conversations (remote mode)
    const isTeacher = session.user.role === "teacher" || session.user.role === "admin";
    const requestedUserId = request.nextUrl.searchParams.get("userId");
    const targetUserId = (isTeacher && requestedUserId) ? requestedUserId : session.user.id;

    const userConversations = await db
      .select({
        id: conversations.id,
        userId: conversations.userId,
        projectId: conversations.projectId,
        personaId: conversations.personaId,
        perspectiveId: conversations.perspectiveId,
        title: conversations.title,
        status: conversations.status,
        analysisSummary: conversations.analysisSummary,
        teacherWhisper: conversations.teacherWhisper,
        isArchived: conversations.isArchived,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        projectTitle: projects.title,
        personaTitle: personas.title,
        personaEmoji: personas.emoji,
        perspectiveTitle: perspectives.title,
        perspectiveIcon: perspectives.icon,
      })
      .from(conversations)
      .leftJoin(projects, eq(conversations.projectId, projects.id))
      .leftJoin(personas, eq(conversations.personaId, personas.id))
      .leftJoin(perspectives, eq(conversations.perspectiveId, perspectives.id))
      .where(
        and(
          eq(conversations.userId, targetUserId),
          eq(conversations.isArchived, false)
        )
      )
      .orderBy(desc(conversations.updatedAt));

    return NextResponse.json({ conversations: userConversations });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create new conversation (optionally linked to a project)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse body for optional dimension IDs and userId override (for teacher remote mode)
    let projectId: string | null = null;
    let personaId: string | null = null;
    let perspectiveId: string | null = null;
    let projectTitle: string | null = null;
    let ownerUserId = session.user.id;

    try {
      const body = await request.json();
      projectId = body.projectId || null;
      personaId = body.personaId || null;
      perspectiveId = body.perspectiveId || null;

      // Teachers can create conversations on behalf of a scholar
      const isTeacher = session.user.role === "teacher" || session.user.role === "admin";
      if (isTeacher && body.userId) {
        ownerUserId = body.userId;
      }
    } catch {
      // No body or invalid JSON is fine
    }

    // If projectId provided, verify it exists and is active
    if (projectId) {
      const project = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.isActive, true)))
        .limit(1);

      if (project.length === 0) {
        return NextResponse.json(
          { error: "Project not found or inactive" },
          { status: 404 }
        );
      }
      projectTitle = project[0].title;
    }

    const newConversation = {
      id: crypto.randomUUID(),
      userId: ownerUserId,
      projectId,
      personaId,
      perspectiveId,
      title: projectTitle ? `${projectTitle}` : "New Conversation",
      status: "green" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      isArchived: false,
    };

    await db.insert(conversations).values(newConversation);

    return NextResponse.json({
      conversation: { ...newConversation, projectTitle, personaTitle: null, personaEmoji: null, perspectiveTitle: null, perspectiveIcon: null }
    });
  } catch (error) {
    console.error("Error creating conversation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
