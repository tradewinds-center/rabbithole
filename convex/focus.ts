import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { authedQuery, teacherMutation, teacherQuery } from "./lib/customFunctions";
import { Id } from "./_generated/dataModel";

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
    // Enrich with lesson title for banner display
    const lesson = active.lessonId ? await ctx.db.get(active.lessonId) : null;
    return { ...active, lessonTitle: lesson?.title ?? null };
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
    lessonId: v.optional(v.id("lessons")),
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
      await ctx.db.patch(row._id, { isActive: false, completedAt: Date.now() });
    }

    // Compute endsAt: explicit override > lesson.durationMinutes > unit.durationMinutes > undefined
    let endsAt = args.endsAt;
    if (!endsAt && args.lessonId) {
      const lesson = await ctx.db.get(args.lessonId);
      if (lesson?.durationMinutes) {
        endsAt = Date.now() + lesson.durationMinutes * 60_000;
      }
    }
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
      lessonId: args.lessonId,
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
      await ctx.db.patch(row._id, { isActive: false, completedAt: Date.now() });
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
      await ctx.db.patch(args.focusId, { isActive: false, completedAt: Date.now() });
    }
  },
});

/**
 * List today's completed activities for the current teacher.
 * Returns enriched data with unit info and scholar count.
 */
export const listCompleted = teacherQuery({
  args: {},
  handler: async (ctx) => {
    // Get today's start (midnight local — use UTC midnight as approximation)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const allCompleted = await ctx.db
      .query("focusSettings")
      .withIndex("by_teacher", (q) => q.eq("teacherId", ctx.user._id))
      .collect();

    // Filter to completed today
    const todayCompleted = allCompleted.filter(
      (f) => !f.isActive && f.completedAt && f.completedAt >= todayStart
    );

    // Enrich with unit info + lesson title + scholar count
    return Promise.all(
      todayCompleted.map(async (f) => {
        const unit = f.unitId ? await ctx.db.get(f.unitId) : null;
        const lesson = f.lessonId ? await ctx.db.get(f.lessonId) : null;

        // Count projects linked to this activity
        const projects = await ctx.db
          .query("projects")
          .withIndex("by_activity", (q) => q.eq("activityId", f._id))
          .collect();

        return {
          _id: f._id,
          unitId: f.unitId,
          lessonId: f.lessonId,
          unitTitle: unit?.title ?? "Unknown",
          unitEmoji: unit?.emoji ?? null,
          lessonTitle: lesson?.title ?? null,
          startedAt: f._creationTime,
          completedAt: f.completedAt!,
          endsAt: f.endsAt,
          scholarCount: projects.length,
        };
      })
    );
  },
});

/**
 * Get a single completed activity with full scholar/project data.
 * Returns the same shape as ScholarInActivity for component reuse.
 */
export const getWithProjects = teacherQuery({
  args: { focusId: v.id("focusSettings") },
  handler: async (ctx, args) => {
    const focus = await ctx.db.get(args.focusId);
    if (!focus) throw new Error("Activity not found");

    const unit = focus.unitId ? await ctx.db.get(focus.unitId) : null;
    const lesson = focus.lessonId ? await ctx.db.get(focus.lessonId) : null;
    // Lesson's process takes priority over unit's process
    const effectiveProcessId = lesson?.processId ?? unit?.processId ?? null;
    const process = effectiveProcessId ? await ctx.db.get(effectiveProcessId) : null;

    // Get all projects linked to this activity
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_activity", (q) => q.eq("activityId", args.focusId))
      .collect();

    const scholars = await Promise.all(
      projects.map(async (proj) => {
        const scholar = await ctx.db.get(proj.userId);
        const lastMsg = await ctx.db
          .query("messages")
          .withIndex("by_project", (q) => q.eq("projectId", proj._id))
          .order("desc")
          .first();
        const procState = await ctx.db
          .query("processState")
          .withIndex("by_project", (q) => q.eq("projectId", proj._id))
          .first();

        return {
          scholarId: proj.userId,
          projectId: proj._id,
          projectCreatedAt: proj._creationTime,
          name: scholar?.name ?? null,
          image: scholar?.image ?? null,
          readingLevel: scholar?.readingLevel ?? null,
          dateOfBirth: scholar?.dateOfBirth ?? null,
          pulseScore: proj.pulseScore ?? null,
          lastMessageAt: lastMsg?._creationTime ?? null,
          lastMessageContent: lastMsg?.content?.slice(0, 120) ?? null,
          lastMessageRole: lastMsg?.role ?? null,
          processStep: procState?.currentStep ?? null,
          projectTitle: proj.title,
          analysisSummary: proj.analysisSummary ?? null,
          activityCompletedAt: proj.activityCompletedAt ?? null,
        };
      })
    );

    return {
      _id: focus._id,
      unitId: focus.unitId,
      lessonId: focus.lessonId,
      unitTitle: unit?.title ?? "Unknown",
      unitEmoji: unit?.emoji ?? null,
      unitDescription: unit?.description ?? null,
      lessonTitle: lesson?.title ?? null,
      startedAt: focus._creationTime,
      completedAt: focus.completedAt,
      endsAt: focus.endsAt,
      processId: effectiveProcessId,
      process: process
        ? {
            title: process.title,
            emoji: process.emoji ?? null,
            steps: process.steps,
          }
        : null,
      scholars,
    };
  },
});
