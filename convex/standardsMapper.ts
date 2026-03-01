"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// ─── System Prompt ──────────────────────────────────────────────────

const MAPPER_SYSTEM_PROMPT = `You are a standards alignment specialist for a gifted elementary school.

Given mastery observations from a student learning session and a list of curriculum standards, identify which specific content standards each observation demonstrates evidence of.

Rules:
- STRONGLY PREFER specific content standards over generic practice/process standards. For example, "subtraction of negative numbers" should map to 6.NS.5 or 7.NS.1 (specific number system standards), NOT to MP.2 or MP.4 (generic mathematical practices that apply to everything).
- Only include practice/process standards (like MP.x) when the observation specifically demonstrates that practice as the PRIMARY skill — e.g., MP.1 only if the observation is specifically about perseverance in problem-solving, not just because the student solved a problem.
- Only map when there is genuine alignment — the observation must demonstrate the knowledge or skill described in the standard.
- One observation can map to 0, 1, or multiple standards, but 1-3 specific content standards is typical. More than 5 is almost certainly too many.
- Don't force mappings. If an observation doesn't clearly align to any available standard, return an empty array for it.
- Consider the mastery level and evidence: a student demonstrating "remember" (1.0) for a concept might align to foundational standards, while "analyze" (4.0) might align to more advanced ones.
- Cross-subject mappings are valid when genuine: a math observation involving written explanation could align to ELA communication standards.
- Use the notation codes exactly as provided in the standards list.`;

// ─── Tool Schema ────────────────────────────────────────────────────

const MAPPER_TOOL = {
  name: "record_standard_mappings" as const,
  description:
    "Record which curriculum standards each mastery observation aligns to.",
  input_schema: {
    type: "object" as const,
    required: ["mappings"],
    properties: {
      mappings: {
        type: "array" as const,
        items: {
          type: "object" as const,
          required: ["observationId", "notations"],
          properties: {
            observationId: {
              type: "string" as const,
              description: "The observation ID from the input list",
            },
            notations: {
              type: "array" as const,
              items: { type: "string" as const },
              description:
                "Standard notation codes this observation aligns to (empty array if none)",
            },
          },
        },
      },
    },
  },
};

// ─── Helpers ────────────────────────────────────────────────────────

const ALL_GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8"];

function getGradeRange(readingLevel: string | undefined): string[] {
  if (!readingLevel) return ["K", "1", "2", "3", "4", "5"];
  const idx = ALL_GRADES.indexOf(readingLevel);
  if (idx === -1) return ["K", "1", "2", "3", "4", "5"];
  const low = Math.max(0, idx - 3);
  const high = Math.min(ALL_GRADES.length - 1, idx + 2);
  return ALL_GRADES.slice(low, high + 1);
}

interface ObservationForMapping {
  id: string;
  conceptLabel: string;
  domain: string;
  masteryLevel: number;
  evidenceSummary: string;
}

interface StandardForMapping {
  id: string;
  notation: string;
  description: string;
  subject: string;
}

function buildUserMessage(
  observations: ObservationForMapping[],
  standards: StandardForMapping[]
): string {
  const parts: string[] = [];

  parts.push("## Mastery Observations\n");
  for (const obs of observations) {
    parts.push(
      `- **[${obs.id}]** ${obs.conceptLabel} (${obs.domain}, Bloom's ${obs.masteryLevel.toFixed(1)}): ${obs.evidenceSummary}`
    );
  }

  // Group standards by subject for readability
  const bySubject: Record<string, StandardForMapping[]> = {};
  for (const s of standards) {
    if (!bySubject[s.subject]) bySubject[s.subject] = [];
    bySubject[s.subject].push(s);
  }

  parts.push("\n## Available Standards\n");
  for (const [subject, stds] of Object.entries(bySubject)) {
    parts.push(`### ${subject}`);
    for (const s of stds) {
      parts.push(`${s.notation} | ${s.description}`);
    }
    parts.push("");
  }

  parts.push(
    "Map each observation to the standards it demonstrates. Use the exact notation codes from the list above."
  );

  return parts.join("\n");
}

// ─── Main Action ────────────────────────────────────────────────────

interface MapperResult {
  mappings: Array<{
    observationId: string;
    notations: string[];
  }>;
}

export const mapToStandards = internalAction({
  args: {
    scholarId: v.id("users"),
    observationIds: v.array(v.id("masteryObservations")),
  },
  handler: async (ctx, args) => {
    if (args.observationIds.length === 0) return;

    console.log(
      `[StandardsMapper] Starting for ${args.observationIds.length} observations`
    );

    // 1. Get scholar's reading level for grade filtering
    const scholar = await ctx.runQuery(internal.scholars.getInternal, {
      scholarId: args.scholarId,
    });
    const grades = getGradeRange(scholar?.readingLevel ?? undefined);
    console.log(
      `[StandardsMapper] Scholar reading level: ${scholar?.readingLevel ?? "unset"}, grade range: ${grades.join(", ")}`
    );

    // 2. Get leaf standards for the grade range
    const standards = await ctx.runQuery(
      internal.standardsTree.leafStandardsForMapping,
      { grades }
    );

    if (standards.length === 0) {
      console.log("[StandardsMapper] No standards found for grade range, skipping");
      return;
    }
    console.log(
      `[StandardsMapper] ${standards.length} leaf standards loaded`
    );

    // 3. Get the observations we need to map
    const observations: ObservationForMapping[] = [];
    for (const obsId of args.observationIds) {
      const obs = await ctx.runQuery(
        internal.masteryObservations.getById,
        { observationId: obsId }
      );
      if (obs) {
        observations.push({
          id: obs._id,
          conceptLabel: obs.conceptLabel,
          domain: obs.domain,
          masteryLevel: obs.masteryLevel,
          evidenceSummary: obs.evidenceSummary,
        });
      }
    }

    if (observations.length === 0) {
      console.log("[StandardsMapper] No valid observations found, skipping");
      return;
    }

    // 4. Build notation → standard ID lookup
    const notationToId = new Map<string, string>();
    for (const s of standards) {
      notationToId.set(s.notation, s.id);
    }

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic();

    // 5. Process in batches of 15 observations per Haiku call
    const BATCH_SIZE = 15;
    let totalPatched = 0;

    for (let batchStart = 0; batchStart < observations.length; batchStart += BATCH_SIZE) {
      const batch = observations.slice(batchStart, batchStart + BATCH_SIZE);
      const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(observations.length / BATCH_SIZE);

      const userMessage = buildUserMessage(batch, standards);
      console.log(
        `[StandardsMapper] Batch ${batchNum}/${totalBatches}: ${batch.length} observations, ${userMessage.length} chars`
      );

      let result: MapperResult;
      try {
        const response = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2048,
          system: MAPPER_SYSTEM_PROMPT,
          tools: [MAPPER_TOOL],
          tool_choice: { type: "tool", name: "record_standard_mappings" },
          messages: [{ role: "user", content: userMessage }],
        });

        console.log(
          `[StandardsMapper] Haiku response, usage: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`
        );

        const toolBlock = response.content.find((b) => b.type === "tool_use");
        if (!toolBlock || toolBlock.type !== "tool_use") {
          console.error(`[StandardsMapper] No tool_use block in batch ${batchNum}`);
          continue;
        }

        const parsed = toolBlock.input as MapperResult;
        result = {
          mappings: Array.isArray(parsed.mappings) ? parsed.mappings : [],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[StandardsMapper] Haiku API FAILED for batch ${batchNum}: ${message}`);
        continue;
      }

      // 6. Patch observations with resolved standard IDs
      for (const mapping of result.mappings) {
        if (!mapping.notations || mapping.notations.length === 0) continue;

        const resolvedIds: Id<"standards">[] = [];
        for (const notation of mapping.notations) {
          const stdId = notationToId.get(notation);
          if (stdId) {
            resolvedIds.push(stdId as Id<"standards">);
          } else {
            console.warn(
              `[StandardsMapper] Unknown notation "${notation}" — skipping`
            );
          }
        }

        if (resolvedIds.length > 0) {
          try {
            await ctx.runMutation(
              internal.masteryObservations.patchStandardIds,
              {
                observationId: mapping.observationId as Id<"masteryObservations">,
                standardIds: resolvedIds,
              }
            );
            totalPatched++;
            console.log(
              `[StandardsMapper] Patched ${mapping.observationId} → ${mapping.notations.join(", ")}`
            );
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(
              `[StandardsMapper] Failed to patch ${mapping.observationId}: ${message}`
            );
          }
        }
      }
    }

    console.log(
      `[StandardsMapper] Done — ${totalPatched}/${observations.length} observations mapped to standards`
    );
  },
});

// ─── Backfill Action ────────────────────────────────────────────────

/**
 * Backfill: find all current observations without standardIds and run the
 * mapper for each scholar. Callable from CLI:
 *   npx convex run standardsMapper:backfillAll
 */
/**
 * Backfill: find all current observations without standardIds and schedule
 * the mapper for each scholar independently (avoids action timeout).
 * Callable from CLI:
 *   npx convex run standardsMapper:backfillAll
 */
export const backfillAll = action({
  args: {},
  handler: async (ctx): Promise<{ scholars: number; observations: number }> => {
    const unmapped: Array<{
      _id: Id<"masteryObservations">;
      scholarId: Id<"users">;
    }> = await ctx.runQuery(
      internal.masteryObservations.unmappedObservations,
      {}
    );

    if (unmapped.length === 0) {
      console.log("[Backfill] No unmapped observations found");
      return { scholars: 0, observations: 0 };
    }

    console.log(
      `[Backfill] Found ${unmapped.length} unmapped observations`
    );

    // Group by scholar
    const byScholar = new Map<string, Id<"masteryObservations">[]>();
    for (const obs of unmapped) {
      const key = obs.scholarId as string;
      if (!byScholar.has(key)) byScholar.set(key, []);
      byScholar.get(key)!.push(obs._id);
    }

    console.log(
      `[Backfill] Scheduling mapper for ${byScholar.size} scholars`
    );

    // Schedule each scholar as a separate action (parallel, avoids timeout)
    let delay = 0;
    for (const [scholarId, obsIds] of Array.from(byScholar.entries())) {
      console.log(
        `[Backfill] Scheduling scholar ${scholarId} (${obsIds.length} observations) at +${delay}ms`
      );
      await ctx.scheduler.runAfter(delay, internal.standardsMapper.mapToStandards, {
        scholarId: scholarId as Id<"users">,
        observationIds: obsIds,
      });
      // Stagger by 2s to avoid rate limiting
      delay += 2000;
    }

    console.log(`[Backfill] All ${byScholar.size} scholars scheduled`);
    return { scholars: byScholar.size, observations: unmapped.length };
  },
});

/**
 * Re-backfill: clear all existing standardIds and re-map everything.
 * Use when the mapper prompt has been improved.
 *   npx convex run standardsMapper:rebackfillAll
 */
export const rebackfillAll = action({
  args: {},
  handler: async (ctx): Promise<{ scholars: number; observations: number }> => {
    const allCurrent: Array<{
      _id: Id<"masteryObservations">;
      scholarId: Id<"users">;
      standardIds?: Id<"standards">[];
    }> = await ctx.runQuery(
      internal.masteryObservations.allCurrentObservations,
      {}
    );

    console.log(`[Rebackfill] Found ${allCurrent.length} current observations`);

    // Clear existing standardIds
    let cleared = 0;
    for (const obs of allCurrent) {
      if (obs.standardIds && obs.standardIds.length > 0) {
        await ctx.runMutation(internal.masteryObservations.clearStandardIds, {
          observationId: obs._id,
        });
        cleared++;
      }
    }
    console.log(`[Rebackfill] Cleared standardIds on ${cleared} observations`);

    // Group by scholar
    const byScholar = new Map<string, Id<"masteryObservations">[]>();
    for (const obs of allCurrent) {
      const key = obs.scholarId as string;
      if (!byScholar.has(key)) byScholar.set(key, []);
      byScholar.get(key)!.push(obs._id);
    }

    // Schedule each scholar
    let delay = 0;
    for (const [scholarId, obsIds] of Array.from(byScholar.entries())) {
      console.log(
        `[Rebackfill] Scheduling scholar ${scholarId} (${obsIds.length} observations) at +${delay}ms`
      );
      await ctx.scheduler.runAfter(delay, internal.standardsMapper.mapToStandards, {
        scholarId: scholarId as Id<"users">,
        observationIds: obsIds,
      });
      delay += 2000;
    }

    console.log(`[Rebackfill] All ${byScholar.size} scholars scheduled`);
    return { scholars: byScholar.size, observations: allCurrent.length };
  },
});
