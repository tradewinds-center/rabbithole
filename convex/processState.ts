import { v } from "convex/values";
import { authedQuery, teacherQuery } from "./lib/customFunctions";
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

    // Find all non-archived projects using this process
    const projects = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("processId"), args.processId))
      .collect();
    const activeProjects = projects.filter((p) => !p.isArchived);

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
