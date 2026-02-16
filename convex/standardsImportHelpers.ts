import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * Insert a batch of standards, skipping duplicates by asnId.
 * Returns array of { asnId, convexId } for parent resolution.
 */
export const batchInsert = internalMutation({
  args: {
    entries: v.array(
      v.object({
        asnId: v.string(),
        notation: v.optional(v.string()),
        description: v.string(),
        gradeLevels: v.array(v.string()),
        subject: v.string(),
        statementLabel: v.string(),
        isLeaf: v.boolean(),
        documentId: v.id("standardsDocuments"),
        asnParentId: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const results: { asnId: string; convexId: string }[] = [];

    for (const entry of args.entries) {
      // Check for existing by asnId
      const existing = await ctx.db
        .query("standards")
        .withIndex("by_asnId", (q) => q.eq("asnId", entry.asnId))
        .first();

      if (existing) {
        results.push({ asnId: entry.asnId, convexId: existing._id });
        continue;
      }

      const id = await ctx.db.insert("standards", {
        asnId: entry.asnId,
        notation: entry.notation,
        description: entry.description,
        gradeLevels: entry.gradeLevels,
        subject: entry.subject,
        statementLabel: entry.statementLabel,
        isLeaf: entry.isLeaf,
        documentId: entry.documentId,
        // parentId set in second pass
      });

      results.push({ asnId: entry.asnId, convexId: id });
    }

    return results;
  },
});

/**
 * Patch parentId on a batch of standards.
 */
export const batchPatchParents = internalMutation({
  args: {
    patches: v.array(
      v.object({
        convexId: v.id("standards"),
        parentConvexId: v.id("standards"),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const patch of args.patches) {
      await ctx.db.patch(patch.convexId, { parentId: patch.parentConvexId });
    }
  },
});

/**
 * Create or upsert a standards document.
 */
export const upsertDocument = internalMutation({
  args: {
    asnDocumentId: v.string(),
    title: v.string(),
    subject: v.string(),
    jurisdiction: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if document already exists
    const existing = await ctx.db
      .query("standardsDocuments")
      .filter((q) => q.eq(q.field("asnDocumentId"), args.asnDocumentId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title,
        subject: args.subject,
        jurisdiction: args.jurisdiction,
      });
      return existing._id;
    }

    return await ctx.db.insert("standardsDocuments", {
      asnDocumentId: args.asnDocumentId,
      title: args.title,
      subject: args.subject,
      jurisdiction: args.jurisdiction,
    });
  },
});
