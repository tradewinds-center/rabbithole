import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { curriculumQuery, curriculumMutation } from "./lib/customFunctions";
import { ROLES } from "./lib/roles";

// ── Public (teacher-authed) ─────────────────────────────────────────

export const getMessages = curriculumQuery({
  args: {},
  handler: async (ctx) => {
    // Global (unscoped) thread: only rows without a scholarId.
    const messages = await ctx.db
      .query("curriculumMessages")
      .withIndex("by_teacher", (q) => q.eq("teacherId", ctx.user._id))
      .order("asc")
      .take(200);
    return messages.filter((m) => m.scholarId === undefined && m.unitId === undefined);
  },
});

/**
 * Messages for a scholar-scoped thread. Teacher/admin/curriculum_designer only.
 *
 * `threadLabel` is reserved for multi-thread-per-scholar — for now, pass
 * nothing (or an empty string) and we return messages with no threadLabel
 * (the primary thread).
 */
export const listMessagesForScholar = curriculumQuery({
  args: {
    scholarId: v.id("users"),
    threadLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const label = args.threadLabel?.trim() || undefined;
    const messages = await ctx.db
      .query("curriculumMessages")
      .withIndex("by_scholar_and_creation", (q) =>
        q.eq("scholarId", args.scholarId)
      )
      .order("asc")
      .take(400);
    // Only show messages authored by the current teacher for their own thread.
    // Admins can see everything (useful for debugging / supervision).
    const teacherFiltered = ctx.user.role === ROLES.ADMIN
      ? messages
      : messages.filter((m) => m.teacherId === ctx.user._id);
    return teacherFiltered.filter(
      (m) => (m.threadLabel ?? undefined) === label
    );
  },
});

export const sendMessage = curriculumMutation({
  args: {
    message: v.string(),
    // Optional scholar scoping — when set, this message joins the
    // scholar-scoped thread (see listMessagesForScholar).
    scholarId: v.optional(v.id("users")),
    threadLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const label = args.threadLabel?.trim() || undefined;

    // Insert user message
    await ctx.db.insert("curriculumMessages", {
      teacherId: ctx.user._id,
      scholarId: args.scholarId,
      threadLabel: label,
      role: "user",
      content: args.message,
    });

    // Create stream ID + placeholder assistant message
    const streamId = crypto.randomUUID();
    const assistantMsgId = await ctx.db.insert("curriculumMessages", {
      teacherId: ctx.user._id,
      scholarId: args.scholarId,
      threadLabel: label,
      role: "assistant",
      content: "",
      streamId,
    });

    return { streamId, assistantMsgId: String(assistantMsgId) };
  },
});

export const clearHistory = curriculumMutation({
  args: {
    // When set, clears only the scholar-scoped thread; otherwise clears the
    // global (unscoped) thread for this teacher.
    scholarId: v.optional(v.id("users")),
    threadLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const label = args.threadLabel?.trim() || undefined;

    if (args.scholarId) {
      const messages = await ctx.db
        .query("curriculumMessages")
        .withIndex("by_scholar_and_creation", (q) =>
          q.eq("scholarId", args.scholarId)
        )
        .collect();
      for (const msg of messages) {
        if (msg.teacherId !== ctx.user._id && ctx.user.role !== ROLES.ADMIN) continue;
        if ((msg.threadLabel ?? undefined) !== label) continue;
        await ctx.db.delete(msg._id);
      }
      return;
    }

    const messages = await ctx.db
      .query("curriculumMessages")
      .withIndex("by_teacher", (q) => q.eq("teacherId", ctx.user._id))
      .collect();
    for (const msg of messages) {
      if (msg.scholarId !== undefined || msg.unitId !== undefined) continue;
      await ctx.db.delete(msg._id);
    }
  },
});

// ── Unit-scoped messages (for Unit Designer chat) ───────────────────

export const getMessagesByUnit = curriculumQuery({
  args: { unitId: v.id("units") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("curriculumMessages")
      .withIndex("by_teacher_unit", (q) =>
        q.eq("teacherId", ctx.user._id).eq("unitId", args.unitId)
      )
      .order("asc")
      .take(200);
    return messages;
  },
});

export const sendMessageForUnit = curriculumMutation({
  args: { message: v.string(), unitId: v.id("units") },
  handler: async (ctx, args) => {
    await ctx.db.insert("curriculumMessages", {
      teacherId: ctx.user._id,
      unitId: args.unitId,
      role: "user",
      content: args.message,
    });

    const streamId = crypto.randomUUID();
    const assistantMsgId = await ctx.db.insert("curriculumMessages", {
      teacherId: ctx.user._id,
      unitId: args.unitId,
      role: "assistant",
      content: "",
      streamId,
    });

    return { streamId, assistantMsgId: String(assistantMsgId) };
  },
});

export const clearHistoryForUnit = curriculumMutation({
  args: { unitId: v.id("units") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("curriculumMessages")
      .withIndex("by_teacher_unit", (q) =>
        q.eq("teacherId", ctx.user._id).eq("unitId", args.unitId)
      )
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
  },
});

export const getUnitDesignerContext = internalQuery({
  args: { teacherId: v.id("users"), unitId: v.id("units") },
  handler: async (ctx, args) => {
    const teacher = await ctx.db.get(args.teacherId);
    const unit = await ctx.db.get(args.unitId);
    if (!unit) return null;

    const messages = await ctx.db
      .query("curriculumMessages")
      .withIndex("by_teacher_unit", (q) =>
        q.eq("teacherId", args.teacherId).eq("unitId", args.unitId)
      )
      .order("asc")
      .take(200);

    // Get lessons for this unit
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_unit", (q) => q.eq("unitId", args.unitId))
      .collect();

    const lessonsWithProcess = await Promise.all(
      lessons.sort((a, b) => a.order - b.order).map(async (l) => {
        const process = l.processId ? await ctx.db.get(l.processId) : null;
        return {
          ...l,
          processTitle: process?.title ?? null,
          processEmoji: process?.emoji ?? null,
        };
      })
    );

    // Get available processes
    const processes = await ctx.db
      .query("processes")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    return {
      teacherName: teacher?.name ?? "Teacher",
      unit,
      lessons: lessonsWithProcess,
      processes: processes.map((p) => ({
        id: String(p._id),
        title: p.title,
        emoji: p.emoji ?? "",
        steps: p.steps.map((s) => s.title).join(" → "),
      })),
      messages: messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    };
  },
});

// ── Internal (called by HTTP action) ────────────────────────────────

export const getContext = internalQuery({
  args: {
    teacherId: v.id("users"),
    scholarId: v.optional(v.id("users")),
    threadLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const teacher = await ctx.db.get(args.teacherId);
    const label = args.threadLabel?.trim() || undefined;

    // Pick the right thread. If scholarId is set, we want messages with
    // (scholarId, threadLabel). Otherwise the global (unscoped) thread.
    let messages;
    if (args.scholarId) {
      const scholarMessages = await ctx.db
        .query("curriculumMessages")
        .withIndex("by_scholar_and_creation", (q) =>
          q.eq("scholarId", args.scholarId)
        )
        .order("asc")
        .take(400);
      messages = scholarMessages.filter(
        (m) =>
          m.teacherId === args.teacherId &&
          (m.threadLabel ?? undefined) === label
      );
    } else {
      const teacherMessages = await ctx.db
        .query("curriculumMessages")
        .withIndex("by_teacher", (q) => q.eq("teacherId", args.teacherId))
        .order("asc")
        .take(400);
      messages = teacherMessages.filter(
        (m) => m.scholarId === undefined && m.unitId === undefined
      );
    }

    // Scholar context (pre-loaded so the system prompt can include it).
    let scholarContext:
      | null
      | {
          scholarId: Id<"users">;
          scholarName: string;
          readingLevel: string | null;
          dossier: string;
          directives: { label: string; content: string }[];
          seeds: {
            topic: string;
            domain: string | null;
            rationale: string;
            approachHint: string | null;
          }[];
          recentObservations: { note: string; type: string; createdAt: number }[];
        } = null;

    if (args.scholarId) {
      const scholar = await ctx.db.get(args.scholarId);
      if (scholar) {
        const dossier = await ctx.db
          .query("scholarDossiers")
          .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId!))
          .first();

        const directives = await ctx.db
          .query("teacherDirectives")
          .withIndex("by_scholar_active", (q) =>
            q.eq("scholarId", args.scholarId!).eq("isActive", true)
          )
          .collect();
        directives.sort((a, b) => a._creationTime - b._creationTime);

        const allSeeds = await ctx.db
          .query("seeds")
          .withIndex("by_scholar_status", (q) =>
            q.eq("scholarId", args.scholarId!)
          )
          .collect();
        const seeds = allSeeds
          .filter((s) => s.status === "active" || s.status === "pending")
          .map((s) => ({
            topic: s.topic,
            domain: s.domain ?? null,
            rationale: s.rationale,
            approachHint: s.approachHint ?? null,
          }));

        const observations = await ctx.db
          .query("observations")
          .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId!))
          .order("desc")
          .take(20);

        scholarContext = {
          scholarId: args.scholarId,
          scholarName: scholar.name ?? "this scholar",
          readingLevel: scholar.readingLevel ?? null,
          dossier: dossier?.content ?? "No dossier data available yet.",
          directives: directives.map((d) => ({
            label: d.label,
            content: d.content,
          })),
          seeds,
          recentObservations: observations.map((o) => ({
            note: o.note,
            type: o.type,
            createdAt: o._creationTime,
          })),
        };
      }
    }

    return {
      teacherName: teacher?.name ?? "Teacher",
      messages: messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      scholarContext,
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
      .withIndex("by_role", (q) => q.eq("role", ROLES.SCHOLAR))
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
        scholarId: u.scholarId ?? null,
        personaTitle: persona?.title ?? null,
        perspectiveTitle: perspective?.title ?? null,
        processTitle: process?.title ?? null,
      });
    }
    return result;
  },
});

// ── Internal mutations (called by unit-designer-stream HTTP action) ───

export const updateUnitInternal = internalMutation({
  args: {
    unitId: v.id("units"),
    bigIdea: v.optional(v.union(v.string(), v.null())),
    essentialQuestions: v.optional(v.array(v.string())),
    enduringUnderstandings: v.optional(v.array(v.string())),
    subject: v.optional(v.union(v.string(), v.null())),
    gradeLevel: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const { unitId, ...fields } = args;
    const updates: Record<string, unknown> = {};
    if (fields.bigIdea !== undefined) updates.bigIdea = fields.bigIdea ?? undefined;
    if (fields.essentialQuestions !== undefined) updates.essentialQuestions = fields.essentialQuestions;
    if (fields.enduringUnderstandings !== undefined) updates.enduringUnderstandings = fields.enduringUnderstandings;
    if (fields.subject !== undefined) updates.subject = fields.subject ?? undefined;
    if (fields.gradeLevel !== undefined) updates.gradeLevel = fields.gradeLevel ?? undefined;
    await ctx.db.patch(unitId, updates);
  },
});

export const createLessonInternal = internalMutation({
  args: {
    unitId: v.id("units"),
    title: v.string(),
    strand: v.optional(v.union(
      v.literal("core"), v.literal("connections"),
      v.literal("practice"), v.literal("identity")
    )),
    processId: v.optional(v.id("processes")),
    systemPrompt: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
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

export const updateLessonInternal = internalMutation({
  args: {
    lessonId: v.id("lessons"),
    title: v.optional(v.string()),
    strand: v.optional(v.union(
      v.literal("core"), v.literal("connections"),
      v.literal("practice"), v.literal("identity"),
      v.null()
    )),
    processId: v.optional(v.union(v.id("processes"), v.null())),
    systemPrompt: v.optional(v.union(v.string(), v.null())),
    durationMinutes: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const { lessonId, ...fields } = args;
    const updates: Record<string, unknown> = {};
    if (fields.title !== undefined) updates.title = fields.title.trim();
    if (fields.strand !== undefined) updates.strand = fields.strand ?? undefined;
    if (fields.processId !== undefined) updates.processId = fields.processId ?? undefined;
    if (fields.systemPrompt !== undefined) updates.systemPrompt = fields.systemPrompt?.trim() || undefined;
    if (fields.durationMinutes !== undefined) updates.durationMinutes = fields.durationMinutes ?? undefined;
    await ctx.db.patch(lessonId, updates);
  },
});

export const deleteLessonInternal = internalMutation({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.lessonId);
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
