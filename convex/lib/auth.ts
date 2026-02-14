import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

const TEACHER_DOMAIN = "tradewinds.school";
const ADMIN_EMAILS = ["andy@tradewinds.school", "carl@tradewinds.school"];

// DEV ONLY: when no auth cookie is present, fall back to this teacher account.
// Remove this before production!
const DEV_FALLBACK_EMAIL = "test.teacher@tradewinds.school";

/**
 * Determine role from email address
 */
export function roleFromEmail(email: string): "scholar" | "teacher" | "admin" {
  if (ADMIN_EMAILS.includes(email)) return "admin";
  if (email.endsWith(`@${TEACHER_DOMAIN}`)) return "teacher";
  return "scholar";
}

/**
 * Get the currently authenticated user document.
 * Returns null if not authenticated (unless dev fallback is active).
 */
export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId) return await ctx.db.get(userId);

  // DEV FALLBACK: return teacher user when unauthenticated
  const fallback = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", DEV_FALLBACK_EMAIL))
    .first();
  return fallback;
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
  if (user.role !== "teacher" && user.role !== "admin") {
    throw new Error("Forbidden: teacher or admin role required");
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
