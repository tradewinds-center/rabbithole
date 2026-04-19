import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { authedQuery, authedMutation, teacherQuery, teacherMutation, adminMutation, adminQuery } from "./lib/customFunctions";
import { getCurrentUser } from "./lib/auth";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ROLES, type Role } from "./lib/roles";

/**
 * Pre-register a user with an invite code.
 * Creates the user record so that the auth callback finds it by username
 * instead of trying to create a new one (which is blocked when SIGNUP_CODE is set).
 */
export const registerWithCode = mutation({
  args: {
    username: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const codeToRole: Array<{ envCode: string | undefined; role: Role }> = [
      { envCode: process.env.SIGNUP_CODE, role: ROLES.SCHOLAR },
      { envCode: process.env.DESIGNER_SIGNUP_CODE, role: ROLES.CURRICULUM_DESIGNER },
      { envCode: process.env.TEACHER_SIGNUP_CODE, role: ROLES.TEACHER },
    ];

    const anyCodeConfigured = codeToRole.some((entry) => entry.envCode);
    if (!anyCodeConfigured) {
      // No code required — nothing to do, auth callback will create the user
      return;
    }

    const submitted = args.code.toLowerCase();
    const matched = codeToRole.find(
      (entry) => entry.envCode && entry.envCode.toLowerCase() === submitted,
    );
    if (!matched) {
      throw new Error("Invalid invite code");
    }

    const username = args.username.trim();
    if (!username) throw new Error("Username is required");

    // Check if user already exists
    const existing = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("username"), username))
      .unique();
    if (existing) {
      // Already exists (seeded or previously registered) — that's fine
      return;
    }

    await ctx.db.insert("users", {
      username,
      name: username,
      role: matched.role,
    });
  },
});

/**
 * Get the current authenticated user document.
 */
export const currentUser = query({
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

/**
 * Store / update user on login.
 * Called after successful auth — creates user if new, updates if existing.
 */
export const storeUser = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db.get(userId);
    if (existing) {
      await ctx.db.patch(userId, {
        name: args.name,
        image: args.image,
      });
      return userId;
    }

    await ctx.db.patch(userId, {
      email: args.email,
      name: args.name,
      image: args.image,
    });
    return userId;
  },
});

/**
 * List all scholars (for teacher dashboard).
 * Returns scholars with project counts and status.
 */
export const listScholars = teacherQuery({
  args: {},
  handler: async (ctx) => {
    const scholars = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", ROLES.SCHOLAR))
      .collect();

    const scholarData = await Promise.all(
      scholars.map(async (scholar) => {
        // Get projects (most recent 5, non-archived)
        const allProjects = await ctx.db
          .query("projects")
          .withIndex("by_user", (q) => q.eq("userId", scholar._id))
          .order("desc")
          .collect();

        const activeProjects = allProjects.filter((c) => !c.isArchived).slice(0, 5);

        // Count messages across all projects
        let messageCount = 0;
        for (const proj of allProjects) {
          const msgs = await ctx.db
            .query("messages")
            .withIndex("by_project", (q) =>
              q.eq("projectId", proj._id)
            )
            .collect();
          messageCount += msgs.length;
        }

        // Get status summary, pulse score, last message, and lastMessageAt from most recent project
        const mostRecent = activeProjects[0];
        const statusSummary = mostRecent?.analysisSummary ?? null;
        const pulseScore = mostRecent?.pulseScore ?? null;
        let lastMessage: string | null = null;
        let lastMessageAt: number | null = null;
        if (mostRecent) {
          const msgs = await ctx.db
            .query("messages")
            .withIndex("by_project", (q) =>
              q.eq("projectId", mostRecent._id)
            )
            .order("desc")
            .collect();
          const lastUserMsg = msgs.find((m) => m.role === "user");
          if (lastUserMsg) {
            const text = lastUserMsg.content;
            lastMessage = text.length > 120 ? text.slice(0, 120) + "..." : text;
            lastMessageAt = lastUserMsg._creationTime;
          }
        }

        // Get process state from most recent project (resolve via unit's building block)
        let processStep: string | null = null;
        let processTitle: string | null = null;
        if (mostRecent?.unitId) {
          const unit = await ctx.db.get(mostRecent.unitId);
          if (unit?.processId) {
            const pState = await ctx.db
              .query("processState")
              .withIndex("by_project", (q) =>
                q.eq("projectId", mostRecent._id)
              )
              .first();
            if (pState) {
              processStep = pState.currentStep;
              const process = await ctx.db.get(unit.processId);
              processTitle = process?.title ?? null;
            }
          }
        }

        return {
          _id: scholar._id,
          id: scholar._id,
          username: scholar.username ?? null,
          name: scholar.name,
          image: scholar.image,
          readingLevel: scholar.readingLevel ?? null,
          dateOfBirth: scholar.dateOfBirth ?? null,
          projectCount: activeProjects.length,
          messageCount,
          lastActive: mostRecent?._creationTime ?? scholar._creationTime,
          statusSummary,
          pulseScore,
          lastMessage,
          lastMessageAt,
          lastProjectTitle: mostRecent?.title ?? null,
          processStep,
          processTitle,
        };
      })
    );

    // Sort by name
    scholarData.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    return scholarData;
  },
});

/**
 * Get a single user by ID.
 */
export const getUser = authedQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * Update user role (admin only).
 */
export const updateRole = adminMutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal(ROLES.SCHOLAR),
      v.literal(ROLES.TEACHER),
      v.literal(ROLES.ADMIN),
      v.literal(ROLES.CURRICULUM_DESIGNER)
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { role: args.role });
  },
});

/**
 * Fix role for a user (no auth required — run via CLI).
 * Usage: npx convex run users:fixRole '{"userId":"<id>","role":"admin"}'
 */
export const fixRole = internalMutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal(ROLES.SCHOLAR), v.literal(ROLES.TEACHER), v.literal(ROLES.ADMIN), v.literal(ROLES.CURRICULUM_DESIGNER)),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error(`No user found with id: ${args.userId}`);
    await ctx.db.patch(args.userId, { role: args.role });
    return { updated: args.userId, name: user.name, role: args.role };
  },
});

/** Internal: delete a user by ID (CLI only). */
export const internalDeleteUser = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error(`No user found with id: ${args.userId}`);
    await ctx.db.delete(args.userId);
    return { deleted: args.userId, name: user.name, email: user.email };
  },
});

/** Internal: list users (for CLI debugging). */
export const internalListUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({ _id: u._id, name: u.name, username: u.username, role: u.role }));
  },
});

/**
 * List all users (admin only).
 */
export const listAllUsers = adminQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      username: u.username ?? null,
      name: u.name ?? null,
      role: u.role ?? ROLES.SCHOLAR,
      _creationTime: u._creationTime,
    }));
  },
});

/**
 * Delete a user and all associated data (admin only).
 * Cascading delete: projects (with messages, artifacts, analyses, processState),
 * observations, mastery, seeds, signals, connections, dossiers, reports,
 * focus settings, and auth sessions/accounts.
 */
export const deleteUser = adminMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Prevent self-deletion
    if (args.userId === ctx.user._id) {
      throw new Error("Cannot delete yourself");
    }

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) throw new Error("User not found");

    // 1. Delete all projects and their children (messages, artifacts, analyses, processState)
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const project of projects) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();
      for (const msg of messages) await ctx.db.delete(msg._id);

      const artifacts = await ctx.db
        .query("artifacts")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();
      for (const a of artifacts) await ctx.db.delete(a._id);

      const analyses = await ctx.db
        .query("analyses")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();
      for (const a of analyses) await ctx.db.delete(a._id);

      const processStates = await ctx.db
        .query("processState")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();
      for (const ps of processStates) await ctx.db.delete(ps._id);

      await ctx.db.delete(project._id);
    }

    // 2. Delete observations (as scholar or teacher)
    const obsAsScholar = await ctx.db
      .query("observations")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.userId))
      .collect();
    for (const o of obsAsScholar) await ctx.db.delete(o._id);

    const obsAsTeacher = await ctx.db
      .query("observations")
      .withIndex("by_teacher", (q) => q.eq("teacherId", args.userId))
      .collect();
    for (const o of obsAsTeacher) await ctx.db.delete(o._id);

    // 3. Delete mastery observations + teacher overrides
    const mastery = await ctx.db
      .query("masteryObservations")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.userId))
      .collect();
    for (const m of mastery) {
      // Delete any teacher overrides for this observation
      const overrides = await ctx.db
        .query("teacherMasteryOverrides")
        .withIndex("by_scholar", (q) => q.eq("scholarId", args.userId))
        .collect();
      for (const ov of overrides) await ctx.db.delete(ov._id);
      await ctx.db.delete(m._id);
    }

    // 4. Delete seeds
    const seeds = await ctx.db
      .query("seeds")
      .withIndex("by_scholar_status", (q) => q.eq("scholarId", args.userId))
      .collect();
    for (const s of seeds) await ctx.db.delete(s._id);

    // 5. Delete session signals
    const signals = await ctx.db
      .query("sessionSignals")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.userId))
      .collect();
    for (const s of signals) await ctx.db.delete(s._id);

    // 6. Delete cross-domain connections
    const connections = await ctx.db
      .query("crossDomainConnections")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.userId))
      .collect();
    for (const c of connections) await ctx.db.delete(c._id);

    // 7. Delete scholar dossiers
    const dossiers = await ctx.db
      .query("scholarDossiers")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.userId))
      .collect();
    for (const d of dossiers) await ctx.db.delete(d._id);

    // 8. Delete reports (as scholar or teacher)
    const reportsAsScholar = await ctx.db
      .query("reports")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.userId))
      .collect();
    for (const r of reportsAsScholar) await ctx.db.delete(r._id);

    // 9. Delete focus settings (if teacher)
    const focusSettings = await ctx.db
      .query("focusSettings")
      .filter((q) => q.eq(q.field("teacherId"), args.userId))
      .collect();
    for (const f of focusSettings) await ctx.db.delete(f._id);

    // 10. Delete auth sessions and accounts
    const sessions = await ctx.db
      .query("authSessions")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .collect();
    for (const s of sessions) {
      // Delete refresh tokens for this session
      const refreshTokens = await ctx.db
        .query("authRefreshTokens")
        .filter((q) => q.eq(q.field("sessionId"), s._id))
        .collect();
      for (const rt of refreshTokens) await ctx.db.delete(rt._id);
      await ctx.db.delete(s._id);
    }

    const accounts = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .collect();
    for (const a of accounts) {
      // Delete verification codes for this account
      const codes = await ctx.db
        .query("authVerificationCodes")
        .filter((q) => q.eq(q.field("accountId"), a._id))
        .collect();
      for (const c of codes) await ctx.db.delete(c._id);
      await ctx.db.delete(a._id);
    }

    // 11. Finally, delete the user
    await ctx.db.delete(args.userId);

    return { deleted: true, name: targetUser.name ?? targetUser.username ?? "Unknown" };
  },
});

/**
 * Update the current user's profile.
 * Scholars can update their own name, dateOfBirth, image.
 * Reading level is teacher-only (use scholars.updateReadingLevel).
 */
export const updateProfile = authedMutation({
  args: {
    name: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    profileSetupComplete: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, string | boolean | undefined | null> = {};
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.dateOfBirth !== undefined) patch.dateOfBirth = args.dateOfBirth;
    if (args.imageStorageId !== undefined) {
      const url = await ctx.storage.getUrl(args.imageStorageId);
      if (url) patch.image = url;
    }
    if (args.profileSetupComplete !== undefined) {
      patch.profileSetupComplete = args.profileSetupComplete;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(ctx.user._id, patch);
    }
  },
});

/**
 * Reset a scholar's password (teacher only).
 * Deletes auth accounts + sessions so the next login creates a fresh auth account.
 * Sets mustResetPassword flag so the scholar is prompted to set a new password.
 * Returns a random 4-digit temp PIN.
 */
export const resetScholarPassword = teacherMutation({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const scholar = await ctx.db.get(args.scholarId);
    if (!scholar) throw new Error("Scholar not found");
    if (scholar.role !== ROLES.SCHOLAR) throw new Error("Can only reset scholar passwords");

    // Generate random 4-digit PIN
    const tempPassword = String(Math.floor(1000 + Math.random() * 9000));

    // Delete auth sessions + refresh tokens
    const sessions = await ctx.db
      .query("authSessions")
      .filter((q) => q.eq(q.field("userId"), args.scholarId))
      .collect();
    for (const s of sessions) {
      const refreshTokens = await ctx.db
        .query("authRefreshTokens")
        .filter((q) => q.eq(q.field("sessionId"), s._id))
        .collect();
      for (const rt of refreshTokens) await ctx.db.delete(rt._id);
      await ctx.db.delete(s._id);
    }

    // Delete auth accounts + verification codes
    const accounts = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("userId"), args.scholarId))
      .collect();
    for (const a of accounts) {
      const codes = await ctx.db
        .query("authVerificationCodes")
        .filter((q) => q.eq(q.field("accountId"), a._id))
        .collect();
      for (const c of codes) await ctx.db.delete(c._id);
      await ctx.db.delete(a._id);
    }

    // Set mustResetPassword flag
    await ctx.db.patch(args.scholarId, { mustResetPassword: true });

    return { tempPassword };
  },
});

/**
 * Delete the current user's auth accounts + sessions.
 * Called by the client right before signOut + signUp with a new password.
 * Clears the mustResetPassword flag.
 */
export const deleteMyAuthAccounts = authedMutation({
  args: {},
  handler: async (ctx) => {
    const userId = ctx.user._id;

    // Delete auth sessions + refresh tokens
    const sessions = await ctx.db
      .query("authSessions")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
    for (const s of sessions) {
      const refreshTokens = await ctx.db
        .query("authRefreshTokens")
        .filter((q) => q.eq(q.field("sessionId"), s._id))
        .collect();
      for (const rt of refreshTokens) await ctx.db.delete(rt._id);
      await ctx.db.delete(s._id);
    }

    // Delete auth accounts + verification codes
    const accounts = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
    for (const a of accounts) {
      const codes = await ctx.db
        .query("authVerificationCodes")
        .filter((q) => q.eq(q.field("accountId"), a._id))
        .collect();
      for (const c of codes) await ctx.db.delete(c._id);
      await ctx.db.delete(a._id);
    }

    // Clear the mustResetPassword flag
    await ctx.db.patch(userId, { mustResetPassword: false });
  },
});

/**
 * Create a new scholar user (teacher only).
 */
export const createScholar = teacherMutation({
  args: {
    name: v.string(),
    username: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.db.insert("users", {
      name: args.name.trim(),
      username: args.username?.trim(),
      role: ROLES.SCHOLAR,
    });
    return { userId };
  },
});
