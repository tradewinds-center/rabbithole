import { v } from "convex/values";
import { authedQuery } from "./lib/customFunctions";
import { internalQuery } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";

/** Helper: filter out nodes with empty/placeholder descriptions */
function hasRealDescription(s: { description: string }): boolean {
  const d = s.description.trim();
  return d !== "" && d !== "(no description)";
}

/** Helper: natural sort by notation, then description */
function sortByNotation<T extends { notation?: string; description: string }>(
  items: T[]
): T[] {
  return items.sort((a, b) => {
    if (a.notation && b.notation) return a.notation.localeCompare(b.notation);
    return a.description.localeCompare(b.description);
  });
}

/**
 * List all standards documents with leaf counts and distinct grade levels.
 */
export const listDocuments = authedQuery({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("standardsDocuments").collect();

    const results = [];
    for (const doc of docs) {
      const allStandards = await ctx.db
        .query("standards")
        .withIndex("by_document", (q) => q.eq("documentId", doc._id))
        .collect();

      const leafCount = allStandards.filter((s) => s.isLeaf).length;

      // Collect distinct grade levels across all standards in this document
      const gradeSet = new Set<string>();
      for (const s of allStandards) {
        for (const g of s.gradeLevels) {
          gradeSet.add(g);
        }
      }
      const grades = Array.from(gradeSet).sort((a, b) => {
        // Sort: K first, then numeric, then alpha
        if (a === "K") return -1;
        if (b === "K") return 1;
        const aNum = parseInt(a);
        const bNum = parseInt(b);
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
        return a.localeCompare(b);
      });

      results.push({ ...doc, leafCount, grades });
    }

    return results;
  },
});

/**
 * Get top-level standards (parentId undefined) for a document,
 * filtered by grade and excluding "(no description)" entries.
 */
export const getRootsByGrade = authedQuery({
  args: {
    documentId: v.id("standardsDocuments"),
    grade: v.string(),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("standards")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    return sortByNotation(
      all.filter(
        (s) =>
          !s.parentId &&
          s.gradeLevels.includes(args.grade) &&
          hasRealDescription(s)
      )
    );
  },
});

/**
 * Get top-level standards (parentId undefined) for a document (no grade filter).
 */
export const getRoots = authedQuery({
  args: { documentId: v.id("standardsDocuments") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("standards")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    return sortByNotation(all.filter((s) => !s.parentId && hasRealDescription(s)));
  },
});

/**
 * Grade summary: total leaf standards for a grade, and how many have observations.
 */
export const gradeSummary = authedQuery({
  args: {
    documentId: v.id("standardsDocuments"),
    grade: v.string(),
    scholarId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const isTeacher = ctx.user.role === "teacher" || ctx.user.role === "admin";
    if (!isTeacher && ctx.user._id !== args.scholarId) throw new Error("Forbidden");

    const allStandards = await ctx.db
      .query("standards")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    // Leaf standards for this grade
    const leaves = allStandards.filter(
      (s) => s.isLeaf && s.gradeLevels.includes(args.grade)
    );
    const totalLeaves = leaves.length;

    if (totalLeaves === 0) {
      return { totalLeaves: 0, assessedLeaves: 0 };
    }

    // Get all current observations for the scholar
    const allObs = await ctx.db
      .query("masteryObservations")
      .withIndex("by_scholar_current", (q) =>
        q.eq("scholarId", args.scholarId).eq("isSuperseded", false)
      )
      .collect();

    // Build set of standard IDs that have observations
    const assessedSet = new Set<string>();
    for (const obs of allObs) {
      if (obs.standardIds) {
        for (const sid of obs.standardIds) {
          assessedSet.add(sid);
        }
      }
    }

    const leafIds = new Set(leaves.map((l) => l._id as string));
    const assessedLeaves = Array.from(leafIds).filter((id) =>
      assessedSet.has(id)
    ).length;

    return { totalLeaves, assessedLeaves };
  },
});

/**
 * Get children of a standard via by_parent index.
 * Filters out "(no description)" entries.
 */
export const getChildren = authedQuery({
  args: { parentId: v.id("standards") },
  handler: async (ctx, args) => {
    const children = await ctx.db
      .query("standards")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .collect();

    return sortByNotation(children.filter(hasRealDescription));
  },
});

/**
 * Walk parent chain to root for breadcrumb display.
 */
export const getAncestors = authedQuery({
  args: { standardId: v.id("standards") },
  handler: async (ctx, args) => {
    const ancestors: Doc<"standards">[] = [];
    let current = await ctx.db.get(args.standardId);

    while (current?.parentId) {
      const parent = await ctx.db.get(current.parentId);
      if (!parent) break;
      ancestors.unshift(parent);
      current = parent;
    }

    return ancestors;
  },
});

/**
 * Get mastery observations linked to a specific standard.
 */
export const observationsForStandard = authedQuery({
  args: {
    standardId: v.id("standards"),
    scholarId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const isTeacher = ctx.user.role === "teacher" || ctx.user.role === "admin";
    if (!isTeacher && ctx.user._id !== args.scholarId) throw new Error("Forbidden");

    // Get all current observations for the scholar, filter for this standard
    const allObs = await ctx.db
      .query("masteryObservations")
      .withIndex("by_scholar_current", (q) =>
        q.eq("scholarId", args.scholarId).eq("isSuperseded", false)
      )
      .collect();

    return allObs.filter(
      (o) => o.standardIds && o.standardIds.includes(args.standardId)
    );
  },
});

/**
 * Recursive subtree coverage: count leaf descendants and how many have observations.
 * Returns { total, assessed } for "X of Y assessed" display.
 */
export const getSubtreeCoverage = authedQuery({
  args: {
    standardId: v.id("standards"),
    scholarId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const isTeacher = ctx.user.role === "teacher" || ctx.user.role === "admin";
    if (!isTeacher && ctx.user._id !== args.scholarId) throw new Error("Forbidden");

    // Collect all leaf IDs in the subtree
    const leafIds: Id<"standards">[] = [];

    async function walkSubtree(nodeId: Id<"standards">) {
      const node = await ctx.db.get(nodeId);
      if (!node) return;

      if (node.isLeaf) {
        leafIds.push(node._id);
        return;
      }

      const children = await ctx.db
        .query("standards")
        .withIndex("by_parent", (q) => q.eq("parentId", nodeId))
        .collect();

      for (const child of children) {
        await walkSubtree(child._id);
      }
    }

    await walkSubtree(args.standardId);

    if (leafIds.length === 0) {
      return { total: 0, assessed: 0 };
    }

    // Get all current observations for the scholar
    const allObs = await ctx.db
      .query("masteryObservations")
      .withIndex("by_scholar_current", (q) =>
        q.eq("scholarId", args.scholarId).eq("isSuperseded", false)
      )
      .collect();

    // Build set of standard IDs that have observations
    const assessedSet = new Set<string>();
    for (const obs of allObs) {
      if (obs.standardIds) {
        for (const sid of obs.standardIds) {
          assessedSet.add(sid);
        }
      }
    }

    const assessed = leafIds.filter((id) => assessedSet.has(id)).length;

    return { total: leafIds.length, assessed };
  },
});

/**
 * Get standard details by IDs (for frontend enrichment).
 */
export const getByIds = authedQuery({
  args: { ids: v.array(v.id("standards")) },
  handler: async (ctx, args) => {
    const results: Doc<"standards">[] = [];
    for (const id of args.ids) {
      const std = await ctx.db.get(id);
      if (std) results.push(std);
    }
    return results;
  },
});

/**
 * Internal query: get leaf standards for the standards mapper.
 * Returns compact records filtered by grade range.
 */
export const leafStandardsForMapping = internalQuery({
  args: {
    grades: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const docs = await ctx.db.query("standardsDocuments").collect();
    const results: {
      id: string;
      notation: string;
      description: string;
      subject: string;
    }[] = [];

    for (const doc of docs) {
      const all = await ctx.db
        .query("standards")
        .withIndex("by_subject_leaf", (q) =>
          q.eq("subject", doc.subject).eq("isLeaf", true)
        )
        .collect();

      for (const s of all) {
        if (
          s.notation &&
          s.gradeLevels.some((g) => args.grades.includes(g))
        ) {
          results.push({
            id: s._id,
            notation: s.notation,
            description: s.description,
            subject: s.subject,
          });
        }
      }
    }

    return results;
  },
});
