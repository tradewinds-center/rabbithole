"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// ─── Observer System Prompt ──────────────────────────────────────────

const OBSERVER_SYSTEM_PROMPT = `You are a Passive Learning Observer for Tradewinds School, a school for gifted elementary students in Honolulu.

You watch transcripts of student-tutor conversations and produce structured assessments. You do NOT interact with the student. You write observations for teachers.

## Your Outputs

You produce a single JSON response with these sections:

### 1. Pulse (dashboard metrics)
Quick-read scores for the teacher dashboard:
- engagementScore (0-1): Active participation, curiosity, follow-up questions
- complexityLevel (0-1): Intellectual depth of engagement
- onTaskScore (0-1): Focus and productivity
- topics: Array of subjects explored
- learningIndicators: Signs of learning (connections, deeper questions, revised understanding)
- concernFlags: Issues needing attention (empty array if none)
- summary: 1 terse sentence for dashboard. No filler. Example: "Student-driven garden planning; rich cross-curricular math×science engagement."
- pulseScore (0-5 integer): Overall learning engagement

### 2. Observations (concept mastery)

**Read the ENTIRE transcript first, then synthesize.** Do NOT tag each exchange individually.

A typical session should produce 2-5 observations, rarely more than 7. If you're writing 10+, you're too granular. Step back and consolidate.

#### What is a "concept"?

A concept is TRANSFERABLE UNDERSTANDING — knowledge that applies across contexts, not a specific fact tied to one moment.

**The textbook test:** Could you title a textbook chapter or university lecture after this concept? "Sound propagation through materials" — yes. "Sound transmission through metal submarine hulls" — no, that's one example of the concept.

**The parent conference test:** Would a teacher mention this at a parent conference? "Kai demonstrates strong causal reasoning about engineering trade-offs" — yes. "Kai knows stoats are cute and furry" — no.

**Good concept labels** (transferable):
- "Sound propagation through materials"
- "Engineering trade-offs and constraint optimization"
- "Seasonal animal adaptations"
- "Causal reasoning in mechanical systems"
- "Area model for multiplication"
- "Biomimetic design thinking"

**Bad concept labels** (too specific, not transferable):
- "Propeller rotation speed as determinant of submarine acoustic signature"
- "Basic stoat identification and physical characteristics"
- "Pressure-mass-power coupling in deep submersible design"
- "Multi-layered sound mitigation strategies"
- "Deep ocean acoustic environment characteristics"

When a student demonstrates the same underlying understanding across multiple exchanges (e.g., reasoning about sound through metal, then sound through water, then sound through air), that is ONE observation about "Sound propagation through materials" — cite the strongest evidence moment.

#### Concept labels and domains

- Use natural labels a knowledgeable teacher or professor would use
- **Domains should be broad academic disciplines**: "Physics", "Biology", "Mathematics", "History", "Engineering", "Philosophy", etc. NOT micro-domains like "Marine Science", "Signal Processing", "Sociolinguistics", "Military Strategy", "Advanced Engineering". A conversation about submarines touches Physics and Engineering, not 8 separate domains.
- If a concept clearly belongs to a niche field (e.g., "Game Theory"), that's fine — but most concepts belong to standard disciplines

#### Mastery levels (Bloom's taxonomy, 0.0-5.0 float)
  - ~1.0 Remember: Recalls facts when prompted
  - ~2.0 Understand: Explains in own words, interprets
  - ~3.0 Apply: Uses concept to solve problems in new contexts
  - ~4.0 Analyze: Breaks down, compares, explains WHY not just THAT
  - ~5.0 Evaluate/Create: Judges, critiques, designs, invents, extends
  - Use fractional levels: 2.3 = "solid Understand with early Apply signs"

#### Confidence (0.0-1.0)
Quality of evidence, not quantity. One profound demonstration can be high confidence. Ten rote answers can be low confidence.

#### Other fields
- evidenceType: "direct_demonstration" | "indirect_inference" | "misconception_signal" | "interest_signal"
- attemptContext: "conversation" | "project" | "problem_solving" | "creative_work" | "peer_explanation" | "debrief"

#### Critical rules
- Never assess what you didn't see
- Scaffolding is in the score — heavily guided = lower level
- Misconceptions are gold — name the misconception, rate Remember(1) with high confidence
- Look for contrary evidence
- Grade-level agnosticism — assess actual concepts, not grade expectations
- Gifted learners show asynchronous development — a kid can Create(5) before Remember(1)
- **Learning a new fact is NOT mastery of a concept.** If a student simply learns that stoats turn white in winter, that's interesting but not an observation. If they then REASON about WHY (connecting to camouflage, predator-prey dynamics, natural selection), THAT is an observation about "Evolutionary adaptations."
- **Deduplicate ruthlessly.** If you're about to write two observations that a teacher would consider "the same thing," they're one observation. Pick the strongest evidence.
- **Reuse existing concept labels.** When you see a concept that matches an existing observation, use the EXACT SAME conceptLabel string. Don't write "Area model for multiplication" if the scholar already has "Area model for multi-digit multiplication." Check the Current Mastery Observations list carefully and match labels exactly when the concept is the same — then supersede if needed. Only create a new label for a genuinely new concept.

### 3. Supersession
You receive the scholar's current observations. For each new observation, decide:
- New concept → set supersedesObservationId to null
- Shows growth/contradiction → set supersedesObservationId to the _id of the old observation
- Reinforces existing → skip (don't write a redundant observation)

IMPORTANT: Also supersede existing observations that are too granular. If the scholar has 5 micro-observations that should be 1, supersede the best one and let the others age out. This helps clean up noisy history.

### 4. Session Signals (learner character)
Note session-level patterns about who this person is as a thinker:
- task_commitment: sustained focus, persistence, returning to hard problems
- creative_approach: novel methods, inventions, original solutions
- self_direction: student-initiated investigations, choosing own path
- intellectual_intensity: rapid-fire questions, deep diving, can't let go
- emotional_engagement: strong reactions to ideas, empathy, moral reasoning
- cross_domain_thinking: connecting ideas across subjects unprompted
- productive_struggle: wrestling with difficulty constructively
- metacognition: thinking about own thinking, noticing own confusion
Rate each as "low", "moderate", or "high". Only include signals you actually observed — not every session needs all types.

### 5. Cross-Domain Connections
When a student links ideas across different domains, record it. Include which domains and concepts are connected, whether student-initiated.

### 6. Seeds (what to explore next)
Suggest what this student should explore, in two directions:
- frontier: new concepts the student is ready for, including fascinating topics beyond any curriculum
- depth_probe: push to higher Bloom's on existing concepts
Seeds should excite, not just advance. Think "what would make this kid's eyes light up?"
1-3 seeds per session is plenty. Only suggest what you're genuinely excited about for this specific kid.

### 7. Inferred Reading/Writing Level
Based on the scholar's actual messages (not the tutor's), estimate their reading and writing level:
- Use US grade levels: K, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, college
- Assess vocabulary complexity, sentence structure, spelling/grammar, and conceptual expression
- Only provide if you have enough evidence (at least 3+ substantive scholar messages)
- This helps teachers calibrate the AI's language level to the scholar

## Response

Call the record_observations tool with your full analysis. All arrays can be empty if nothing notable.
Keep transcriptExcerpts brief — just enough to show the moment.`;

// ─── Tool Schema for Structured Output ───────────────────────────────

const OBSERVER_TOOL = {
  name: "record_observations" as const,
  description: "Record the observer's full analysis of the student session.",
  input_schema: {
    type: "object" as const,
    required: ["pulse", "observations", "sessionSignals", "crossDomainConnections", "seeds"],
    properties: {
      inferredReadingLevel: {
        type: "string" as const,
        description: "Estimated reading/writing level based on scholar messages: K, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, or college. Omit if insufficient evidence.",
      },
      pulse: {
        type: "object" as const,
        required: ["engagementScore", "complexityLevel", "onTaskScore", "topics", "learningIndicators", "concernFlags", "summary", "pulseScore"],
        properties: {
          engagementScore: { type: "number" as const, description: "0-1 engagement level" },
          complexityLevel: { type: "number" as const, description: "0-1 intellectual depth" },
          onTaskScore: { type: "number" as const, description: "0-1 focus and productivity" },
          topics: { type: "array" as const, items: { type: "string" as const } },
          learningIndicators: { type: "array" as const, items: { type: "string" as const } },
          concernFlags: { type: "array" as const, items: { type: "string" as const } },
          summary: { type: "string" as const, description: "1 terse sentence for dashboard" },
          pulseScore: { type: "integer" as const, description: "0-5 overall engagement" },
        },
      },
      observations: {
        type: "array" as const,
        items: {
          type: "object" as const,
          required: ["conceptLabel", "domain", "masteryLevel", "confidenceScore", "evidenceSummary", "evidenceType", "attemptContext", "studentInitiated", "transcriptExcerpt"],
          properties: {
            conceptLabel: { type: "string" as const },
            domain: { type: "string" as const },
            masteryLevel: { type: "number" as const, description: "0.0-5.0 Bloom's float" },
            confidenceScore: { type: "number" as const, description: "0.0-1.0" },
            evidenceSummary: { type: "string" as const },
            evidenceType: { type: "string" as const, enum: ["direct_demonstration", "indirect_inference", "misconception_signal", "interest_signal"] },
            attemptContext: { type: "string" as const, enum: ["conversation", "project", "problem_solving", "creative_work", "peer_explanation", "debrief"] },
            studentInitiated: { type: "boolean" as const },
            transcriptExcerpt: { type: "string" as const },
            standardNotations: { type: "array" as const, items: { type: "string" as const }, description: "Optional formal standard codes" },
            supersedesObservationId: { type: "string" as const, description: "ID of observation being replaced, or omit for new" },
          },
        },
      },
      sessionSignals: {
        type: "array" as const,
        items: {
          type: "object" as const,
          required: ["signalType", "description", "intensity"],
          properties: {
            signalType: { type: "string" as const, enum: ["task_commitment", "creative_approach", "self_direction", "intellectual_intensity", "emotional_engagement", "cross_domain_thinking", "productive_struggle", "metacognition"] },
            description: { type: "string" as const },
            intensity: { type: "string" as const, enum: ["low", "moderate", "high"] },
            transcriptExcerpt: { type: "string" as const },
          },
        },
      },
      crossDomainConnections: {
        type: "array" as const,
        items: {
          type: "object" as const,
          required: ["domains", "conceptLabels", "description", "studentInitiated"],
          properties: {
            domains: { type: "array" as const, items: { type: "string" as const }, description: "At least 2 domains" },
            conceptLabels: { type: "array" as const, items: { type: "string" as const } },
            description: { type: "string" as const },
            studentInitiated: { type: "boolean" as const },
            transcriptExcerpt: { type: "string" as const },
          },
        },
      },
      seeds: {
        type: "array" as const,
        items: {
          type: "object" as const,
          required: ["suggestionType", "topic", "rationale"],
          properties: {
            suggestionType: { type: "string" as const, enum: ["frontier", "depth_probe"] },
            topic: { type: "string" as const },
            domain: { type: "string" as const },
            rationale: { type: "string" as const },
            approachHint: { type: "string" as const },
            connectionTo: { type: "string" as const },
            currentBloomsLevel: { type: "number" as const },
            targetBloomsLevel: { type: "number" as const },
          },
        },
      },
    },
  },
};

// ─── Input Types (from internal queries) ─────────────────────────────

/** Shape returned by masteryObservations.currentByScholar */
interface MasteryObservationDoc {
  _id: string;
  conceptLabel: string;
  domain: string;
  masteryLevel: number;
  confidenceScore: number;
  observedAt: number;
}

/** Shape returned by seeds.activeByScholar */
interface SeedDoc {
  topic: string;
  domain?: string;
  suggestionType: string;
}

/** Shape returned by sessionSignals.recentByScholar */
interface SessionSignalDoc {
  signalType: string;
  intensity: string;
}

/** Shape of the context object from projectHelpers.getProjectContext */
interface ObserverContext {
  scholarName: string | null;
  scholarId: string;
  title: string;
  unitContext: { title: string } | null;
}

// ─── Helper Functions ────────────────────────────────────────────────

function buildObserverUserMessage(
  transcript: string,
  currentObservations: MasteryObservationDoc[],
  activeSeeds: SeedDoc[],
  recentSignals: SessionSignalDoc[],
  context: ObserverContext
): string {
  const parts: string[] = [];

  parts.push(`## Scholar: ${context.scholarName || "Unknown"}`);
  parts.push(`## Project: "${context.title}"`);

  if (context.unitContext) {
    parts.push(`## Unit: "${context.unitContext.title}"`);
  }

  // Current mastery observations for supersession decisions
  if (currentObservations.length > 0) {
    parts.push(`\n## Current Mastery Observations (${currentObservations.length})`);
    parts.push(`Use these to decide supersession. Reference _id when superseding.`);
    for (const obs of currentObservations) {
      parts.push(
        `- [${obs._id}] ${obs.conceptLabel} (${obs.domain}): ${obs.masteryLevel.toFixed(1)} Bloom's, ` +
          `confidence ${obs.confidenceScore.toFixed(2)}, observed ${new Date(obs.observedAt).toLocaleDateString()}`
      );
    }
  }

  // Active seeds for context
  if (activeSeeds.length > 0) {
    parts.push(`\n## Active Seeds (${activeSeeds.length})`);
    for (const seed of activeSeeds) {
      parts.push(`- ${seed.topic} (${seed.domain || "general"}) — ${seed.suggestionType}`);
    }
  }

  // Recent signal profile
  if (recentSignals.length > 0) {
    parts.push(`\n## Recent Learner Signals`);
    const signalCounts: Record<string, number> = {};
    for (const s of recentSignals) {
      signalCounts[s.signalType] = (signalCounts[s.signalType] || 0) + 1;
    }
    for (const [type, count] of Object.entries(signalCounts)) {
      parts.push(`- ${type}: ${count} occurrences`);
    }
  }

  parts.push(`\n## Transcript\n\n${transcript}`);

  return parts.join("\n");
}

interface ObserverResult {
  inferredReadingLevel?: string;
  pulse: {
    engagementScore: number;
    complexityLevel: number;
    onTaskScore: number;
    topics: string[];
    learningIndicators: string[];
    concernFlags: string[];
    summary: string;
    pulseScore: number;
  };
  observations: Array<{
    conceptLabel: string;
    domain: string;
    masteryLevel: number;
    confidenceScore: number;
    evidenceSummary: string;
    evidenceType: string;
    attemptContext: string;
    studentInitiated: boolean;
    transcriptExcerpt: string;
    standardNotations?: string[];
    supersedesObservationId?: string | null;
  }>;
  sessionSignals: Array<{
    signalType: string;
    description: string;
    intensity: string;
    transcriptExcerpt?: string;
  }>;
  crossDomainConnections: Array<{
    domains: string[];
    conceptLabels: string[];
    description: string;
    studentInitiated: boolean;
    transcriptExcerpt?: string;
  }>;
  seeds: Array<{
    suggestionType: string;
    topic: string;
    domain?: string;
    rationale: string;
    approachHint?: string;
    connectionTo?: string;
    currentBloomsLevel?: number;
    targetBloomsLevel?: number;
  }>;
}

// ─── Unified Observer Action ─────────────────────────────────────────

/**
 * Unified observer. Replaces both runObserverAnalysis and runDetailedAnalysis.
 * One Sonnet call produces: pulse scores, concept mastery, session signals,
 * seeds, and cross-domain connections.
 */
export const analyzeProject = internalAction({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    console.log(`[Observer] Starting analysis for project ${args.projectId}`);

    // 1. Get project context
    const context = await ctx.runQuery(
      internal.projectHelpers.getProjectContext,
      { projectId: args.projectId }
    );
    if (!context || context.chatHistory.length < 3) {
      console.log(`[Observer] Skipping — ${!context ? "no context" : `only ${context.chatHistory.length} messages (need 3)`}`);
      return null;
    }
    console.log(`[Observer] Scholar: ${context.scholarName}, Project: "${context.title}", Messages: ${context.chatHistory.length}`);

    // 2. Get scholar's current mastery observations (for supersession)
    const currentObservations = await ctx.runQuery(
      internal.masteryObservations.currentByScholar,
      { scholarId: context.scholarId }
    );

    // 3. Get active seeds
    const activeSeeds = await ctx.runQuery(internal.seeds.activeByScholar, {
      scholarId: context.scholarId,
    });

    // 4. Get recent session signals
    const recentSignals = await ctx.runQuery(
      internal.sessionSignals.recentByScholar,
      { scholarId: context.scholarId, limit: 30 }
    );

    // 5. Build transcript (limit to last 30 messages for cost)
    const recentHistory =
      context.chatHistory.length > 30
        ? context.chatHistory.slice(-30)
        : context.chatHistory;
    const truncationNote =
      context.chatHistory.length > 30
        ? `[Earlier messages omitted — showing last 30 of ${context.chatHistory.length}]\n\n`
        : "";

    const transcriptText =
      truncationNote +
      recentHistory
        .map(
          (m: { role: string; content: string }) =>
            `${m.role === "user" ? "SCHOLAR" : "TUTOR"}: ${m.content}`
        )
        .join("\n\n");

    // 6. Call Claude Sonnet
    console.log(`[Observer] Calling Sonnet with context: ${currentObservations.length} existing observations, ${activeSeeds.length} active seeds, ${recentSignals.length} recent signals`);
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic();

    const userMessage = buildObserverUserMessage(
      transcriptText,
      currentObservations,
      activeSeeds,
      recentSignals,
      context
    );
    console.log(`[Observer] User message length: ${userMessage.length} chars`);

    let result: ObserverResult;
    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
        system: OBSERVER_SYSTEM_PROMPT,
        tools: [OBSERVER_TOOL],
        tool_choice: { type: "tool", name: "record_observations" },
        messages: [{ role: "user", content: userMessage }],
      });

      console.log(`[Observer] Sonnet response, usage: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`);

      const toolBlock = response.content.find((b) => b.type === "tool_use");
      if (!toolBlock || toolBlock.type !== "tool_use") {
        console.error(`[Observer] No tool_use block in response. Content types: ${response.content.map((b) => b.type).join(", ")}`);
        await ctx.runMutation(internal.analysisHelpers.saveAnalysis, {
          projectId: args.projectId,
          engagementScore: 0.5, complexityLevel: 0.5, onTaskScore: 0.5,
          topics: [], learningIndicators: [], concernFlags: [],
          summary: "Observer analysis unavailable", pulseScore: 3,
        });
        return null;
      }

      const parsed = toolBlock.input as ObserverResult;
      result = {
        inferredReadingLevel: parsed.inferredReadingLevel ?? undefined,
        pulse: {
          engagementScore: parsed.pulse.engagementScore ?? 0.5,
          complexityLevel: parsed.pulse.complexityLevel ?? 0.5,
          onTaskScore: parsed.pulse.onTaskScore ?? 0.5,
          topics: parsed.pulse.topics ?? [],
          learningIndicators: parsed.pulse.learningIndicators ?? [],
          concernFlags: parsed.pulse.concernFlags ?? [],
          summary: parsed.pulse.summary ?? "Analysis unavailable",
          pulseScore: typeof parsed.pulse.pulseScore === "number" ? parsed.pulse.pulseScore : 3,
        },
        observations: Array.isArray(parsed.observations) ? parsed.observations : [],
        sessionSignals: Array.isArray(parsed.sessionSignals) ? parsed.sessionSignals : [],
        crossDomainConnections: Array.isArray(parsed.crossDomainConnections) ? parsed.crossDomainConnections : [],
        seeds: Array.isArray(parsed.seeds) ? parsed.seeds : [],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Observer] Sonnet API FAILED: ${message}`);
      console.error(`[Observer] Error details:`, JSON.stringify(err, null, 2).slice(0, 1000));
      return null;
    }

    console.log(`[Observer] Parsed OK — pulse: ${result.pulse.pulseScore}/5, "${result.pulse.summary}"`);
    console.log(`[Observer]   ${result.observations.length} observations, ${result.sessionSignals.length} signals, ${result.crossDomainConnections.length} connections, ${result.seeds.length} seeds`);
    for (const obs of result.observations) {
      console.log(`[Observer]   📊 ${obs.conceptLabel} (${obs.domain}): ${obs.masteryLevel.toFixed(1)} Bloom's, conf ${(obs.confidenceScore * 100).toFixed(0)}%, ${obs.evidenceType}${obs.supersedesObservationId ? ` [supersedes ${obs.supersedesObservationId}]` : ""}`);
    }
    for (const seed of result.seeds) {
      console.log(`[Observer]   🌱 ${seed.suggestionType}: "${seed.topic}" (${seed.domain ?? "general"})`);
    }

    // 7–11. Write all results to DB
    try {
      // 7. Pulse
      console.log(`[Observer] Writing pulse...`);
      await ctx.runMutation(internal.analysisHelpers.saveAnalysis, {
        projectId: args.projectId,
        engagementScore: result.pulse.engagementScore,
        complexityLevel: result.pulse.complexityLevel,
        onTaskScore: result.pulse.onTaskScore,
        topics: result.pulse.topics,
        learningIndicators: result.pulse.learningIndicators,
        concernFlags: result.pulse.concernFlags,
        summary: result.pulse.summary,
        pulseScore: result.pulse.pulseScore,
      });
      console.log(`[Observer] Pulse written OK`);

      // 8. Mastery observations (collect IDs for standards mapper)
      const newObservationIds: string[] = [];
      for (let i = 0; i < result.observations.length; i++) {
        const obs = result.observations[i];
        console.log(`[Observer] Writing observation ${i + 1}/${result.observations.length}: ${obs.conceptLabel}`);
        const obsId = await ctx.runMutation(internal.masteryObservations.record, {
          scholarId: context.scholarId,
          conceptLabel: obs.conceptLabel,
          domain: obs.domain,
          projectId: args.projectId,
          transcriptExcerpt: obs.transcriptExcerpt || "",
          masteryLevel: obs.masteryLevel,
          confidenceScore: obs.confidenceScore,
          evidenceSummary: obs.evidenceSummary,
          evidenceType: obs.evidenceType || "direct_demonstration",
          attemptContext: obs.attemptContext || "conversation",
          studentInitiated: obs.studentInitiated ?? false,
          standardNotations: obs.standardNotations ?? undefined,
          supersedesObservationId: obs.supersedesObservationId ?? undefined,
        });
        newObservationIds.push(obsId);
      }

      // 9. Session signals
      for (const signal of result.sessionSignals) {
        await ctx.runMutation(internal.sessionSignals.record, {
          scholarId: context.scholarId,
          projectId: args.projectId,
          signalType: signal.signalType,
          description: signal.description,
          intensity: signal.intensity,
          transcriptExcerpt: signal.transcriptExcerpt ?? undefined,
        });
      }
      console.log(`[Observer] ${result.sessionSignals.length} signals written`);

      // 10. Cross-domain connections
      for (const conn of result.crossDomainConnections) {
        await ctx.runMutation(internal.crossDomainConnections.record, {
          scholarId: context.scholarId,
          projectId: args.projectId,
          domains: conn.domains,
          conceptLabels: conn.conceptLabels,
          description: conn.description,
          studentInitiated: conn.studentInitiated ?? false,
          transcriptExcerpt: conn.transcriptExcerpt ?? undefined,
        });
      }

      // 11. Seeds
      for (const seed of result.seeds) {
        await ctx.runMutation(internal.seeds.record, {
          scholarId: context.scholarId,
          projectId: args.projectId,
          topic: seed.topic,
          domain: seed.domain ?? undefined,
          suggestionType: seed.suggestionType || "frontier",
          rationale: seed.rationale || "",
          approachHint: seed.approachHint ?? undefined,
          connectionTo: seed.connectionTo ?? undefined,
          currentBloomsLevel: seed.currentBloomsLevel ?? undefined,
          targetBloomsLevel: seed.targetBloomsLevel ?? undefined,
        });
      }
      console.log(`[Observer] ${result.seeds.length} seeds written`);

      // 12. Reading level suggestion (if inferred and different from current)
      if (result.inferredReadingLevel) {
        const scholar = await ctx.runQuery(internal.scholars.getInternal, {
          scholarId: context.scholarId,
        });
        const currentLevel = scholar?.readingLevel ?? null;
        if (currentLevel !== result.inferredReadingLevel) {
          await ctx.runMutation(internal.scholars.setReadingLevelSuggestion, {
            scholarId: context.scholarId,
            suggestion: result.inferredReadingLevel,
          });
          console.log(`[Observer] 📖 Reading level suggestion: ${result.inferredReadingLevel} (current: ${currentLevel ?? "unset"})`);
        }
      }

      // 13. Standards mapping (second pass — maps observations to curriculum standards)
      if (newObservationIds.length > 0) {
        try {
          await ctx.runAction(internal.standardsMapper.mapToStandards, {
            scholarId: context.scholarId,
            observationIds: newObservationIds as any,
          });
        } catch (mapErr: unknown) {
          // Non-fatal: standards mapping is supplementary
          const msg = mapErr instanceof Error ? mapErr.message : String(mapErr);
          console.error(`[Observer] Standards mapping failed (non-fatal): ${msg}`);
        }
      }
    } catch (writeErr: unknown) {
      const message = writeErr instanceof Error ? writeErr.message : String(writeErr);
      console.error(`[Observer] WRITE FAILED: ${message}`);
      console.error(`[Observer] Write error details:`, JSON.stringify(writeErr, null, 2).slice(0, 1000));
      throw writeErr;
    }

    console.log(`[Observer] ✅ Done — all writes complete for project ${args.projectId}`);
    return result;
  },
});
