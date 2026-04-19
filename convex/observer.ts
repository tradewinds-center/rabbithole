"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { OBSERVER_SYSTEM_PROMPT } from "./prompts";
import { MODELS } from "./lib/models";

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
        model: MODELS.SONNET,
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
