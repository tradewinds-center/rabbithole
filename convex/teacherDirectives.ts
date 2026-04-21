import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";
import { authedQuery } from "./lib/customFunctions";
import { teacherMutation } from "./lib/customFunctions";
import { ROLES } from "./lib/roles";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Teacher Directives — persistent pedagogical instructions the tutor AI is
 * expected to follow for a specific scholar. These live in their own table
 * (as of Phase 1.5) rather than as marker blocks inside the scholar dossier.
 *
 * The dossier is for observer/tutor-authored learning notes; directives are
 * for teacher/admin-authored "standing rules" that govern tutor behavior.
 */

/**
 * Return active directives for a scholar, oldest-first (by _creationTime).
 * Used by buildSystemPrompt when rendering the DIRECTIVES section.
 */
export const listActiveByScholarInternal = internalQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("teacherDirectives")
      .withIndex("by_scholar_active", (q) =>
        q.eq("scholarId", args.scholarId).eq("isActive", true)
      )
      .collect();
    rows.sort((a, b) => a._creationTime - b._creationTime);
    return rows;
  },
});

/**
 * List directives for UI. Teachers/admins see all directives (active +
 * inactive). Scholars can see their own active ones only.
 */
export const listByScholar = authedQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const isTeacher =
      ctx.user.role === ROLES.TEACHER || ctx.user.role === ROLES.ADMIN;
    if (!isTeacher && ctx.user._id !== args.scholarId) {
      throw new Error("Forbidden");
    }

    const rows = await ctx.db
      .query("teacherDirectives")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
      .collect();
    rows.sort((a, b) => a._creationTime - b._creationTime);

    if (!isTeacher) {
      return rows.filter((r) => r.isActive);
    }
    return rows;
  },
});

/**
 * Shared upsert-by-label logic. Case-insensitive label match. If one exists,
 * patch content + authorId + updatedAt. Otherwise insert a new active row.
 */
async function upsertByLabelHelper(
  ctx: MutationCtx,
  args: {
    scholarId: Id<"users">;
    label: string;
    content: string;
    authorId: Id<"users">;
  }
) {
  const label = args.label.trim();
  if (!label) throw new Error("label must be a non-empty string");
  const content = args.content.trim();

  const existing = await ctx.db
    .query("teacherDirectives")
    .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
    .collect();

  const labelLower = label.toLowerCase();
  const match = existing.find((r) => r.label.toLowerCase() === labelLower);

  const now = Date.now();

  if (match) {
    await ctx.db.patch(match._id, {
      content,
      authorId: args.authorId,
      updatedAt: now,
      // Preserve label casing of the existing row; don't reformat.
    });
    return { action: "updated" as const, id: match._id, label: match.label };
  }

  const id = await ctx.db.insert("teacherDirectives", {
    scholarId: args.scholarId,
    label,
    content,
    authorId: args.authorId,
    isActive: true,
    updatedAt: now,
  });
  return { action: "created" as const, id, label };
}

/**
 * Upsert a directive by (scholarId, label). Called by AI tools (teacherAide).
 * Accepts authorId explicitly because the AI tool infers the author from the
 * teacher context, not from the Convex auth user (it's an internal invocation).
 */
export const upsertByLabel = internalMutation({
  args: {
    scholarId: v.id("users"),
    label: v.string(),
    content: v.string(),
    authorId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await upsertByLabelHelper(ctx, args);
  },
});

/**
 * Upsert a directive by (scholarId, label). UI-callable. authorId is inferred
 * from the authenticated teacher via the teacherMutation wrapper.
 */
export const upsertByTeacher = teacherMutation({
  args: {
    scholarId: v.id("users"),
    label: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    return await upsertByLabelHelper(ctx, {
      scholarId: args.scholarId,
      label: args.label,
      content: args.content,
      authorId: ctx.user._id,
    });
  },
});

/**
 * Activate or deactivate a directive. Teacher-only.
 */
export const setActive = teacherMutation({
  args: {
    id: v.id("teacherDirectives"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Directive not found");
    await ctx.db.patch(args.id, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Hard-delete a directive. Teacher-only.
 */
export const remove = teacherMutation({
  args: { id: v.id("teacherDirectives") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) return;
    await ctx.db.delete(args.id);
  },
});
