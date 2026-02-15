import { v } from "convex/values";
import { authedQuery, authedMutation, teacherMutation } from "./lib/customFunctions";
import { internal } from "./_generated/api";

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

    // Enrich with persona emoji for sidebar display
    return Promise.all(
      projects.map(async (project) => {
        let personaEmoji: string | null = null;
        if (project.personaId) {
          const persona = await ctx.db.get(project.personaId);
          personaEmoji = persona?.emoji ?? null;
        }
        return {
          ...project,
          id: project._id,
          updatedAt: project._creationTime,
          personaEmoji,
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
    personaId: v.optional(v.id("personas")),
    perspectiveId: v.optional(v.id("perspectives")),
    processId: v.optional(v.id("processes")),
  },
  handler: async (ctx, args) => {
    const isTeacher =
      ctx.user.role === "teacher" || ctx.user.role === "admin";
    const ownerUserId =
      isTeacher && args.userId ? args.userId : ctx.user._id;

    // Get unit title if linked
    let title = "New Project";
    if (args.unitId) {
      const unit = await ctx.db.get(args.unitId);
      if (unit && unit.isActive) {
        title = unit.title;
      }
    }

    const id = await ctx.db.insert("projects", {
      userId: ownerUserId,
      unitId: args.unitId,
      personaId: args.personaId,
      perspectiveId: args.perspectiveId,
      processId: args.processId,
      title,
      isArchived: false,
    });

    // Initialize process state if a process was set
    if (args.processId) {
      await ctx.scheduler.runAfter(0, internal.processState.initialize, {
        projectId: id,
        processId: args.processId,
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
    personaId: v.optional(v.union(v.id("personas"), v.null())),
    perspectiveId: v.optional(v.union(v.id("perspectives"), v.null())),
    processId: v.optional(v.union(v.id("processes"), v.null())),
    teacherWhisper: v.optional(v.union(v.string(), v.null())),
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
    if (args.personaId !== undefined)
      updates.personaId = args.personaId ?? undefined;
    if (args.perspectiveId !== undefined)
      updates.perspectiveId = args.perspectiveId ?? undefined;
    if (args.processId !== undefined)
      updates.processId = args.processId ?? undefined;

    // Only teachers can update these
    if (isTeacher) {
      if (args.teacherWhisper !== undefined)
        updates.teacherWhisper = args.teacherWhisper ?? undefined;
      if (args.readingLevelOverride !== undefined)
        updates.readingLevelOverride = args.readingLevelOverride ?? undefined;
      if (args.analysisSummary !== undefined)
        updates.analysisSummary = args.analysisSummary ?? undefined;
    }

    await ctx.db.patch(args.id, updates);

    // Handle processState when processId changes
    if (args.processId !== undefined) {
      const newProcessId = args.processId;
      if (newProcessId) {
        // Initialize/replace processState
        await ctx.scheduler.runAfter(0, internal.processState.initialize, {
          projectId: args.id,
          processId: newProcessId,
        });
      } else {
        // Remove processState when process is cleared
        await ctx.scheduler.runAfter(0, internal.processState.remove, {
          projectId: args.id,
        });
      }
    }

    return await ctx.db.get(args.id);
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

    // Dimension snapshot (as strings, not IDs, for historical reference)
    const personaId = project.personaId
      ? String(project.personaId)
      : undefined;
    const unitId = project.unitId
      ? String(project.unitId)
      : undefined;
    const perspectiveId = project.perspectiveId
      ? String(project.perspectiveId)
      : undefined;
    const processId = project.processId
      ? String(project.processId)
      : undefined;

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
    });

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
    };
  },
});
