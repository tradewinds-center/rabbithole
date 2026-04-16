import { v } from "convex/values";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { ROLES } from "./lib/roles";

/**
 * List reports for a scholar, newest first.
 */
export const list = authedQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const isTeacher = ctx.user.role === ROLES.TEACHER || ctx.user.role === ROLES.ADMIN;
    if (!isTeacher && ctx.user._id !== args.scholarId) throw new Error("Forbidden");

    return await ctx.db
      .query("reports")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
      .order("desc")
      .collect();
  },
});

/**
 * Create a report and auto-append to scholar dossier.
 */
export const create = authedMutation({
  args: {
    scholarId: v.id("users"),
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const isTeacher = ctx.user.role === ROLES.TEACHER || ctx.user.role === ROLES.ADMIN;
    if (!isTeacher && ctx.user._id !== args.scholarId) throw new Error("Forbidden");

    const id = await ctx.db.insert("reports", {
      teacherId: ctx.user._id,
      scholarId: args.scholarId,
      title: args.title.trim(),
      content: args.content.trim(),
    });

    // Auto-append to dossier
    const dateStr = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const appendText = `\n\n--- Teacher Report: ${args.title.trim()} (${dateStr}) ---\n${args.content.trim()}`;

    const existing = await ctx.db
      .query("scholarDossiers")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        content: existing.content + appendText,
      });
    } else {
      await ctx.db.insert("scholarDossiers", {
        scholarId: args.scholarId,
        content: appendText.trimStart(),
      });
    }

    return await ctx.db.get(id);
  },
});

/**
 * Delete a report. Does NOT remove from dossier (already folded in).
 */
export const remove = authedMutation({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    const isTeacher = ctx.user.role === ROLES.TEACHER || ctx.user.role === ROLES.ADMIN;
    if (!isTeacher) {
      const report = await ctx.db.get(args.reportId);
      if (!report || report.scholarId !== ctx.user._id) throw new Error("Forbidden");
    }
    await ctx.db.delete(args.reportId);
  },
});
