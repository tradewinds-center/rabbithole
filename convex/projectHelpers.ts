import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

/**
 * Get all context needed to call Claude for a project.
 * Called by the HTTP action before streaming.
 */
export const getProjectContext = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;

    // Get chat history
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_project", (q) =>
        q.eq("projectId", args.projectId)
      )
      .order("asc")
      .collect();

    const chatHistory = messages
      .filter((m) => m.role !== "system" && m.role !== "tool")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // Get reading level: project override takes priority, then scholar's level
    const scholar = await ctx.db.get(project.userId);
    const readingLevel = project.readingLevelOverride ?? scholar?.readingLevel ?? null;

    // Get unit context
    let unitContext = null;
    if (project.unitId) {
      const unit = await ctx.db.get(project.unitId);
      if (unit) {
        unitContext = {
          title: unit.title,
          description: unit.description ?? null,
          systemPrompt: unit.systemPrompt ?? null,
          rubric: unit.rubric ?? null,
          targetBloomLevel: unit.targetBloomLevel ?? null,
        };
      }
    }

    // Get persona context
    let personaContext = null;
    if (project.personaId) {
      const persona = await ctx.db.get(project.personaId);
      if (persona) {
        personaContext = {
          title: persona.title,
          emoji: persona.emoji,
          systemPrompt: persona.systemPrompt ?? null,
        };
      }
    }

    // Get perspective context
    let perspectiveContext = null;
    if (project.perspectiveId) {
      const perspective = await ctx.db.get(project.perspectiveId);
      if (perspective) {
        perspectiveContext = {
          title: perspective.title,
          icon: perspective.icon ?? null,
          systemPrompt: perspective.systemPrompt ?? null,
        };
      }
    }

    // Get process context + state
    let processContext = null;
    let processStateData = null;
    if (project.processId) {
      const process = await ctx.db.get(project.processId);
      if (process) {
        processContext = {
          title: process.title,
          emoji: process.emoji ?? null,
          systemPrompt: process.systemPrompt ?? null,
          steps: process.steps,
        };
      }
      const pState = await ctx.db
        .query("processState")
        .withIndex("by_project", (q) =>
          q.eq("projectId", args.projectId)
        )
        .first();
      if (pState) {
        processStateData = {
          currentStep: pState.currentStep,
          steps: pState.steps,
        };
      }
    }

    // Get artifact data (multi-document)
    const allArtifacts = await ctx.db
      .query("artifacts")
      .withIndex("by_project", (q) =>
        q.eq("projectId", args.projectId)
      )
      .collect();
    const artifactData = allArtifacts.length > 0
      ? allArtifacts.map((a) => ({
          id: a._id,
          title: a.title,
          content: a.content,
          lastEditedBy: a.lastEditedBy,
        }))
      : null;

    return {
      teacherWhisper: project.teacherWhisper ?? null,
      readingLevel,
      scholarName: scholar?.name ?? null,
      unitContext,
      personaContext,
      perspectiveContext,
      processContext,
      processStateData,
      artifactData,
      chatHistory,
      title: project.title,
    };
  },
});

/**
 * Update streaming message content (called periodically during stream).
 */
export const updateStreamContent = internalMutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      content: args.content,
    });
  },
});

/**
 * Finalize a stream: save full content, clear streamId, update project.
 */
export const finalizeStream = internalMutation({
  args: {
    messageId: v.id("messages"),
    projectId: v.id("projects"),
    content: v.string(),
    model: v.optional(v.string()),
    tokensUsed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // If content is empty (tool fired at end, no text followed), delete the trailing placeholder
    if (!args.content.trim()) {
      await ctx.db.delete(args.messageId);
    } else {
      // Finalize the assistant message
      await ctx.db.patch(args.messageId, {
        content: args.content,
        model: args.model,
        tokensUsed: args.tokensUsed,
        streamId: undefined,
      });
    }

    // Update project title if first exchange
    const project = await ctx.db.get(args.projectId);
    if (project && project.title === "New Project") {
      // Count user messages to see if this is the first exchange
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_project", (q) =>
          q.eq("projectId", args.projectId)
        )
        .collect();

      const userMessages = messages.filter(
        (m) => m.role === "user" && m.content !== "<start>"
      );
      if (userMessages.length <= 1 && userMessages[0]) {
        const words = userMessages[0].content.split(" ").slice(0, 6).join(" ");
        const title =
          words.length > 40 ? words.slice(0, 40) + "..." : words;
        await ctx.db.patch(args.projectId, { title });
      }
    }

    // Auto-trigger observer analysis in background
    await ctx.scheduler.runAfter(0, internal.analysisActions.runObserverAnalysis, {
      projectId: args.projectId,
    });
  },
});

/**
 * Build the system prompt for Claude based on project context.
 * Shared by the project-stream HTTP action.
 */
export function buildSystemPrompt(
  teacherWhisper: string | null,
  readingLevel: string | null,
  scholarName: string | null,
  unitContext: {
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
  } | null = null,
  artifactData: {
    id: string;
    title: string;
    content: string;
    lastEditedBy: string;
  }[] | null = null
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
- Keep responses concise but substantive
- You can use markdown in your responses: **bold**, *italic*, lists, headers, etc.
- If the scholar's first message is "<start>", greet them${scholarName ? ` by name (${scholarName.split(" ")[0]})` : ""} and introduce the current unit warmly. Ask an engaging opening question to get them started. Do NOT mention or repeat "<start>" in your response.`
  );

  if (scholarName) {
    parts.push(`\nSCHOLAR NAME: ${scholarName}`);
  }

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

  // Unit context
  if (unitContext) {
    parts.push(`\n\nUNIT: "${unitContext.title}"`);
    if (unitContext.systemPrompt) {
      parts.push(`Instructions: ${unitContext.systemPrompt}`);
    }
    if (unitContext.rubric) {
      parts.push(`Rubric: ${unitContext.rubric}`);
    }
    if (unitContext.targetBloomLevel) {
      parts.push(
        `Target cognitive level (Bloom's): ${unitContext.targetBloomLevel}. Guide the scholar toward this level of thinking.`
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

  // Artifacts (shared documents — supports multiple)
  if (artifactData && artifactData.length > 0) {
    parts.push(`\n\nDOCUMENTS (${artifactData.length}):`);
    for (const doc of artifactData) {
      const lines = doc.content.split("\n");
      const numberedContent = lines.map((l, i) => `${i + 1}: ${l}`).join("\n");
      parts.push(`\n[Document ID: ${doc.id}] "${doc.title}" (last edited by ${doc.lastEditedBy})
Content:
${numberedContent}`);
    }
    parts.push(`\nYou have a tool called "edit_document" to create, view, rename, and edit documents. When editing an existing document, pass the document_id to target the correct one. Use str_replace for targeted edits (provide exact text to find and replace). Use insert to add text at a specific line number. Use rename to change the document title. The scholar can also edit documents and titles directly.

IMPORTANT: Documents are plain text only — do NOT use markdown formatting. Document titles are shown separately in the UI header. Do NOT include a title, headline, or byline at the top of document content — that would be redundant. Document body should start directly with the actual content.`);
  } else if (unitContext) {
    parts.push(`\n\nYou have a tool called "edit_document" to create shared working documents that the scholar can also edit. Use it when the unit involves writing, building, or producing a deliverable. Create a document early so the scholar can see their work take shape. Documents are plain text only — do NOT use markdown formatting. Document titles are shown separately in the UI header, so do NOT include a title or byline in the document content itself. Multiple documents can be created for different parts of the work.`);
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
 * Split stream: called by tool run callbacks when a tool fires mid-stream.
 * 1. Finalizes the current assistant message with content so far
 * 2. Inserts a role:"tool" message with the toolAction label
 * 3. Inserts a new empty assistant placeholder
 * Returns the new assistant message ID.
 */
export const splitStream = internalMutation({
  args: {
    currentMessageId: v.id("messages"),
    projectId: v.id("projects"),
    contentSoFar: v.string(),
    toolAction: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Finalize current assistant message with content accumulated so far
    await ctx.db.patch(args.currentMessageId, {
      content: args.contentSoFar,
      streamId: undefined,
    });

    // 2. Get dimension snapshots from the current message
    const currentMsg = await ctx.db.get(args.currentMessageId);

    // 3. Insert tool message
    await ctx.db.insert("messages", {
      projectId: args.projectId,
      role: "tool",
      content: "",
      toolAction: args.toolAction,
      personaId: currentMsg?.personaId,
      unitId: currentMsg?.unitId,
      perspectiveId: currentMsg?.perspectiveId,
      processId: currentMsg?.processId,
      flagged: false,
    });

    // 4. Insert new assistant placeholder
    const newMsgId = await ctx.db.insert("messages", {
      projectId: args.projectId,
      role: "assistant",
      content: "",
      personaId: currentMsg?.personaId,
      unitId: currentMsg?.unitId,
      perspectiveId: currentMsg?.perspectiveId,
      processId: currentMsg?.processId,
      flagged: false,
    });

    return newMsgId;
  },
});
