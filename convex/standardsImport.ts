"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

interface ImportResult {
  documentId: Id<"standardsDocuments">;
  totalStandards: number;
  parentLinksPatched: number;
}

// ─── SirFizX v0.8 JSON entry shape ─────────────────────────────────
// Entries have mixed ID schemes:
//   - Folders: only `id` (GUID), no ASN.id
//   - Leaves/intermediates: `ASN.id` (S-prefixed) is canonical, `id` is GUID
// Parent references (`ASN.parent` or `asnParent`) always use S-prefixed ASN IDs.
// We create a synthetic "canonical ID" for each entry to unify both schemes.

interface RawEntry {
  id: string;
  subject: string;
  statement: string;
  gradeLevels?: string[];
  gradelevels?: string[]; // alternate casing in some entries
  code?: string | null;
  shortCode?: string;
  cls?: string;
  statementLabel?: string;
  asnParent?: string;
  ccsiParent?: string;
  ASN?: {
    id?: string | null;
    identifier?: string;
    parent?: string;
    leaf?: string;
    statementNotation?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

// ─── Helpers ────────────────────────────────────────────────────────

function normalizeGrade(g: string): string {
  if (g === "KG" || g === "K") return "K";
  const num = parseInt(g, 10);
  if (!isNaN(num)) return String(num);
  return g;
}

function inferLabel(cls: string | undefined, depth: number): string {
  if (cls === "folder") {
    if (depth === 0) return "Domain";
    if (depth === 1) return "Cluster";
    return "Category";
  }
  return "Standard";
}

// ─── Main import action ─────────────────────────────────────────────

export const importFromUrl = internalAction({
  args: {
    url: v.string(),
    subject: v.string(),
    jurisdiction: v.string(),
    documentTitle: v.string(),
    asnDocumentId: v.string(),
  },
  handler: async (ctx, args): Promise<ImportResult> => {
    console.log(`Fetching standards from: ${args.url}`);
    const res = await fetch(args.url);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${args.url}: ${res.status} ${res.statusText}`);
    }

    const rawData: RawEntry[] = await res.json();
    console.log(`Fetched ${rawData.length} entries`);

    // Create/upsert the document record
    const documentId = await ctx.runMutation(
      internal.standardsImportHelpers.upsertDocument,
      {
        asnDocumentId: args.asnDocumentId,
        title: args.documentTitle,
        subject: args.subject,
        jurisdiction: args.jurisdiction,
      }
    );

    // ── Build unified ID system ──
    // Each entry gets a canonicalId. Folders only have `id` (GUID).
    // Leaves/intermediates have `ASN.id` (S-prefixed) as canonical.
    // We also need to register every ID each entry is known by, so parents can resolve.

    interface Processed {
      canonicalId: string;
      parentCanonicalId?: string;
      notation?: string;
      description: string;
      gradeLevels: string[];
      statementLabel: string;
      isLeaf: boolean;
      cls?: string;
    }

    // Map from any known ID → canonical ID
    const idAlias = new Map<string, string>();
    const processed: Processed[] = [];

    for (const entry of rawData) {
      const asnId = entry.ASN?.id;
      const guid = entry.id;
      // Canonical: prefer ASN.id if present, otherwise GUID
      const canonicalId = asnId || guid;

      // Register both IDs as aliases to canonical
      idAlias.set(canonicalId, canonicalId);
      if (asnId && guid && asnId !== guid) {
        idAlias.set(guid, canonicalId);
      }

      // Resolve parent: ASN.parent > asnParent > ccsiParent
      const parentRef =
        entry.ASN?.parent || entry.asnParent || entry.ccsiParent || undefined;

      const gradeLevels = (entry.gradeLevels || entry.gradelevels || []).map(
        normalizeGrade
      );
      const notation =
        entry.shortCode ||
        entry.ASN?.statementNotation ||
        undefined;

      const isLeaf = entry.ASN?.leaf === "true";

      processed.push({
        canonicalId,
        parentCanonicalId: parentRef,
        notation,
        description: entry.statement || "(no description)",
        gradeLevels,
        statementLabel: entry.statementLabel || "",
        isLeaf,
        cls: entry.cls,
      });
    }

    // Build parent depth map for label inference
    const parentMap = new Map<string, string>();
    for (const p of processed) {
      if (p.parentCanonicalId) {
        // Resolve parent through alias
        const resolvedParent =
          idAlias.get(p.parentCanonicalId) || p.parentCanonicalId;
        parentMap.set(p.canonicalId, resolvedParent);
      }
    }

    function getDepth(id: string): number {
      let depth = 0;
      let current = id;
      const seen = new Set<string>();
      while (parentMap.has(current) && !seen.has(current)) {
        seen.add(current);
        current = parentMap.get(current)!;
        depth++;
      }
      return depth;
    }

    // Fill in statementLabel where missing
    const transformed = processed.map((p) => ({
      asnId: p.canonicalId,
      notation: p.notation,
      description: p.description,
      gradeLevels: p.gradeLevels,
      subject: args.subject,
      statementLabel:
        p.statementLabel || inferLabel(p.cls, getDepth(p.canonicalId)),
      isLeaf: p.isLeaf,
      documentId,
      asnParentId: p.parentCanonicalId
        ? idAlias.get(p.parentCanonicalId) || p.parentCanonicalId
        : undefined,
    }));

    // Pass 1: Insert all nodes in chunks, collecting canonical → convexId
    const asnToConvex = new Map<string, string>();
    const CHUNK = 200;

    for (let i = 0; i < transformed.length; i += CHUNK) {
      const chunk = transformed.slice(i, i + CHUNK);
      console.log(
        `Inserting batch ${Math.floor(i / CHUNK) + 1}/${Math.ceil(transformed.length / CHUNK)}`
      );

      const results = await ctx.runMutation(
        internal.standardsImportHelpers.batchInsert,
        { entries: chunk }
      );

      for (const r of results) {
        asnToConvex.set(r.asnId, r.convexId);
      }
    }

    // Pass 2: Patch parent references
    const parentPatches: { convexId: string; parentConvexId: string }[] = [];
    for (const entry of transformed) {
      if (entry.asnParentId) {
        const childConvexId = asnToConvex.get(entry.asnId);
        const parentConvexId = asnToConvex.get(entry.asnParentId);
        if (childConvexId && parentConvexId) {
          parentPatches.push({
            convexId: childConvexId as any,
            parentConvexId: parentConvexId as any,
          });
        }
      }
    }

    for (let i = 0; i < parentPatches.length; i += CHUNK) {
      const chunk = parentPatches.slice(i, i + CHUNK);
      console.log(
        `Patching parents ${Math.floor(i / CHUNK) + 1}/${Math.ceil(parentPatches.length / CHUNK)}`
      );

      await ctx.runMutation(internal.standardsImportHelpers.batchPatchParents, {
        patches: chunk as any,
      });
    }

    console.log(
      `Done! Imported ${transformed.length} standards, patched ${parentPatches.length} parent links.`
    );
    return {
      documentId,
      totalStandards: transformed.length,
      parentLinksPatched: parentPatches.length,
    };
  },
});

// ─── Public action wrappers ─────────────────────────────────────────

export const importCommonCoreMath = action({
  args: {},
  handler: async (ctx): Promise<ImportResult> => {
    return await ctx.runAction(internal.standardsImport.importFromUrl, {
      url: "https://raw.githubusercontent.com/SirFizX/standards-data/master/clean-data/CC/math/CC-math-0.8.0.json",
      subject: "Mathematics",
      jurisdiction: "Common Core",
      documentTitle: "Common Core State Standards for Mathematics",
      asnDocumentId: "D10003FB",
    });
  },
});

export const importCommonCoreELA = action({
  args: {},
  handler: async (ctx): Promise<ImportResult> => {
    return await ctx.runAction(internal.standardsImport.importFromUrl, {
      url: "https://raw.githubusercontent.com/SirFizX/standards-data/master/clean-data/CC/literacy/CC-literacy-0.8.0.json",
      subject: "ELA/Literacy",
      jurisdiction: "Common Core",
      documentTitle: "Common Core State Standards for English Language Arts & Literacy",
      asnDocumentId: "D10003FC",
    });
  },
});
