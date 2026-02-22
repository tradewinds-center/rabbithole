import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { authedQuery, authedMutation, teacherMutation } from "./lib/customFunctions";

// ── Self-service token management (any logged-in user) ─────────────────

/**
 * Generate a token for the current user.
 * Scholars create tokens for parent/MCP access to their own data.
 * Teachers create tokens for MCP access to all scholar data.
 */
export const createMyToken = authedMutation({
  args: { label: v.string() },
  handler: async (ctx, args) => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const id = await ctx.db.insert("tokens", {
      token,
      userId: ctx.user._id,
      label: args.label.trim(),
    });

    return { id, token };
  },
});

/**
 * List current user's tokens.
 */
export const myTokens = authedQuery({
  args: {},
  handler: async (ctx) => {
    const tokens = await ctx.db
      .query("tokens")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .collect();

    return tokens.map((t) => ({
      _id: t._id,
      label: t.label,
      createdAt: t._creationTime,
      expiresAt: t.expiresAt,
      token: t.token,
    }));
  },
});

/**
 * Revoke own token.
 */
export const revokeMyToken = authedMutation({
  args: { tokenId: v.id("tokens") },
  handler: async (ctx, args) => {
    const token = await ctx.db.get(args.tokenId);
    if (!token || token.userId !== ctx.user._id) throw new Error("Not found");
    await ctx.db.delete(args.tokenId);
  },
});

// ── Teacher: create token for a scholar (backward compat) ──────────────

export const createForScholar = teacherMutation({
  args: {
    scholarId: v.id("users"),
    label: v.string(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const scholar = await ctx.db.get(args.scholarId);
    if (!scholar || scholar.role !== "scholar") {
      throw new Error("Scholar not found");
    }

    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const id = await ctx.db.insert("tokens", {
      token,
      userId: args.scholarId,
      label: args.label.trim(),
      expiresAt: args.expiresAt,
    });

    return { id, token };
  },
});

/**
 * Teacher lists tokens for a scholar.
 */
export const listForScholar = authedQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const isTeacher = ctx.user.role === "teacher" || ctx.user.role === "admin";
    if (!isTeacher && ctx.user._id !== args.scholarId) throw new Error("Forbidden");

    const tokens = await ctx.db
      .query("tokens")
      .withIndex("by_user", (q) => q.eq("userId", args.scholarId))
      .collect();

    return tokens.map((t) => ({
      _id: t._id,
      label: t.label,
      createdAt: t._creationTime,
      expiresAt: t.expiresAt,
      token: t.token,
    }));
  },
});

/**
 * Revoke a token (teacher can revoke any scholar's token, scholar can revoke own).
 */
export const revokeToken = authedMutation({
  args: { tokenId: v.id("tokens") },
  handler: async (ctx, args) => {
    const token = await ctx.db.get(args.tokenId);
    if (!token) throw new Error("Token not found");

    const isTeacher = ctx.user.role === "teacher" || ctx.user.role === "admin";
    if (!isTeacher && token.userId !== ctx.user._id) throw new Error("Forbidden");

    await ctx.db.delete(args.tokenId);
  },
});

// ── Token validation (internal, called by HTTP actions) ─────────────────

export const validateToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenDoc = await ctx.db
      .query("tokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!tokenDoc) return null;

    if (tokenDoc.expiresAt && Date.now() > tokenDoc.expiresAt) {
      return null;
    }

    const user = await ctx.db.get(tokenDoc.userId);
    if (!user) return null;

    return {
      userId: tokenDoc.userId,
      userName: user.name ?? "User",
      label: tokenDoc.label,
      role: user.role ?? "scholar",
    };
  },
});

// ── Parent-scoped data queries (internal, reused by HTTP parent-api) ────

export const getScholarSummary = internalQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const scholar = await ctx.db.get(args.scholarId);
    if (!scholar) return null;

    const dossier = await ctx.db
      .query("scholarDossiers")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
      .first();

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", args.scholarId))
      .order("desc")
      .take(10);

    const recentPulse = projects.find((p) => p.pulseScore != null);

    const masteryObs = await ctx.db
      .query("masteryObservations")
      .withIndex("by_scholar_current", (q) =>
        q.eq("scholarId", args.scholarId).eq("isSuperseded", false)
      )
      .collect();

    const domains = Array.from(new Set(masteryObs.map((o) => o.domain)));

    return {
      name: scholar.name ?? "Scholar",
      readingLevel: scholar.readingLevel ?? null,
      dateOfBirth: scholar.dateOfBirth ?? null,
      dossier: dossier?.content ?? null,
      recentPulseScore: recentPulse?.pulseScore ?? null,
      totalProjects: projects.length,
      masteryDomainCount: domains.length,
      masteryObservationCount: masteryObs.length,
    };
  },
});

export const getRecentProjects = internalQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user_and_archived", (q) =>
        q.eq("userId", args.scholarId).eq("isArchived", false)
      )
      .order("desc")
      .take(20);

    const result = [];
    for (const p of projects) {
      let unitTitle: string | null = null;
      if (p.unitId) {
        const unit = await ctx.db.get(p.unitId);
        unitTitle = unit?.title ?? null;
      }

      const messages = await ctx.db
        .query("messages")
        .withIndex("by_project", (q) => q.eq("projectId", p._id))
        .collect();

      result.push({
        title: p.title,
        unitTitle,
        pulseScore: p.pulseScore ?? null,
        messageCount: messages.length,
        createdAt: p._creationTime,
        analysisSummary: p.analysisSummary ?? null,
      });
    }

    return result;
  },
});

// ── Teacher-scoped: list all scholars (for teacher MCP) ─────────────────

export const listScholars = internalQuery({
  args: {},
  handler: async (ctx) => {
    const scholars = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "scholar"))
      .collect();

    return scholars.map((s) => ({
      id: s._id,
      name: s.name ?? "Scholar",
      readingLevel: s.readingLevel ?? null,
    }));
  },
});
