import { v } from "convex/values";
import { authedQuery, teacherQuery, teacherMutation } from "./lib/customFunctions";
import { internalQuery } from "./_generated/server";

/** Lean query accessible to all authenticated users (scholars need this for UnitPickerDialog). */
export const listByUnitPublic = authedQuery({
  args: { unitId: v.id("units") },
  handler: async (ctx, args) => {
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_unit", (q) => q.eq("unitId", args.unitId))
      .collect();
    return Promise.all(
      lessons.sort((a, b) => a.order - b.order).map(async (l) => {
        const process = l.processId ? await ctx.db.get(l.processId) : null;
        return {
          _id: l._id,
          title: l.title,
          strand: l.strand ?? null,
          processTitle: process?.title ?? null,
          processEmoji: process?.emoji ?? null,
          durationMinutes: l.durationMinutes ?? null,
        };
      })
    );
  },
});

export const listByUnit = teacherQuery({
  args: { unitId: v.id("units") },
  handler: async (ctx, args) => {
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_unit", (q) => q.eq("unitId", args.unitId))
      .collect();

    // Resolve process names
    return Promise.all(
      lessons
        .sort((a, b) => a.order - b.order)
        .map(async (l) => {
          const process = l.processId ? await ctx.db.get(l.processId) : null;
          return {
            ...l,
            processTitle: process?.title ?? null,
            processEmoji: process?.emoji ?? null,
          };
        })
    );
  },
});

export const get = teacherQuery({
  args: { id: v.id("lessons") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = teacherMutation({
  args: {
    unitId: v.id("units"),
    title: v.string(),
    strand: v.optional(v.union(
      v.literal("core"), v.literal("connections"),
      v.literal("practice"), v.literal("identity")
    )),
    systemPrompt: v.optional(v.string()),
    processId: v.optional(v.id("processes")),
    durationMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get next order number for this unit
    const existing = await ctx.db
      .query("lessons")
      .withIndex("by_unit", (q) => q.eq("unitId", args.unitId))
      .collect();
    const maxOrder = existing.reduce((max, l) => Math.max(max, l.order), -1);

    return await ctx.db.insert("lessons", {
      unitId: args.unitId,
      title: args.title.trim(),
      strand: args.strand,
      systemPrompt: args.systemPrompt?.trim() || undefined,
      processId: args.processId,
      order: maxOrder + 1,
      durationMinutes: args.durationMinutes,
    });
  },
});

export const update = teacherMutation({
  args: {
    id: v.id("lessons"),
    title: v.optional(v.string()),
    strand: v.optional(v.union(
      v.literal("core"), v.literal("connections"),
      v.literal("practice"), v.literal("identity"),
      v.null()
    )),
    systemPrompt: v.optional(v.union(v.string(), v.null())),
    processId: v.optional(v.union(v.id("processes"), v.null())),
    durationMinutes: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const cleaned: Record<string, unknown> = {};
    if (updates.title !== undefined) cleaned.title = updates.title.trim();
    if (updates.strand !== undefined) cleaned.strand = updates.strand ?? undefined;
    if (updates.systemPrompt !== undefined)
      cleaned.systemPrompt = updates.systemPrompt?.trim() || undefined;
    if (updates.processId !== undefined)
      cleaned.processId = updates.processId ?? undefined;
    if (updates.durationMinutes !== undefined)
      cleaned.durationMinutes = updates.durationMinutes ?? undefined;

    await ctx.db.patch(id, cleaned);
  },
});

export const remove = teacherMutation({
  args: { id: v.id("lessons") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const reorder = teacherMutation({
  args: {
    lessonIds: v.array(v.id("lessons")),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.lessonIds.length; i++) {
      await ctx.db.patch(args.lessonIds[i], { order: i });
    }
  },
});

// Internal query for use in HTTP actions
export const listByUnitInternal = internalQuery({
  args: { unitId: v.id("units") },
  handler: async (ctx, args) => {
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_unit", (q) => q.eq("unitId", args.unitId))
      .collect();

    return Promise.all(
      lessons
        .sort((a, b) => a.order - b.order)
        .map(async (l) => {
          const process = l.processId ? await ctx.db.get(l.processId) : null;
          return {
            ...l,
            processTitle: process?.title ?? null,
            processEmoji: process?.emoji ?? null,
          };
        })
    );
  },
});
