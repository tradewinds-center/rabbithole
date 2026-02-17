import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { teacherQuery, teacherMutation } from "./lib/customFunctions";

// ── Public (teacher-authed) ─────────────────────────────────────────

export const getMessages = teacherQuery({
  args: {},
  handler: async (ctx) => {
    const messages = await ctx.db
      .query("curriculumMessages")
      .withIndex("by_teacher", (q) => q.eq("teacherId", ctx.user._id))
      .order("asc")
      .take(200);
    return messages;
  },
});

export const sendMessage = teacherMutation({
  args: { message: v.string() },
  handler: async (ctx, args) => {
    // Insert user message
    await ctx.db.insert("curriculumMessages", {
      teacherId: ctx.user._id,
      role: "user",
      content: args.message,
    });

    // Create stream ID + placeholder assistant message
    const streamId = crypto.randomUUID();
    const assistantMsgId = await ctx.db.insert("curriculumMessages", {
      teacherId: ctx.user._id,
      role: "assistant",
      content: "",
      streamId,
    });

    return { streamId, assistantMsgId: String(assistantMsgId) };
  },
});

export const clearHistory = teacherMutation({
  args: {},
  handler: async (ctx) => {
    const messages = await ctx.db
      .query("curriculumMessages")
      .withIndex("by_teacher", (q) => q.eq("teacherId", ctx.user._id))
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
  },
});

// ── Internal (called by HTTP action) ────────────────────────────────

export const getContext = internalQuery({
  args: { teacherId: v.id("users") },
  handler: async (ctx, args) => {
    const teacher = await ctx.db.get(args.teacherId);
    const messages = await ctx.db
      .query("curriculumMessages")
      .withIndex("by_teacher", (q) => q.eq("teacherId", args.teacherId))
      .order("asc")
      .take(200);

    return {
      teacherName: teacher?.name ?? "Teacher",
      messages: messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    };
  },
});

export const updateStreamContent = internalMutation({
  args: {
    messageId: v.id("curriculumMessages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, { content: args.content });
  },
});

export const finalizeStream = internalMutation({
  args: {
    messageId: v.id("curriculumMessages"),
    content: v.string(),
    model: v.optional(v.string()),
    tokensUsed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!args.content.trim()) {
      await ctx.db.delete(args.messageId);
    } else {
      await ctx.db.patch(args.messageId, {
        content: args.content,
        model: args.model,
        tokensUsed: args.tokensUsed,
        streamId: undefined,
      });
    }
  },
});

// ── Tool data helpers (internal) ────────────────────────────────────

export const listScholarsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const scholars = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "scholar"))
      .collect();

    const result = [];
    for (const s of scholars) {
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_user", (q) => q.eq("userId", s._id))
        .collect();
      const observations = await ctx.db
        .query("observations")
        .withIndex("by_scholar", (q) => q.eq("scholarId", s._id))
        .collect();
      result.push({
        id: s._id,
        name: s.name ?? "Unknown",
        readingLevel: s.readingLevel ?? null,
        projectCount: projects.length,
        observationCount: observations.length,
      });
    }
    return result;
  },
});

export const getScholarMastery = internalQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const observations = await ctx.db
      .query("masteryObservations")
      .withIndex("by_scholar_current", (q) =>
        q.eq("scholarId", args.scholarId).eq("isSuperseded", false)
      )
      .collect();

    const byDomain: Record<
      string,
      { concept: string; level: number; evidence: string }[]
    > = {};
    for (const o of observations) {
      if (!byDomain[o.domain]) byDomain[o.domain] = [];
      byDomain[o.domain].push({
        concept: o.conceptLabel,
        level: o.masteryLevel,
        evidence: o.evidenceSummary,
      });
    }
    return byDomain;
  },
});

export const getScholarSignals = internalQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const signals = await ctx.db
      .query("sessionSignals")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
      .collect();

    const byType: Record<string, { count: number; highCount: number }> = {};
    for (const s of signals) {
      if (!byType[s.signalType]) byType[s.signalType] = { count: 0, highCount: 0 };
      byType[s.signalType].count++;
      if (s.intensity === "high") byType[s.signalType].highCount++;
    }
    return byType;
  },
});

export const getScholarSeeds = internalQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const seeds = await ctx.db
      .query("seeds")
      .withIndex("by_scholar_status", (q) =>
        q.eq("scholarId", args.scholarId)
      )
      .collect();

    return seeds
      .filter((s) => s.status === "active" || s.status === "pending")
      .map((s) => ({
        topic: s.topic,
        domain: s.domain ?? null,
        rationale: s.rationale,
        status: s.status,
      }));
  },
});

export const getScholarObservations = internalQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const observations = await ctx.db
      .query("observations")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
      .order("desc")
      .take(20);

    return observations.map((o) => ({
      note: o.note,
      type: o.type,
      createdAt: o._creationTime,
    }));
  },
});

export const getScholarDossier = internalQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const dossier = await ctx.db
      .query("scholarDossiers")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
      .first();
    return dossier?.content ?? "No dossier data available yet.";
  },
});

export const listUnitsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const units = await ctx.db.query("units").collect();
    const result = [];
    for (const u of units) {
      const persona = u.personaId ? await ctx.db.get(u.personaId) : null;
      const perspective = u.perspectiveId ? await ctx.db.get(u.perspectiveId) : null;
      const process = u.processId ? await ctx.db.get(u.processId) : null;
      result.push({
        id: u._id,
        title: u.title,
        description: u.description ?? null,
        targetBloomLevel: u.targetBloomLevel ?? null,
        isActive: u.isActive,
        personaTitle: persona?.title ?? null,
        perspectiveTitle: perspective?.title ?? null,
        processTitle: process?.title ?? null,
      });
    }
    return result;
  },
});

export const getUnitDetails = internalQuery({
  args: { unitId: v.id("units") },
  handler: async (ctx, args) => {
    const unit = await ctx.db.get(args.unitId);
    if (!unit) return null;

    const persona = unit.personaId ? await ctx.db.get(unit.personaId) : null;
    const perspective = unit.perspectiveId ? await ctx.db.get(unit.perspectiveId) : null;
    const process = unit.processId ? await ctx.db.get(unit.processId) : null;

    return {
      title: unit.title,
      description: unit.description ?? null,
      systemPrompt: unit.systemPrompt ?? null,
      rubric: unit.rubric ?? null,
      targetBloomLevel: unit.targetBloomLevel ?? null,
      persona: persona ? { title: persona.title, emoji: persona.emoji, systemPrompt: persona.systemPrompt ?? null } : null,
      perspective: perspective ? { title: perspective.title, icon: perspective.icon ?? null, systemPrompt: perspective.systemPrompt ?? null } : null,
      process: process ? { title: process.title, emoji: process.emoji ?? null, steps: process.steps } : null,
    };
  },
});
