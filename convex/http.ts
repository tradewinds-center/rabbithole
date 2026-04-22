import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { auth } from "./auth";
import { buildSystemPrompt } from "./projectHelpers";
import { ROLES } from "./lib/roles";
import { MODELS } from "./lib/models";

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

    // Build system prompt (now includes artifact data + dossier + directives + mastery context)
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
      project.timingContext,
      project.lessonContext,
      project.teacherDirectives.length > 0 ? project.teacherDirectives : null
    );

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let fullContent = "";
        let model = "";
        let tokensUsed = 0;
        let finalized = false;
        const projId = projectId as Id<"projects">;

        try {
          let lastPersistLength = 0;

          // Build messages for API (with image support)
          type ImageMediaType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";
          type ContentPart =
            | { type: "text"; text: string }
            | { type: "image"; source: { type: "base64"; media_type: ImageMediaType; data: string } };
          const apiMessages: { role: "user" | "assistant"; content: string | ContentPart[] }[] = [];
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
                  // Detect actual image type from magic bytes (content-type header is unreliable)
                  const contentType: ImageMediaType =
                    bytes[0] === 0xFF && bytes[1] === 0xD8 ? "image/jpeg" :
                    bytes[0] === 0x89 && bytes[1] === 0x50 ? "image/png" :
                    bytes[0] === 0x47 && bytes[1] === 0x49 ? "image/gif" :
                    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 ? "image/webp" :
                    (imgRes.headers.get("content-type") || "image/jpeg") as ImageMediaType;

                  // Multi-part content: image + text
                  const contentParts: ContentPart[] = [
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
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ toolComplete: { name: "update_process_step", result: `Step "${input.step}" → ${status}` } })}\n\n`)
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
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ toolComplete: { name: "edit_document", result: "Document created" } })}\n\n`)
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
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ toolComplete: { name: "edit_document", result: `Viewed "${artifact.title}"` } })}\n\n`)
                    );
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
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ toolComplete: { name: "edit_document", result: "Viewed documents" } })}\n\n`)
                  );
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
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ toolComplete: { name: "edit_document", result: `Renamed to "${newTitle}"` } })}\n\n`)
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
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ toolComplete: { name: "edit_document", result: "Text replaced" } })}\n\n`)
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
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ toolComplete: { name: "edit_document", result: "Text inserted" } })}\n\n`)
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
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ toolComplete: { name: "create_code", result: `Created "${input.title}"` } })}\n\n`)
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
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ toolComplete: { name: "update_dossier", result: "Profile updated" } })}\n\n`)
              );
              return "Dossier updated successfully.";
            },
          });

          const generateImageTool = betaTool({
            name: "generate_image",
            description: "Generate an educational illustration or visualization using AI image generation. Use this to create diagrams, scientific illustrations, historical scenes, maps, or any visual that helps explain a concept.",
            inputSchema: {
              type: "object" as const,
              properties: {
                prompt: {
                  type: "string" as const,
                  description: "Detailed description of the image to generate. Be specific about subject, composition, labels, colors, and educational content.",
                },
                alt_text: {
                  type: "string" as const,
                  description: "Brief alt text describing the image for accessibility.",
                },
              },
              required: ["prompt", "alt_text"] as const,
            },
            run: async (input) => {
              try {
                const apiKey = process.env.GEMINI_API_KEY;
                if (!apiKey) {
                  return "Image generation is not available right now. I'll describe the concept in words instead.";
                }

                // Notify client that image generation has started
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ generatingImage: "started" })}\n\n`
                  )
                );

                const geminiRes = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      contents: [{ parts: [{ text: input.prompt }] }],
                      generationConfig: {
                        responseModalities: ["IMAGE", "TEXT"],
                      },
                    }),
                  }
                );

                if (!geminiRes.ok) {
                  console.error("Gemini API error:", geminiRes.status, await geminiRes.text());
                  return "Image generation failed. I'll describe the concept in words instead.";
                }

                const geminiData = await geminiRes.json();
                const parts = geminiData?.candidates?.[0]?.content?.parts;
                if (!parts) {
                  return "Image generation returned no results. I'll describe the concept in words instead.";
                }

                // Find the image part
                const imagePart = parts.find((p: { inlineData?: { mimeType?: string; data?: string } }) => p.inlineData?.mimeType?.startsWith("image/"));
                if (!imagePart?.inlineData?.data) {
                  return "Image generation returned no image. I'll describe the concept in words instead.";
                }

                // Decode base64 to binary
                const base64 = imagePart.inlineData.data;
                const mimeType = imagePart.inlineData.mimeType || "image/png";
                const binaryString = atob(base64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: mimeType });

                // Store in Convex file storage
                const storageId = await ctx.storage.store(blob);

                // Split the stream with imageId on the tool message
                const newId = await ctx.runMutation(internal.projectHelpers.splitStream, {
                  currentMessageId: assistantMsgId as Id<"messages">,
                  projectId: projId,
                  contentSoFar: fullContent,
                  toolAction: "Generated image",
                  imageId: storageId,
                });

                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ toolComplete: { name: "generate_image", result: "Image generated" } })}\n\n`)
                );
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ generatedImage: true, newAssistantMsg: String(newId) })}\n\n`
                  )
                );

                assistantMsgId = newId;
                fullContent = "";
                lastPersistLength = 0;

                return `Image generated successfully. Now describe what the image shows to the scholar.`;
              } catch (err) {
                console.error("Image generation error:", err);
                return "Image generation encountered an error. I'll describe the concept in words instead.";
              }
            },
          });

          // Build tools array based on active features
          const tools: Parameters<typeof anthropic.beta.messages.toolRunner>[0]["tools"] = [];
          tools.push(updateDossierTool); // Always enabled
          tools.push(createCodeTool); // Always enabled — scholars can build interactive code
          tools.push(editDocumentTool); // Always enabled — needed to edit code artifacts and create/edit documents
          tools.push(generateImageTool); // Always enabled — AI image generation
          if (hasProcess) tools.push(processStepTool);

          // ── Stream with tool runner ──────────────────────────────────

          if (tools.length > 0) {
            // Use beta tool runner for automatic multi-turn handling
            const runner = anthropic.beta.messages.toolRunner({
              model: MODELS.SONNET,
              max_tokens: 4096,
              system: systemPrompt,
              messages: apiMessages,
              tools,
              stream: true,
            });

            // Nested iteration: outer = turns, inner = streaming events
            for await (const messageStream of runner) {
              for await (const event of messageStream) {
                if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ toolStart: { name: (event.content_block as { name?: string }).name } })}\n\n`)
                  );
                } else if (event.type === "message_start") {
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
              model: MODELS.SONNET,
              max_tokens: 4096,
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
          finalized = true;

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
          // Finalize the stuck message so it doesn't show an infinite spinner
          if (!finalized) {
            try {
              await ctx.runMutation(internal.projectHelpers.finalizeStream, {
                messageId: assistantMsgId as Id<"messages">,
                projectId: projId,
                content: fullContent || "",
                model,
                tokensUsed,
              });
            } catch (finalizeErr) {
              console.error("Failed to finalize stream on error:", finalizeErr);
            }
          }
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

Be concise and practical. Speak as a colleague.

## Scholar links
You can link directly to a scholar's profile using standard markdown link syntax:
[Scholar Name](/teacher?tab=scholars&scholar=SCHOLAR_ID)
Use the list_scholars or find_scholar tool to get the correct ID before linking. Always use the scholar's real display name as the link text.`;

http.route({
  path: "/curriculum-stream",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const { teacherId, streamId, assistantMsgId, scholarId, threadLabel } =
      body as {
        teacherId: string;
        streamId: string;
        assistantMsgId: string;
        scholarId?: string;
        threadLabel?: string;
      };

    const context = await ctx.runQuery(
      internal.curriculumAssistant.getContext,
      {
        teacherId: teacherId as Id<"users">,
        scholarId: scholarId ? (scholarId as Id<"users">) : undefined,
        threadLabel,
      }
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

    // Shared emit function — set once the ReadableStream starts
    const encoder = new TextEncoder();
    let emitSSE: (data: Record<string, unknown>) => void = () => {};

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
        emitSSE({ toolComplete: { name: "list_scholars", result: `Found ${scholars.length} scholars` } });
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
        emitSSE({ toolComplete: { name: "get_scholar_dossier", result: `Loaded ${scholar.name}'s profile` } });
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
        emitSSE({ toolComplete: { name: "get_scholar_mastery", result: `Loaded ${scholar.name}'s mastery data` } });
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
        emitSSE({ toolComplete: { name: "get_scholar_signals", result: `Loaded ${scholar.name}'s signals` } });
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
        emitSSE({ toolComplete: { name: "get_scholar_seeds", result: `Loaded ${scholar.name}'s seeds` } });
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
        emitSSE({ toolComplete: { name: "get_scholar_observations", result: `Loaded ${scholar.name}'s observations` } });
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
        emitSSE({ toolComplete: { name: "list_units", result: `Found ${units.length} units` } });
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
        emitSSE({ toolComplete: { name: "get_unit_details", result: `Loaded "${unit.title}"` } });
        return JSON.stringify(details);
      },
    });

    const upsertTeacherDirectiveTool = betaTool({
      name: "upsert_teacher_directive",
      description:
        "Create or update a teacher directive — a persistent pedagogical instruction for the AI tutor about a specific scholar. Directives are standing rules (e.g., \"Use Structured Word Inquiry, not phonics drills\", \"Frame math as visual reasoning\", \"Cognitive profile and accommodations\") that the tutor treats as governing behavior for that scholar. Directives persist across sessions and are separate from the scholar dossier (which is observer/tutor-authored learning notes). If a directive with the same label already exists for this scholar, its content is REPLACED; otherwise a new directive is CREATED.",
      inputSchema: {
        type: "object" as const,
        properties: {
          scholarName: {
            type: "string" as const,
            description: "The scholar's name (case-insensitive partial match)",
          },
          label: {
            type: "string" as const,
            description:
              "Short human-readable label identifying this directive (e.g., \"SWI directives\", \"Family context\", \"Cognitive profile\"). Used as the directive key — re-using the same label (case-insensitive) replaces the existing directive.",
          },
          content: {
            type: "string" as const,
            description:
              "The teacher-authored body of the directive. Preserves formatting verbatim; use plain prose or markdown bullets as you like.",
          },
        },
        required: ["scholarName", "label", "content"] as const,
      },
      run: async (input) => {
        const scholar = await resolveScholar(input.scholarName);
        if (!scholar) return `No scholar found matching "${input.scholarName}".`;
        const result = await ctx.runMutation(
          internal.teacherAide.upsertTeacherDirective,
          {
            scholarId: scholar.id as Id<"users">,
            label: input.label,
            content: input.content,
            authorId: teacherId as Id<"users">,
          }
        );
        emitSSE({
          toolComplete: {
            name: "upsert_teacher_directive",
            result: `${result.action === "updated" ? "Updated" : "Created"} "${result.label}" directive for ${scholar.name}`,
          },
        });
        return `Teacher directive "${result.label}" ${result.action} for ${scholar.name}.`;
      },
    });

    const createScholarSeedTool = betaTool({
      name: "create_scholar_seed",
      description:
        "Create an active teacher-authored exploration seed for a scholar. Seeds are suggested topics the AI tutor will weave into future sessions — the teacher equivalent of the AI observer's own seed suggestions. Use this when you want to steer a specific scholar toward a topic (e.g., \"The -spect- morpheme family\" for a kid working on SWI).",
      inputSchema: {
        type: "object" as const,
        properties: {
          scholarName: {
            type: "string" as const,
            description: "The scholar's name (case-insensitive partial match)",
          },
          topic: {
            type: "string" as const,
            description: "Short topic phrase (e.g., \"Latin and Greek roots in filmmaking\")",
          },
          domain: {
            type: "string" as const,
            description:
              "Optional broad academic domain (e.g., \"Language Arts\", \"Mathematics\", \"Science\").",
          },
          rationale: {
            type: "string" as const,
            description:
              "Why this topic, for this scholar, right now. Informs the tutor on how to frame it.",
          },
          approachHint: {
            type: "string" as const,
            description:
              "Optional hint on how the tutor should approach the topic (pedagogical steer, example, on-ramp).",
          },
        },
        required: ["scholarName", "topic", "rationale"] as const,
      },
      run: async (input) => {
        const scholar = await resolveScholar(input.scholarName);
        if (!scholar) return `No scholar found matching "${input.scholarName}".`;
        await ctx.runMutation(internal.teacherAide.createScholarSeed, {
          scholarId: scholar.id as Id<"users">,
          teacherId: teacherId as Id<"users">,
          topic: input.topic,
          domain: input.domain,
          rationale: input.rationale,
          approachHint: input.approachHint,
        });
        emitSSE({
          toolComplete: {
            name: "create_scholar_seed",
            result: `Seeded "${input.topic}" for ${scholar.name}`,
          },
        });
        return `Active seed "${input.topic}" created for ${scholar.name}.`;
      },
    });

    const createScholarUnitTool = betaTool({
      name: "create_scholar_unit",
      description:
        "Create a new curriculum unit scoped to a specific scholar. The unit will only be visible to that scholar in their unit picker (in addition to all general teacher-created units). Use this to spin up a bespoke unit for an individual scholar's project (e.g., \"Word Detective\" for a scholar working on structured word inquiry). Idempotent by (scholarName, title) — if a unit with the same title already exists for this scholar, returns the existing unitId without creating a duplicate. IMPORTANT: a unit is an empty container; to make it useful, follow up with create_scholar_lesson calls to populate it with lessons.",
      inputSchema: {
        type: "object" as const,
        properties: {
          scholarName: {
            type: "string" as const,
            description: "The scholar's name (case-insensitive partial match)",
          },
          title: {
            type: "string" as const,
            description: "Unit title (e.g., \"Word Detective\", \"Fractions Deep Dive\")",
          },
          emoji: {
            type: "string" as const,
            description: "Optional emoji to represent the unit in the UI",
          },
          description: {
            type: "string" as const,
            description: "Short description of what this unit is about",
          },
          bigIdea: {
            type: "string" as const,
            description: "The enduring big idea of the unit (PCM curriculum field)",
          },
          essentialQuestions: {
            type: "array" as const,
            items: { type: "string" as const },
            description: "Essential questions driving inquiry",
          },
          enduringUnderstandings: {
            type: "array" as const,
            items: { type: "string" as const },
            description: "Enduring understandings scholars should take away",
          },
          subject: {
            type: "string" as const,
            description: "Broad subject (e.g., \"Language Arts\", \"Mathematics\")",
          },
          gradeLevel: {
            type: "string" as const,
            description: "Grade level (e.g., \"3\", \"K-2\")",
          },
        },
        required: ["scholarName", "title"] as const,
      },
      run: async (input) => {
        const scholar = await resolveScholar(input.scholarName);
        if (!scholar) return `No scholar found matching "${input.scholarName}".`;
        const result = await ctx.runMutation(
          internal.teacherAide.createScholarUnit,
          {
            scholarId: scholar.id as Id<"users">,
            authorId: teacherId as Id<"users">,
            title: input.title,
            emoji: input.emoji,
            description: input.description,
            bigIdea: input.bigIdea,
            essentialQuestions: input.essentialQuestions,
            enduringUnderstandings: input.enduringUnderstandings,
            subject: input.subject,
            gradeLevel: input.gradeLevel,
          }
        );
        emitSSE({
          toolComplete: {
            name: "create_scholar_unit",
            result: result.existed
              ? `Unit "${input.title}" already exists for ${scholar.name}`
              : `Created unit "${input.title}" for ${scholar.name}`,
          },
        });
        return JSON.stringify({
          unitId: result.unitId,
          existed: result.existed,
          scholarName: scholar.name,
          title: input.title,
        });
      },
    });

    const createScholarLessonTool = betaTool({
      name: "create_scholar_lesson",
      description:
        "Create a lesson inside a unit. Provide EITHER a direct unitId (returned from create_scholar_unit) OR a unitTitle + scholarName pair that will be resolved to a scholar-scoped unit. Idempotent by (unitId, title) — if a lesson with the same title already exists under this unit, returns the existing lessonId without creating a duplicate. Strand is the lesson's pedagogical role: core (main concept), connections (interdisciplinary links), practice (application), or identity (reflection / ownership).",
      inputSchema: {
        type: "object" as const,
        properties: {
          unitId: {
            type: "string" as const,
            description: "Direct unitId (preferred if available). If omitted, supply unitTitle + scholarName.",
          },
          unitTitle: {
            type: "string" as const,
            description: "Unit title to resolve (case-insensitive partial match). Required if unitId is not provided.",
          },
          scholarName: {
            type: "string" as const,
            description: "Scholar name, used together with unitTitle to disambiguate a scholar-scoped unit.",
          },
          title: {
            type: "string" as const,
            description: "Lesson title",
          },
          strand: {
            type: "string" as const,
            enum: ["core", "connections", "practice", "identity"] as const,
            description: "Pedagogical strand: core | connections | practice | identity",
          },
          systemPrompt: {
            type: "string" as const,
            description: "Optional system prompt specifically for the tutor when this lesson is the current focus",
          },
          durationMinutes: {
            type: "number" as const,
            description: "Optional expected duration in minutes",
          },
        },
        required: ["title"] as const,
      },
      run: async (input) => {
        // Resolve unit: unitId takes precedence, else unitTitle (+ scholar scope).
        let unitId: Id<"units"> | null = null;
        let unitLabel = "(unknown)";
        if (input.unitId) {
          unitId = input.unitId as Id<"units">;
          const details = await ctx.runQuery(
            internal.curriculumAssistant.getUnitDetails,
            { unitId }
          );
          unitLabel = details?.title ?? "(unknown)";
        } else if (input.unitTitle) {
          const scholar = input.scholarName
            ? await resolveScholar(input.scholarName)
            : null;
          const allUnits = await ctx.runQuery(
            internal.curriculumAssistant.listUnitsInternal,
            {}
          );
          const lower = input.unitTitle.toLowerCase();
          const candidates = allUnits.filter((u) =>
            u.title.toLowerCase().includes(lower)
          );
          if (candidates.length === 0) {
            return `No unit found matching "${input.unitTitle}".`;
          }
          // Prefer a unit scoped to the named scholar if provided.
          let chosen = null as (typeof candidates)[number] | null;
          if (scholar) {
            chosen =
              candidates.find((c) => c.scholarId === scholar.id) ?? null;
          }
          if (!chosen) chosen = candidates[0];
          unitId = chosen.id as Id<"units">;
          unitLabel = chosen.title;
        } else {
          return "Either unitId or unitTitle must be provided.";
        }

        const strand = input.strand as
          | "core"
          | "connections"
          | "practice"
          | "identity"
          | undefined;

        const result = await ctx.runMutation(
          internal.teacherAide.createScholarLesson,
          {
            unitId,
            title: input.title,
            strand,
            systemPrompt: input.systemPrompt,
            durationMinutes: input.durationMinutes,
          }
        );
        emitSSE({
          toolComplete: {
            name: "create_scholar_lesson",
            result: result.existed
              ? `Lesson "${input.title}" already exists in "${unitLabel}"`
              : `Created lesson "${input.title}" in "${unitLabel}"`,
          },
        });
        return JSON.stringify({
          lessonId: result.lessonId,
          existed: result.existed,
          unitTitle: unitLabel,
          title: input.title,
        });
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
      upsertTeacherDirectiveTool,
      createScholarSeedTool,
      createScholarUnitTool,
      createScholarLessonTool,
    ];

    // Build the system prompt. When the current thread is scoped to a scholar,
    // pre-load the scholar's redacted context so the AI doesn't need to tool-
    // call on every turn to remember who we're talking about.
    const systemPromptSections: string[] = [CURRICULUM_ASSISTANT_SYSTEM_PROMPT];
    if (context.scholarContext) {
      const sc = context.scholarContext;
      const lines: string[] = [];
      lines.push("");
      lines.push(`## Current scholar: ${sc.scholarName}`);
      lines.push("");
      lines.push(
        `This chat thread is scoped to one specific scholar. Assume every question is about ${sc.scholarName} unless stated otherwise. The context below is pre-loaded — you do NOT need to call get_scholar_dossier / get_scholar_seeds / get_scholar_observations for this scholar (but you may still call get_scholar_mastery and get_scholar_signals if useful).`
      );
      lines.push("");
      if (sc.readingLevel) {
        lines.push(`Reading level: ${sc.readingLevel}`);
        lines.push("");
      }
      lines.push(`### Dossier`);
      lines.push(sc.dossier);
      lines.push("");
      if (sc.directives.length > 0) {
        lines.push(`### Active teacher directives (${sc.directives.length})`);
        for (const d of sc.directives) {
          lines.push(`- **${d.label}** — ${d.content}`);
        }
        lines.push("");
      } else {
        lines.push(`### Active teacher directives`);
        lines.push(`(none yet)`);
        lines.push("");
      }
      if (sc.seeds.length > 0) {
        lines.push(`### Active exploration seeds (${sc.seeds.length})`);
        for (const s of sc.seeds) {
          let line = `- "${s.topic}"`;
          if (s.domain) line += ` (${s.domain})`;
          line += ` — ${s.rationale}`;
          if (s.approachHint) line += ` [approach: ${s.approachHint}]`;
          lines.push(line);
        }
        lines.push("");
      }
      if (sc.recentObservations.length > 0) {
        lines.push(
          `### Recent teacher observations (last ${sc.recentObservations.length})`
        );
        for (const o of sc.recentObservations) {
          lines.push(`- [${o.type}] ${o.note}`);
        }
        lines.push("");
      }
      lines.push(
        `When suggesting new directives, seeds, units, or lessons, use the tools (upsert_teacher_directive, create_scholar_seed, create_scholar_unit, create_scholar_lesson) and default scholarName to "${sc.scholarName}".`
      );
      systemPromptSections.push(lines.join("\n"));
    }
    const systemPrompt = systemPromptSections.join("\n");

    const stream = new ReadableStream({
      async start(controller) {
        emitSSE = (data) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        let fullContent = "";
        let model = "";
        let tokensUsed = 0;
        let finalized = false;

        try {
          let lastPersistLength = 0;

          const apiMessages = context.messages
            .filter((m) => m.content.trim() !== "")
            .map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            }));

          const runner = anthropic.beta.messages.toolRunner({
            model: MODELS.SONNET,
            max_tokens: 4096,
            system: systemPrompt,
            messages: apiMessages,
            tools,
            stream: true,
          });

          for await (const messageStream of runner) {
            for await (const event of messageStream) {
              if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ toolStart: { name: (event.content_block as { name?: string }).name } })}\n\n`)
                );
              } else if (event.type === "message_start") {
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
          finalized = true;

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true })}\n\n`
            )
          );
          controller.close();
        } catch (error) {
          console.error("Curriculum stream error:", error);
          if (!finalized) {
            try {
              await ctx.runMutation(
                internal.curriculumAssistant.finalizeStream,
                {
                  messageId: assistantMsgId as Id<"curriculumMessages">,
                  content: fullContent || "",
                  model,
                  tokensUsed,
                }
              );
            } catch (finalizeErr) {
              console.error("Failed to finalize curriculum stream on error:", finalizeErr);
            }
          }
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
                  Math.max(...result.observations.map((o) => o.masteryLevel))
                )
              : "remember",
            bloomDescription: result.observations.length > 0
              ? result.observations
                  .sort((a, b) => b.masteryLevel - a.masteryLevel)
                  .slice(0, 3)
                  .map((o) => `${o.conceptLabel}: ${o.masteryLevel.toFixed(1)}`)
                  .join(", ")
              : "No observations yet",
            nudges: result.seeds
              .filter((s) => s.suggestionType === "depth_probe")
              .map((s) => ({ type: "challenge", message: s.rationale })),
            suggestedFollowUps: result.seeds
              .filter((s) => s.suggestionType === "frontier")
              .map((s) => ({
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

// ── Parent/Token API endpoints ───────────────────────────────────────────────

const PARENT_API_CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

/** Extract Bearer token from Authorization header */
function extractToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

/**
 * Resolve the scholarId for an API request.
 * - For scholar tokens: userId IS the scholar.
 * - For teacher tokens: scholarId must come from the POST body.
 */
async function resolveScholarId(
  auth: { userId: Id<"users">; role: string },
  request: Request
): Promise<Id<"users"> | null> {
  if (auth.role === ROLES.TEACHER || auth.role === ROLES.ADMIN) {
    try {
      const body = await request.clone().json();
      if (body?.scholarId) return body.scholarId as Id<"users">;
    } catch {}
    return null; // Teacher must provide scholarId
  }
  return auth.userId; // Scholar's own data
}

http.route({
  path: "/parent-api/validate",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const token = extractToken(request);
    if (!token) return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: PARENT_API_CORS });
    const auth = await ctx.runQuery(internal.tokens.validateToken, { token });
    if (!auth) return new Response(JSON.stringify({ error: "Invalid or expired token" }), { status: 401, headers: PARENT_API_CORS });
    return new Response(
      JSON.stringify({ userName: auth.userName, label: auth.label, role: auth.role }),
      { status: 200, headers: PARENT_API_CORS }
    );
  }),
});

http.route({
  path: "/parent-api/scholars",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const token = extractToken(request);
    if (!token) return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: PARENT_API_CORS });
    const auth = await ctx.runQuery(internal.tokens.validateToken, { token });
    if (!auth) return new Response(JSON.stringify({ error: "Invalid or expired token" }), { status: 401, headers: PARENT_API_CORS });
    if (auth.role !== ROLES.TEACHER && auth.role !== ROLES.ADMIN) {
      return new Response(JSON.stringify({ error: "Teacher access required" }), { status: 403, headers: PARENT_API_CORS });
    }
    const scholars = await ctx.runQuery(internal.tokens.listScholars, {});
    return new Response(JSON.stringify(scholars), { status: 200, headers: PARENT_API_CORS });
  }),
});

http.route({
  path: "/parent-api/summary",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const token = extractToken(request);
    if (!token) return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: PARENT_API_CORS });
    const auth = await ctx.runQuery(internal.tokens.validateToken, { token });
    if (!auth) return new Response(JSON.stringify({ error: "Invalid or expired token" }), { status: 401, headers: PARENT_API_CORS });
    const scholarId = await resolveScholarId(auth, request);
    if (!scholarId) return new Response(JSON.stringify({ error: "scholarId required" }), { status: 400, headers: PARENT_API_CORS });
    const summary = await ctx.runQuery(internal.tokens.getScholarSummary, { scholarId });
    return new Response(JSON.stringify(summary), { status: 200, headers: PARENT_API_CORS });
  }),
});

http.route({
  path: "/parent-api/projects",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const token = extractToken(request);
    if (!token) return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: PARENT_API_CORS });
    const auth = await ctx.runQuery(internal.tokens.validateToken, { token });
    if (!auth) return new Response(JSON.stringify({ error: "Invalid or expired token" }), { status: 401, headers: PARENT_API_CORS });
    const scholarId = await resolveScholarId(auth, request);
    if (!scholarId) return new Response(JSON.stringify({ error: "scholarId required" }), { status: 400, headers: PARENT_API_CORS });
    const projects = await ctx.runQuery(internal.tokens.getRecentProjects, { scholarId });
    return new Response(JSON.stringify(projects), { status: 200, headers: PARENT_API_CORS });
  }),
});

http.route({
  path: "/parent-api/mastery",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const token = extractToken(request);
    if (!token) return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: PARENT_API_CORS });
    const auth = await ctx.runQuery(internal.tokens.validateToken, { token });
    if (!auth) return new Response(JSON.stringify({ error: "Invalid or expired token" }), { status: 401, headers: PARENT_API_CORS });
    const scholarId = await resolveScholarId(auth, request);
    if (!scholarId) return new Response(JSON.stringify({ error: "scholarId required" }), { status: 400, headers: PARENT_API_CORS });
    const mastery = await ctx.runQuery(internal.curriculumAssistant.getScholarMastery, { scholarId });
    return new Response(JSON.stringify(mastery), { status: 200, headers: PARENT_API_CORS });
  }),
});

http.route({
  path: "/parent-api/signals",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const token = extractToken(request);
    if (!token) return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: PARENT_API_CORS });
    const auth = await ctx.runQuery(internal.tokens.validateToken, { token });
    if (!auth) return new Response(JSON.stringify({ error: "Invalid or expired token" }), { status: 401, headers: PARENT_API_CORS });
    const scholarId = await resolveScholarId(auth, request);
    if (!scholarId) return new Response(JSON.stringify({ error: "scholarId required" }), { status: 400, headers: PARENT_API_CORS });
    const signals = await ctx.runQuery(internal.curriculumAssistant.getScholarSignals, { scholarId });
    return new Response(JSON.stringify(signals), { status: 200, headers: PARENT_API_CORS });
  }),
});

http.route({
  path: "/parent-api/seeds",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const token = extractToken(request);
    if (!token) return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: PARENT_API_CORS });
    const auth = await ctx.runQuery(internal.tokens.validateToken, { token });
    if (!auth) return new Response(JSON.stringify({ error: "Invalid or expired token" }), { status: 401, headers: PARENT_API_CORS });
    const scholarId = await resolveScholarId(auth, request);
    if (!scholarId) return new Response(JSON.stringify({ error: "scholarId required" }), { status: 400, headers: PARENT_API_CORS });
    const seeds = await ctx.runQuery(internal.curriculumAssistant.getScholarSeeds, { scholarId });
    return new Response(JSON.stringify(seeds), { status: 200, headers: PARENT_API_CORS });
  }),
});

http.route({
  path: "/parent-api/observations",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const token = extractToken(request);
    if (!token) return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: PARENT_API_CORS });
    const auth = await ctx.runQuery(internal.tokens.validateToken, { token });
    if (!auth) return new Response(JSON.stringify({ error: "Invalid or expired token" }), { status: 401, headers: PARENT_API_CORS });
    const scholarId = await resolveScholarId(auth, request);
    if (!scholarId) return new Response(JSON.stringify({ error: "scholarId required" }), { status: 400, headers: PARENT_API_CORS });
    const observations = await ctx.runQuery(internal.curriculumAssistant.getScholarObservations, { scholarId });
    return new Response(JSON.stringify(observations), { status: 200, headers: PARENT_API_CORS });
  }),
});

// CORS preflight for parent-api
http.route({
  path: "/parent-api/scholars",
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

http.route({
  path: "/parent-api/validate",
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

http.route({
  path: "/parent-api/summary",
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

http.route({
  path: "/parent-api/projects",
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

http.route({
  path: "/parent-api/mastery",
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

http.route({
  path: "/parent-api/signals",
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

http.route({
  path: "/parent-api/seeds",
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

http.route({
  path: "/parent-api/observations",
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

// ── Unit Designer streaming endpoint ──────────────────────────────────────

const UNIT_DESIGNER_SYSTEM_PROMPT = `You are a unit designer AI for teachers at Tradewinds School, a gifted elementary school in Honolulu.

Your job: help teachers design curriculum units using the Parallel Curriculum Model (PCM). You work within a specific unit and have tools to create lessons, update the unit structure, and generate lesson system prompts.

PCM Framework:
- **Big Idea**: The overarching concept or theme that transfers across contexts
- **Essential Questions**: Open-ended questions that guide inquiry (no single right answer)
- **Enduring Understandings**: What students should understand long after the unit is over

PCM Strands (each lesson belongs to one):
- **Core** (🔍): Build foundational understanding of the discipline's key concepts
- **Connections** (🔗): Link concepts across disciplines and to the real world
- **Practice** (🎯): Apply knowledge through authentic, practitioner-like work
- **Identity** (🌱): Connect learning to personal identity, values, and purpose (optional)

Available Processes (guided step workflows):
{PROCESSES}

Kaplan's Depth & Complexity Icons (use these to calibrate lesson depth):
- Language of the Discipline, Details, Patterns, Rules, Trends, Ethics, Big Ideas, Unanswered Questions, Multiple Perspectives, Across Disciplines, Over Time

Bloom's Taxonomy levels (low to high):
Remember → Understand → Apply → Analyze → Evaluate → Create

When designing lessons:
1. Ask about the learning goal and target Bloom's level
2. Suggest which Depth & Complexity icons are relevant
3. Recommend an appropriate process (if any)
4. Consider what happens in the AI chat vs. physical classroom
5. Generate a system prompt that gives the AI tutor clear instructions

When generating system prompts for lessons, include:
- The learning objectives (what the scholar should understand/be able to do)
- Which D&C icons to emphasize
- The AI tutor's role and approach
- How to use the process steps (if a process is assigned)
- Assessment indicators (how to know if the scholar is getting it)

Current unit structure is provided via the read_unit_structure tool. Use it to understand context before making changes.

Be concise and practical. Speak as a colleague.`;

http.route({
  path: "/unit-designer-stream",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const { teacherId, unitId, streamId, assistantMsgId } = body as {
      teacherId: string;
      unitId: string;
      streamId: string;
      assistantMsgId: string;
    };

    const context = await ctx.runQuery(
      internal.curriculumAssistant.getUnitDesignerContext,
      { teacherId: teacherId as Id<"users">, unitId: unitId as Id<"units"> }
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

    // Build system prompt with available processes
    const processesDesc = context.processes.map(
      (p) => `- ${p.emoji} ${p.title} (id: ${p.id}): ${p.steps}`
    ).join("\n");
    const systemPrompt = UNIT_DESIGNER_SYSTEM_PROMPT.replace("{PROCESSES}", processesDesc);

    // Shared emit function — set once the ReadableStream starts
    const udEncoder = new TextEncoder();
    let udEmit: (data: Record<string, unknown>) => void = () => {};

    // ── Define tools ────────────────────────────────────────────────

    const readUnitStructureTool = betaTool({
      name: "read_unit_structure",
      description: "Read the full unit structure: Big Idea, EQs, EUs, and all lessons with their strands, processes, and prompts.",
      inputSchema: {
        type: "object" as const,
        properties: {},
        required: [] as const,
      },
      run: async () => {
        // Re-fetch fresh data
        const freshCtx = await ctx.runQuery(
          internal.curriculumAssistant.getUnitDesignerContext,
          { teacherId: teacherId as Id<"users">, unitId: unitId as Id<"units"> }
        );
        if (!freshCtx) return "Unit not found.";
        const u = freshCtx.unit;
        const lines = [
          `Unit: ${u.title}`,
          u.subject ? `Subject: ${u.subject}` : null,
          u.gradeLevel ? `Grade: ${u.gradeLevel}` : null,
          u.bigIdea ? `Big Idea: ${u.bigIdea}` : "Big Idea: (not set)",
          u.essentialQuestions?.length
            ? `Essential Questions:\n${u.essentialQuestions.map((q: string) => `  - ${q}`).join("\n")}`
            : "Essential Questions: (none)",
          u.enduringUnderstandings?.length
            ? `Enduring Understandings:\n${u.enduringUnderstandings.map((eu: string) => `  - ${eu}`).join("\n")}`
            : "Enduring Understandings: (none)",
          "",
          `Lessons (${freshCtx.lessons.length}):`,
          ...freshCtx.lessons.map((l) =>
            `  [${l.strand ?? "none"}] ${l.title}${l.processTitle ? ` (${l.processEmoji} ${l.processTitle}, processId: ${l.processId})` : " (no process)"}${l.systemPrompt ? " ✓prompt" : " ✗no prompt"}`
          ),
          "",
          "Available processes:",
          ...freshCtx.processes.map((p) => `  - ${p.emoji} ${p.title} (id: ${p.id})`),
        ].filter(Boolean);
        udEmit({ toolComplete: { name: "read_unit_structure", result: `${freshCtx.lessons.length} lessons loaded` } });
        return lines.join("\n");
      },
    });

    const updateUnitTool = betaTool({
      name: "update_unit",
      description: "Update unit fields: Big Idea, Essential Questions, Enduring Understandings, subject, grade level.",
      inputSchema: {
        type: "object" as const,
        properties: {
          bigIdea: { type: "string" as const, description: "The unit's Big Idea" },
          essentialQuestions: {
            type: "array" as const,
            items: { type: "string" as const },
            description: "Essential Questions (replaces all existing)",
          },
          enduringUnderstandings: {
            type: "array" as const,
            items: { type: "string" as const },
            description: "Enduring Understandings (replaces all existing)",
          },
          subject: { type: "string" as const, description: "Subject area" },
          gradeLevel: { type: "string" as const, description: "Grade level" },
        },
        required: [] as const,
      },
      run: async (input) => {
        const updates: Record<string, unknown> = {};
        if (input.bigIdea !== undefined) updates.bigIdea = input.bigIdea || null;
        if (input.essentialQuestions !== undefined) updates.essentialQuestions = input.essentialQuestions;
        if (input.enduringUnderstandings !== undefined) updates.enduringUnderstandings = input.enduringUnderstandings;
        if (input.subject !== undefined) updates.subject = input.subject || null;
        if (input.gradeLevel !== undefined) updates.gradeLevel = input.gradeLevel || null;

        await ctx.runMutation(internal.curriculumAssistant.updateUnitInternal, {
          unitId: unitId as Id<"units">,
          ...updates,
        });
        udEmit({ toolComplete: { name: "update_unit", result: "Unit updated" } });
        return "Unit updated successfully.";
      },
    });

    const createLessonTool = betaTool({
      name: "create_lesson",
      description: "Create a new lesson in this unit.",
      inputSchema: {
        type: "object" as const,
        properties: {
          title: { type: "string" as const, description: "Lesson title" },
          strand: {
            type: "string" as const,
            enum: ["core", "connections", "practice", "identity"] as const,
            description: "PCM strand",
          },
          processId: { type: "string" as const, description: "Process ID (from available processes)" },
          systemPrompt: { type: "string" as const, description: "System prompt for the AI tutor" },
          durationMinutes: { type: "number" as const, description: "Expected duration in minutes" },
        },
        required: ["title", "strand"] as const,
      },
      run: async (input) => {
        await ctx.runMutation(internal.curriculumAssistant.createLessonInternal, {
          unitId: unitId as Id<"units">,
          title: input.title,
          strand: input.strand as "core" | "connections" | "practice" | "identity",
          processId: input.processId as Id<"processes"> | undefined,
          systemPrompt: input.systemPrompt,
          durationMinutes: input.durationMinutes,
        });
        udEmit({ toolComplete: { name: "create_lesson", result: `Created "${input.title}"` } });
        return `Lesson "${input.title}" created in ${input.strand} strand.`;
      },
    });

    const updateLessonTool = betaTool({
      name: "update_lesson",
      description: "Update an existing lesson's fields.",
      inputSchema: {
        type: "object" as const,
        properties: {
          lessonTitle: { type: "string" as const, description: "Title of the lesson to update (case-insensitive match)" },
          title: { type: "string" as const, description: "New title" },
          strand: {
            type: "string" as const,
            enum: ["core", "connections", "practice", "identity"] as const,
            description: "New strand",
          },
          processId: { type: "string" as const, description: "New process ID (empty string to remove)" },
          systemPrompt: { type: "string" as const, description: "New system prompt" },
          durationMinutes: { type: "number" as const, description: "New duration in minutes" },
        },
        required: ["lessonTitle"] as const,
      },
      run: async (input) => {
        // Find lesson by title
        const freshCtx = await ctx.runQuery(
          internal.curriculumAssistant.getUnitDesignerContext,
          { teacherId: teacherId as Id<"users">, unitId: unitId as Id<"units"> }
        );
        if (!freshCtx) return "Unit not found.";
        const lower = input.lessonTitle.toLowerCase();
        const lesson = freshCtx.lessons.find(
          (l) => l.title.toLowerCase().includes(lower)
        );
        if (!lesson) return `No lesson found matching "${input.lessonTitle}".`;

        const updates: Record<string, unknown> = {};
        if (input.title) updates.title = input.title;
        if (input.strand) updates.strand = input.strand;
        if (input.processId !== undefined) updates.processId = input.processId || null;
        if (input.systemPrompt !== undefined) updates.systemPrompt = input.systemPrompt || null;
        if (input.durationMinutes !== undefined) updates.durationMinutes = input.durationMinutes;

        await ctx.runMutation(internal.curriculumAssistant.updateLessonInternal, {
          lessonId: lesson._id,
          ...updates,
        });
        udEmit({ toolComplete: { name: "update_lesson", result: `Updated "${lesson.title}"` } });
        return `Lesson "${lesson.title}" updated.`;
      },
    });

    const deleteLessonTool = betaTool({
      name: "delete_lesson",
      description: "Delete a lesson from this unit.",
      inputSchema: {
        type: "object" as const,
        properties: {
          lessonTitle: { type: "string" as const, description: "Title of the lesson to delete (case-insensitive match)" },
        },
        required: ["lessonTitle"] as const,
      },
      run: async (input) => {
        const freshCtx = await ctx.runQuery(
          internal.curriculumAssistant.getUnitDesignerContext,
          { teacherId: teacherId as Id<"users">, unitId: unitId as Id<"units"> }
        );
        if (!freshCtx) return "Unit not found.";
        const lower = input.lessonTitle.toLowerCase();
        const lesson = freshCtx.lessons.find(
          (l) => l.title.toLowerCase().includes(lower)
        );
        if (!lesson) return `No lesson found matching "${input.lessonTitle}".`;

        await ctx.runMutation(internal.curriculumAssistant.deleteLessonInternal, {
          lessonId: lesson._id,
        });
        udEmit({ toolComplete: { name: "delete_lesson", result: `Deleted "${lesson.title}"` } });
        return `Lesson "${lesson.title}" deleted.`;
      },
    });

    const generateLessonPromptTool = betaTool({
      name: "generate_lesson_prompt",
      description: "Generate a system prompt for a specific lesson based on the unit context and lesson details. Writes the prompt directly to the lesson.",
      inputSchema: {
        type: "object" as const,
        properties: {
          lessonTitle: { type: "string" as const, description: "Title of the lesson" },
          prompt: { type: "string" as const, description: "The generated system prompt to save" },
        },
        required: ["lessonTitle", "prompt"] as const,
      },
      run: async (input) => {
        const freshCtx = await ctx.runQuery(
          internal.curriculumAssistant.getUnitDesignerContext,
          { teacherId: teacherId as Id<"users">, unitId: unitId as Id<"units"> }
        );
        if (!freshCtx) return "Unit not found.";
        const lower = input.lessonTitle.toLowerCase();
        const lesson = freshCtx.lessons.find(
          (l) => l.title.toLowerCase().includes(lower)
        );
        if (!lesson) return `No lesson found matching "${input.lessonTitle}".`;

        await ctx.runMutation(internal.curriculumAssistant.updateLessonInternal, {
          lessonId: lesson._id,
          systemPrompt: input.prompt,
        });
        udEmit({ toolComplete: { name: "generate_lesson_prompt", result: `Prompt saved for "${lesson.title}"` } });
        return `System prompt saved for "${lesson.title}".`;
      },
    });

    const generateAllPromptsTool = betaTool({
      name: "generate_all_prompts",
      description: "Batch generate system prompts for all lessons that don't have one yet. Returns a list of lessons that need prompts — you should then generate each one.",
      inputSchema: {
        type: "object" as const,
        properties: {},
        required: [] as const,
      },
      run: async () => {
        const freshCtx = await ctx.runQuery(
          internal.curriculumAssistant.getUnitDesignerContext,
          { teacherId: teacherId as Id<"users">, unitId: unitId as Id<"units"> }
        );
        if (!freshCtx) return "Unit not found.";
        const missing = freshCtx.lessons.filter((l) => !l.systemPrompt?.trim());
        if (missing.length === 0) {
          udEmit({ toolComplete: { name: "generate_all_prompts", result: "All lessons have prompts" } });
          return "All lessons already have system prompts.";
        }
        udEmit({ toolComplete: { name: "generate_all_prompts", result: `${missing.length} lessons need prompts` } });
        return `${missing.length} lessons need prompts:\n${missing.map((l) => `- ${l.title} [${l.strand ?? "none"}]${l.processTitle ? ` (${l.processTitle})` : ""}`).join("\n")}\n\nGenerate a prompt for each using the generate_lesson_prompt tool.`;
      },
    });

    const tools = [
      readUnitStructureTool,
      updateUnitTool,
      createLessonTool,
      updateLessonTool,
      deleteLessonTool,
      generateLessonPromptTool,
      generateAllPromptsTool,
    ];

    const stream = new ReadableStream({
      async start(controller) {
        udEmit = (data) => controller.enqueue(udEncoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        let fullContent = "";
        let model = "";
        let tokensUsed = 0;
        let finalized = false;

        try {
          let lastPersistLength = 0;

          const apiMessages = context.messages
            .filter((m) => m.content.trim() !== "")
            .map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            }));

          const runner = anthropic.beta.messages.toolRunner({
            model: MODELS.SONNET,
            max_tokens: 4096,
            system: systemPrompt,
            messages: apiMessages,
            tools,
            stream: true,
          });

          for await (const messageStream of runner) {
            for await (const event of messageStream) {
              if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
                controller.enqueue(
                  udEncoder.encode(`data: ${JSON.stringify({ toolStart: { name: (event.content_block as { name?: string }).name } })}\n\n`)
                );
              } else if (event.type === "message_start") {
                model = event.message.model;
              } else if (event.type === "content_block_delta") {
                const delta = event.delta;
                if ("text" in delta) {
                  fullContent += delta.text;
                  controller.enqueue(
                    udEncoder.encode(
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
          finalized = true;

          controller.enqueue(
            udEncoder.encode(
              `data: ${JSON.stringify({ done: true })}\n\n`
            )
          );
          controller.close();
        } catch (error) {
          console.error("Unit designer stream error:", error);
          if (!finalized) {
            try {
              await ctx.runMutation(
                internal.curriculumAssistant.finalizeStream,
                {
                  messageId: assistantMsgId as Id<"curriculumMessages">,
                  content: fullContent || "",
                  model,
                  tokensUsed,
                }
              );
            } catch (finalizeErr) {
              console.error("Failed to finalize unit designer stream on error:", finalizeErr);
            }
          }
          controller.enqueue(
            udEncoder.encode(
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

// CORS preflight for unit-designer-stream
http.route({
  path: "/unit-designer-stream",
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
