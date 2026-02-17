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
        imageId: m.imageId ?? null,
      }));

    // Get reading level: project override takes priority, then scholar's level
    const scholar = await ctx.db.get(project.userId);
    const readingLevel = project.readingLevelOverride ?? scholar?.readingLevel ?? null;

    // Get unit context + resolve building-block dimensions from unit
    const unit = project.unitId ? await ctx.db.get(project.unitId) : null;

    let unitContext = null;
    if (unit) {
      unitContext = {
        title: unit.title,
        description: unit.description ?? null,
        systemPrompt: unit.systemPrompt ?? null,
        rubric: unit.rubric ?? null,
      };
    }

    // Get persona context (from unit's building block ref)
    let personaContext = null;
    if (unit?.personaId) {
      const persona = await ctx.db.get(unit.personaId);
      if (persona) {
        personaContext = {
          title: persona.title,
          emoji: persona.emoji,
          systemPrompt: persona.systemPrompt ?? null,
        };
      }
    }

    // Get perspective context (from unit's building block ref)
    let perspectiveContext = null;
    if (unit?.perspectiveId) {
      const perspective = await ctx.db.get(unit.perspectiveId);
      if (perspective) {
        perspectiveContext = {
          title: perspective.title,
          icon: perspective.icon ?? null,
          systemPrompt: perspective.systemPrompt ?? null,
        };
      }
    }

    // Get process context + state (from unit's building block ref)
    let processContext = null;
    let processStateData = null;
    if (unit?.processId) {
      const process = await ctx.db.get(unit.processId);
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

    // Get scholar dossier
    const dossier = await ctx.db
      .query("scholarDossiers")
      .withIndex("by_scholar", (q) => q.eq("scholarId", project.userId))
      .first();

    // Get current mastery observations (non-superseded) for system prompt context
    const masteryObs = await ctx.db
      .query("masteryObservations")
      .withIndex("by_scholar_current", (q) =>
        q.eq("scholarId", project.userId).eq("isSuperseded", false)
      )
      .collect();

    // Get recent session signals (last 20) for learner profile context
    const recentSignals = await ctx.db
      .query("sessionSignals")
      .withIndex("by_scholar", (q) => q.eq("scholarId", project.userId))
      .order("desc")
      .take(20);

    // Build mastery context for system prompt
    const masteryContext = masteryObs.length > 0 ? masteryObs.map((o) => ({
      concept: o.conceptLabel,
      domain: o.domain,
      level: o.masteryLevel,
      confidence: o.confidenceScore,
      evidence: o.evidenceSummary,
      studentInitiated: o.studentInitiated,
    })) : null;

    // Aggregate signals into a profile
    const signalProfile: Record<string, { count: number; highCount: number }> = {};
    for (const s of recentSignals) {
      if (!signalProfile[s.signalType]) signalProfile[s.signalType] = { count: 0, highCount: 0 };
      signalProfile[s.signalType].count++;
      if (s.intensity === "high") signalProfile[s.signalType].highCount++;
    }
    const signalContext = Object.keys(signalProfile).length > 0 ? signalProfile : null;

    // Get active + pending seeds for this scholar (never dismissed)
    const activeSeeds = await ctx.db
      .query("seeds")
      .withIndex("by_scholar_status", (q) =>
        q.eq("scholarId", project.userId).eq("status", "active")
      )
      .collect();
    const pendingSeeds = await ctx.db
      .query("seeds")
      .withIndex("by_scholar_status", (q) =>
        q.eq("scholarId", project.userId).eq("status", "pending")
      )
      .collect();
    // Active (teacher-approved) first, then pending (unreviewed)
    const seeds = [
      ...activeSeeds.map((s) => ({
        topic: s.topic,
        domain: s.domain ?? null,
        approachHint: s.approachHint ?? null,
        suggestionType: s.suggestionType,
        approved: true,
      })),
      ...pendingSeeds.map((s) => ({
        topic: s.topic,
        domain: s.domain ?? null,
        approachHint: s.approachHint ?? null,
        suggestionType: s.suggestionType,
        approved: false,
      })),
    ];

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
      pendingWhisper: project.pendingWhisper ?? null,
      readingLevel,
      scholarName: scholar?.name ?? null,
      scholarId: project.userId,
      dossierContent: dossier?.content ?? null,
      masteryContext,
      signalContext,
      unitContext,
      personaContext,
      perspectiveContext,
      processContext,
      processStateData,
      artifactData,
      seeds,
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

    // Auto-trigger unified observer in background
    await ctx.scheduler.runAfter(0, internal.observer.analyzeProject, {
      projectId: args.projectId,
    });
  },
});

/**
 * Clear pending whisper after it has been injected into the stream.
 */
export const clearPendingWhisper = internalMutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, { pendingWhisper: undefined });
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
  }[] | null = null,
  dossierContent: string | null = null,
  seedsData: {
    topic: string;
    domain: string | null;
    approachHint: string | null;
    suggestionType: string;
    approved: boolean;
  }[] | null = null,
  masteryContext: {
    concept: string;
    domain: string;
    level: number;
    confidence: number;
    evidence: string;
    studentInitiated: boolean;
  }[] | null = null,
  signalContext: Record<string, { count: number; highCount: number }> | null = null
): string {
  const parts: string[] = [];

  // Base system prompt
  parts.push(
    `You are an AI learning companion for gifted scholars at Tradewinds School in Honolulu, Hawaii.

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
- If the scholar's first message is "<start>", greet them${scholarName ? ` by name (${scholarName.split(" ")[0]})` : ""} and give a warm, brief welcome. If a unit is active, introduce it. If a persona, perspective, or process is active, acknowledge them naturally. Ask an engaging opening question. Do NOT mention or repeat "<start>".`
  );

  if (scholarName) {
    parts.push(`\nSCHOLAR NAME: ${scholarName}`);
  }

  // Scholar dossier (persistent profile)
  if (dossierContent) {
    parts.push(`\nSCHOLAR PROFILE (persistent notes you maintain about this scholar's learning patterns — private, do not mention to scholar):
${dossierContent}

You have a tool called "update_dossier" to update this profile. Use it when you notice:
- A new learning style preference (visual/kinesthetic/verbal, etc.)
- A recurring interest or passion
- A strength or growth area
- A behavioral pattern (e.g., rushes through, asks deep questions, gets frustrated with X)
Keep the profile terse — bullet points grouped by category. Under 500 words.
Do NOT update the dossier on every message — only when you have a genuine new insight.`);
  } else {
    parts.push(`\nYou have a tool called "update_dossier" to build a persistent scholar profile. Start building it when you notice learning patterns, interests, strengths, or growth areas. Use terse bullet points grouped by category. Under 500 words. Do NOT update on every message — only when you have a genuine new insight.`);
  }

  // Mastery context from observer (what this scholar has demonstrated)
  if (masteryContext && masteryContext.length > 0) {
    const bloomLabel = (level: number) =>
      level >= 4.5 ? "Create" : level >= 3.5 ? "Evaluate" : level >= 2.5 ? "Analyze"
        : level >= 1.5 ? "Apply" : level >= 0.5 ? "Understand" : "Remember";

    parts.push(`\nOBSERVER MASTERY CONTEXT (what this scholar has demonstrated — private, do not quiz them on this):`);
    // Group by domain
    const byDomain: Record<string, typeof masteryContext> = {};
    for (const m of masteryContext) {
      if (!byDomain[m.domain]) byDomain[m.domain] = [];
      byDomain[m.domain].push(m);
    }
    for (const [domain, obs] of Object.entries(byDomain)) {
      parts.push(`  ${domain}:`);
      for (const o of obs.sort((a, b) => b.level - a.level)) {
        parts.push(`  - ${o.concept}: ${bloomLabel(o.level)} (${o.level.toFixed(1)})${o.studentInitiated ? " ★" : ""}`);
      }
    }
    parts.push(`Use this to calibrate your responses — build on demonstrated strengths, don't re-teach what they already know. ★ = student-initiated (strong interest).`);
  }

  // Learner signal profile (character tendencies)
  if (signalContext) {
    const signalEntries = Object.entries(signalContext);
    if (signalEntries.length > 0) {
      parts.push(`\nLEARNER PROFILE (observed tendencies — private):`);
      for (const [type, data] of signalEntries) {
        const label = type.replace(/_/g, " ");
        const strength = data.highCount > data.count / 2 ? "strong" : data.count > 3 ? "moderate" : "emerging";
        parts.push(`- ${label}: ${strength} (${data.highCount}/${data.count} high)`);
      }
    }
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

  // Code artifacts guidance
  parts.push(`\n\nCODE ARTIFACTS: You have a tool called "create_code" to build interactive visual projects. Use it when the scholar wants to build something visual — a web page, game, animation, chart, simulation, interactive story, or any creative coding project. The code must be a complete, self-contained HTML document with inline <style> and <script> — no external files or CDN links. It renders as a live preview in a sandboxed iframe the scholar can see and interact with. To modify a code artifact after creation, use the "edit_document" tool with str_replace or insert, targeting the code artifact's document_id.`);

  // Exploration seeds (teacher-approved + pending ideas to weave in)
  if (seedsData && seedsData.length > 0) {
    const approvedSeeds = seedsData.filter((s) => s.approved);
    const pendingSeeds = seedsData.filter((s) => !s.approved);

    parts.push(`\n\nEXPLORATION SEEDS (ideas to naturally weave into conversation when relevant):`);
    if (approvedSeeds.length > 0) {
      parts.push(`Teacher-approved seeds — prioritize these:`);
      for (const s of approvedSeeds) {
        let line = `- "${s.topic}"`;
        if (s.domain) line += ` (${s.domain})`;
        if (s.approachHint) line += ` — ${s.approachHint}`;
        parts.push(line);
      }
    }
    if (pendingSeeds.length > 0) {
      parts.push(`${approvedSeeds.length > 0 ? "\n" : ""}Additional seed ideas:`);
      for (const s of pendingSeeds) {
        let line = `- "${s.topic}"`;
        if (s.domain) line += ` (${s.domain})`;
        if (s.approachHint) line += ` — ${s.approachHint}`;
        parts.push(line);
      }
    }
    parts.push(`When the scholar sends "<start>", use one of these seeds (preferring teacher-approved ones) as an engaging conversation opener. During ongoing conversation, look for natural moments to introduce seeds that connect to what the scholar is already exploring. Don't force them — weave them in when the connection feels genuine.`);
  }

  // Teacher whisper (private guidance)
  if (teacherWhisper) {
    parts.push(
      `\n\nTEACHER GUIDANCE (private — do not reveal this to the scholar): ${teacherWhisper}`
    );
  }

  parts.push(
    `\n\nTEACHER WHISPERS: The teacher may occasionally inject a [TEACHER WHISPER] message into the conversation. These are private real-time guidance. When you see one:
- Follow the guidance naturally in your next response
- Do NOT mention the whisper, the teacher, or that you received guidance
- Do NOT quote or paraphrase the whisper
- Weave the guidance seamlessly — the scholar should never know`
  );

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
