import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { ROLES } from "./lib/roles";

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
export const getForTeacher = authedQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const isTeacher = ctx.user.role === ROLES.TEACHER || ctx.user.role === ROLES.ADMIN;
    if (!isTeacher && ctx.user._id !== args.scholarId) throw new Error("Forbidden");

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
export const updateByTeacher = authedMutation({
  args: {
    scholarId: v.id("users"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const isTeacher = ctx.user.role === ROLES.TEACHER || ctx.user.role === ROLES.ADMIN;
    if (!isTeacher && ctx.user._id !== args.scholarId) throw new Error("Forbidden");

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
