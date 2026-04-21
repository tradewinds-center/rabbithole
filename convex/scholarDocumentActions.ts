"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Extraction + redaction pipeline for scholarDocuments.
 *
 * 1. Pull the PDF bytes out of Convex storage.
 * 2. Send to Gemini 3 Pro for plain-text extraction.
 * 3. Send the extracted text BACK to Gemini with a strict redaction prompt.
 * 4. Save both to the document row.
 * 5. Optionally purge the original PDF per DOCUMENT_RETENTION_POLICY.
 *
 * The redaction step is load-bearing — everything it outputs is allowed to
 * flow into downstream LLM calls that generate directives/seeds, and those
 * eventually surface to the scholar via the tutor. Keep the prompt strict.
 */

// Model string: the repo currently uses gemini-3-pro-image-preview for images.
// For text extraction we use the non-image variant.
const GEMINI_MODEL = "gemini-3-pro-preview";

// ─────────────────────────────────────────────────────────────────────────
// REDACTION PROMPT — DO NOT RELAX WITHOUT REVIEW.
//
// Everything this prompt outputs can flow downstream into:
//   - Teacher directives (fed into the tutor system prompt)
//   - Seeds (fed into the tutor system prompt as exploration topics)
//   - Proposed unit suggestions
// Which means it can indirectly reach the scholar. So: NOTHING leakable in,
// NOTHING leakable out.
// ─────────────────────────────────────────────────────────────────────────
const REDACTION_PROMPT = `You are redacting a confidential child cognitive-assessment document so the
redacted output can be used internally by teachers at Tradewinds School to
tailor instruction. The redacted output will ALSO be fed into a downstream AI
that writes notes the child's AI tutor will read. So anything you leave in may
ultimately reach the child. Be strict.

STRIP (do not include any of the following in your output):
- Exact subscores and test numbers: FSIQ, VCI, VSI, FRI, WMI, PSI, any index
  score, standard score, scaled score, percentile, T-score, z-score, or
  grade-equivalent number. Drop all raw numbers tied to performance.
- Named test instruments with their numeric results (e.g. "WISC-V FSIQ 127" →
  drop; "profile is consistent with superior overall reasoning" → keep).
- Diagnostic labels that are medical-sounding rather than classroom-relevant
  (autism-spectrum severity levels, specific DSM codes, comorbid medical
  conditions unrelated to learning). Mild ADHD / dyslexia patterns used to
  explain learning style are OK, phrased qualitatively.
- Identifying information: full birth date, address, phone, email, parent
  names, school names other than Tradewinds, names of clinicians, doctor IDs,
  license numbers.
- Non-educational medical history (allergies, medications, surgeries, family
  medical history).
- Anything clinically sensitive beyond "pattern + implications for classroom
  tailoring."

KEEP (these are pedagogically actionable and should be preserved in
qualitative, plain language):
- Qualitative cognitive profile: "superior verbal reasoning," "relative
  weakness in processing speed compared with reasoning," "stealth-dyslexia
  pattern," "mild inattentive ADHD," "asynchronous development." Use
  qualitative descriptors, never numbers.
- Recommended accommodations and teaching strategies.
- Stated interests, strengths, protective factors.
- Learning-style observations ("works best with open-ended challenges,"
  "reads above grade level," "strong pattern recognition").
- Examples of tasks the child found engaging or frustrating (if given in
  qualitative form).

OUTPUT FORMAT — respond with valid JSON matching exactly this shape:
{
  "summary": "<2-6 paragraphs of prose, no bullets, no headings, suitable for a
teacher skim-read. Refer to the child by first name only or 'the student'.
Never include numbers from the assessment.>",
  "keyFindings": [
    "<3-7 short bullets, each <= 200 chars, each pedagogically actionable.
Phrased as observations a teacher could act on, not as clinical findings.>"
  ]
}

If the document does not appear to be an assessment / IEP / educational
document at all, still produce the same JSON but with summary noting that.

Return ONLY the JSON. No prose before or after. No code fences.
`;

const EXTRACTION_PROMPT = `Extract the full text content of the attached
document. Return plain text only — no markdown formatting, no headings, no
bullet characters unless they are present in the original. Preserve paragraph
breaks. Include tables and lists as plain text. Do not summarize, do not
abbreviate, do not editorialize. If a section is unreadable, write
"[unreadable]" in place of that section.`;

// ─── Gemini helpers ─────────────────────────────────────────────────────

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

async function callGemini(
  apiKey: string,
  parts: GeminiPart[]
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          responseModalities: ["TEXT"],
        },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Gemini API ${res.status}: ${body.slice(0, 500)}`
    );
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0];
  const contentParts = candidate?.content?.parts;
  if (!contentParts || !Array.isArray(contentParts)) {
    throw new Error(
      `Gemini response missing content.parts. Finish reason: ${candidate?.finishReason ?? "unknown"}`
    );
  }
  const text = contentParts
    .map((p: { text?: string }) => p.text ?? "")
    .join("");
  if (!text) {
    throw new Error("Gemini returned empty text");
  }
  return text;
}

function blobToBase64(bytes: Uint8Array): string {
  // Convex Node runtime has Buffer available.
  return Buffer.from(bytes).toString("base64");
}

interface RedactionResult {
  summary: string;
  keyFindings: string[];
}

function parseRedactionJson(raw: string): RedactionResult {
  // Strip accidental code fences.
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  }
  const parsed = JSON.parse(cleaned);
  const summary = typeof parsed.summary === "string" ? parsed.summary : "";
  const keyFindings = Array.isArray(parsed.keyFindings)
    ? parsed.keyFindings
        .filter((x: unknown) => typeof x === "string")
        .map((x: string) => x.trim())
        .filter(Boolean)
    : [];
  if (!summary) {
    throw new Error("Redaction response missing `summary`");
  }
  return { summary, keyFindings };
}

// ─── Main action ────────────────────────────────────────────────────────

export const extractAndRedact = internalAction({
  args: { documentId: v.id("scholarDocuments") },
  handler: async (ctx, args) => {
    console.log(
      `[scholarDocs.extractAndRedact] documentId=${args.documentId}`
    );

    const doc = await ctx.runQuery(
      internal.scholarDocuments.aiGetDocument,
      { documentId: args.documentId }
    );
    if (!doc) {
      console.error(`[scholarDocs] doc not found: ${args.documentId}`);
      return null;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(
        internal.scholarDocuments.aiPatchProcessingStatus,
        {
          documentId: args.documentId,
          status: "error",
          error: "GEMINI_API_KEY not set on this deployment",
        }
      );
      return null;
    }

    try {
      // ── Step 1: extract text (skip if we were handed pre-populated text) ──
      let extractedText = doc.extractedText ?? "";

      if (!extractedText) {
        if (!doc.fileStorageId) {
          throw new Error(
            "Document has neither extractedText nor fileStorageId"
          );
        }

        await ctx.runMutation(
          internal.scholarDocuments.aiPatchProcessingStatus,
          { documentId: args.documentId, status: "extracting" }
        );

        const blob = await ctx.storage.get(doc.fileStorageId);
        if (!blob) throw new Error("Storage blob missing");

        const bytes = new Uint8Array(await blob.arrayBuffer());
        const mimeType = doc.fileMimeType ?? "application/pdf";

        console.log(
          `[scholarDocs] Gemini extract — ${bytes.byteLength} bytes, mime=${mimeType}`
        );

        extractedText = await callGemini(apiKey, [
          { text: EXTRACTION_PROMPT },
          {
            inlineData: {
              mimeType,
              data: blobToBase64(bytes),
            },
          },
        ]);

        await ctx.runMutation(
          internal.scholarDocuments.aiPatchExtractedText,
          { documentId: args.documentId, text: extractedText }
        );
      }

      // ── Step 2: redact ────────────────────────────────────────────────
      await ctx.runMutation(
        internal.scholarDocuments.aiPatchProcessingStatus,
        { documentId: args.documentId, status: "redacting" }
      );

      console.log(
        `[scholarDocs] Gemini redact — ${extractedText.length} chars`
      );

      const redactionRaw = await callGemini(apiKey, [
        { text: REDACTION_PROMPT },
        { text: `\n\n--- DOCUMENT TEXT ---\n\n${extractedText}` },
      ]);

      const { summary, keyFindings } = parseRedactionJson(redactionRaw);

      await ctx.runMutation(
        internal.scholarDocuments.aiPatchRedactedSummary,
        {
          documentId: args.documentId,
          summary,
          keyFindings,
        }
      );

      // ── Step 3: retention policy ─────────────────────────────────────
      const retention = process.env.DOCUMENT_RETENTION_POLICY ?? "keep";
      if (retention === "purge_after_redaction") {
        console.log(
          `[scholarDocs] DOCUMENT_RETENTION_POLICY=purge_after_redaction → deleting storage file`
        );
        await ctx.runMutation(
          internal.scholarDocuments.aiPurgeFile,
          { documentId: args.documentId }
        );
      }

      // ── Step 4: done ─────────────────────────────────────────────────
      await ctx.runMutation(
        internal.scholarDocuments.aiPatchProcessingStatus,
        { documentId: args.documentId, status: "ready" }
      );

      console.log(
        `[scholarDocs] ✅ ready — summary=${summary.length} chars, ${keyFindings.length} key findings`
      );
      return { ok: true, keyFindings };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[scholarDocs] FAILED: ${message}`);
      await ctx.runMutation(
        internal.scholarDocuments.aiPatchProcessingStatus,
        {
          documentId: args.documentId,
          status: "error",
          error: message.slice(0, 500),
        }
      );
      return { ok: false, error: message };
    }
  },
});
