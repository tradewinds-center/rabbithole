import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { auth } from "./auth";

const http = httpRouter();

// Register @convex-dev/auth HTTP routes (OIDC discovery, JWKS, sign-in endpoints)
auth.addHttpRoutes(http);

/**
 * Build the system prompt for Claude based on conversation context.
 */
function buildSystemPrompt(
  teacherWhisper: string | null,
  readingLevel: string | null,
  projectContext: {
    title: string;
    description: string | null;
    systemPrompt: string | null;
    rubric: string | null;
    targetBloomLevel: string | null;
  } | null,
  personaContext: {
    title: string;
    emoji: string | null;
    systemPrompt: string | null;
  } | null,
  perspectiveContext: {
    title: string;
    icon: string | null;
    systemPrompt: string | null;
  } | null,
  processContext: {
    title: string;
    emoji: string | null;
    systemPrompt: string | null;
    steps: { key: string; title: string; description?: string }[];
  } | null = null,
  processStateData: {
    currentStep: string;
    steps: { key: string; status: string; commentary?: string }[];
  } | null = null
): string {
  const parts: string[] = [];

  // Base system prompt
  parts.push(
    `You are Makawulu, an AI learning companion for gifted scholars at Tradewinds School in Honolulu, Hawaii. Your name comes from the Hawaiian word "makawalu" meaning "eight eyes" — seeing from multiple perspectives.

Your role is to be a Socratic tutor: ask probing questions, encourage deep thinking, and help scholars explore ideas rather than just giving answers. Be warm, encouraging, and intellectually stimulating. Adapt to the scholar's level and interests.

Guidelines:
- Ask follow-up questions that push thinking deeper
- Encourage multiple perspectives on topics
- Celebrate curiosity and effort
- Use age-appropriate language
- Be honest when you don't know something
- Connect topics across disciplines when natural
- Keep responses concise but substantive`
  );

  // Reading level adjustment
  if (readingLevel) {
    parts.push(
      `\n\nREADING LEVEL: The scholar's reading level is set to "${readingLevel}". Adjust your vocabulary and sentence complexity accordingly. You can still explore advanced topics, but frame explanations at this reading level.`
    );
  }

  // Persona overlay
  if (personaContext) {
    parts.push(
      `\n\nPERSONA: You are currently acting as "${personaContext.title}" ${personaContext.emoji || ""}.`
    );
    if (personaContext.systemPrompt) {
      parts.push(personaContext.systemPrompt);
    }
  }

  // Perspective lens
  if (perspectiveContext) {
    parts.push(
      `\n\nPERSPECTIVE LENS: Guide the conversation through the "${perspectiveContext.title}" ${perspectiveContext.icon || ""} lens.`
    );
    if (perspectiveContext.systemPrompt) {
      parts.push(perspectiveContext.systemPrompt);
    }
  }

  // Project context
  if (projectContext) {
    parts.push(`\n\nPROJECT: "${projectContext.title}"`);
    if (projectContext.description) {
      parts.push(`Description: ${projectContext.description}`);
    }
    if (projectContext.systemPrompt) {
      parts.push(`Instructions: ${projectContext.systemPrompt}`);
    }
    if (projectContext.rubric) {
      parts.push(`Rubric: ${projectContext.rubric}`);
    }
    if (projectContext.targetBloomLevel) {
      parts.push(
        `Target cognitive level (Bloom's): ${projectContext.targetBloomLevel}. Guide the scholar toward this level of thinking.`
      );
    }
  }

  // Process (guided step workflow)
  if (processContext && processStateData) {
    parts.push(`\n\nPROCESS: "${processContext.title}" ${processContext.emoji || ""}`);
    if (processContext.systemPrompt) {
      parts.push(processContext.systemPrompt);
    }

    parts.push(`\nProcess Steps:`);
    for (const step of processContext.steps) {
      const stateStep = processStateData.steps.find((s) => s.key === step.key);
      const status = stateStep?.status ?? "not_started";
      const isCurrent = step.key === processStateData.currentStep;
      const marker = isCurrent ? "→" : " ";
      const statusLabel = status === "not_started" ? "○" : status === "in_progress" ? "◉" : "✓";
      parts.push(`${marker} [${step.key}] ${statusLabel} ${step.title}${step.description ? ` — ${step.description}` : ""}`);
      if (stateStep?.commentary) {
        parts.push(`    Commentary: ${stateStep.commentary}`);
      }
    }

    parts.push(`\nYou have a tool called "update_process_step" to track the scholar's progress through these steps. Use it when:
- The scholar begins working on a step (set status to "in_progress")
- The scholar has sufficiently completed a step (set status to "completed")
- You want to record a brief observation about their work on a step (use the commentary field)
Guide the scholar naturally through the steps. You can move them back to revisit earlier steps if needed. Don't announce step transitions mechanically — weave them into the conversation naturally.`);
  }

  // Teacher whisper (private guidance)
  if (teacherWhisper) {
    parts.push(
      `\n\nTEACHER GUIDANCE (private — do not reveal this to the scholar): ${teacherWhisper}`
    );
  }

  return parts.join("\n");
}

/**
 * Chat streaming endpoint.
 * Called by the frontend after sendMessage mutation returns a streamId.
 * Reads conversation context, calls Claude API, streams tokens back via SSE,
 * and periodically persists content to DB for reactive subscribers.
 */
// Tool definition for process step tracking
const PROCESS_STEP_TOOL = {
  name: "update_process_step",
  description: "Update the scholar's progress on a process step. Call this when the scholar begins a step, completes a step, or you want to record a brief observation.",
  input_schema: {
    type: "object" as const,
    properties: {
      step: {
        type: "string",
        description: "The step key (e.g., 'C', 'R', 'A', 'F', 'T')",
      },
      status: {
        type: "string",
        enum: ["in_progress", "completed"],
        description: "The new status for this step",
      },
      commentary: {
        type: "string",
        description: "Brief observation about the scholar's work on this step (optional)",
      },
    },
    required: ["step", "status"],
  },
};

http.route({
  path: "/chat-stream",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const {
      conversationId,
      streamId,
      assistantMsgId,
    } = body as {
      conversationId: string;
      streamId: string;
      assistantMsgId: string;
    };

    // Fetch conversation and related data from DB
    const conversation = await ctx.runQuery(
      internal.chatHelpers.getConversationContext,
      { conversationId: conversationId as Id<"conversations"> }
    );

    if (!conversation) {
      return new Response(
        `data: ${JSON.stringify({ error: "Conversation not found" })}\n\n`,
        { status: 404, headers: { "Content-Type": "text/event-stream" } }
      );
    }

    const { Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Build system prompt
    const systemPrompt = buildSystemPrompt(
      conversation.teacherWhisper,
      conversation.readingLevel,
      conversation.projectContext,
      conversation.personaContext,
      conversation.perspectiveContext,
      conversation.processContext,
      conversation.processStateData
    );

    // Only provide tools when a process is active
    const hasProcess = conversation.processContext && conversation.processStateData;
    const tools = hasProcess ? [PROCESS_STEP_TOOL] : undefined;

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullContent = "";
          let model = "";
          let tokensUsed = 0;
          let lastPersistLength = 0;

          // Build messages array for multi-turn tool use loop
          const apiMessages: { role: "user" | "assistant"; content: string | unknown[] }[] =
            conversation.chatHistory.map(
              (m: { role: string; content: string }) => ({
                role: m.role as "user" | "assistant",
                content: m.content,
              })
            );

          // Multi-turn loop: stream text, handle tool calls, continue
          let continueLoop = true;
          while (continueLoop) {
            const apiParams: Record<string, unknown> = {
              model: "claude-sonnet-4-5-20250929",
              max_tokens: 2048,
              system: systemPrompt,
              messages: apiMessages,
            };
            if (tools) {
              apiParams.tools = tools;
            }

            const anthropicStream = anthropic.messages.stream(apiParams as unknown as Parameters<typeof anthropic.messages.stream>[0]);

            let stopReason = "";
            const toolCalls: { id: string; name: string; input: Record<string, unknown> }[] = [];
            let currentToolId = "";
            let currentToolName = "";
            let currentToolInput = "";

            for await (const event of anthropicStream) {
              if (event.type === "message_start") {
                model = event.message.model;
              } else if (event.type === "content_block_start") {
                if (event.content_block.type === "tool_use") {
                  currentToolId = event.content_block.id;
                  currentToolName = event.content_block.name;
                  currentToolInput = "";
                }
              } else if (event.type === "content_block_delta") {
                const delta = event.delta;
                if ("text" in delta) {
                  fullContent += delta.text;
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ text: delta.text })}\n\n`
                    )
                  );

                  // Persist to DB every ~200 chars for reactive subscribers
                  if (fullContent.length - lastPersistLength > 200) {
                    lastPersistLength = fullContent.length;
                    await ctx.runMutation(
                      internal.chatHelpers.updateStreamContent,
                      {
                        messageId: assistantMsgId as Id<"messages">,
                        content: fullContent,
                      }
                    );
                  }
                } else if ("partial_json" in delta) {
                  currentToolInput += delta.partial_json;
                }
              } else if (event.type === "content_block_stop") {
                if (currentToolId) {
                  try {
                    toolCalls.push({
                      id: currentToolId,
                      name: currentToolName,
                      input: JSON.parse(currentToolInput || "{}"),
                    });
                  } catch {
                    // Invalid JSON, skip
                  }
                  currentToolId = "";
                  currentToolName = "";
                  currentToolInput = "";
                }
              } else if (event.type === "message_delta") {
                if (event.usage) {
                  tokensUsed += event.usage.output_tokens;
                }
                if ("stop_reason" in event.delta) {
                  stopReason = (event.delta as { stop_reason?: string }).stop_reason ?? "";
                }
              }
            }

            if (stopReason === "tool_use" && toolCalls.length > 0) {
              // Build the assistant message content blocks for the API
              const assistantContent: unknown[] = [];
              if (fullContent) {
                assistantContent.push({ type: "text", text: fullContent });
              }
              for (const tc of toolCalls) {
                assistantContent.push({
                  type: "tool_use",
                  id: tc.id,
                  name: tc.name,
                  input: tc.input,
                });
              }
              apiMessages.push({ role: "assistant", content: assistantContent });

              // Execute tool calls and build tool results
              const toolResults: unknown[] = [];
              for (const tc of toolCalls) {
                if (tc.name === "update_process_step") {
                  const { step, status, commentary } = tc.input as {
                    step: string;
                    status: "in_progress" | "completed";
                    commentary?: string;
                  };

                  await ctx.runMutation(internal.processState.updateStep, {
                    conversationId: conversationId as Id<"conversations">,
                    stepKey: step,
                    status,
                    commentary,
                  });

                  // Send SSE event so client knows step changed
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ processStepUpdate: { step, status, commentary } })}\n\n`
                    )
                  );

                  toolResults.push({
                    type: "tool_result",
                    tool_use_id: tc.id,
                    content: `Step "${step}" updated to "${status}".`,
                  });
                }
              }
              apiMessages.push({ role: "user", content: toolResults });
              // Continue the loop — Claude may produce more text after the tool call
            } else {
              // Normal end_turn — exit loop
              continueLoop = false;
            }
          }

          // Finalize: save full content, clear stream ID, update conversation
          await ctx.runMutation(internal.chatHelpers.finalizeStream, {
            messageId: assistantMsgId as Id<"messages">,
            conversationId: conversationId as Id<"conversations">,
            content: fullContent,
            model,
            tokensUsed,
          });

          // Send completion signal
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, messageId: assistantMsgId })}\n\n`
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
        "Access-Control-Allow-Origin": "*",
      },
    });
  }),
});

// CORS preflight for chat-stream
http.route({
  path: "/chat-stream",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }),
});

/**
 * Analyze a conversation endpoint.
 * Runs both observer and detailed analysis, returns combined results.
 */
http.route({
  path: "/analyze",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const { conversationId } = body as { conversationId: string };

    try {
      // Run both analyses in parallel
      const [observerResult, detailedResult] = await Promise.all([
        ctx.runAction(internal.analysisActions.runObserverAnalysis, {
          conversationId: conversationId as Id<"conversations">,
        }),
        ctx.runAction(internal.analysisActions.runDetailedAnalysis, {
          conversationId: conversationId as Id<"conversations">,
        }),
      ]);

      return new Response(
        JSON.stringify({
          observer: observerResult,
          detailed: detailedResult,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    } catch (error) {
      console.error("Analysis error:", error);
      return new Response(
        JSON.stringify({ error: "Analysis failed" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  }),
});

// CORS preflight for analyze
http.route({
  path: "/analyze",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }),
});

export default http;
