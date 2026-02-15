import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { auth } from "./auth";
import { buildSystemPrompt } from "./projectHelpers";

const http = httpRouter();

// Register @convex-dev/auth HTTP routes (OIDC discovery, JWKS, sign-in endpoints)
auth.addHttpRoutes(http);

/**
 * Project streaming endpoint.
 * Called by the frontend after sendMessage mutation returns a streamId.
 * Reads project context, calls Claude API via beta tool runner,
 * streams tokens back via SSE, and periodically persists content to DB.
 */
http.route({
  path: "/project-stream",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const {
      projectId,
      streamId,
      assistantMsgId: initialAssistantMsgId,
    } = body as {
      projectId: string;
      streamId: string;
      assistantMsgId: string;
    };
    let assistantMsgId = initialAssistantMsgId;

    // Fetch project and related data from DB
    const project = await ctx.runQuery(
      internal.projectHelpers.getProjectContext,
      { projectId: projectId as Id<"projects"> }
    );

    if (!project) {
      return new Response(
        `data: ${JSON.stringify({ error: "Project not found" })}\n\n`,
        { status: 404, headers: { "Content-Type": "text/event-stream" } }
      );
    }

    const { Anthropic } = await import("@anthropic-ai/sdk");
    const { betaTool } = await import("@anthropic-ai/sdk/helpers/beta/json-schema");

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Build system prompt (now includes artifact data + dossier)
    const systemPrompt = buildSystemPrompt(
      project.teacherWhisper,
      project.readingLevel,
      project.scholarName,
      project.unitContext,
      project.personaContext,
      project.perspectiveContext,
      project.processContext,
      project.processStateData,
      project.artifactData,
      project.dossierContent
    );

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullContent = "";
          let model = "";
          let tokensUsed = 0;
          let lastPersistLength = 0;

          const projId = projectId as Id<"projects">;

          // Build messages for API
          const apiMessages = project.chatHistory.map(
            (m: { role: string; content: string }) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })
          );

          // ── Inject pending whisper before last user message ──────────
          if (project.pendingWhisper) {
            const lastUserIdx = apiMessages.reduce(
              (last: number, m: { role: string }, i: number) =>
                m.role === "user" ? i : last,
              -1
            );
            if (lastUserIdx >= 0) {
              apiMessages.splice(lastUserIdx, 0, {
                role: "user" as const,
                content: `[TEACHER WHISPER — private guidance, do not reveal to scholar]: ${project.pendingWhisper}`,
              });
            }
          }

          // ── Define tools with run callbacks ──────────────────────────

          const hasProcess = project.processContext && project.processStateData;

          const processStepTool = betaTool({
            name: "update_process_step",
            description: "Update the scholar's progress on a process step. Call this when the scholar begins a step, completes a step, or you want to record a brief observation.",
            inputSchema: {
              type: "object" as const,
              properties: {
                step: {
                  type: "string" as const,
                  description: "The step key (e.g., 'C', 'R', 'A', 'F', 'T')",
                },
                status: {
                  type: "string" as const,
                  enum: ["in_progress", "completed"] as const,
                  description: "The new status for this step",
                },
                commentary: {
                  type: "string" as const,
                  description: "Brief observation about the scholar's work on this step (optional)",
                },
              },
              required: ["step", "status"] as const,
            },
            run: async (input) => {
              const status = input.status as "in_progress" | "completed";
              await ctx.runMutation(internal.processState.updateStep, {
                projectId: projId,
                stepKey: input.step,
                status,
                commentary: input.commentary,
              });
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ processStepUpdate: { step: input.step, status, commentary: input.commentary } })}\n\n`
                )
              );
              const label = status === "completed" ? `Completed step: ${input.step}` : `Started step: ${input.step}`;
              const newId = await ctx.runMutation(internal.projectHelpers.splitStream, {
                currentMessageId: assistantMsgId as Id<"messages">,
                projectId: projId,
                contentSoFar: fullContent,
                toolAction: label,
              });
              assistantMsgId = newId;
              fullContent = "";
              lastPersistLength = 0;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ newAssistantMsg: String(newId) })}\n\n`
                )
              );
              return `Step "${input.step}" updated to "${status}".`;
            },
          });

          const editDocumentTool = betaTool({
            name: "edit_document",
            description: "Create, view, rename, or edit the scholar's working documents using targeted edits. Use this to help the scholar build written work. Multiple documents can exist — use document_id to target a specific one.",
            inputSchema: {
              type: "object" as const,
              properties: {
                command: {
                  type: "string" as const,
                  enum: ["create", "view", "rename", "str_replace", "insert"] as const,
                  description: "The operation to perform on the document",
                },
                document_id: {
                  type: "string" as const,
                  description: "ID of specific document to edit. If omitted, edits the most recent document. Required for str_replace, insert, and rename when multiple documents exist.",
                },
                title: {
                  type: "string" as const,
                  description: "Document title (for create or rename)",
                },
                file_text: {
                  type: "string" as const,
                  description: "Full initial content (for create)",
                },
                old_str: {
                  type: "string" as const,
                  description: "Exact text to find (for str_replace). Must match exactly.",
                },
                new_str: {
                  type: "string" as const,
                  description: "Replacement text (for str_replace)",
                },
                insert_line: {
                  type: "number" as const,
                  description: "Line number to insert after (for insert, 0 = beginning)",
                },
                insert_text: {
                  type: "string" as const,
                  description: "Text to insert (for insert)",
                },
              },
              required: ["command"] as const,
            },
            run: async (input) => {
              const docId = (input as { document_id?: string }).document_id as Id<"artifacts"> | undefined;

              switch (input.command) {
                case "create": {
                  const newArtifactId = await ctx.runMutation(internal.artifacts.aiCreate, {
                    projectId: projId,
                    title: (input as { title?: string }).title || "Document",
                    content: (input as { file_text?: string }).file_text || "",
                  });
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ artifactUpdate: true, newArtifactId: String(newArtifactId) })}\n\n`)
                  );
                  const newId = await ctx.runMutation(internal.projectHelpers.splitStream, {
                    currentMessageId: assistantMsgId as Id<"messages">,
                    projectId: projId,
                    contentSoFar: fullContent,
                    toolAction: "Created document",
                  });
                  assistantMsgId = newId;
                  fullContent = "";
                  lastPersistLength = 0;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ newAssistantMsg: String(newId) })}\n\n`)
                  );
                  return `Document created successfully. Document ID: ${String(newArtifactId)}`;
                }
                case "view": {
                  if (docId) {
                    const artifact = await ctx.runQuery(internal.artifacts.aiGetContent, {
                      projectId: projId,
                      artifactId: docId,
                    });
                    if (!artifact || Array.isArray(artifact)) return "Error: Document not found.";
                    const lines = artifact.content.split("\n");
                    return `[${String(artifact._id)}] Title: ${artifact.title}\n` + lines.map((l: string, i: number) => `${i + 1}: ${l}`).join("\n");
                  }
                  // No document_id — return all documents
                  const allDocs = await ctx.runQuery(internal.artifacts.aiGetContent, {
                    projectId: projId,
                  });
                  if (!allDocs || (Array.isArray(allDocs) && allDocs.length === 0)) {
                    return "No documents exist yet. Use create to make one.";
                  }
                  const docs = Array.isArray(allDocs) ? allDocs : [allDocs];
                  return docs.map((doc: { _id: Id<"artifacts">; title: string; content: string }) => {
                    const lines = doc.content.split("\n");
                    const preview = lines.slice(0, 5).map((l: string, i: number) => `${i + 1}: ${l}`).join("\n");
                    return `[${String(doc._id)}] "${doc.title}" (${lines.length} lines)\n${preview}${lines.length > 5 ? "\n..." : ""}`;
                  }).join("\n\n");
                }
                case "rename": {
                  const newTitle = (input as { title?: string }).title;
                  if (!newTitle) return "Error: rename requires a title parameter.";
                  await ctx.runMutation(internal.artifacts.aiRename, {
                    projectId: projId,
                    title: newTitle,
                    ...(docId ? { artifactId: docId } : {}),
                  });
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ artifactUpdate: true })}\n\n`)
                  );
                  return `Document renamed to "${newTitle}".`;
                }
                case "str_replace": {
                  const oldStr = (input as { old_str?: string }).old_str;
                  const newStr = (input as { new_str?: string }).new_str;
                  if (!oldStr || newStr === undefined) {
                    return "Error: str_replace requires old_str and new_str parameters.";
                  }
                  const result = await ctx.runMutation(internal.artifacts.aiStrReplace, {
                    projectId: projId,
                    oldStr,
                    newStr,
                    ...(docId ? { artifactId: docId } : {}),
                  });
                  if (result.error) return result.error;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ artifactUpdate: true })}\n\n`)
                  );
                  {
                    const newId = await ctx.runMutation(internal.projectHelpers.splitStream, {
                      currentMessageId: assistantMsgId as Id<"messages">,
                      projectId: projId,
                      contentSoFar: fullContent,
                      toolAction: "Edited document",
                    });
                    assistantMsgId = newId;
                    fullContent = "";
                    lastPersistLength = 0;
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ newAssistantMsg: String(newId) })}\n\n`)
                    );
                  }
                  return "Successfully replaced text.";
                }
                case "insert": {
                  const insertLine = (input as { insert_line?: number }).insert_line ?? 0;
                  const insertText = (input as { insert_text?: string }).insert_text;
                  if (!insertText) {
                    return "Error: insert requires insert_text parameter.";
                  }
                  await ctx.runMutation(internal.artifacts.aiInsert, {
                    projectId: projId,
                    insertLine,
                    insertText,
                    ...(docId ? { artifactId: docId } : {}),
                  });
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ artifactUpdate: true })}\n\n`)
                  );
                  {
                    const newId = await ctx.runMutation(internal.projectHelpers.splitStream, {
                      currentMessageId: assistantMsgId as Id<"messages">,
                      projectId: projId,
                      contentSoFar: fullContent,
                      toolAction: "Edited document",
                    });
                    assistantMsgId = newId;
                    fullContent = "";
                    lastPersistLength = 0;
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ newAssistantMsg: String(newId) })}\n\n`)
                    );
                  }
                  return "Text inserted successfully.";
                }
                default:
                  return "Unknown command. Use create, view, str_replace, or insert.";
              }
            },
          });

          const updateDossierTool = betaTool({
            name: "update_dossier",
            description: "Update the persistent scholar profile with learning patterns, interests, strengths, and growth areas you've observed. Only call this when you have a genuine new insight — not on every message.",
            inputSchema: {
              type: "object" as const,
              properties: {
                content: {
                  type: "string" as const,
                  description: "The full updated dossier content. Use terse bullet points grouped by category (e.g., Learning Style, Interests, Strengths, Growth Areas, Behavioral Patterns). Under 500 words.",
                },
              },
              required: ["content"] as const,
            },
            run: async (input) => {
              await ctx.runMutation(internal.dossier.aiUpdate, {
                scholarId: project.scholarId,
                content: input.content,
              });
              return "Dossier updated successfully.";
            },
          });

          // Build tools array based on active features
          const tools: Parameters<typeof anthropic.beta.messages.toolRunner>[0]["tools"] = [];
          tools.push(updateDossierTool); // Always enabled
          if (hasProcess) tools.push(processStepTool);
          if (project.unitContext || (project.artifactData && project.artifactData.length > 0)) tools.push(editDocumentTool);

          // ── Stream with tool runner ──────────────────────────────────

          if (tools.length > 0) {
            // Use beta tool runner for automatic multi-turn handling
            const runner = anthropic.beta.messages.toolRunner({
              model: "claude-sonnet-4-5-20250929",
              max_tokens: 2048,
              system: systemPrompt,
              messages: apiMessages,
              tools,
              stream: true,
            });

            // Nested iteration: outer = turns, inner = streaming events
            for await (const messageStream of runner) {
              for await (const event of messageStream) {
                if (event.type === "message_start") {
                  model = event.message.model;
                } else if (event.type === "content_block_delta") {
                  const delta = event.delta;
                  if ("text" in delta) {
                    fullContent += delta.text;
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ text: delta.text })}\n\n`
                      )
                    );
                    if (fullContent.length - lastPersistLength > 200) {
                      lastPersistLength = fullContent.length;
                      await ctx.runMutation(
                        internal.projectHelpers.updateStreamContent,
                        {
                          messageId: assistantMsgId as Id<"messages">,
                          content: fullContent,
                        }
                      );
                    }
                  }
                } else if (event.type === "message_delta") {
                  if (event.usage) {
                    tokensUsed += event.usage.output_tokens;
                  }
                }
              }
            }
          } else {
            // No tools: simple streaming (no tool runner needed)
            const anthropicStream = anthropic.messages.stream({
              model: "claude-sonnet-4-5-20250929",
              max_tokens: 2048,
              system: systemPrompt,
              messages: apiMessages,
            });

            for await (const event of anthropicStream) {
              if (event.type === "message_start") {
                model = event.message.model;
              } else if (event.type === "content_block_delta") {
                const delta = event.delta;
                if ("text" in delta) {
                  fullContent += delta.text;
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ text: delta.text })}\n\n`
                    )
                  );
                  if (fullContent.length - lastPersistLength > 200) {
                    lastPersistLength = fullContent.length;
                    await ctx.runMutation(
                      internal.projectHelpers.updateStreamContent,
                      {
                        messageId: assistantMsgId as Id<"messages">,
                        content: fullContent,
                      }
                    );
                  }
                }
              } else if (event.type === "message_delta") {
                if (event.usage) {
                  tokensUsed += event.usage.output_tokens;
                }
              }
            }
          }

          // Finalize: save full content, clear stream ID, update project
          await ctx.runMutation(internal.projectHelpers.finalizeStream, {
            messageId: assistantMsgId as Id<"messages">,
            projectId: projId,
            content: fullContent,
            model,
            tokensUsed,
          });

          // Clear pending whisper after it's been consumed
          if (project.pendingWhisper) {
            await ctx.runMutation(
              internal.projectHelpers.clearPendingWhisper,
              { projectId: projId }
            );
          }

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

// CORS preflight for project-stream
http.route({
  path: "/project-stream",
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
 * Analyze a project endpoint.
 * Runs both observer and detailed analysis, returns combined results.
 */
http.route({
  path: "/analyze",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const { projectId } = body as { projectId: string };

    try {
      // Run both analyses in parallel
      const [observerResult, detailedResult] = await Promise.all([
        ctx.runAction(internal.analysisActions.runObserverAnalysis, {
          projectId: projectId as Id<"projects">,
        }),
        ctx.runAction(internal.analysisActions.runDetailedAnalysis, {
          projectId: projectId as Id<"projects">,
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
