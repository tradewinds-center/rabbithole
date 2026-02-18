import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { teacherQuery, teacherMutation } from "./lib/customFunctions";

// ── Token CRUD (teacher-authed) ───────────────────────────────────────

export const createToken = teacherMutation({
  args: {
    scholarId: v.id("users"),
    parentName: v.string(),
    parentEmail: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify scholar exists and is actually a scholar
    const scholar = await ctx.db.get(args.scholarId);
    if (!scholar || scholar.role !== "scholar") {
      throw new Error("Scholar not found");
    }

    // Generate a random token (32 hex chars)
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const id = await ctx.db.insert("parentTokens", {
      token,
      scholarId: args.scholarId,
      parentName: args.parentName,
      parentEmail: args.parentEmail,
      createdBy: ctx.user._id,
      expiresAt: args.expiresAt,
    });

    return { id, token };
  },
});

export const listTokens = teacherQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const tokens = await ctx.db
      .query("parentTokens")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
      .collect();

    return tokens.map((t) => ({
      _id: t._id,
      parentName: t.parentName,
      parentEmail: t.parentEmail,
      createdAt: t._creationTime,
      expiresAt: t.expiresAt,
      token: t.token,
    }));
  },
});

export const revokeToken = teacherMutation({
  args: { tokenId: v.id("parentTokens") },
  handler: async (ctx, args) => {
    const token = await ctx.db.get(args.tokenId);
    if (!token) throw new Error("Token not found");
    await ctx.db.delete(args.tokenId);
  },
});

// ── Token validation (internal, called by HTTP actions) ───────────────

export const validateToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenDoc = await ctx.db
      .query("parentTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!tokenDoc) return null;

    // Check expiration
    if (tokenDoc.expiresAt && Date.now() > tokenDoc.expiresAt) {
      return null;
    }

    const scholar = await ctx.db.get(tokenDoc.scholarId);
    if (!scholar) return null;

    return {
      scholarId: tokenDoc.scholarId,
      scholarName: scholar.name ?? "Scholar",
      parentName: tokenDoc.parentName,
    };
  },
});

// ── Parent-scoped data queries (internal) ─────────────────────────────

export const getScholarSummary = internalQuery({
  args: { scholarId: v.id("users") },
  handler: async (ctx, args) => {
    const scholar = await ctx.db.get(args.scholarId);
    if (!scholar) return null;

    // Dossier
    const dossier = await ctx.db
      .query("scholarDossiers")
      .withIndex("by_scholar", (q) => q.eq("scholarId", args.scholarId))
      .first();

    // Recent pulse (from most recent non-archived project with a score)
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", args.scholarId))
      .order("desc")
      .take(10);

    const recentPulse = projects.find((p) => p.pulseScore != null);

    // Mastery count
    const masteryObs = await ctx.db
      .query("masteryObservations")
      .withIndex("by_scholar_current", (q) =>
        q.eq("scholarId", args.scholarId).eq("isSuperseded", false)
      )
      .collect();

    // Unique domains
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
      // Get unit name if linked
      let unitTitle: string | null = null;
      if (p.unitId) {
        const unit = await ctx.db.get(p.unitId);
        unitTitle = unit?.title ?? null;
      }

      // Get message count
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
