import { v } from "convex/values";
import { authedQuery, authedMutation, teacherMutation, teacherQuery } from "./lib/customFunctions";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

/** Parent password for time limit mode (set via PARENT_PASSWORD env var in Convex dashboard). */
const PARENT_PASSWORD = process.env.PARENT_PASSWORD ?? "";

/**
 * List projects for a user (non-archived, most recent first).
 * Teachers can pass userId to view a scholar's projects (remote mode).
 */
export const list = authedQuery({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const isTeacher =
      ctx.user.role === "teacher" || ctx.user.role === "admin";
    const targetUserId =
      isTeacher && args.userId ? args.userId : ctx.user._id;

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user_and_archived", (q) =>
        q.eq("userId", targetUserId).eq("isArchived", false)
      )
      .order("desc")
      .collect();

    // Enrich with unit info (+ unit's persona emoji) and message count
    return Promise.all(
      projects.map(async (project) => {
        let unitTitle: string | null = null;
        let unitEmoji: string | null = null;
        let personaEmoji: string | null = null;
        if (project.unitId) {
          const unit = await ctx.db.get(project.unitId);
          unitTitle = unit?.title ?? null;
          unitEmoji = unit?.emoji ?? null;
          // Resolve persona from unit's building block
          if (unit?.personaId) {
            const persona = await ctx.db.get(unit.personaId);
            personaEmoji = persona?.emoji ?? null;
          }
        }
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();
        const messageCount = messages.filter(
          (m) => m.role === "user" || m.role === "assistant"
        ).length;

        return {
          ...project,
          id: project._id,
          updatedAt: project._creationTime,
          personaEmoji,
          unitTitle,
          unitEmoji,
          messageCount,
        };
      })
    );
  },
});

/**
 * Get a project with its messages.
 */
export const getWithMessages = authedQuery({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project) throw new Error("Project not found");

    // Access check: scholars can only view their own
    const isTeacher =
      ctx.user.role === "teacher" || ctx.user.role === "admin";
    if (!isTeacher && project.userId !== ctx.user._id) {
      throw new Error("Forbidden");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_project", (q) =>
        q.eq("projectId", args.id)
      )
      .order("asc")
      .collect();

    return {
      project: {
        ...project,
        id: project._id,
      },
      messages: messages.map((m) => ({
        ...m,
        id: m._id,
        createdAt: m._creationTime,
      })),
    };
  },
});

/**
 * Create a new project.
 */
export const create = authedMutation({
  args: {
    userId: v.optional(v.id("users")), // For teacher remote mode
    unitId: v.optional(v.id("units")),
    lessonId: v.optional(v.id("lessons")),
    activityId: v.optional(v.id("focusSettings")),
  },
  handler: async (ctx, args) => {
    const isTeacher =
      ctx.user.role === "teacher" || ctx.user.role === "admin";
    const ownerUserId =
      isTeacher && args.userId ? args.userId : ctx.user._id;

    // Get unit title and process from unit's building block
    let title = "New Project";
    let processId: Id<"processes"> | undefined = undefined;
    if (args.unitId) {
      const unit = await ctx.db.get(args.unitId);
      if (unit && unit.isActive) {
        title = unit.title;
        processId = unit.processId ?? undefined;
      }
    }

    // Lesson overrides: use lesson title and process when present
    if (args.lessonId) {
      const lesson = await ctx.db.get(args.lessonId);
      if (lesson) {
        title = lesson.title;
        if (lesson.processId) processId = lesson.processId;
      }
    }

    const id = await ctx.db.insert("projects", {
      userId: ownerUserId,
      unitId: args.unitId,
      lessonId: args.lessonId,
      activityId: args.activityId,
      title,
      isArchived: false,
    });

    // Initialize process state if unit/lesson has a process
    if (processId) {
      await ctx.scheduler.runAfter(0, internal.processState.initialize, {
        projectId: id,
        processId,
      });
    }

    return { id };
  },
});

/**
 * Update project (title, dimensions, whisper, status).
 * Scholars can update title + dimensions on their own projects.
 * Teachers can update anything on any project.
 */
export const update = authedMutation({
  args: {
    id: v.id("projects"),
    title: v.optional(v.string()),
    unitId: v.optional(v.union(v.id("units"), v.null())),
    activityId: v.optional(v.union(v.id("focusSettings"), v.null())),
    teacherWhisper: v.optional(v.union(v.string(), v.null())),
    pendingWhisper: v.optional(v.union(v.string(), v.null())),
    readingLevelOverride: v.optional(v.union(v.string(), v.null())),
    analysisSummary: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project) throw new Error("Project not found");

    const isTeacher =
      ctx.user.role === "teacher" || ctx.user.role === "admin";

    // Scholars can only update their own projects
    if (!isTeacher && project.userId !== ctx.user._id) {
      throw new Error("Forbidden");
    }

    const updates: Record<string, unknown> = {};

    // Both scholars and teachers can update these
    if (args.title !== undefined) updates.title = args.title;
    if (args.unitId !== undefined)
      updates.unitId = args.unitId ?? undefined;
    if (args.activityId !== undefined)
      updates.activityId = args.activityId ?? undefined;

    // Only teachers can update these
    if (isTeacher) {
      if (args.teacherWhisper !== undefined)
        updates.teacherWhisper = args.teacherWhisper ?? undefined;
      if (args.pendingWhisper !== undefined)
        updates.pendingWhisper = args.pendingWhisper ?? undefined;
      if (args.readingLevelOverride !== undefined)
        updates.readingLevelOverride = args.readingLevelOverride ?? undefined;
      if (args.analysisSummary !== undefined)
        updates.analysisSummary = args.analysisSummary ?? undefined;
    }

    // Handle processState when unitId changes
    if (args.unitId !== undefined) {
      const oldUnit = project.unitId ? await ctx.db.get(project.unitId) : null;
      const newUnit = args.unitId ? await ctx.db.get(args.unitId) : null;
      const oldProcessId = oldUnit?.processId ?? null;
      const newProcessId = newUnit?.processId ?? null;

      if (newProcessId && newProcessId !== oldProcessId) {
        await ctx.scheduler.runAfter(0, internal.processState.initialize, {
          projectId: args.id,
          processId: newProcessId,
        });
      } else if (!newProcessId && oldProcessId) {
        await ctx.scheduler.runAfter(0, internal.processState.remove, {
          projectId: args.id,
        });
      }
    }

    await ctx.db.patch(args.id, updates);

    return await ctx.db.get(args.id);
  },
});

/**
 * Mark a scholar's project as complete/incomplete within an activity.
 * Setting complete=true stamps activityCompletedAt; false clears it.
 */
export const markActivityComplete = teacherMutation({
  args: {
    projectId: v.id("projects"),
    complete: v.boolean(),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");
    await ctx.db.patch(args.projectId, {
      activityCompletedAt: args.complete ? Date.now() : undefined,
    });
  },
});

/**
 * Archive a project (soft delete).
 */
export const archive = authedMutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project) throw new Error("Project not found");

    const isTeacher =
      ctx.user.role === "teacher" || ctx.user.role === "admin";
    if (!isTeacher && project.userId !== ctx.user._id) {
      throw new Error("Forbidden");
    }

    await ctx.db.patch(args.id, { isArchived: true });
  },
});

/**
 * Send a message: saves user message, creates stream ID, inserts placeholder.
 * Returns the streamId so the client can subscribe to streaming.
 * The actual Claude API call happens via the HTTP action.
 */
export const sendMessage = authedMutation({
  args: {
    projectId: v.id("projects"),
    message: v.string(),
    imageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    // Access check: teachers can send in any project, scholars only their own
    const isTeacher =
      ctx.user.role === "teacher" || ctx.user.role === "admin";
    if (!isTeacher && project.userId !== ctx.user._id) {
      throw new Error("Forbidden");
    }

    // Time limit enforcement: reject messages after timer expires
    if (
      !isTeacher &&
      project.sessionTimeLimit &&
      project.sessionStartTime
    ) {
      const elapsed = Date.now() - project.sessionStartTime;
      if (elapsed >= project.sessionTimeLimit * 60 * 1000) {
        throw new Error("Session time limit has expired");
      }
    }

    // Dimension snapshot (as strings, not IDs, for historical reference)
    // Resolve building blocks from the unit
    const unit = project.unitId ? await ctx.db.get(project.unitId) : null;
    const personaId = unit?.personaId ? String(unit.personaId) : undefined;
    const unitId = project.unitId ? String(project.unitId) : undefined;
    const perspectiveId = unit?.perspectiveId ? String(unit.perspectiveId) : undefined;
    const processId = unit?.processId ? String(unit.processId) : undefined;

    // Save user message
    await ctx.db.insert("messages", {
      projectId: args.projectId,
      role: "user",
      content: args.message,
      personaId,
      unitId,
      perspectiveId,
      processId,
      flagged: false,
      ...(args.imageId ? { imageId: args.imageId } : {}),
    });

    // Denormalize last message info onto the project for efficient dashboard queries
    await ctx.db.patch(args.projectId, {
      lastMessageAt: Date.now(),
      lastMessageRole: "user",
      lastMessagePreview: args.message.slice(0, 120) || undefined,
    });

    // If there's a pending whisper, record it between user msg and assistant placeholder
    if (project.pendingWhisper) {
      await ctx.db.insert("messages", {
        projectId: args.projectId,
        role: "tool",
        content: project.pendingWhisper,
        toolAction: "whisper",
        flagged: false,
      });
    }

    // Create stream ID
    const streamId = crypto.randomUUID();

    // Insert placeholder assistant message with stream ID
    const assistantMsgId = await ctx.db.insert("messages", {
      projectId: args.projectId,
      role: "assistant",
      content: "",
      streamId,
      personaId,
      unitId,
      perspectiveId,
      processId,
      flagged: false,
    });

    return {
      streamId,
      assistantMsgId,
      projectId: args.projectId,
      imageId: args.imageId ?? null,
    };
  },
});

/**
 * List all active (non-archived) projects grouped by unitId.
 * Used by teacher Activity View to show which scholars are working on which units.
 */
export const listActiveByUnit = teacherQuery({
  args: {},
  handler: async (ctx) => {
    // Get all non-archived projects
    const allProjects = await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    // Group by unitId
    const byUnit = new Map<string, typeof allProjects>();
    const unassigned: typeof allProjects = [];
    for (const p of allProjects) {
      if (p.unitId) {
        const key = String(p.unitId);
        if (!byUnit.has(key)) byUnit.set(key, []);
        byUnit.get(key)!.push(p);
      } else {
        unassigned.push(p);
      }
    }

    // Resolve each unit group
    const unitGroups = await Promise.all(
      Array.from(byUnit.entries()).map(async ([unitIdStr, projects]) => {
        const unitId = unitIdStr as Id<"units">;
        const unit = await ctx.db.get(unitId);
        if (!unit) return null;

        const process = unit.processId
          ? await ctx.db.get(unit.processId)
          : null;

        const scholars = await Promise.all(
          projects.map(async (proj) => {
            const scholar = await ctx.db.get(proj.userId);
            // Get process state
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
              lastMessageAt: proj.lastMessageAt ?? null,
              lastMessageContent: proj.lastMessagePreview ?? null,
              lastMessageRole: proj.lastMessageRole ?? null,
              processStep: procState?.currentStep ?? null,
              projectTitle: proj.title,
              analysisSummary: proj.analysisSummary ?? null,
              activityId: proj.activityId ? String(proj.activityId) : null,
              activityCompletedAt: proj.activityCompletedAt ?? null,
            };
          })
        );

        return {
          unitId: unit._id,
          unitTitle: unit.title,
          unitEmoji: unit.emoji ?? null,
          unitDescription: unit.description ?? null,
          processId: unit.processId ?? null,
          process: process
            ? {
                title: process.title,
                emoji: process.emoji ?? null,
                steps: process.steps,
              }
            : null,
          durationMinutes: unit.durationMinutes ?? null,
          scholars,
        };
      })
    );

    // Resolve unassigned scholars (projects with no unit)
    const unassignedScholars = await Promise.all(
      unassigned.map(async (proj) => {
        const scholar = await ctx.db.get(proj.userId);
        return {
          scholarId: proj.userId,
          projectId: proj._id,
          projectCreatedAt: proj._creationTime,
          name: scholar?.name ?? null,
          image: scholar?.image ?? null,
          readingLevel: scholar?.readingLevel ?? null,
          dateOfBirth: scholar?.dateOfBirth ?? null,
          pulseScore: proj.pulseScore ?? null,
          lastMessageAt: proj.lastMessageAt ?? null,
          lastMessageContent: proj.lastMessagePreview ?? null,
          lastMessageRole: proj.lastMessageRole ?? null,
          processStep: null,
          projectTitle: proj.title,
          analysisSummary: proj.analysisSummary ?? null,
          activityId: proj.activityId ? String(proj.activityId) : null,
          activityCompletedAt: proj.activityCompletedAt ?? null,
        };
      })
    );

    // Include scholars with no active projects at all
    const allScholars = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "scholar"))
      .collect();
    const scholarsWithProjects = new Set(allProjects.map((p) => String(p.userId)));
    const noProjectScholars = allScholars
      .filter((s) => !scholarsWithProjects.has(String(s._id)))
      .map((s) => ({
        scholarId: s._id,
        projectId: "" as Id<"projects">, // placeholder — no project yet
        projectCreatedAt: s._creationTime,
        name: s.name ?? null,
        image: s.image ?? null,
        readingLevel: s.readingLevel ?? null,
        dateOfBirth: s.dateOfBirth ?? null,
        pulseScore: null,
        lastMessageAt: null,
        lastMessageContent: null,
        lastMessageRole: null,
        processStep: null,
        projectTitle: "",
        analysisSummary: null,
        activityId: null,
        activityCompletedAt: null,
      }));

    return {
      unitGroups: unitGroups.filter(
        (g): g is NonNullable<typeof g> => g !== null
      ),
      unassigned: { scholars: [...unassignedScholars, ...noProjectScholars] },
    };
  },
});

// ── Time Limit Mode ─────────────────────────────────────────────────

/**
 * Set a session time limit (parent password required).
 * Starts the timer immediately.
 */
export const setTimeLimit = authedMutation({
  args: {
    projectId: v.id("projects"),
    minutes: v.number(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.password !== PARENT_PASSWORD) {
      throw new Error("Incorrect parent password");
    }
    if (args.minutes < 1 || args.minutes > 480) {
      throw new Error("Time limit must be between 1 and 480 minutes");
    }
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    await ctx.db.patch(args.projectId, {
      sessionTimeLimit: args.minutes,
      sessionStartTime: Date.now(),
    });
  },
});

/**
 * Clear the session time limit (parent password required).
 */
export const clearTimeLimit = authedMutation({
  args: {
    projectId: v.id("projects"),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.password !== PARENT_PASSWORD) {
      throw new Error("Incorrect parent password");
    }
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    await ctx.db.patch(args.projectId, {
      sessionTimeLimit: undefined,
      sessionStartTime: undefined,
      pendingWhisper: undefined,
    });
  },
});

/**
 * Inject a time-limit whisper (called by frontend when timer is near expiry).
 */
export const injectTimeLimitWhisper = authedMutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    // Only inject if time limit is active and whisper not already set
    if (!project.sessionTimeLimit || !project.sessionStartTime) return;
    if (project.pendingWhisper) return;

    await ctx.db.patch(args.projectId, {
      pendingWhisper:
        "The session time is almost up. Please wrap up the current topic naturally within the next minute. Offer a brief summary of what was discussed and suggest what the scholar could explore next time.",
    });
  },
});
