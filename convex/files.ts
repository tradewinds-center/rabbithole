import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

/**
 * Generate a short-lived upload URL for file storage.
 * Called by the client before uploading an image.
 */
export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

/**
 * Get a serving URL for a stored file.
 */
export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * Internal query to get a file URL (for the HTTP action).
 */
export const getUrlInternal = internalQuery({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
