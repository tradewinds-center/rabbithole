import { v } from "convex/values";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Get sidekick for the current user, or for a specific scholar (teacher access).
 */
export const getForScholar = authedQuery({
  args: {
    scholarId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const isTeacher = ctx.user.role === "teacher" || ctx.user.role === "admin";
    const targetId = isTeacher && args.scholarId ? args.scholarId : ctx.user._id;

    return await ctx.db
      .query("sidekicks")
      .withIndex("by_scholar", (q) => q.eq("scholarId", targetId))
      .first();
  },
});

/**
 * Internal query for system prompt injection.
 */
export const getSidekickForScholar = internalQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sidekicks")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
      .first();
  },
});

/**
 * Create or update sidekick fields (name, animal, color, setupComplete).
 */
export const upsert = authedMutation({
  args: {
    name: v.optional(v.string()),
    animal: v.optional(v.string()),
    color: v.optional(v.string()),
    setupComplete: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sidekicks")
      .withIndex("by_scholar", (q) => q.eq("scholarId", ctx.user._id))
      .first();

    if (existing) {
      const patch: Record<string, unknown> = {};
      if (args.name !== undefined) patch.name = args.name;
      if (args.animal !== undefined) patch.animal = args.animal;
      if (args.color !== undefined) patch.color = args.color;
      if (args.setupComplete !== undefined) patch.setupComplete = args.setupComplete;
      await ctx.db.patch(existing._id, patch);

      // Trigger avatar generation if animal+color are now set and no avatar yet
      const updated = await ctx.db.get(existing._id);
      if (updated?.animal && updated?.color && !updated.avatarStorageId && updated.generationStatus !== "generating") {
        await ctx.db.patch(existing._id, { generationStatus: "pending" });
        await ctx.scheduler.runAfter(0, internal.sidekickGenerator.initiateSidekickGeneration, {
          scholarId: ctx.user._id,
        });
      }

      return existing._id;
    } else {
      const id = await ctx.db.insert("sidekicks", {
        scholarId: ctx.user._id,
        name: args.name,
        animal: args.animal,
        color: args.color,
        setupComplete: args.setupComplete ?? false,
        generationStatus: args.animal && args.color ? "pending" : undefined,
      });

      // Trigger avatar generation if we have animal+color
      if (args.animal && args.color) {
        await ctx.scheduler.runAfter(0, internal.sidekickGenerator.initiateSidekickGeneration, {
          scholarId: ctx.user._id,
        });
      }

      return id;
    }
  },
});

/**
 * Internal mutation to update generation status.
 */
export const setGenerationStatus = internalMutation({
  args: {
    sidekickId: v.id("sidekicks"),
    generationStatus: v.union(
      v.literal("pending"),
      v.literal("generating"),
      v.literal("complete"),
      v.literal("failed"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sidekickId, {
      generationStatus: args.generationStatus,
    });
  },
});

/**
 * Internal mutation to store avatar + habitat storage IDs.
 */
export const storeAvatar = internalMutation({
  args: {
    sidekickId: v.id("sidekicks"),
    avatarStorageId: v.optional(v.id("_storage")),
    habitatStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {
      generationStatus: "complete",
    };
    if (args.avatarStorageId) patch.avatarStorageId = args.avatarStorageId;
    if (args.habitatStorageId) patch.habitatStorageId = args.habitatStorageId;
    await ctx.db.patch(args.sidekickId, patch);
  },
});

/**
 * Get avatar/habitat URLs by resolving storage IDs.
 */
export const getAvatarUrl = authedQuery({
  args: {
    scholarId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const isTeacher = ctx.user.role === "teacher" || ctx.user.role === "admin";
    const targetId = isTeacher && args.scholarId ? args.scholarId : ctx.user._id;

    const sidekick = await ctx.db
      .query("sidekicks")
      .withIndex("by_scholar", (q) => q.eq("scholarId", targetId))
      .first();

    if (!sidekick) return null;

    const avatarUrl = sidekick.avatarStorageId
      ? await ctx.storage.getUrl(sidekick.avatarStorageId)
      : null;
    const habitatUrl = sidekick.habitatStorageId
      ? await ctx.storage.getUrl(sidekick.habitatStorageId)
      : null;

    return { avatarUrl, habitatUrl };
  },
});
