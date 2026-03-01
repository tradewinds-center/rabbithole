import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { authedQuery, teacherQuery } from "./lib/customFunctions";

/**
 * Record a mastery observation (called by the observer action).
 * Handles supersession: if supersedesObservationId is provided,
 * marks the old observation as superseded.
 */
export const record = internalMutation({
  args: {
    scholarId: v.id("users"),
    conceptLabel: v.string(),
    domain: v.string(),
    projectId: v.id("projects"),
    transcriptExcerpt: v.string(),
    masteryLevel: v.number(),
    confidenceScore: v.number(),
    evidenceSummary: v.string(),
    evidenceType: v.string(),
    attemptContext: v.string(),
    studentInitiated: v.boolean(),
    standardNotations: v.optional(v.array(v.string())),
    supersedesObservationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Resolve standard notations to IDs (if standards table is populated)
    let standardIds: Id<"standards">[] | undefined = undefined;
    if (args.standardNotations && args.standardNotations.length > 0) {
      const resolved = [];
      for (const notation of args.standardNotations) {
        let std = await ctx.db
          .query("standards")
          .withIndex("by_notation", (q) => q.eq("notation", notation))
          .first();
        if (!std) {
          std = await ctx.db
            .query("standards")
            .withIndex("by_asnId", (q) => q.eq("asnId", notation))
            .first();
        }
        if (std) resolved.push(std._id);
      }
      if (resolved.length > 0) standardIds = resolved;
    }

    // Handle observer-directed supersession
    if (args.supersedesObservationId) {
      try {
        const obsId = args.supersedesObservationId as Id<"masteryObservations">;
        const existing = await ctx.db.get(obsId);
        if (existing && !existing.isSuperseded) {
          await ctx.db.patch(obsId, { isSuperseded: true });
        }
      } catch {
        // Invalid ID — observer hallucinated. No-op.
      }
    }

    return await ctx.db.insert("masteryObservations", {
      scholarId: args.scholarId,
      conceptLabel: args.conceptLabel,
      domain: args.domain,
      observedAt: Date.now(),
      projectId: args.projectId,
      transcriptExcerpt: args.transcriptExcerpt,
      masteryLevel: args.masteryLevel,
      confidenceScore: args.confidenceScore,
      evidenceSummary: args.evidenceSummary,
      evidenceType: args.evidenceType,
      attemptContext: args.attemptContext,
      studentInitiated: args.studentInitiated,
      standardIds,
      supersedesId: args.supersedesObservationId
        ? (args.supersedesObservationId as Id<"masteryObservations">)
        : undefined,
      isSuperseded: false,
    });
  },
});

/**
 * Get current (non-superseded) observations for a scholar.
 * Used by the observer to make supersession decisions.
 */
export const currentByScholar = internalQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("masteryObservations")
      .withIndex("by_scholar_current", (q) =>
        q.eq("scholarId", args.scholarId).eq("isSuperseded", false)
      )
      .collect();
  },
});

/**
 * Teacher view: current observations for a scholar, grouped by domain.
 */
export const byScholarDomain = authedQuery({
  args: { scholarId: v.id("users"), domain: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const isTeacher = ctx.user.role === "teacher" || ctx.user.role === "admin";
    if (!isTeacher && ctx.user._id !== args.scholarId) throw new Error("Forbidden");

    const observations = await ctx.db
      .query("masteryObservations")
      .withIndex("by_scholar_current", (q) =>
        q.eq("scholarId", args.scholarId).eq("isSuperseded", false)
      )
      .collect();

    const filtered = args.domain
      ? observations.filter((o) => o.domain === args.domain)
      : observations;

    const byDomain: Record<string, typeof filtered> = {};
    for (const obs of filtered) {
      if (!byDomain[obs.domain]) byDomain[obs.domain] = [];
      byDomain[obs.domain].push(obs);
    }

    return byDomain;
  },
});

/**
 * Inspect a concept's full observation history (all versions).
 */
export const inspectConcept = authedQuery({
  args: {
    scholarId: v.id("users"),
    conceptLabel: v.string(),
  },
  handler: async (ctx, args) => {
    const isTeacher = ctx.user.role === "teacher" || ctx.user.role === "admin";
    if (!isTeacher && ctx.user._id !== args.scholarId) throw new Error("Forbidden");

    const allForScholar = await ctx.db
      .query("masteryObservations")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
      .collect();

    const forConcept = allForScholar
      .filter((o) => o.conceptLabel === args.conceptLabel)
      .sort((a, b) => b.observedAt - a.observedAt);

    // Get teacher override if any
    const current = forConcept.find((o) => !o.isSuperseded);
    let teacherOverride = null;
    if (current) {
      teacherOverride = await ctx.db
        .query("teacherMasteryOverrides")
        .withIndex("by_observation", (q) =>
          q.eq("observationId", current._id)
        )
        .first();
    }

    return { observations: forConcept, teacherOverride };
  },
});

/**
 * Current observations that have linked standards, for a scholar.
 * Used by StandardsTab for efficient initial load.
 */
export const withStandardsByScholar = authedQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const isTeacher = ctx.user.role === "teacher" || ctx.user.role === "admin";
    if (!isTeacher && ctx.user._id !== args.scholarId) throw new Error("Forbidden");

    const observations = await ctx.db
      .query("masteryObservations")
      .withIndex("by_scholar_current", (q) =>
        q.eq("scholarId", args.scholarId).eq("isSuperseded", false)
      )
      .collect();

    return observations.filter(
      (o) => o.standardIds && o.standardIds.length > 0
    );
  },
});

/**
 * Get all current observations that have no standardIds linked (for backfill).
 */
export const unmappedObservations = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("masteryObservations").collect();
    return all.filter(
      (o) => !o.isSuperseded && (!o.standardIds || o.standardIds.length === 0)
    );
  },
});

/**
 * Get all current (non-superseded) observations regardless of standardIds (for re-backfill).
 */
export const allCurrentObservations = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("masteryObservations").collect();
    return all.filter((o) => !o.isSuperseded);
  },
});

/**
 * Clear standardIds on an observation (for re-backfill).
 */
export const clearStandardIds = internalMutation({
  args: { observationId: v.id("masteryObservations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.observationId, { standardIds: undefined });
  },
});

/**
 * Get a single observation by ID (used by standards mapper).
 */
export const getById = internalQuery({
  args: { observationId: v.id("masteryObservations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.observationId);
  },
});

/**
 * Patch standardIds onto an existing observation (used by standards mapper).
 */
export const patchStandardIds = internalMutation({
  args: {
    observationId: v.id("masteryObservations"),
    standardIds: v.array(v.id("standards")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.observationId, {
      standardIds: args.standardIds,
    });
  },
});

/**
 * Get all observations for a project (for inline display in teacher view).
 */
export const byProject = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("masteryObservations")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});
