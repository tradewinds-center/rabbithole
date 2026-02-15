import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  // Spread @convex-dev/auth internal tables (authAccounts, authSessions, etc.)
  ...authTables,

  // Override the users table to include both auth fields and our custom fields
  users: defineTable({
    // Auth fields (from @convex-dev/auth)
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // Our custom fields
    externalId: v.optional(v.string()),
    role: v.optional(
      v.union(
        v.literal("scholar"),
        v.literal("teacher"),
        v.literal("admin")
      )
    ),
    readingLevel: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_externalId", ["externalId"])
    .index("by_role", ["role"]),

  projects: defineTable({
    userId: v.id("users"),
    unitId: v.optional(v.id("units")),
    personaId: v.optional(v.id("personas")),
    perspectiveId: v.optional(v.id("perspectives")),
    processId: v.optional(v.id("processes")),
    title: v.string(),
    analysisSummary: v.optional(v.string()),
    pulseScore: v.optional(v.number()),
    teacherWhisper: v.optional(v.string()),
    pendingWhisper: v.optional(v.string()),
    readingLevelOverride: v.optional(v.string()),
    isArchived: v.boolean(),
    // DEPRECATED — kept optional for migration, remove after running migrations:removeStatusField
    status: v.optional(v.union(v.literal("green"), v.literal("yellow"), v.literal("red"))),
    progressScore: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_archived", ["userId", "isArchived"])
    .index("by_unit", ["unitId"]),

  messages: defineTable({
    projectId: v.id("projects"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
      v.literal("tool")
    ),
    content: v.string(),
    toolAction: v.optional(v.string()),
    // Snapshot of active dimensions when this message was sent
    // These are strings (not v.id) because they're historical references
    // that should survive if the original entity is deleted
    personaId: v.optional(v.string()),
    unitId: v.optional(v.string()),
    perspectiveId: v.optional(v.string()),
    processId: v.optional(v.string()),
    model: v.optional(v.string()),
    tokensUsed: v.optional(v.number()),
    flagged: v.boolean(),
    flagReason: v.optional(v.string()),
    // For persistent-text-streaming: links to active stream
    streamId: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_stream", ["streamId"]),

  analyses: defineTable({
    projectId: v.id("projects"),
    engagementScore: v.optional(v.number()),
    complexityLevel: v.optional(v.number()),
    onTaskScore: v.optional(v.number()),
    topics: v.optional(v.array(v.string())),
    learningIndicators: v.optional(v.array(v.string())),
    concernFlags: v.optional(v.array(v.string())),
    summary: v.optional(v.string()),
    suggestedIntervention: v.optional(v.string()),
  }).index("by_project", ["projectId"]),

  observations: defineTable({
    teacherId: v.id("users"),
    scholarId: v.id("users"),
    projectId: v.optional(v.id("projects")),
    note: v.string(),
    type: v.union(
      v.literal("praise"),
      v.literal("concern"),
      v.literal("suggestion"),
      v.literal("intervention")
    ),
  })
    .index("by_scholar", ["scholarId"])
    .index("by_teacher", ["teacherId"])
    .index("by_project", ["projectId"]),

  scholarTopics: defineTable({
    scholarId: v.id("users"),
    topic: v.string(),
    bloomLevel: v.union(
      v.literal("remember"),
      v.literal("understand"),
      v.literal("apply"),
      v.literal("analyze"),
      v.literal("evaluate"),
      v.literal("create")
    ),
    teacherRating: v.number(), // 1 = thumbs up, -1 = thumbs down, 0 = neutral
    mentionCount: v.number(),
    lastProjectId: v.optional(v.id("projects")),
  })
    .index("by_scholar", ["scholarId"])
    .index("by_scholar_and_topic", ["scholarId", "topic"]),

  suggestedTopics: defineTable({
    scholarId: v.id("users"),
    teacherId: v.id("users"),
    topic: v.string(),
    rationale: v.optional(v.string()),
    targetBloomLevel: v.optional(
      v.union(
        v.literal("remember"),
        v.literal("understand"),
        v.literal("apply"),
        v.literal("analyze"),
        v.literal("evaluate"),
        v.literal("create")
      )
    ),
    explored: v.boolean(),
  })
    .index("by_scholar", ["scholarId"])
    .index("by_teacher", ["teacherId"]),

  personas: defineTable({
    teacherId: v.id("users"),
    title: v.string(),
    slug: v.optional(v.string()),
    emoji: v.string(),
    description: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_teacher", ["teacherId"])
    .index("by_active", ["isActive"])
    .index("by_slug", ["slug"]),

  perspectives: defineTable({
    teacherId: v.id("users"),
    title: v.string(),
    slug: v.optional(v.string()),
    icon: v.optional(v.string()),
    description: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_teacher", ["teacherId"])
    .index("by_active", ["isActive"])
    .index("by_slug", ["slug"]),

  units: defineTable({
    teacherId: v.id("users"),
    title: v.string(),
    slug: v.optional(v.string()),
    emoji: v.optional(v.string()),
    description: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    rubric: v.optional(v.string()),
    targetBloomLevel: v.optional(
      v.union(
        v.literal("remember"),
        v.literal("understand"),
        v.literal("apply"),
        v.literal("analyze"),
        v.literal("evaluate"),
        v.literal("create")
      )
    ),
    isActive: v.boolean(),
  })
    .index("by_teacher", ["teacherId"])
    .index("by_active", ["isActive"])
    .index("by_slug", ["slug"]),

  focusSettings: defineTable({
    teacherId: v.id("users"),
    personaId: v.optional(v.id("personas")),
    unitId: v.optional(v.id("units")),
    perspectiveId: v.optional(v.id("perspectives")),
    processId: v.optional(v.id("processes")),
    isActive: v.boolean(),
  }).index("by_active", ["isActive"]),

  processes: defineTable({
    teacherId: v.id("users"),
    title: v.string(),
    slug: v.optional(v.string()),
    emoji: v.optional(v.string()),
    description: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    steps: v.array(
      v.object({
        key: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
      })
    ),
    isActive: v.boolean(),
  })
    .index("by_teacher", ["teacherId"])
    .index("by_active", ["isActive"])
    .index("by_slug", ["slug"]),

  artifacts: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    content: v.string(),
    lastEditedBy: v.union(v.literal("scholar"), v.literal("ai")),
  }).index("by_project", ["projectId"]),

  scholarDossiers: defineTable({
    scholarId: v.id("users"),
    content: v.string(),
  }).index("by_scholar", ["scholarId"]),

  processState: defineTable({
    projectId: v.id("projects"),
    processId: v.id("processes"),
    currentStep: v.string(),
    steps: v.array(
      v.object({
        key: v.string(),
        status: v.union(
          v.literal("not_started"),
          v.literal("in_progress"),
          v.literal("completed")
        ),
        commentary: v.optional(v.string()),
      })
    ),
  }).index("by_project", ["projectId"]),
});
