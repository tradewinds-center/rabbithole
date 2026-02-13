import {
  customQuery,
  customMutation,
  customAction,
} from "convex-helpers/server/customFunctions";
import { query, mutation, action } from "../_generated/server";
import { getCurrentUser, requireUser, requireTeacher, requireAdmin } from "./auth";
import { Doc } from "../_generated/dataModel";

// ── Authenticated queries/mutations (any logged-in user) ──────────────

export const authedQuery = customQuery(query, {
  args: {},
  input: async (ctx) => {
    const user = await requireUser(ctx);
    return { ctx: { ...ctx, user }, args: {} };
  },
});

export const authedMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const user = await requireUser(ctx);
    return { ctx: { ...ctx, user }, args: {} };
  },
});

export const authedAction = customAction(action, {
  args: {},
  input: async (ctx) => {
    // Actions don't have db access directly, but we can pass user info
    return { ctx, args: {} };
  },
});

// ── Teacher-only queries/mutations ────────────────────────────────────

export const teacherQuery = customQuery(query, {
  args: {},
  input: async (ctx) => {
    const user = await requireTeacher(ctx);
    return { ctx: { ...ctx, user }, args: {} };
  },
});

export const teacherMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const user = await requireTeacher(ctx);
    return { ctx: { ...ctx, user }, args: {} };
  },
});

// ── Admin-only queries/mutations ──────────────────────────────────────

export const adminQuery = customQuery(query, {
  args: {},
  input: async (ctx) => {
    const user = await requireAdmin(ctx);
    return { ctx: { ...ctx, user }, args: {} };
  },
});

export const adminMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const user = await requireAdmin(ctx);
    return { ctx: { ...ctx, user }, args: {} };
  },
});

// Re-export the user type for convenience
export type AuthenticatedUser = Doc<"users">;
