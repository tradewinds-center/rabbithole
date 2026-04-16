import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { authedQuery } from "./lib/customFunctions";
import { ROLES } from "./lib/roles";

/**
 * List messages for a project (used by reactive subscribers).
 */
export const listByProject = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return [];

    // Access check
    const isTeacher =
      ctx.user.role === ROLES.TEACHER || ctx.user.role === ROLES.ADMIN;
    if (!isTeacher && project.userId !== ctx.user._id) {
      return [];
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_project", (q) =>
        q.eq("projectId", args.projectId)
      )
      .order("asc")
      .collect();

    return messages.map((m) => ({
      ...m,
      id: m._id,
      createdAt: m._creationTime,
    }));
  },
});

/**
 * Get stream body for persistent-text-streaming.
 * This is a public query used by the useStream hook.
 */
export const getStreamBody = query({
  args: { streamId: v.string() },
  handler: async (ctx, args) => {
    const message = await ctx.db
      .query("messages")
      .withIndex("by_stream", (q) => q.eq("streamId", args.streamId))
      .first();

    if (!message) return null;
    return {
      body: message.content,
      status: message.streamId ? "streaming" : "done",
    };
  },
});

/**
 * Insert a user message (internal, called from chat mutation).
 */
export const insertUserMessage = internalMutation({
  args: {
    projectId: v.id("projects"),
    content: v.string(),
    personaId: v.optional(v.string()),
    unitId: v.optional(v.string()),
    perspectiveId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      projectId: args.projectId,
      role: "user",
      content: args.content,
      personaId: args.personaId,
      unitId: args.unitId,
      perspectiveId: args.perspectiveId,
      flagged: false,
    });
  },
});

/**
 * Insert an assistant message placeholder (internal, called from chat action).
 */
export const insertAssistantPlaceholder = internalMutation({
  args: {
    projectId: v.id("projects"),
    streamId: v.string(),
    personaId: v.optional(v.string()),
    unitId: v.optional(v.string()),
    perspectiveId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      projectId: args.projectId,
      role: "assistant",
      content: "",
      streamId: args.streamId,
      personaId: args.personaId,
      unitId: args.unitId,
      perspectiveId: args.perspectiveId,
      flagged: false,
    });
  },
});

/**
 * Finalize an assistant message after streaming completes.
 */
export const finalizeAssistantMessage = internalMutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
    model: v.optional(v.string()),
    tokensUsed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      content: args.content,
      model: args.model,
      tokensUsed: args.tokensUsed,
      streamId: undefined, // Clear stream ID to mark as done
    });
  },
});

/**
 * Insert a whisper record into the message history.
 * Stored as role:"tool" with toolAction:"whisper" so it's visible
 * to teachers in remote mode but filterable for scholars.
 */
export const insertWhisper = internalMutation({
  args: {
    projectId: v.id("projects"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", {
      projectId: args.projectId,
      role: "tool",
      content: args.content,
      toolAction: "whisper",
      flagged: false,
    });
  },
});

/**
 * Recent messages across all of a scholar's projects (for Activity tab).
 * Returns last 10 user/assistant messages with project context.
 */
export const getRecentByScholar = authedQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const isTeacher = ctx.user.role === ROLES.TEACHER || ctx.user.role === ROLES.ADMIN;
    if (!isTeacher && ctx.user._id !== args.scholarId) return [];

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", args.scholarId))
      .collect();

    // Gather recent messages from each project, then sort globally
    const allMessages: {
      _id: string;
      role: string;
      content: string;
      projectId: string;
      projectTitle: string;
      unitTitle: string | null;
      _creationTime: number;
    }[] = [];

    for (const project of projects) {
      let unitTitle: string | null = null;
      if (project.unitId) {
        const unit = await ctx.db.get(project.unitId);
        unitTitle = unit?.title ?? null;
      }

      const msgs = await ctx.db
        .query("messages")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .order("desc")
        .take(10);

      for (const m of msgs) {
        if (m.role === "user" || m.role === "assistant") {
          allMessages.push({
            _id: m._id,
            role: m.role,
            content: m.content,
            projectId: project._id,
            projectTitle: project.title,
            unitTitle,
            _creationTime: m._creationTime,
          });
        }
      }
    }

    // Sort by creation time descending, take 10
    allMessages.sort((a, b) => b._creationTime - a._creationTime);
    return allMessages.slice(0, 10);
  },
});

/**
 * Update streaming message content (called periodically during stream).
 */
export const updateStreamContent = internalMutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      content: args.content,
    });
  },
});
