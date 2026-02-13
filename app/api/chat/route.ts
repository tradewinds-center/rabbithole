import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, conversations, messages, users, projects, personas, perspectives } from "@/db";
import { eq, and } from "drizzle-orm";
import { buildSystemPrompt, sendMessage, type ChatMessage, type ProjectContext, type PersonaContext, type PerspectiveContext } from "@/lib/claude";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { conversationId, message } = body;

    if (!conversationId || !message) {
      return NextResponse.json(
        { error: "Missing conversationId or message" },
        { status: 400 }
      );
    }

    // Verify conversation access: teachers can send in any conversation, scholars only their own
    const isTeacher = session.user.role === "teacher" || session.user.role === "admin";
    const conversation = await db
      .select()
      .from(conversations)
      .where(
        isTeacher
          ? eq(conversations.id, conversationId)
          : and(
              eq(conversations.id, conversationId),
              eq(conversations.userId, session.user.id)
            )
      )
      .limit(1);

    if (conversation.length === 0) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Save user message with dimension snapshots
    const userMessageId = crypto.randomUUID();
    await db.insert(messages).values({
      id: userMessageId,
      conversationId,
      role: "user",
      content: message,
      personaId: conversation[0].personaId || null,
      projectId: conversation[0].projectId || null,
      perspectiveId: conversation[0].perspectiveId || null,
      createdAt: new Date(),
    });

    // Get conversation history
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    const chatHistory: ChatMessage[] = history
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // Fetch the scholar's reading level (use conversation owner, not session user)
    const scholarId = conversation[0].userId;
    const user = await db
      .select({ readingLevel: users.readingLevel })
      .from(users)
      .where(eq(users.id, scholarId))
      .limit(1);

    const readingLevel = user.length > 0 ? user[0].readingLevel : null;

    // Fetch project context if conversation is linked to a project
    let projectContext: ProjectContext | null = null;
    if (conversation[0].projectId) {
      const project = await db
        .select()
        .from(projects)
        .where(eq(projects.id, conversation[0].projectId))
        .limit(1);

      if (project.length > 0) {
        projectContext = {
          title: project[0].title,
          description: project[0].description,
          systemPrompt: project[0].systemPrompt,
          rubric: project[0].rubric,
          targetBloomLevel: project[0].targetBloomLevel,
        };
      }
    }

    // Fetch persona context
    let personaContext: PersonaContext | null = null;
    if (conversation[0].personaId) {
      const persona = await db
        .select()
        .from(personas)
        .where(eq(personas.id, conversation[0].personaId))
        .limit(1);

      if (persona.length > 0) {
        personaContext = {
          title: persona[0].title,
          emoji: persona[0].emoji,
          systemPrompt: persona[0].systemPrompt,
        };
      }
    }

    // Fetch perspective context
    let perspectiveContext: PerspectiveContext | null = null;
    if (conversation[0].perspectiveId) {
      const perspective = await db
        .select()
        .from(perspectives)
        .where(eq(perspectives.id, conversation[0].perspectiveId))
        .limit(1);

      if (perspective.length > 0) {
        perspectiveContext = {
          title: perspective[0].title,
          icon: perspective[0].icon,
          systemPrompt: perspective[0].systemPrompt,
        };
      }
    }

    // Build system prompt with all context dimensions
    const systemPrompt = buildSystemPrompt(
      conversation[0].teacherWhisper,
      readingLevel,
      projectContext,
      personaContext,
      perspectiveContext
    );

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropicStream = await sendMessage(chatHistory, systemPrompt);
          let fullContent = "";
          let model = "";
          let tokensUsed = 0;

          for await (const event of anthropicStream as AsyncIterable<Anthropic.MessageStreamEvent>) {
            if (event.type === "content_block_delta") {
              const delta = event.delta;
              if ("text" in delta) {
                fullContent += delta.text;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text: delta.text })}\n\n`)
                );
              }
            } else if (event.type === "message_start") {
              model = event.message.model;
            } else if (event.type === "message_delta") {
              if (event.usage) {
                tokensUsed = event.usage.output_tokens;
              }
            }
          }

          // Save assistant message with dimension snapshots
          const assistantMessageId = crypto.randomUUID();
          await db.insert(messages).values({
            id: assistantMessageId,
            conversationId,
            role: "assistant",
            content: fullContent,
            model,
            tokensUsed,
            personaId: conversation[0].personaId || null,
            projectId: conversation[0].projectId || null,
            perspectiveId: conversation[0].perspectiveId || null,
            createdAt: new Date(),
          });

          // Update conversation timestamp and generate title if first exchange
          const updateData: Record<string, unknown> = { updatedAt: new Date() };

          // Generate title from first message if conversation is new
          if (chatHistory.length <= 2 && conversation[0].title === "New Conversation") {
            // Use first few words of user message as title
            const words = message.split(" ").slice(0, 6).join(" ");
            updateData.title = words.length > 40 ? words.slice(0, 40) + "..." : words;
          }

          await db
            .update(conversations)
            .set(updateData)
            .where(eq(conversations.id, conversationId));

          // Send completion signal
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, messageId: assistantMessageId })}\n\n`
            )
          );
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: "Stream error" })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
