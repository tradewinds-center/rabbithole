import { v } from "convex/values";
import { authedQuery, authedMutation, teacherMutation } from "./lib/customFunctions";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

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

    const id = await ctx.db.insert("projects", {
      userId: ownerUserId,
      unitId: args.unitId,
      title,
      isArchived: false,
    });

    // Initialize process state if unit has a process
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
