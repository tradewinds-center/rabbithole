import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, conversations, messages, users } from "@/db";
import { eq, and } from "drizzle-orm";
import { buildSystemPrompt, sendMessage, type ChatMessage } from "@/lib/claude";
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

    // Verify conversation belongs to user
    const conversation = await db
      .select()
      .from(conversations)
      .where(
        and(
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

    // Save user message
    const userMessageId = crypto.randomUUID();
    await db.insert(messages).values({
      id: userMessageId,
      conversationId,
      role: "user",
      content: message,
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

    // Fetch user's reading level
    const user = await db
      .select({ readingLevel: users.readingLevel })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    const readingLevel = user.length > 0 ? user[0].readingLevel : null;

    // Build system prompt with teacher whisper and reading level
    const systemPrompt = buildSystemPrompt(conversation[0].teacherWhisper, readingLevel);

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

          // Save assistant message
          const assistantMessageId = crypto.randomUUID();
          await db.insert(messages).values({
            id: assistantMessageId,
            conversationId,
            role: "assistant",
            content: fullContent,
            model,
            tokensUsed,
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
