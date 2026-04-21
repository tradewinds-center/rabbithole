import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * One-off migration for Phase 1.5 of the Teacher AI feature.
 *
 * Phase 1 stored teacher-authored pedagogical directives inline in
 * `scholarDossiers.content` as marker blocks like:
 *
 *   [Teacher-authored YYYY-MM-DD: <label>]
 *   <body...>
 *
 * Phase 1.5 moves those directives into a dedicated `teacherDirectives` table.
 * This migration:
 *
 *   1. Scans every scholarDossiers row
 *   2. Extracts teacher-authored marker blocks
 *   3. Inserts each block as a teacherDirectives row (idempotent per label)
 *   4. Rewrites the dossier with teacher blocks stripped (observer prose kept)
 *
 * Idempotent: running twice inserts 0 new directives the second time.
 *
 * Caller must pass an `authorId` — typically Andy's admin user ID on the
 * target deployment — because the original marker blocks don't carry an
 * author field.
 */

const TEACHER_MARKER_PATTERN = /^\[Teacher-authored (\d{4}-\d{2}-\d{2}): (.+)\]\s*$/gm;

type Segment =
  | { kind: "prose"; text: string }
  | { kind: "block"; label: string; date: string; body: string };

function parseDossier(content: string): Segment[] {
  const markers: Array<{
    index: number;
    date: string;
    label: string;
    headerLength: number;
  }> = [];
  const re = new RegExp(TEACHER_MARKER_PATTERN.source, "gm");
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    markers.push({
      index: m.index,
      date: m[1],
      label: m[2].trim(),
      headerLength: m[0].length,
    });
  }

  if (markers.length === 0) {
    return content.length > 0 ? [{ kind: "prose", text: content }] : [];
  }

  const segments: Segment[] = [];
  if (markers[0].index > 0) {
    segments.push({ kind: "prose", text: content.slice(0, markers[0].index) });
  }
  for (let i = 0; i < markers.length; i++) {
    const headerEnd = markers[i].index + markers[i].headerLength;
    const blockEnd = i + 1 < markers.length ? markers[i + 1].index : content.length;
    // Body is everything after the header line, up to the next marker or EOS.
    const body = content.slice(headerEnd, blockEnd);
    segments.push({
      kind: "block",
      label: markers[i].label,
      date: markers[i].date,
      body,
    });
  }
  return segments;
}

/**
 * Collapse runs of 3+ newlines into double newlines, trim leading/trailing
 * whitespace, but preserve intentional blank-line separation elsewhere.
 */
function normalizeProse(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

export const migrate = internalMutation({
  args: {
    authorId: v.id("users"),
  },
  handler: async (ctx, args) => {
    let dossiersScanned = 0;
    let blocksFound = 0;
    let directivesCreated = 0;
    let directivesSkipped = 0;

    const dossiers = await ctx.db.query("scholarDossiers").collect();

    for (const dossier of dossiers) {
      dossiersScanned++;
      const segments = parseDossier(dossier.content);
      const blocks = segments.filter((s): s is Extract<Segment, { kind: "block" }> => s.kind === "block");
      if (blocks.length === 0) continue;

      blocksFound += blocks.length;

      // Fetch existing directives for this scholar once (for idempotency check).
      const existing = await ctx.db
        .query("teacherDirectives")
        .withIndex("by_scholar", (q) => q.eq("scholarId", dossier.scholarId))
        .collect();
      const existingLabelsLower = new Set(existing.map((r) => r.label.toLowerCase()));

      for (const block of blocks) {
        const body = block.body.trim();
        const labelLower = block.label.toLowerCase();
        if (existingLabelsLower.has(labelLower)) {
          directivesSkipped++;
          continue;
        }
        await ctx.db.insert("teacherDirectives", {
          scholarId: dossier.scholarId,
          label: block.label,
          content: body,
          authorId: args.authorId,
          isActive: true,
          updatedAt: Date.now(),
        });
        existingLabelsLower.add(labelLower);
        directivesCreated++;
      }

      // Rewrite the dossier without teacher blocks.
      const proseOnly = segments
        .filter((s) => s.kind === "prose")
        .map((s) => (s as { kind: "prose"; text: string }).text)
        .join("");
      const cleaned = normalizeProse(proseOnly);
      if (cleaned !== dossier.content) {
        await ctx.db.patch(dossier._id, { content: cleaned });
      }
    }

    return { dossiersScanned, blocksFound, directivesCreated, directivesSkipped };
  },
});
