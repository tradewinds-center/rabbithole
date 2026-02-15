import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";
import { teacherQuery, teacherMutation } from "./lib/customFunctions";

/**
 * Get dossier for a scholar (used by system prompt builder).
 */
export const aiGet = internalQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("scholarDossiers")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
      .first();
  },
});

/**
 * Upsert dossier content (called by AI tool handler).
 */
export const aiUpdate = internalMutation({
  args: {
    scholarId: v.id("users"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("scholarDossiers")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { content: args.content });
    } else {
      await ctx.db.insert("scholarDossiers", {
        scholarId: args.scholarId,
        content: args.content,
      });
    }
  },
});

/**
 * Get dossier for teacher UI (ScholarProfile).
 */
export const getForTeacher = teacherQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const dossier = await ctx.db
      .query("scholarDossiers")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
      .first();
    return dossier?.content ?? null;
  },
});

/**
 * Teacher manual edit of dossier.
 */
export const updateByTeacher = teacherMutation({
  args: {
    scholarId: v.id("users"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("scholarDossiers")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { content: args.content });
    } else {
      await ctx.db.insert("scholarDossiers", {
        scholarId: args.scholarId,
        content: args.content,
      });
    }
  },
});
