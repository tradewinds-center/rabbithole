import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Get the currently authenticated user document.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId) return await ctx.db.get(userId);
  return null;
}

/**
 * Get the currently authenticated user, throwing if not authenticated.
 */
export async function requireUser(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!user) throw new Error("Not authenticated");
  return user;
}

/**
 * Require teacher or admin role.
 */
export async function requireTeacher(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== "teacher" && user.role !== "admin" && user.role !== "curriculum_designer") {
    throw new Error("Forbidden: teacher, admin, or curriculum_designer role required");
  }
  return user;
}

/**
 * Require curriculum access: teacher, admin, or curriculum_designer.
 */
export async function requireCurriculumAccess(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (
    user.role !== "teacher" &&
    user.role !== "admin" &&
    user.role !== "curriculum_designer"
  ) {
    throw new Error("Forbidden: curriculum access required");
  }
  return user;
}

/**
 * Require admin role.
 */
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== "admin") {
    throw new Error("Forbidden: admin role required");
  }
  return user;
}
