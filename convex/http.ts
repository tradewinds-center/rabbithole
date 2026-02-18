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

    // Build system prompt (now includes artifact data + dossier + mastery context)
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
      project.dossierContent,
      project.seeds.length > 0 ? project.seeds : null,
      project.masteryContext,
      project.signalContext,
      project.timingContext
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

          // Build messages for API (with image support)
          const apiMessages: { role: "user" | "assistant"; content: any }[] = [];
          for (const m of project.chatHistory) {
            const msg = m as { role: string; content: string; imageId: string | null };
            if (msg.imageId && msg.role === "user") {
              // Get image URL from storage, then fetch and convert to base64
              const imageUrl = await ctx.runQuery(internal.files.getUrlInternal, {
                storageId: msg.imageId as Id<"_storage">,
              });
              if (imageUrl) {
                try {
                  const imgRes = await fetch(imageUrl);
                  const imgBuf = await imgRes.arrayBuffer();
                  const bytes = new Uint8Array(imgBuf);
                  let binary = "";
                  for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                  }
                  const base64 = btoa(binary);
                  const contentType = imgRes.headers.get("content-type") || "image/png";

                  // Multi-part content: image + text
                  const contentParts: any[] = [
                    {
                      type: "image",
                      source: {
                        type: "base64",
                        media_type: contentType,
                        data: base64,
                      },
                    },
                  ];
                  if (msg.content) {
                    contentParts.push({ type: "text", text: msg.content });
                  }
                  apiMessages.push({
                    role: "user",
                    content: contentParts,
                  });
                  continue;
                } catch (err) {
                  console.error("Failed to fetch image for Claude:", err);
                }
              }
              // Fallback: image couldn't be loaded, send text only
              apiMessages.push({
                role: msg.role as "user" | "assistant",
                content: msg.content,
              });
            } else {
              apiMessages.push({
                role: msg.role as "user" | "assistant",
                content: msg.content,
              });
            }
          }

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

          const createCodeTool = betaTool({
            name: "create_code",
            description: "Create an interactive code artifact that the scholar can see rendered live. Use this when the scholar is building something visual with HTML/CSS/JavaScript — a web page, a game, an animation, a data visualization, or any interactive project. The code will be rendered in a live preview sandbox. Write a single self-contained HTML file with inline CSS and JavaScript.",
            inputSchema: {
              type: "object" as const,
              properties: {
                title: {
                  type: "string" as const,
                  description: "A short title for the code project (e.g., 'Bouncing Ball Game', 'Solar System Model')",
                },
                code: {
                  type: "string" as const,
                  description: "Complete self-contained HTML file with inline <style> and <script> tags. Must be a valid HTML document. Use modern CSS and vanilla JavaScript — no external libraries unless loaded via CDN.",
                },
              },
              required: ["title", "code"] as const,
            },
            run: async (input) => {
              const newArtifactId = await ctx.runMutation(internal.artifacts.aiCreate, {
                projectId: projId,
                title: input.title,
                content: input.code,
                type: "code",
                language: "html",
              });
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ artifactUpdate: true, newArtifactId: String(newArtifactId) })}\n\n`)
              );
              const newId = await ctx.runMutation(internal.projectHelpers.splitStream, {
                currentMessageId: assistantMsgId as Id<"messages">,
                projectId: projId,
                contentSoFar: fullContent,
                toolAction: "Created code artifact",
              });
              assistantMsgId = newId;
              fullContent = "";
              lastPersistLength = 0;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ newAssistantMsg: String(newId) })}\n\n`)
              );
              return `Code artifact created successfully. Document ID: ${String(newArtifactId)}. The scholar can now see the live preview. You can update it using edit_document with str_replace or insert commands using this document_id.`;
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
          tools.push(createCodeTool); // Always enabled — scholars can build interactive code
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

// ── Curriculum Assistant streaming endpoint ─────────────────────────────────

const CURRICULUM_ASSISTANT_SYSTEM_PROMPT = `You are a curriculum design assistant for teachers at Tradewinds School, a gifted elementary school in Honolulu.

Your job: help teachers design, adapt, and differentiate curriculum for their scholars. You have tools to look up scholar profiles, mastery data, learning signals, and existing units.

Use tools proactively when asked about a specific scholar or when designing curriculum. Always ground suggestions in actual student data.

When designing units, include: title, description, system prompt (instructions for the AI tutor), rubric, and target Bloom's level.

Tradewinds philosophy: Socratic inquiry, multiple perspectives (makawalu), depth over breadth, follow the child's curiosity.

Be concise and practical. Speak as a colleague.`;

http.route({
  path: "/curriculum-stream",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const { teacherId, streamId, assistantMsgId } = body as {
      teacherId: string;
      streamId: string;
      assistantMsgId: string;
    };

    const context = await ctx.runQuery(
      internal.curriculumAssistant.getContext,
      { teacherId: teacherId as Id<"users"> }
    );

    if (!context) {
      return new Response(
        `data: ${JSON.stringify({ error: "Context not found" })}\n\n`,
        { status: 404, headers: { "Content-Type": "text/event-stream" } }
      );
    }

    const { Anthropic } = await import("@anthropic-ai/sdk");
    const { betaTool } = await import("@anthropic-ai/sdk/helpers/beta/json-schema");

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Helper: resolve scholar name to ID
    const resolveScholar = async (scholarName: string) => {
      const scholars = await ctx.runQuery(
        internal.curriculumAssistant.listScholarsInternal, {}
      );
      const lower = scholarName.toLowerCase();
      const match = scholars.find(
        (s) => s.name.toLowerCase().includes(lower)
      );
      return match ?? null;
    };

    // Helper: resolve unit title to ID
    const resolveUnit = async (unitTitle: string) => {
      const units = await ctx.runQuery(
        internal.curriculumAssistant.listUnitsInternal, {}
      );
      const lower = unitTitle.toLowerCase();
      const match = units.find(
        (u) => u.title.toLowerCase().includes(lower)
      );
      return match ?? null;
    };

    // Define tools
    const listScholarsTool = betaTool({
      name: "list_scholars",
      description: "List all scholars with their basic info: name, reading level, project count, observation count.",
      inputSchema: {
        type: "object" as const,
        properties: {},
        required: [] as const,
      },
      run: async () => {
        const scholars = await ctx.runQuery(
          internal.curriculumAssistant.listScholarsInternal, {}
        );
        return JSON.stringify(scholars);
      },
    });

    const getScholarDossierTool = betaTool({
      name: "get_scholar_dossier",
      description: "Get a scholar's persistent profile (dossier) with learning patterns, interests, strengths, and growth areas.",
      inputSchema: {
        type: "object" as const,
        properties: {
          scholarName: {
            type: "string" as const,
            description: "The scholar's name (case-insensitive partial match)",
          },
        },
        required: ["scholarName"] as const,
      },
      run: async (input) => {
        const scholar = await resolveScholar(input.scholarName);
        if (!scholar) return `No scholar found matching "${input.scholarName}".`;
        const dossier = await ctx.runQuery(
          internal.curriculumAssistant.getScholarDossier,
          { scholarId: scholar.id as Id<"users"> }
        );
        return `Dossier for ${scholar.name}:\n${dossier}`;
      },
    });

    const getScholarMasteryTool = betaTool({
      name: "get_scholar_mastery",
      description: "Get a scholar's mastery observations grouped by domain, showing concept, Bloom's level (0-5), and evidence.",
      inputSchema: {
        type: "object" as const,
        properties: {
          scholarName: {
            type: "string" as const,
            description: "The scholar's name (case-insensitive partial match)",
          },
        },
        required: ["scholarName"] as const,
      },
      run: async (input) => {
        const scholar = await resolveScholar(input.scholarName);
        if (!scholar) return `No scholar found matching "${input.scholarName}".`;
        const mastery = await ctx.runQuery(
          internal.curriculumAssistant.getScholarMastery,
          { scholarId: scholar.id as Id<"users"> }
        );
        return JSON.stringify({ scholar: scholar.name, mastery });
      },
    });

    const getScholarSignalsTool = betaTool({
      name: "get_scholar_signals",
      description: "Get a scholar's learning signal profile: curiosity, persistence, collaboration, etc. with counts and high-intensity counts.",
      inputSchema: {
        type: "object" as const,
        properties: {
          scholarName: {
            type: "string" as const,
            description: "The scholar's name (case-insensitive partial match)",
          },
        },
        required: ["scholarName"] as const,
      },
      run: async (input) => {
        const scholar = await resolveScholar(input.scholarName);
        if (!scholar) return `No scholar found matching "${input.scholarName}".`;
        const signals = await ctx.runQuery(
          internal.curriculumAssistant.getScholarSignals,
          { scholarId: scholar.id as Id<"users"> }
        );
        return JSON.stringify({ scholar: scholar.name, signals });
      },
    });

    const getScholarSeedsTool = betaTool({
      name: "get_scholar_seeds",
      description: "Get a scholar's active and pending exploration seeds: suggested topics for deepening learning.",
      inputSchema: {
        type: "object" as const,
        properties: {
          scholarName: {
            type: "string" as const,
            description: "The scholar's name (case-insensitive partial match)",
          },
        },
        required: ["scholarName"] as const,
      },
      run: async (input) => {
        const scholar = await resolveScholar(input.scholarName);
        if (!scholar) return `No scholar found matching "${input.scholarName}".`;
        const seeds = await ctx.runQuery(
          internal.curriculumAssistant.getScholarSeeds,
          { scholarId: scholar.id as Id<"users"> }
        );
        return JSON.stringify({ scholar: scholar.name, seeds });
      },
    });

    const getScholarObservationsTool = betaTool({
      name: "get_scholar_observations",
      description: "Get teacher observations about a scholar: praise, concerns, suggestions, and interventions.",
      inputSchema: {
        type: "object" as const,
        properties: {
          scholarName: {
            type: "string" as const,
            description: "The scholar's name (case-insensitive partial match)",
          },
        },
        required: ["scholarName"] as const,
      },
      run: async (input) => {
        const scholar = await resolveScholar(input.scholarName);
        if (!scholar) return `No scholar found matching "${input.scholarName}".`;
        const observations = await ctx.runQuery(
          internal.curriculumAssistant.getScholarObservations,
          { scholarId: scholar.id as Id<"users"> }
        );
        return JSON.stringify({ scholar: scholar.name, observations });
      },
    });

    const listUnitsTool = betaTool({
      name: "list_units",
      description: "List all curriculum units with title, description, target Bloom's level, and building block names (persona, perspective, process).",
      inputSchema: {
        type: "object" as const,
        properties: {},
        required: [] as const,
      },
      run: async () => {
        const units = await ctx.runQuery(
          internal.curriculumAssistant.listUnitsInternal, {}
        );
        return JSON.stringify(units);
      },
    });

    const getUnitDetailsTool = betaTool({
      name: "get_unit_details",
      description: "Get full details of a curriculum unit including system prompt, rubric, and building block details.",
      inputSchema: {
        type: "object" as const,
        properties: {
          unitTitle: {
            type: "string" as const,
            description: "The unit's title (case-insensitive partial match)",
          },
        },
        required: ["unitTitle"] as const,
      },
      run: async (input) => {
        const unit = await resolveUnit(input.unitTitle);
        if (!unit) return `No unit found matching "${input.unitTitle}".`;
        const details = await ctx.runQuery(
          internal.curriculumAssistant.getUnitDetails,
          { unitId: unit.id as Id<"units"> }
        );
        return JSON.stringify(details);
      },
    });

    const tools = [
      listScholarsTool,
      getScholarDossierTool,
      getScholarMasteryTool,
      getScholarSignalsTool,
      getScholarSeedsTool,
      getScholarObservationsTool,
      listUnitsTool,
      getUnitDetailsTool,
    ];

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullContent = "";
          let model = "";
          let tokensUsed = 0;
          let lastPersistLength = 0;

          const apiMessages = context.messages
            .filter((m) => m.content.trim() !== "")
            .map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            }));

          const runner = anthropic.beta.messages.toolRunner({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 4096,
            system: CURRICULUM_ASSISTANT_SYSTEM_PROMPT,
            messages: apiMessages,
            tools,
            stream: true,
          });

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
                      internal.curriculumAssistant.updateStreamContent,
                      {
                        messageId: assistantMsgId as Id<"curriculumMessages">,
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

          // Finalize
          await ctx.runMutation(
            internal.curriculumAssistant.finalizeStream,
            {
              messageId: assistantMsgId as Id<"curriculumMessages">,
              content: fullContent,
              model,
              tokensUsed,
            }
          );

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true })}\n\n`
            )
          );
          controller.close();
        } catch (error) {
          console.error("Curriculum stream error:", error);
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

// CORS preflight for curriculum-stream
http.route({
  path: "/curriculum-stream",
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

/** Map a Bloom's float (0-5) to a named level string. */
function bloomFromFloat(level: number): string {
  if (level >= 4.5) return "create";
  if (level >= 3.5) return "evaluate";
  if (level >= 2.5) return "analyze";
  if (level >= 1.5) return "apply";
  if (level >= 0.5) return "understand";
  return "remember";
}

/**
 * Analyze a project endpoint.
 * Runs unified observer (writes mastery observations, signals, seeds, etc. to DB).
 * Returns a backward-compatible "detailed" shape for ProjectViewer.
 */
http.route({
  path: "/analyze",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const { projectId } = body as { projectId: string };

    try {
      const result = await ctx.runAction(internal.observer.analyzeProject, {
        projectId: projectId as Id<"projects">,
      });

      // Map observer result to legacy "detailed" shape for ProjectViewer
      const detailed = result
        ? {
            summary: result.pulse.summary,
            topics: result.pulse.topics,
            bloomLevel: result.observations.length > 0
              ? bloomFromFloat(
                  Math.max(...result.observations.map((o: any) => o.masteryLevel))
                )
              : "remember",
            bloomDescription: result.observations.length > 0
              ? result.observations
                  .sort((a: any, b: any) => b.masteryLevel - a.masteryLevel)
                  .slice(0, 3)
                  .map((o: any) => `${o.conceptLabel}: ${o.masteryLevel.toFixed(1)}`)
                  .join(", ")
              : "No observations yet",
            nudges: result.seeds
              .filter((s: any) => s.suggestionType === "depth_probe")
              .map((s: any) => ({ type: "challenge", message: s.rationale })),
            suggestedFollowUps: result.seeds
              .filter((s: any) => s.suggestionType === "frontier")
              .map((s: any) => ({
                topic: s.topic,
                rationale: s.rationale,
              })),
          }
        : null;

      return new Response(
        JSON.stringify({ observer: result?.pulse ?? null, detailed }),
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

// ── Text-to-Speech (OpenAI TTS) ──────────────────────────────────────────────

http.route({
  path: "/tts",
  method: "POST",
  handler: httpAction(async (_ctx, request) => {
    const body = await request.json();
    const { text, voice } = body as { text?: string; voice?: string };

    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
    if (text.length > 4096) {
      return new Response(JSON.stringify({ error: "text must be 4096 chars or fewer" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const openaiRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        voice: voice || "nova",
        input: text,
        response_format: "mp3",
      }),
    });

    if (!openaiRes.ok) {
      const err = await openaiRes.text();
      console.error("OpenAI TTS error:", err);
      return new Response(JSON.stringify({ error: "TTS generation failed" }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Manually pump the OpenAI stream into a new ReadableStream so the
    // Convex HTTP action stays alive until all audio data is forwarded.
    // Direct passthrough via `new Response(openaiRes.body)` doesn't work
    // because Convex closes the external fetch when the handler returns.
    const reader = openaiRes.body!.getReader();
    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }),
});

// CORS preflight for tts
http.route({
  path: "/tts",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }),
});

export default http;
