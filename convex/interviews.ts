import { v } from "convex/values";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { internalQuery } from "./_generated/server";

/**
 * Create an interview project (projectType: "interview").
 */
export const createInterview = authedMutation({
  args: {},
  handler: async (ctx) => {
    // Get sidekick name for the title
    const sidekick = await ctx.db
      .query("sidekicks")
      .withIndex("by_scholar", (q) => q.eq("scholarId", ctx.user._id))
      .first();

    const sidekickName = sidekick?.name ?? "your Sidekick";
    const title = `Chat with ${sidekickName}`;

    const id = await ctx.db.insert("projects", {
      userId: ctx.user._id,
      title,
      projectType: "interview",
      isArchived: false,
    });

    return { id };
  },
});

/**
 * List interview-type projects for the current user.
 */
export const listInterviews = authedQuery({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user_and_archived", (q) =>
        q.eq("userId", ctx.user._id).eq("isArchived", false)
      )
      .order("desc")
      .collect();

    const interviews = projects.filter((p) => p.projectType === "interview");

    return Promise.all(
      interviews.map(async (project) => {
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();
        const messageCount = messages.filter(
          (m) => m.role === "user" || m.role === "assistant"
        ).length;

        return {
          _id: project._id,
          title: project.title,
          messageCount,
          createdAt: project._creationTime,
          lastMessageAt: project.lastMessageAt ?? project._creationTime,
        };
      })
    );
  },
});

/**
 * Fetch recent messages from interview projects for portrait assessment.
 */
export const getRecentInterviewMessages = internalQuery({
  args: {
    scholarId: v.id("users"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    // Get all interview projects for this scholar
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", args.scholarId))
      .order("desc")
      .collect();

    const interviewProjects = projects.filter((p) => p.projectType === "interview");

    // Collect messages from interview projects, most recent first
    const allMessages: Array<{ role: string; content: string; createdAt: number }> = [];

    for (const project of interviewProjects) {
      if (allMessages.length >= args.limit) break;

      const messages = await ctx.db
        .query("messages")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .order("asc")
        .collect();

      for (const m of messages) {
        if (m.role === "user" || m.role === "assistant") {
          allMessages.push({
            role: m.role,
            content: m.content,
            createdAt: m._creationTime,
          });
        }
      }
    }

    // Return most recent messages up to limit
    return allMessages.slice(-args.limit);
  },
});
