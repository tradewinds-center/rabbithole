import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, conversations, messages, projects } from "@/db";
import { eq, desc, and, isNull } from "drizzle-orm";

// GET - List conversations for current user (optionally filter by projectId)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    // Build where conditions
    const conditions = [
      eq(conversations.userId, session.user.id),
      eq(conversations.isArchived, false),
    ];

    // Filter by project: "none" = general chats, specific ID = project chats
    if (projectId === "none") {
      conditions.push(isNull(conversations.projectId));
    } else if (projectId) {
      conditions.push(eq(conversations.projectId, projectId));
    }

    const userConversations = await db
      .select({
        id: conversations.id,
        userId: conversations.userId,
        projectId: conversations.projectId,
        title: conversations.title,
        status: conversations.status,
        analysisSummary: conversations.analysisSummary,
        teacherWhisper: conversations.teacherWhisper,
        isArchived: conversations.isArchived,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        projectTitle: projects.title,
      })
      .from(conversations)
      .leftJoin(projects, eq(conversations.projectId, projects.id))
      .where(and(...conditions))
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

    // Parse body for optional projectId
    let projectId: string | null = null;
    let projectTitle: string | null = null;

    try {
      const body = await request.json();
      projectId = body.projectId || null;
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
      userId: session.user.id,
      projectId: projectId,
      title: projectTitle ? `${projectTitle}` : "New Conversation",
      status: "green" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      isArchived: false,
    };

    await db.insert(conversations).values(newConversation);

    return NextResponse.json({
      conversation: { ...newConversation, projectTitle }
    });
  } catch (error) {
    console.error("Error creating conversation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
