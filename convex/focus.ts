import { v } from "convex/values";
import { authedQuery, teacherMutation } from "./lib/customFunctions";

/**
 * Get the current active focus setting (if any).
 * Available to all authenticated users (scholars need to read it too).
 */
export const getCurrent = authedQuery({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("focusSettings")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first();
    return active ?? null;
  },
});

/**
 * Set focus unit (teacher only).
 * Deactivates any existing focus, then creates a new active one.
 * Phase 1: only unitId — individual dimensions come from the unit.
 */
export const set = teacherMutation({
  args: {
    unitId: v.optional(v.id("units")),
  },
  handler: async (ctx, args) => {
    // Deactivate all existing active focus settings
    const existing = await ctx.db
      .query("focusSettings")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    for (const row of existing) {
      await ctx.db.patch(row._id, { isActive: false });
    }

    // Insert new active focus
    return await ctx.db.insert("focusSettings", {
      teacherId: ctx.user._id,
      unitId: args.unitId,
      isActive: true,
    });
  },
});

/**
 * Clear focus (teacher only).
 * Sets isActive to false on the current focus.
 */
export const clear = teacherMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("focusSettings")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    for (const row of existing) {
      await ctx.db.patch(row._id, { isActive: false });
    }
  },
});
