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

// ─── UCLA Historical Thinking Standards ─────────────────────────────
// From UCLA/NCHS National Standards for History (Historical Thinking)
// These are skill-based standards that span all elementary grades.

const UCLA_HISTORICAL_THINKING = [
  // Standard 1: Chronological Thinking
  { id: "UCLA-HT-1", notation: "HT.1", description: "Chronological Thinking", isLeaf: false, parent: undefined as string | undefined, label: "Domain" },
  { id: "UCLA-HT-1-A", notation: "HT.1.A", description: "Distinguish between past, present, and future time", isLeaf: true, parent: "UCLA-HT-1", label: "Standard" },
  { id: "UCLA-HT-1-B", notation: "HT.1.B", description: "Identify the temporal structure of a historical narrative or story", isLeaf: true, parent: "UCLA-HT-1", label: "Standard" },
  { id: "UCLA-HT-1-C", notation: "HT.1.C", description: "Establish temporal order in constructing historical narratives of their own", isLeaf: true, parent: "UCLA-HT-1", label: "Standard" },
  { id: "UCLA-HT-1-D", notation: "HT.1.D", description: "Measure and calculate calendar time", isLeaf: true, parent: "UCLA-HT-1", label: "Standard" },
  { id: "UCLA-HT-1-E", notation: "HT.1.E", description: "Interpret data presented in time lines and create time lines", isLeaf: true, parent: "UCLA-HT-1", label: "Standard" },
  { id: "UCLA-HT-1-F", notation: "HT.1.F", description: "Reconstruct patterns of historical succession and duration; explain historical continuity and change", isLeaf: true, parent: "UCLA-HT-1", label: "Standard" },
  { id: "UCLA-HT-1-G", notation: "HT.1.G", description: "Compare alternative models for periodization", isLeaf: true, parent: "UCLA-HT-1", label: "Standard" },

  // Standard 2: Historical Comprehension
  { id: "UCLA-HT-2", notation: "HT.2", description: "Historical Comprehension", isLeaf: false, parent: undefined as string | undefined, label: "Domain" },
  { id: "UCLA-HT-2-A", notation: "HT.2.A", description: "Identify the author or source of the historical document or narrative and assess its credibility", isLeaf: true, parent: "UCLA-HT-2", label: "Standard" },
  { id: "UCLA-HT-2-B", notation: "HT.2.B", description: "Reconstruct the literal meaning of a historical passage", isLeaf: true, parent: "UCLA-HT-2", label: "Standard" },
  { id: "UCLA-HT-2-C", notation: "HT.2.C", description: "Identify the central question(s) the historical narrative addresses", isLeaf: true, parent: "UCLA-HT-2", label: "Standard" },
  { id: "UCLA-HT-2-D", notation: "HT.2.D", description: "Differentiate between historical facts and historical interpretations", isLeaf: true, parent: "UCLA-HT-2", label: "Standard" },
  { id: "UCLA-HT-2-E", notation: "HT.2.E", description: "Read historical narratives imaginatively", isLeaf: true, parent: "UCLA-HT-2", label: "Standard" },
  { id: "UCLA-HT-2-F", notation: "HT.2.F", description: "Appreciate historical perspectives", isLeaf: true, parent: "UCLA-HT-2", label: "Standard" },
  { id: "UCLA-HT-2-G", notation: "HT.2.G", description: "Draw upon data in historical maps", isLeaf: true, parent: "UCLA-HT-2", label: "Standard" },
  { id: "UCLA-HT-2-H", notation: "HT.2.H", description: "Utilize visual, mathematical, and quantitative data", isLeaf: true, parent: "UCLA-HT-2", label: "Standard" },
  { id: "UCLA-HT-2-I", notation: "HT.2.I", description: "Draw upon visual sources including photographs, paintings, cartoons, and architecture", isLeaf: true, parent: "UCLA-HT-2", label: "Standard" },

  // Standard 3: Historical Analysis and Interpretation
  { id: "UCLA-HT-3", notation: "HT.3", description: "Historical Analysis and Interpretation", isLeaf: false, parent: undefined as string | undefined, label: "Domain" },
  { id: "UCLA-HT-3-A", notation: "HT.3.A", description: "Compare and contrast differing sets of ideas, values, personalities, behaviors, and institutions", isLeaf: true, parent: "UCLA-HT-3", label: "Standard" },
  { id: "UCLA-HT-3-B", notation: "HT.3.B", description: "Consider multiple perspectives of various peoples by demonstrating their differing motives, beliefs, interests, hopes, and fears", isLeaf: true, parent: "UCLA-HT-3", label: "Standard" },
  { id: "UCLA-HT-3-C", notation: "HT.3.C", description: "Analyze cause-and-effect relationships and multiple causation, including the importance of the individual, the influence of ideas, and the role of chance", isLeaf: true, parent: "UCLA-HT-3", label: "Standard" },
  { id: "UCLA-HT-3-D", notation: "HT.3.D", description: "Draw comparisons across eras and regions in order to define enduring issues", isLeaf: true, parent: "UCLA-HT-3", label: "Standard" },
  { id: "UCLA-HT-3-E", notation: "HT.3.E", description: "Distinguish between unsupported expressions of opinion and informed hypotheses grounded in historical evidence", isLeaf: true, parent: "UCLA-HT-3", label: "Standard" },
  { id: "UCLA-HT-3-F", notation: "HT.3.F", description: "Compare competing historical narratives", isLeaf: true, parent: "UCLA-HT-3", label: "Standard" },
  { id: "UCLA-HT-3-G", notation: "HT.3.G", description: "Challenge arguments of historical inevitability", isLeaf: true, parent: "UCLA-HT-3", label: "Standard" },
  { id: "UCLA-HT-3-H", notation: "HT.3.H", description: "Hold interpretations of history as tentative, subject to change as new information is uncovered", isLeaf: true, parent: "UCLA-HT-3", label: "Standard" },
  { id: "UCLA-HT-3-I", notation: "HT.3.I", description: "Evaluate major debates among historians", isLeaf: true, parent: "UCLA-HT-3", label: "Standard" },
  { id: "UCLA-HT-3-J", notation: "HT.3.J", description: "Hypothesize the influence of the past", isLeaf: true, parent: "UCLA-HT-3", label: "Standard" },

  // Standard 4: Historical Research Capabilities
  { id: "UCLA-HT-4", notation: "HT.4", description: "Historical Research Capabilities", isLeaf: false, parent: undefined as string | undefined, label: "Domain" },
  { id: "UCLA-HT-4-A", notation: "HT.4.A", description: "Formulate historical questions", isLeaf: true, parent: "UCLA-HT-4", label: "Standard" },
  { id: "UCLA-HT-4-B", notation: "HT.4.B", description: "Obtain historical data from a variety of sources", isLeaf: true, parent: "UCLA-HT-4", label: "Standard" },
  { id: "UCLA-HT-4-C", notation: "HT.4.C", description: "Interrogate historical data", isLeaf: true, parent: "UCLA-HT-4", label: "Standard" },
  { id: "UCLA-HT-4-D", notation: "HT.4.D", description: "Identify the gaps in the available records and marshal contextual knowledge and perspectives of the time and place", isLeaf: true, parent: "UCLA-HT-4", label: "Standard" },
  { id: "UCLA-HT-4-E", notation: "HT.4.E", description: "Employ quantitative analysis", isLeaf: true, parent: "UCLA-HT-4", label: "Standard" },
  { id: "UCLA-HT-4-F", notation: "HT.4.F", description: "Support interpretations with historical evidence", isLeaf: true, parent: "UCLA-HT-4", label: "Standard" },

  // Standard 5: Historical Issues-Analysis and Decision-Making
  { id: "UCLA-HT-5", notation: "HT.5", description: "Historical Issues-Analysis and Decision-Making", isLeaf: false, parent: undefined as string | undefined, label: "Domain" },
  { id: "UCLA-HT-5-A", notation: "HT.5.A", description: "Identify issues and problems in the past", isLeaf: true, parent: "UCLA-HT-5", label: "Standard" },
  { id: "UCLA-HT-5-B", notation: "HT.5.B", description: "Marshal evidence of antecedent circumstances", isLeaf: true, parent: "UCLA-HT-5", label: "Standard" },
  { id: "UCLA-HT-5-C", notation: "HT.5.C", description: "Identify relevant historical antecedents", isLeaf: true, parent: "UCLA-HT-5", label: "Standard" },
  { id: "UCLA-HT-5-D", notation: "HT.5.D", description: "Evaluate alternative courses of action", isLeaf: true, parent: "UCLA-HT-5", label: "Standard" },
  { id: "UCLA-HT-5-E", notation: "HT.5.E", description: "Formulate a position or course of action on an issue", isLeaf: true, parent: "UCLA-HT-5", label: "Standard" },
  { id: "UCLA-HT-5-F", notation: "HT.5.F", description: "Evaluate the implementation of a decision", isLeaf: true, parent: "UCLA-HT-5", label: "Standard" },
];

const ALL_ELEMENTARY_GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8"];

export const importUCLAHistoricalThinking = action({
  args: {},
  handler: async (ctx): Promise<ImportResult> => {
    console.log("Importing UCLA Historical Thinking Standards...");

    // Create/upsert the document record
    const documentId = await ctx.runMutation(
      internal.standardsImportHelpers.upsertDocument,
      {
        asnDocumentId: "UCLA-HT",
        title: "UCLA Historical Thinking Standards",
        subject: "Historical Thinking",
        jurisdiction: "UCLA/NCHS",
      }
    );

    // Transform into the shape expected by batchInsert
    const entries = UCLA_HISTORICAL_THINKING.map((s) => ({
      asnId: s.id,
      notation: s.notation,
      description: s.description,
      gradeLevels: ALL_ELEMENTARY_GRADES,
      subject: "Historical Thinking",
      statementLabel: s.label,
      isLeaf: s.isLeaf,
      documentId,
      asnParentId: s.parent,
    }));

    // Insert all standards (fits in a single batch)
    const results = await ctx.runMutation(
      internal.standardsImportHelpers.batchInsert,
      { entries }
    );

    const asnToConvex = new Map<string, string>();
    for (const r of results) {
      asnToConvex.set(r.asnId, r.convexId);
    }

    // Patch parent references
    const parentPatches: { convexId: string; parentConvexId: string }[] = [];
    for (const entry of entries) {
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

    await ctx.runMutation(internal.standardsImportHelpers.batchPatchParents, {
      patches: parentPatches as any,
    });

    console.log(
      `Done! Imported ${entries.length} standards, patched ${parentPatches.length} parent links.`
    );
    return {
      documentId,
      totalStandards: entries.length,
      parentLinksPatched: parentPatches.length,
    };
  },
});
