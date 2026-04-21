"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { MODELS } from "./lib/models";
import type { Id } from "./_generated/dataModel";

/**
 * Scholar-document proposal generator (LLM call). Reads the redacted
 * assessment summary + existing scholar context, asks Claude Sonnet to
 * propose starter directives and seeds, caches the proposal, returns it.
 *
 * We DO NOT apply the proposal here — the UI shows it as a diff and a
 * teacher approves changes individually in a separate flow.
 */

// ── Tool schema ─────────────────────────────────────────────────────────

const PROPOSAL_TOOL = {
  name: "propose_starter_set" as const,
  description:
    "Propose new teacher directives and seeds for this scholar, based on a redacted cognitive-assessment summary.",
  input_schema: {
    type: "object" as const,
    required: ["rationale", "directives", "seeds"],
    properties: {
      rationale: {
        type: "string" as const,
        description:
          "2-4 sentences on the overall shape of the proposal: why these directives and seeds, as a group.",
      },
      directives: {
        type: "array" as const,
        items: {
          type: "object" as const,
          required: ["action", "label", "content", "reason"],
          properties: {
            action: {
              type: "string" as const,
              enum: ["create", "update"],
              description:
                "UPDATE if an existing directive with a similar label already covers this finding; otherwise CREATE.",
            },
            label: {
              type: "string" as const,
              description:
                "Short label, e.g. 'SWI / stealth-dyslexia'. Must match an existing label exactly if action=update.",
            },
            content: {
              type: "string" as const,
              description:
                "Directive body — teacher-authored-style instructions to the tutor.",
            },
            reason: {
              type: "string" as const,
              description:
                "One sentence: why this directive, citing the specific finding from the summary.",
            },
          },
        },
      },
      seeds: {
        type: "array" as const,
        items: {
          type: "object" as const,
          required: ["topic", "domain", "rationale", "approachHint"],
          properties: {
            topic: { type: "string" as const },
            domain: { type: "string" as const },
            rationale: { type: "string" as const },
            approachHint: { type: "string" as const },
          },
        },
      },
      unitSuggestion: {
        type: "object" as const,
        required: ["title", "bigIdea", "essentialQuestions", "rationale"],
        properties: {
          title: { type: "string" as const },
          bigIdea: { type: "string" as const },
          essentialQuestions: {
            type: "array" as const,
            items: { type: "string" as const },
          },
          rationale: { type: "string" as const },
        },
      },
    },
  },
};

const SYSTEM_PROMPT = `You are a gifted-education curriculum designer at Tradewinds School. A
teacher has uploaded a cognitive-assessment document for a specific scholar,
which has been redacted to remove subscores and identifying info. Your job is
to propose a STARTER SET of teacher directives + seeds based on the redacted
summary and the scholar's existing profile.

CONTEXT YOU WILL RECEIVE:
- A redacted summary of the assessment (qualitative only, no numbers).
- The scholar's existing teacher directives (standing pedagogical rules).
- The scholar's existing active seeds (exploration topics).
- The scholar's existing dossier (observer-authored learning notes).

YOUR PROPOSAL MUST:
1. Directives: 1–3 total. If an existing directive already covers a finding,
   propose action=update (same label) with an improved/expanded content.
   Otherwise action=create with a new descriptive label. Content should read
   like a teacher wrote it to the tutor — imperative, specific, grounded in
   the finding.
2. Seeds: 4–8 total. Each must be NEW — don't propose a seed whose topic
   substantially overlaps an existing active seed. Each needs topic, domain,
   rationale (why it fits THIS scholar), and approachHint (1-3 sentences of
   how the tutor should approach it).
3. unitSuggestion: OPTIONAL — include at most one unit suggestion only if the
   findings clearly call for one (e.g. a morphology unit for stealth
   dyslexia). Otherwise omit the field entirely.

TONE AND FRAMING:
- Strength-based, gifted-positive language. Never deficit-framed.
- Avoid clinical terms that feel medicalized. Use "pattern" not "disorder."
- Never invent subscores or percentiles. You only see qualitative info.
- Write directives that TEACH the tutor how to engage the child. Write seeds
  that would actually excite a curious kid.

Respond ONLY via the propose_starter_set tool call.`;

function buildUserMessage(args: {
  redactedSummary: string;
  keyFindings: string[];
  existingDirectives: Array<{ label: string; content: string; isActive: boolean }>;
  existingSeeds: Array<{ topic: string; domain?: string; suggestionType: string }>;
  dossierContent: string | null;
}): string {
  const parts: string[] = [];

  parts.push("## Redacted assessment summary\n");
  parts.push(args.redactedSummary);

  if (args.keyFindings.length > 0) {
    parts.push("\n## AI-extracted key findings");
    for (const k of args.keyFindings) parts.push(`- ${k}`);
  }

  parts.push("\n## Existing teacher directives (for this scholar)");
  if (args.existingDirectives.length === 0) {
    parts.push("(none)");
  } else {
    for (const d of args.existingDirectives) {
      const status = d.isActive ? "active" : "inactive";
      parts.push(
        `- [${status}] ${d.label}: ${d.content.slice(0, 240)}${d.content.length > 240 ? "…" : ""}`
      );
    }
  }

  parts.push("\n## Existing active seeds (for this scholar)");
  if (args.existingSeeds.length === 0) {
    parts.push("(none)");
  } else {
    for (const s of args.existingSeeds) {
      parts.push(
        `- ${s.topic} (${s.domain ?? "general"}, ${s.suggestionType})`
      );
    }
  }

  parts.push("\n## Existing scholar dossier (observer notes, internal)");
  parts.push(args.dossierContent ?? "(empty)");

  parts.push(
    "\nPropose the starter set now via the propose_starter_set tool."
  );
  return parts.join("\n");
}

// ── Action ──────────────────────────────────────────────────────────────

interface ProposalOutput {
  rationale: string;
  directives: Array<{
    action: "create" | "update";
    label: string;
    content: string;
    reason: string;
  }>;
  seeds: Array<{
    topic: string;
    domain: string;
    rationale: string;
    approachHint: string | null;
  }>;
  unitSuggestion:
    | null
    | {
        title: string;
        bigIdea: string;
        essentialQuestions: string[];
        rationale: string;
      };
}

export const runProposal = internalAction({
  args: {
    documentId: v.id("scholarDocuments"),
    generatedBy: v.id("users"),
  },
  handler: async (ctx, args): Promise<ProposalOutput> => {
    console.log(
      `[scholarDocProposals.run] documentId=${args.documentId}`
    );

    const ctxData = await ctx.runQuery(
      internal.scholarDocumentProposals.aiGetProposalContext,
      { documentId: args.documentId }
    );
    if (!ctxData) throw new Error("Document context not found");
    if (ctxData.document.processingStatus !== "ready") {
      throw new Error(
        `Document not ready (status=${ctxData.document.processingStatus})`
      );
    }
    if (!ctxData.document.redactedSummary) {
      throw new Error("Document has no redactedSummary");
    }

    const userMessage = buildUserMessage({
      redactedSummary: ctxData.document.redactedSummary,
      keyFindings: ctxData.document.aiKeyFindings,
      existingDirectives: ctxData.directives,
      existingSeeds: ctxData.seeds,
      dossierContent: ctxData.dossierContent,
    });

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model: MODELS.SONNET,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [PROPOSAL_TOOL],
      tool_choice: { type: "tool", name: "propose_starter_set" },
      messages: [{ role: "user", content: userMessage }],
    });

    console.log(
      `[scholarDocProposals] Sonnet ${response.usage.input_tokens}in / ${response.usage.output_tokens}out`
    );

    const toolBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      throw new Error("No tool_use block in Claude response");
    }

    const parsed = toolBlock.input as Partial<ProposalOutput>;
    const proposal: ProposalOutput = {
      rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
      directives: Array.isArray(parsed.directives)
        ? parsed.directives.map((d) => ({
            action: d.action === "update" ? "update" : "create",
            label: d.label ?? "",
            content: d.content ?? "",
            reason: d.reason ?? "",
          }))
        : [],
      seeds: Array.isArray(parsed.seeds)
        ? parsed.seeds.map((s) => ({
            topic: s.topic ?? "",
            domain: s.domain ?? "",
            rationale: s.rationale ?? "",
            approachHint: s.approachHint ?? null,
          }))
        : [],
      unitSuggestion: parsed.unitSuggestion
        ? {
            title: parsed.unitSuggestion.title ?? "",
            bigIdea: parsed.unitSuggestion.bigIdea ?? "",
            essentialQuestions: Array.isArray(
              parsed.unitSuggestion.essentialQuestions
            )
              ? parsed.unitSuggestion.essentialQuestions
              : [],
            rationale: parsed.unitSuggestion.rationale ?? "",
          }
        : null,
    };

    await ctx.runMutation(
      internal.scholarDocumentProposals.aiSaveProposal,
      {
        documentId: args.documentId,
        scholarId: ctxData.document.scholarId as Id<"users">,
        generatedBy: args.generatedBy,
        proposal,
        model: MODELS.SONNET,
      }
    );

    console.log(
      `[scholarDocProposals] ✅ ${proposal.directives.length} directives, ${proposal.seeds.length} seeds, unit=${proposal.unitSuggestion ? "yes" : "no"}`
    );
    return proposal;
  },
});
