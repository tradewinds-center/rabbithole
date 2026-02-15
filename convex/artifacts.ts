import { v } from "convex/values";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * Get all artifacts for a project (reactive, used by ArtifactPanel).
 * Returns array sorted by creation time.
 */
export const getByProject = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("artifacts")
      .withIndex("by_project", (q) =>
        q.eq("projectId", args.projectId)
      )
      .collect();
  },
});

/**
 * Scholar saves edits to artifact content (by artifact ID).
 */
export const scholarUpdate = authedMutation({
  args: {
    artifactId: v.id("artifacts"),
    content: v.optional(v.string()),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const artifact = await ctx.db.get(args.artifactId);
    if (!artifact) return;
    const patch: { content?: string; title?: string; lastEditedBy: "scholar" } = {
      lastEditedBy: "scholar",
    };
    if (args.content !== undefined) patch.content = args.content;
    if (args.title !== undefined) patch.title = args.title;
    await ctx.db.patch(artifact._id, patch);
  },
});

/**
 * Scholar creates a new empty artifact.
 */
export const scholarCreate = authedMutation({
  args: {
    projectId: v.id("projects"),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("artifacts", {
      projectId: args.projectId,
      title: args.title || "Untitled",
      content: "",
      lastEditedBy: "scholar",
    });
  },
});

/**
 * Scholar deletes an artifact.
 */
export const deleteArtifact = authedMutation({
  args: { artifactId: v.id("artifacts") },
  handler: async (ctx, args) => {
    const artifact = await ctx.db.get(args.artifactId);
    if (!artifact) return;
    await ctx.db.delete(args.artifactId);
  },
});

// ── Internal mutations for AI tool use ────────────────────────────────

/**
 * AI creates a new artifact for a project (no longer deletes existing).
 * Returns the new artifact _id.
 */
export const aiCreate = internalMutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("artifacts", {
      projectId: args.projectId,
      title: args.title,
      content: args.content,
      lastEditedBy: "ai",
    });
    return id;
  },
});

/**
 * AI replaces text in artifact content (str_replace).
 * Accepts optional artifactId; falls back to first artifact for backwards compat.
 */
export const aiStrReplace = internalMutation({
  args: {
    projectId: v.id("projects"),
    oldStr: v.string(),
    newStr: v.string(),
    artifactId: v.optional(v.id("artifacts")),
  },
  handler: async (ctx, args) => {
    let artifact;
    if (args.artifactId) {
      artifact = await ctx.db.get(args.artifactId);
    } else {
      artifact = await ctx.db
        .query("artifacts")
        .withIndex("by_project", (q) =>
          q.eq("projectId", args.projectId)
        )
        .first();
    }
    if (!artifact) {
      return { error: "Error: No document exists yet. Use create first." };
    }
    if (!artifact.content.includes(args.oldStr)) {
      return {
        error: `Error: old_str not found in document. Make sure it matches exactly, including whitespace and line breaks.`,
      };
    }
    const newContent = artifact.content.replace(args.oldStr, args.newStr);
    await ctx.db.patch(artifact._id, {
      content: newContent,
      lastEditedBy: "ai",
    });
    return {};
  },
});

/**
 * AI inserts text at a line number (0 = beginning).
 * Accepts optional artifactId; falls back to first artifact for backwards compat.
 */
export const aiInsert = internalMutation({
  args: {
    projectId: v.id("projects"),
    insertLine: v.number(),
    insertText: v.string(),
    artifactId: v.optional(v.id("artifacts")),
  },
  handler: async (ctx, args) => {
    let artifact;
    if (args.artifactId) {
      artifact = await ctx.db.get(args.artifactId);
    } else {
      artifact = await ctx.db
        .query("artifacts")
        .withIndex("by_project", (q) =>
          q.eq("projectId", args.projectId)
        )
        .first();
    }
    if (!artifact) return;
    const lines = artifact.content.split("\n");
    const lineNum = Math.max(0, Math.min(args.insertLine, lines.length));
    lines.splice(lineNum, 0, args.insertText);
    await ctx.db.patch(artifact._id, {
      content: lines.join("\n"),
      lastEditedBy: "ai",
    });
  },
});

/**
 * AI renames an artifact.
 * Accepts optional artifactId; falls back to first artifact for backwards compat.
 */
export const aiRename = internalMutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    artifactId: v.optional(v.id("artifacts")),
  },
  handler: async (ctx, args) => {
    let artifact;
    if (args.artifactId) {
      artifact = await ctx.db.get(args.artifactId);
    } else {
      artifact = await ctx.db
        .query("artifacts")
        .withIndex("by_project", (q) =>
          q.eq("projectId", args.projectId)
        )
        .first();
    }
    if (!artifact) return;
    await ctx.db.patch(artifact._id, { title: args.title });
  },
});

/**
 * AI reads artifact content (for view command).
 * Returns all artifacts when no artifactId specified.
 */
export const aiGetContent = internalQuery({
  args: {
    projectId: v.id("projects"),
    artifactId: v.optional(v.id("artifacts")),
  },
  handler: async (ctx, args) => {
    if (args.artifactId) {
      return await ctx.db.get(args.artifactId);
    }
    // Return all artifacts for the project
    return await ctx.db
      .query("artifacts")
      .withIndex("by_project", (q) =>
        q.eq("projectId", args.projectId)
      )
      .collect();
  },
});
