import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, users, conversations, messages } from "@/db";
import { eq, desc, count, sql } from "drizzle-orm";

// GET - List all scholars (for teachers)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only teachers and admins can view all users
    if (session.user.role !== "teacher" && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all scholars with their conversation stats
    const scholars = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        image: users.image,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.role, "scholar"))
      .orderBy(users.name);

    // Get conversation counts and latest status for each scholar
    const scholarData = await Promise.all(
      scholars.map(async (scholar) => {
        const convos = await db
          .select({
            id: conversations.id,
            title: conversations.title,
            status: conversations.status,
            updatedAt: conversations.updatedAt,
          })
          .from(conversations)
          .where(eq(conversations.userId, scholar.id))
          .orderBy(desc(conversations.updatedAt))
          .limit(5);

        // Get message count
        const [msgCount] = await db
          .select({ count: count() })
          .from(messages)
          .innerJoin(conversations, eq(messages.conversationId, conversations.id))
          .where(eq(conversations.userId, scholar.id));

        // Determine overall status (worst status across recent conversations)
        const hasRed = convos.some((c) => c.status === "red");
        const hasYellow = convos.some((c) => c.status === "yellow");
        const overallStatus: "green" | "yellow" | "red" = hasRed
          ? "red"
          : hasYellow
          ? "yellow"
          : "green";

        return {
          ...scholar,
          conversationCount: convos.length,
          messageCount: msgCount?.count || 0,
          recentConversations: convos,
          overallStatus,
          lastActive: convos[0]?.updatedAt || scholar.createdAt,
        };
      })
    );

    return NextResponse.json({ scholars: scholarData });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - Update user role (admin only)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can change roles
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, role } = body;

    if (!userId || !role || !["scholar", "teacher", "admin"].includes(role)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
