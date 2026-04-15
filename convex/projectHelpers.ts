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
        youtubeUrl: unit.youtubeUrl ?? null,
        videoTranscript: unit.videoTranscript ?? null,
        bigIdea: unit.bigIdea ?? null,
        essentialQuestions: unit.essentialQuestions ?? null,
        enduringUnderstandings: unit.enduringUnderstandings ?? null,
      };
    }

    // Get lesson context when project has a lessonId
    let lessonContext = null;
    const lesson = project.lessonId ? await ctx.db.get(project.lessonId) : null;
    if (lesson) {
      const lessonProcess = lesson.processId ? await ctx.db.get(lesson.processId) : null;
      lessonContext = {
        title: lesson.title,
        strand: lesson.strand ?? null,
        systemPrompt: lesson.systemPrompt ?? null,
        durationMinutes: lesson.durationMinutes ?? null,
        processTitle: lessonProcess?.title ?? null,
        processEmoji: lessonProcess?.emoji ?? null,
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

    // Get process context + state
    // Lesson's processId takes priority over unit's processId
    let processContext = null;
    let processStateData = null;
    const resolvedProcessId = lesson?.processId ?? unit?.processId;
    if (resolvedProcessId) {
      const process = await ctx.db.get(resolvedProcessId);
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

    // Get focus timing context
    const activeFocus = await ctx.db
      .query("focusSettings")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first();
    let timingContext: {
      unitEndsAt: number | null;
      projectStartedAt: number;
      unitDurationMinutes: number | null;
    } | null = null;
    if (activeFocus && activeFocus.isActive && activeFocus.endsAt && Date.now() <= activeFocus.endsAt) {
      timingContext = {
        unitEndsAt: activeFocus.endsAt,
        projectStartedAt: project._creationTime,
        unitDurationMinutes: unit?.durationMinutes ?? null,
      };
    } else if (unit?.durationMinutes) {
      // No active focus but unit has a duration — pass it for soft pacing
      timingContext = {
        unitEndsAt: null,
        projectStartedAt: project._creationTime,
        unitDurationMinutes: unit.durationMinutes,
      };
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
      pendingWhisper: project.pendingWhisper ?? null,
      readingLevel,
      scholarName: scholar?.name ?? null,
      scholarId: project.userId,
      dossierContent: dossier?.content ?? null,
      masteryContext,
      signalContext,
      unitContext,
      lessonContext,
      personaContext,
      perspectiveContext,
      processContext,
      processStateData,
      artifactData,
      seeds,
      chatHistory,
      title: project.title,
      timingContext,
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

    // Denormalize last message info onto the project for efficient dashboard queries
    await ctx.db.patch(args.projectId, {
      lastMessageAt: Date.now(),
      lastMessageRole: "assistant",
      lastMessagePreview: args.content.slice(0, 120) || undefined,
    });

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

// ── System Prompt Types ───────────────────────────────────────────────

export type UnitContext = {
  title: string;
  description: string | null;
  systemPrompt: string | null;
  rubric: string | null;
  youtubeUrl: string | null;
  videoTranscript: string | null;
  bigIdea: string | null;
  essentialQuestions: string[] | null;
  enduringUnderstandings: string[] | null;
};

export type PersonaContext = {
  title: string;
  emoji: string | null;
  systemPrompt: string | null;
};

export type PerspectiveContext = {
  title: string;
  icon: string | null;
  systemPrompt: string | null;
};

export type ProcessContext = {
  title: string;
  emoji: string | null;
  systemPrompt: string | null;
  steps: { key: string; title: string; description?: string }[];
};

export type ProcessStateData = {
  currentStep: string;
  steps: { key: string; status: string; commentary?: string }[];
};

export type ArtifactData = {
  id: string;
  title: string;
  content: string;
  lastEditedBy: string;
};

export type SeedData = {
  topic: string;
  domain: string | null;
  approachHint: string | null;
  suggestionType: string;
  approved: boolean;
};

export type MasteryContextEntry = {
  concept: string;
  domain: string;
  level: number;
  confidence: number;
  evidence: string;
  studentInitiated: boolean;
};

export type SignalContext = Record<string, { count: number; highCount: number }>;

export type TimingContext = {
  unitEndsAt: number | null;
  projectStartedAt: number;
  unitDurationMinutes: number | null;
};

export type LessonContext = {
  title: string;
  strand: string | null;
  systemPrompt: string | null;
  durationMinutes: number | null;
  processTitle: string | null;
  processEmoji: string | null;
};

// ── System Prompt Section Builders ───────────────────────────────────

function buildBasePrompt(scholarName: string | null): string {
  return `You are an AI learning companion for gifted scholars at Tradewinds School in Honolulu, Hawaii.

Your role is to be a Socratic tutor: ask probing questions, encourage deep thinking, and help scholars explore ideas rather than just giving answers. Be warm, encouraging, and intellectually stimulating. Adapt to the scholar's level and interests.

You are a learning tool — professional, bounded, and focused on intellectual growth. You do not simulate friendship or emotional connection. Sessions have clear learning goals and time limits.

Guidelines:
- Ask follow-up questions that push thinking deeper
- Encourage multiple perspectives on topics
- Celebrate curiosity and effort, not the person ("Great question!" not "You're so smart!")
- Use age-appropriate language
- Be honest when you don't know something
- Connect topics across disciplines when natural
- Keep responses concise but substantive
- Do not use emotional language or express feelings — stay intellectually warm but professionally bounded
- Do not say things like "I'm excited," "I miss you," "I'm proud of you," or "We're friends"
- Focus praise on ideas, questions, and thinking processes, not on the scholar's identity
- You can use markdown in your responses: **bold**, *italic*, lists, headers, etc.
- If the scholar's first message is "<start>", greet them${scholarName ? ` by name (${scholarName.split(" ")[0]})` : ""} and give a warm, brief welcome focused on the work ahead. If a unit is active, introduce it. If a persona, perspective, or process is active, acknowledge them naturally. Ask an engaging opening question about the topic. Do NOT mention or repeat "<start>".${scholarName ? `\n\nSCHOLAR NAME: ${scholarName}` : ""}`;
}

function buildDossierSection(dossierContent: string | null): string {
  if (dossierContent) {
    return `\nSCHOLAR PROFILE (persistent notes you maintain about this scholar's learning patterns — private, do not mention to scholar):
${dossierContent}

You have a tool called "update_dossier" to update this profile. Use it when you notice:
- A new learning style preference (visual/kinesthetic/verbal, etc.)
- A recurring interest or passion
- A strength or growth area
- A behavioral pattern (e.g., rushes through, asks deep questions, gets frustrated with X)
Keep the profile terse — bullet points grouped by category. Under 500 words.
Do NOT update the dossier on every message — only when you have a genuine new insight.`;
  }
  return `\nYou have a tool called "update_dossier" to build a persistent scholar profile. Start building it when you notice learning patterns, interests, strengths, or growth areas. Use terse bullet points grouped by category. Under 500 words. Do NOT update on every message — only when you have a genuine new insight.`;
}

function buildMasterySection(masteryContext: MasteryContextEntry[] | null): string | null {
  if (!masteryContext || masteryContext.length === 0) return null;

  const bloomLabel = (level: number) =>
    level >= 4.5 ? "Create" : level >= 3.5 ? "Evaluate" : level >= 2.5 ? "Analyze"
      : level >= 1.5 ? "Apply" : level >= 0.5 ? "Understand" : "Remember";

  const lines: string[] = [];
  lines.push(`\nOBSERVER MASTERY CONTEXT (what this scholar has demonstrated — private, do not quiz them on this):`);
  const byDomain: Record<string, MasteryContextEntry[]> = {};
  for (const m of masteryContext) {
    if (!byDomain[m.domain]) byDomain[m.domain] = [];
    byDomain[m.domain].push(m);
  }
  for (const [domain, obs] of Object.entries(byDomain)) {
    lines.push(`  ${domain}:`);
    for (const o of obs.sort((a, b) => b.level - a.level)) {
      lines.push(`  - ${o.concept}: ${bloomLabel(o.level)} (${o.level.toFixed(1)})${o.studentInitiated ? " ★" : ""}`);
    }
  }
  lines.push(`Use this to calibrate your responses — build on demonstrated strengths, don't re-teach what they already know. ★ = student-initiated (strong interest).`);
  return lines.join("\n");
}

function buildSignalSection(signalContext: SignalContext | null): string | null {
  if (!signalContext) return null;
  const entries = Object.entries(signalContext);
  if (entries.length === 0) return null;

  const lines: string[] = [`\nLEARNER PROFILE (observed tendencies — private):`];
  for (const [type, data] of entries) {
    const label = type.replace(/_/g, " ");
    const strength = data.highCount > data.count / 2 ? "strong" : data.count > 3 ? "moderate" : "emerging";
    lines.push(`- ${label}: ${strength} (${data.highCount}/${data.count} high)`);
  }
  return lines.join("\n");
}

function buildUnitSection(unitContext: UnitContext | null): string | null {
  if (!unitContext) return null;
  const lines: string[] = [`\n\nUNIT: "${unitContext.title}"`];
  if (unitContext.bigIdea) lines.push(`Big Idea: ${unitContext.bigIdea}`);
  if (unitContext.essentialQuestions?.length) {
    lines.push(`Essential Questions:\n${unitContext.essentialQuestions.map((q) => `  - ${q}`).join("\n")}`);
  }
  if (unitContext.enduringUnderstandings?.length) {
    lines.push(`Enduring Understandings:\n${unitContext.enduringUnderstandings.map((eu) => `  - ${eu}`).join("\n")}`);
  }
  if (unitContext.systemPrompt) lines.push(`Instructions: ${unitContext.systemPrompt}`);
  if (unitContext.rubric) lines.push(`Rubric: ${unitContext.rubric}`);
  if (unitContext.videoTranscript) {
    lines.push(`\nVIDEO TRANSCRIPT:
The scholar is reflecting on a video. Below is the transcript with timestamps.
Use this as the basis for discussion. Reference specific moments by timestamp.
Do NOT summarize — engage the scholar: ask what they noticed, what surprised them, what they agree/disagree with, what connections they see.

${unitContext.videoTranscript}`);
  }
  return lines.join("\n");
}

function buildLessonSection(lessonContext: LessonContext | null): string | null {
  if (!lessonContext) return null;
  const lines: string[] = [`\n\nLESSON: "${lessonContext.title}"`];
  if (lessonContext.strand) lines.push(`Strand: ${lessonContext.strand}`);
  if (lessonContext.processTitle) lines.push(`Process: ${lessonContext.processEmoji ?? ""} ${lessonContext.processTitle}`);
  if (lessonContext.systemPrompt) lines.push(`Lesson Instructions: ${lessonContext.systemPrompt}`);
  if (lessonContext.durationMinutes) lines.push(`Target Duration: ~${lessonContext.durationMinutes} minutes`);
  return lines.join("\n");
}

function buildTimingSection(timingContext: TimingContext | null): string | null {
  if (!timingContext) return null;
  if (timingContext.unitEndsAt) {
    const now = Date.now();
    const totalMs = timingContext.unitDurationMinutes
      ? timingContext.unitDurationMinutes * 60_000
      : timingContext.unitEndsAt - timingContext.projectStartedAt;
    const elapsedMs = now - (timingContext.unitEndsAt - totalMs);
    const remainingMs = timingContext.unitEndsAt - now;
    const remainingMin = Math.max(0, Math.round(remainingMs / 60_000));
    const pctThrough = Math.min(100, Math.round((elapsedMs / totalMs) * 100));

    const lines: string[] = [`\n\nTIMING: Session is ${pctThrough}% through, ~${remainingMin} minute${remainingMin !== 1 ? "s" : ""} remaining.`];
    if (remainingMin <= 5) {
      lines.push(`Almost over. Help the scholar wrap up their current thought, summarize what they explored, and suggest where to pick up next time.`);
    } else if (remainingMin <= 10) {
      lines.push(`Approaching the end. Begin guiding toward a natural stopping point — don't start new big threads.`);
    }
    lines.push(`Students are NEVER locked out. This is purely for pacing your responses naturally.`);
    return lines.join("\n");
  }
  if (timingContext.unitDurationMinutes) {
    return `\n\nTIMING: This unit is designed for ~${timingContext.unitDurationMinutes} minutes. Pace your responses accordingly, but no strict deadline is active.`;
  }
  return null;
}

function buildProcessSection(processContext: ProcessContext | null, processStateData: ProcessStateData | null): string | null {
  if (!processContext || !processStateData) return null;

  const lines: string[] = [`\n\nPROCESS: "${processContext.title}" ${processContext.emoji || ""}`];
  if (processContext.systemPrompt) lines.push(processContext.systemPrompt);

  lines.push(`\nProcess Steps:`);
  for (const step of processContext.steps) {
    const stateStep = processStateData.steps.find((s) => s.key === step.key);
    const status = stateStep?.status ?? "not_started";
    const isCurrent = step.key === processStateData.currentStep;
    const marker = isCurrent ? "→" : " ";
    const statusLabel = status === "not_started" ? "○" : status === "in_progress" ? "◉" : "✓";
    lines.push(`${marker} [${step.key}] ${statusLabel} ${step.title}${step.description ? ` — ${step.description}` : ""}`);
    if (stateStep?.commentary) lines.push(`    Commentary: ${stateStep.commentary}`);
  }

  lines.push(`\nYou have a tool called "update_process_step" to track the scholar's progress through these steps. Use it when:
- The scholar begins working on a step (set status to "in_progress")
- The scholar has sufficiently completed a step (set status to "completed")
- You want to record a brief observation about their work on a step (use the commentary field)
Guide the scholar naturally through the steps. You can move them back to revisit earlier steps if needed. Don't announce step transitions mechanically — weave them into the conversation naturally.`);
  return lines.join("\n");
}

function buildArtifactSection(artifactData: ArtifactData[] | null, hasUnit: boolean): string {
  const lines: string[] = [];
  if (artifactData && artifactData.length > 0) {
    lines.push(`\n\nDOCUMENTS (${artifactData.length}):`);
    for (const doc of artifactData) {
      const docLines = doc.content.split("\n");
      const numberedContent = docLines.map((l, i) => `${i + 1}: ${l}`).join("\n");
      lines.push(`\n[Document ID: ${doc.id}] "${doc.title}" (last edited by ${doc.lastEditedBy})
Content:
${numberedContent}`);
    }
    lines.push(`\nYou have a tool called "edit_document" to create, view, rename, and edit documents. When editing an existing document, pass the document_id to target the correct one. Use str_replace for targeted edits (provide exact text to find and replace). Use insert to add text at a specific line number. Use rename to change the document title. The scholar can also edit documents and titles directly.

IMPORTANT: Documents are plain text only — do NOT use markdown formatting. Document titles are shown separately in the UI header. Do NOT include a title, headline, or byline at the top of document content — that would be redundant. Document body should start directly with the actual content.`);
  } else if (hasUnit) {
    lines.push(`\n\nYou have a tool called "edit_document" to create shared working documents that the scholar can also edit. Use it when the unit involves writing, building, or producing a deliverable. Create a document early so the scholar can see their work take shape. Documents are plain text only — do NOT use markdown formatting. Document titles are shown separately in the UI header, so do NOT include a title or byline in the document content itself. Multiple documents can be created for different parts of the work.`);
  }
  return lines.join("\n");
}

function buildToolsSection(): string {
  return `\n\nCODE ARTIFACTS: You have a tool called "create_code" to build interactive visual projects. Use it when the scholar wants to build something visual — a web page, game, animation, chart, simulation, interactive story, or any creative coding project. The code must be a complete, self-contained HTML document with inline <style> and <script>. Prefer vanilla JS — external libraries via CDN are allowed if needed (e.g. p5.js, Three.js). It renders as a live preview in a sandboxed iframe the scholar can see and interact with. To modify a code artifact after creation, use the "edit_document" tool with str_replace or insert, targeting the code artifact's document_id.

IMAGE GENERATION: You have a tool called "generate_image" to create educational illustrations and visualizations. Use it when:
- A concept would be significantly clearer with a visual (cell structure, solar system, water cycle, geometric proof, historical scene, map)
- The scholar asks you to draw, illustrate, or show something
- A diagram or visual would deepen understanding beyond what words can convey

Do NOT generate images for decoration, greetings, or when text suffices.

Write a detailed prompt describing exactly what to illustrate — be specific about subject, composition, labels, colors, and educational content. Prefer clean, labeled diagram styles for scientific/mathematical concepts. For historical or creative topics, use a warm illustrative style appropriate for elementary students. Always describe the image to the scholar after generating it.`;
}

function buildSeedsSection(seedsData: SeedData[] | null): string | null {
  if (!seedsData || seedsData.length === 0) return null;

  const approvedSeeds = seedsData.filter((s) => s.approved);
  const pendingSeeds = seedsData.filter((s) => !s.approved);

  const lines: string[] = [`\n\nEXPLORATION SEEDS (ideas to naturally weave into conversation when relevant):`];
  if (approvedSeeds.length > 0) {
    lines.push(`Teacher-approved seeds — prioritize these:`);
    for (const s of approvedSeeds) {
      let line = `- "${s.topic}"`;
      if (s.domain) line += ` (${s.domain})`;
      if (s.approachHint) line += ` — ${s.approachHint}`;
      lines.push(line);
    }
  }
  if (pendingSeeds.length > 0) {
    lines.push(`${approvedSeeds.length > 0 ? "\n" : ""}Additional seed ideas:`);
    for (const s of pendingSeeds) {
      let line = `- "${s.topic}"`;
      if (s.domain) line += ` (${s.domain})`;
      if (s.approachHint) line += ` — ${s.approachHint}`;
      lines.push(line);
    }
  }
  lines.push(`When the scholar sends "<start>", use one of these seeds (preferring teacher-approved ones) as an engaging conversation opener. During ongoing conversation, look for natural moments to introduce seeds that connect to what the scholar is already exploring. Don't force them — weave them in when the connection feels genuine.`);
  return lines.join("\n");
}

function buildWhisperSection(teacherWhisper: string | null): string {
  const lines: string[] = [];
  if (teacherWhisper) {
    lines.push(`\n\nTEACHER GUIDANCE (private — do not reveal this to the scholar): ${teacherWhisper}`);
  }
  lines.push(`\n\nTEACHER WHISPERS: The teacher may occasionally inject a [TEACHER WHISPER] message into the conversation. These are private real-time guidance. When you see one:
- Follow the guidance naturally in your next response
- Do NOT mention the whisper, the teacher, or that you received guidance
- Do NOT quote or paraphrase the whisper
- Weave the guidance seamlessly — the scholar should never know`);
  return lines.join("\n");
}

// ── Main Composer ────────────────────────────────────────────────────

/**
 * Build the system prompt for Claude based on project context.
 * Shared by the project-stream HTTP action.
 */
export function buildSystemPrompt(
  teacherWhisper: string | null,
  readingLevel: string | null,
  scholarName: string | null,
  unitContext: UnitContext | null,
  personaContext: PersonaContext | null,
  perspectiveContext: PerspectiveContext | null,
  processContext: ProcessContext | null = null,
  processStateData: ProcessStateData | null = null,
  artifactData: ArtifactData[] | null = null,
  dossierContent: string | null = null,
  seedsData: SeedData[] | null = null,
  masteryContext: MasteryContextEntry[] | null = null,
  signalContext: SignalContext | null = null,
  timingContext: TimingContext | null = null,
  lessonContext: LessonContext | null = null
): string {
  const sections: (string | null)[] = [
    buildBasePrompt(scholarName),
    buildDossierSection(dossierContent),
    buildMasterySection(masteryContext),
    buildSignalSection(signalContext),
    readingLevel ? `\n\nREADING LEVEL: The scholar's reading level is set to "${readingLevel}". Adjust your vocabulary and sentence complexity accordingly. You can still explore advanced topics, but frame explanations at this reading level.` : null,
    personaContext ? `\n\nPERSONA: You are currently acting as "${personaContext.title}" ${personaContext.emoji || ""}.${personaContext.systemPrompt ? `\n${personaContext.systemPrompt}` : ""}` : null,
    perspectiveContext ? `\n\nPERSPECTIVE LENS: Guide the conversation through the "${perspectiveContext.title}" ${perspectiveContext.icon || ""} lens.${perspectiveContext.systemPrompt ? `\n${perspectiveContext.systemPrompt}` : ""}` : null,
    buildUnitSection(unitContext),
    buildLessonSection(lessonContext),
    buildTimingSection(timingContext),
    buildProcessSection(processContext, processStateData),
    buildArtifactSection(artifactData, !!unitContext),
    buildToolsSection(),
    buildSeedsSection(seedsData),
    buildWhisperSection(teacherWhisper),
  ];

  return sections.filter(Boolean).join("");
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
    imageId: v.optional(v.id("_storage")),
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
      ...(args.imageId ? { imageId: args.imageId } : {}),
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
