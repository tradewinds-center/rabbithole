import { v } from "convex/values";
import { authedQuery, teacherQuery, teacherMutation } from "./lib/customFunctions";
import { internalMutation } from "./_generated/server";

/**
 * Get process state for a project (reactive, used by ProcessPanel).
 */
export const getByProject = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("processState")
      .withIndex("by_project", (q) =>
        q.eq("projectId", args.projectId)
      )
      .first();
  },
});

/**
 * Initialize process state when a process is set on a project.
 * Creates all steps as "not_started", sets currentStep to the first step.
 */
export const initialize = internalMutation({
  args: {
    projectId: v.id("projects"),
    processId: v.id("processes"),
  },
  handler: async (ctx, args) => {
    // Delete existing processState for this project
    const existing = await ctx.db
      .query("processState")
      .withIndex("by_project", (q) =>
        q.eq("projectId", args.projectId)
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    // Get the process to read its steps
    const process = await ctx.db.get(args.processId);
    if (!process || process.steps.length === 0) return;

    await ctx.db.insert("processState", {
      projectId: args.projectId,
      processId: args.processId,
      currentStep: process.steps[0].key,
      steps: process.steps.map((s) => ({
        key: s.key,
        status: "not_started" as const,
      })),
    });
  },
});

/**
 * Update a step's status and commentary. Called by AI tool handler in http.ts.
 */
export const updateStep = internalMutation({
  args: {
    projectId: v.id("projects"),
    stepKey: v.string(),
    status: v.union(
      v.literal("in_progress"),
      v.literal("completed")
    ),
    commentary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("processState")
      .withIndex("by_project", (q) =>
        q.eq("projectId", args.projectId)
      )
      .first();
    if (!state) return;

    const updatedSteps = state.steps.map((s) => {
      if (s.key === args.stepKey) {
        return {
          ...s,
          status: args.status,
          commentary: args.commentary ?? s.commentary,
        };
      }
      return s;
    });

    await ctx.db.patch(state._id, {
      currentStep: args.stepKey,
      steps: updatedSteps,
    });
  },
});

/**
 * Teacher moves a scholar to a different process step (drag-and-drop in Activity View).
 * Special pseudo-steps:
 *   "__not_started" — clears currentStep (scholar hasn't started the process)
 *   "__complete"    — stamps activityCompletedAt on the project
 * Any real step key clears activityCompletedAt and sets currentStep normally.
 */
export const teacherMoveStep = teacherMutation({
  args: {
    projectId: v.id("projects"),
    stepKey: v.string(),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return;

    // Handle pseudo-steps
    if (args.stepKey === "__complete") {
      await ctx.db.patch(args.projectId, { activityCompletedAt: Date.now() });
      return;
    }

    // Moving to any non-complete step clears completion
    if (project.activityCompletedAt) {
      await ctx.db.patch(args.projectId, { activityCompletedAt: undefined });
    }

    if (args.stepKey === "__not_started") {
      // Clear process state currentStep
      const state = await ctx.db
        .query("processState")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .first();
      if (state) {
        await ctx.db.patch(state._id, {
          currentStep: "",
          steps: state.steps.map((s) => ({ ...s, status: "not_started" as const })),
        });
      }
      return;
    }

    // Normal step move
    const state = await ctx.db
      .query("processState")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first();
    if (!state) return;

    const updatedSteps = state.steps.map((s) => {
      if (s.key === args.stepKey) {
        return { ...s, status: "in_progress" as const };
      }
      return s;
    });

    await ctx.db.patch(state._id, {
      currentStep: args.stepKey,
      steps: updatedSteps,
    });
  },
});

/**
 * Remove process state for a project (when process is cleared).
 */
export const remove = internalMutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("processState")
      .withIndex("by_project", (q) =>
        q.eq("projectId", args.projectId)
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

/**
 * Get racetrack data: all scholars' progress on a specific process.
 * Used by teacher's Conductor View to show class-wide step progress.
 */
export const getRacetrackData = teacherQuery({
  args: { processId: v.id("processes") },
  handler: async (ctx, args) => {
    const process = await ctx.db.get(args.processId);
    if (!process) return null;

    // Find all non-archived projects using this process (via unit building block)
    const unitsWithProcess = await ctx.db
      .query("units")
      .filter((q) => q.eq(q.field("processId"), args.processId))
      .collect();
    const allProjects = [];
    for (const unit of unitsWithProcess) {
      const unitProjects = await ctx.db
        .query("projects")
        .withIndex("by_unit", (q) => q.eq("unitId", unit._id))
        .collect();
      allProjects.push(...unitProjects);
    }
    const activeProjects = allProjects.filter((p) => !p.isArchived);

    // For each project, get processState + scholar info
    const scholarResults = await Promise.all(
      activeProjects.map(async (proj) => {
        const state = await ctx.db
          .query("processState")
          .withIndex("by_project", (q) =>
            q.eq("projectId", proj._id)
          )
          .first();
        const scholar = await ctx.db.get(proj.userId);
        if (!state || !scholar) return null;
        return {
          id: scholar._id,
          name: scholar.name ?? null,
          image: scholar.image ?? null,
          currentStep: state.currentStep,
        };
      })
    );

    return {
      process: {
        title: process.title,
        emoji: process.emoji ?? null,
        steps: process.steps,
      },
      scholars: scholarResults.filter(
        (s): s is NonNullable<typeof s> => s !== null
      ),
    };
  },
});
