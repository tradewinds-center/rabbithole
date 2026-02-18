import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { authedQuery, teacherMutation } from "./lib/customFunctions";

/**
 * Get the current active focus setting (if any).
 * Available to all authenticated users (scholars need to read it too).
 * Returns null if no active focus or if the focus has expired.
 */
export const getCurrent = authedQuery({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("focusSettings")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first();
    if (!active) return null;
    // Treat expired focus as inactive
    if (active.endsAt && Date.now() > active.endsAt) return null;
    // Per-scholar filtering: if scholarIds is set, only those scholars see the lock
    const user = ctx.user;
    if (
      user.role === "scholar" &&
      active.scholarIds &&
      active.scholarIds.length > 0 &&
      !active.scholarIds.includes(user._id)
    ) {
      return null;
    }
    return active;
  },
});

/**
 * Set focus unit (teacher only).
 * Deactivates any existing focus, then creates a new active one.
 * If the unit has durationMinutes, computes endsAt automatically.
 * Teacher can override with an explicit endsAt.
 */
export const set = teacherMutation({
  args: {
    unitId: v.optional(v.id("units")),
    scholarIds: v.optional(v.array(v.id("users"))),
    endsAt: v.optional(v.number()),
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

    // Compute endsAt: explicit override > unit.durationMinutes > undefined
    let endsAt = args.endsAt;
    if (!endsAt && args.unitId) {
      const unit = await ctx.db.get(args.unitId);
      if (unit?.durationMinutes) {
        endsAt = Date.now() + unit.durationMinutes * 60_000;
      }
    }

    // Insert new active focus
    const focusId = await ctx.db.insert("focusSettings", {
      teacherId: ctx.user._id,
      unitId: args.unitId,
      scholarIds: args.scholarIds,
      isActive: true,
      endsAt,
    });

    // Schedule auto-clear if endsAt is set
    if (endsAt) {
      const delayMs = endsAt - Date.now();
      if (delayMs > 0) {
        await ctx.scheduler.runAfter(
          delayMs,
          internal.focus.autoClear,
          { focusId }
        );
      }
    }

    return focusId;
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

/**
 * Internal: auto-clear a specific focus setting after expiration.
 * Scheduled by `set` — no auth required.
 */
export const autoClear = internalMutation({
  args: { focusId: v.id("focusSettings") },
  handler: async (ctx, args) => {
    const focus = await ctx.db.get(args.focusId);
    if (focus && focus.isActive) {
      await ctx.db.patch(args.focusId, { isActive: false });
    }
  },
});
