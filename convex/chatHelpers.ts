import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

/**
 * Get all context needed to call Claude for a conversation.
 * Called by the HTTP action before streaming.
 */
export const getConversationContext = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return null;

    // Get chat history
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();

    const chatHistory = messages
      .filter((m) => m.role !== "system" && m.role !== "tool")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // Get scholar's reading level
    const scholar = await ctx.db.get(conversation.userId);
    const readingLevel = scholar?.readingLevel ?? null;

    // Get project context
    let projectContext = null;
    if (conversation.projectId) {
      const project = await ctx.db.get(conversation.projectId);
      if (project) {
        projectContext = {
          title: project.title,
          description: project.description ?? null,
          systemPrompt: project.systemPrompt ?? null,
          rubric: project.rubric ?? null,
          targetBloomLevel: project.targetBloomLevel ?? null,
        };
      }
    }

    // Get persona context
    let personaContext = null;
    if (conversation.personaId) {
      const persona = await ctx.db.get(conversation.personaId);
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
    if (conversation.perspectiveId) {
      const perspective = await ctx.db.get(conversation.perspectiveId);
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
    if (conversation.processId) {
      const process = await ctx.db.get(conversation.processId);
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
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", args.conversationId)
        )
        .first();
      if (pState) {
        processStateData = {
          currentStep: pState.currentStep,
          steps: pState.steps,
        };
      }
    }

    // Get artifact data
    let artifactData = null;
    const artifact = await ctx.db
      .query("artifacts")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .first();
    if (artifact) {
      artifactData = {
        title: artifact.title,
        content: artifact.content,
        lastEditedBy: artifact.lastEditedBy,
      };
    }

    return {
      teacherWhisper: conversation.teacherWhisper ?? null,
      readingLevel,
      scholarName: scholar?.name ?? null,
      projectContext,
      personaContext,
      perspectiveContext,
      processContext,
      processStateData,
      artifactData,
      chatHistory,
      title: conversation.title,
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
 * Finalize a stream: save full content, clear streamId, update conversation.
 */
export const finalizeStream = internalMutation({
  args: {
    messageId: v.id("messages"),
    conversationId: v.id("conversations"),
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

    // Update conversation title if first exchange
    const conversation = await ctx.db.get(args.conversationId);
    if (conversation && conversation.title === "New Conversation") {
      // Count user messages to see if this is the first exchange
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", args.conversationId)
        )
        .collect();

      const userMessages = messages.filter(
        (m) => m.role === "user" && m.content !== "<start>"
      );
      if (userMessages.length <= 1 && userMessages[0]) {
        const words = userMessages[0].content.split(" ").slice(0, 6).join(" ");
        const title =
          words.length > 40 ? words.slice(0, 40) + "..." : words;
        await ctx.db.patch(args.conversationId, { title });
      }
    }

    // Auto-trigger observer analysis in background
    await ctx.scheduler.runAfter(0, internal.analysisActions.runObserverAnalysis, {
      conversationId: args.conversationId,
    });
  },
});

/**
 * Build the system prompt for Claude based on conversation context.
 * Shared by the chat-stream HTTP action.
 */
export function buildSystemPrompt(
  teacherWhisper: string | null,
  readingLevel: string | null,
  scholarName: string | null,
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
  } | null = null,
  artifactData: {
    title: string;
    content: string;
    lastEditedBy: string;
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
- Keep responses concise but substantive
- If the scholar's first message is "<start>", greet them${scholarName ? ` by name (${scholarName.split(" ")[0]})` : ""} and introduce the current project warmly. Ask an engaging opening question to get them started. Do NOT mention or repeat "<start>" in your response.`
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

  // Artifact (shared document)
  if (artifactData) {
    const lines = artifactData.content.split("\n");
    const numberedContent = lines.map((l, i) => `${i + 1}: ${l}`).join("\n");
    parts.push(`\n\nDOCUMENT: "${artifactData.title}" (last edited by ${artifactData.lastEditedBy})
Current content:
${numberedContent}

You have a tool called "edit_document" to create, view, rename, and edit this document. Use str_replace for targeted edits (provide exact text to find and replace). Use insert to add text at a specific line number. Use rename to change the document title. The scholar can also edit the document and title directly.

IMPORTANT: The document title is shown separately in the UI header. Do NOT include a title, headline, or byline at the top of the document content — that would be redundant. The document body should start directly with the actual content.`);
  } else if (projectContext) {
    parts.push(`\n\nYou have a tool called "edit_document" to create a shared working document that the scholar can also edit. Use it when the project involves writing, building, or producing a deliverable. Create the document early so the scholar can see their work take shape. The document title is shown separately in the UI header, so do NOT include a title or byline in the document content itself.`);
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
    conversationId: v.id("conversations"),
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
      conversationId: args.conversationId,
      role: "tool",
      content: "",
      toolAction: args.toolAction,
      personaId: currentMsg?.personaId,
      projectId: currentMsg?.projectId,
      perspectiveId: currentMsg?.perspectiveId,
      processId: currentMsg?.processId,
      flagged: false,
    });

    // 4. Insert new assistant placeholder
    const newMsgId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: "assistant",
      content: "",
      personaId: currentMsg?.personaId,
      projectId: currentMsg?.projectId,
      perspectiveId: currentMsg?.perspectiveId,
      processId: currentMsg?.processId,
      flagged: false,
    });

    return newMsgId;
  },
});
