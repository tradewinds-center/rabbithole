import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import { ROLES } from "./lib/roles";

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
    username: v.optional(v.string()),
    externalId: v.optional(v.string()),
    role: v.optional(
      v.union(
        v.literal(ROLES.SCHOLAR),
        v.literal(ROLES.TEACHER),
        v.literal(ROLES.ADMIN),
        v.literal(ROLES.CURRICULUM_DESIGNER)
      )
    ),
    readingLevel: v.optional(v.string()),
    readingLevelSuggestion: v.optional(v.string()), // Observer-inferred level, pending teacher review
    dateOfBirth: v.optional(v.string()), // ISO date string, e.g. "2018-03-15"
    profileSetupComplete: v.optional(v.boolean()),
    ttsEnabled: v.optional(v.boolean()), // Text-to-speech (undefined = enabled)
    sttEnabled: v.optional(v.boolean()), // Speech-to-text / voice dictation (undefined = enabled)
    mustResetPassword: v.optional(v.boolean()), // Force password reset on next login
  })
    .index("by_email", ["email"])
    .index("by_username", ["username"])
    .index("by_externalId", ["externalId"])
    .index("by_role", ["role"]),

  projects: defineTable({
    userId: v.id("users"),
    unitId: v.optional(v.id("units")),
    lessonId: v.optional(v.id("lessons")),
    title: v.string(),
    analysisSummary: v.optional(v.string()),
    pulseScore: v.optional(v.number()),
    teacherWhisper: v.optional(v.string()),
    pendingWhisper: v.optional(v.string()),
    readingLevelOverride: v.optional(v.string()),
    // Time limit mode (parent-set)
    sessionTimeLimit: v.optional(v.number()), // minutes
    sessionStartTime: v.optional(v.number()), // timestamp ms
    isArchived: v.boolean(),
    // DEPRECATED — kept optional for migration, remove after running migrations:removeStatusField
    status: v.optional(v.union(v.literal("green"), v.literal("yellow"), v.literal("red"))),
    progressScore: v.optional(v.number()),
    activityId: v.optional(v.id("focusSettings")),
    activityCompletedAt: v.optional(v.number()), // timestamp ms — scholar finished this activity
    // Denormalized from last message for efficient teacher dashboard queries
    lastMessageAt: v.optional(v.number()),
    lastMessageRole: v.optional(v.string()),
    lastMessagePreview: v.optional(v.string()), // first 120 chars of last message
  })
    .index("by_user", ["userId"])
    .index("by_user_and_archived", ["userId", "isArchived"])
    .index("by_unit", ["unitId"])
    .index("by_lesson", ["lessonId"])
    .index("by_activity", ["activityId"]),

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
    // Image attachment (Convex file storage)
    imageId: v.optional(v.id("_storage")),
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

  // ─── Standards Reference Layer (for compliance lens) ─────────────
  standardsDocuments: defineTable({
    asnDocumentId: v.string(),
    title: v.string(),
    subject: v.string(),
    jurisdiction: v.string(),
  })
    .index("by_subject", ["subject"])
    .index("by_jurisdiction", ["jurisdiction"]),

  standards: defineTable({
    asnId: v.string(),
    notation: v.optional(v.string()),
    description: v.string(),
    gradeLevels: v.array(v.string()),
    subject: v.string(),
    statementLabel: v.string(),
    isLeaf: v.boolean(),
    parentId: v.optional(v.id("standards")),
    documentId: v.id("standardsDocuments"),
  })
    .index("by_subject", ["subject"])
    .index("by_subject_leaf", ["subject", "isLeaf"])
    .index("by_parent", ["parentId"])
    .index("by_notation", ["notation"])
    .index("by_document", ["documentId"])
    .index("by_asnId", ["asnId"]),

  // ─── Observer Output Tables ────────────────────────────────────────
  masteryObservations: defineTable({
    scholarId: v.id("users"),
    conceptLabel: v.string(),
    domain: v.string(),
    observedAt: v.number(),
    projectId: v.id("projects"),
    transcriptExcerpt: v.string(),
    excerptMessageIds: v.optional(v.array(v.id("messages"))),
    masteryLevel: v.number(),
    confidenceScore: v.number(),
    evidenceSummary: v.string(),
    evidenceType: v.string(),
    attemptContext: v.string(),
    studentInitiated: v.boolean(),
    standardIds: v.optional(v.array(v.id("standards"))),
    supersedesId: v.optional(v.id("masteryObservations")),
    isSuperseded: v.boolean(),
  })
    .index("by_scholar", ["scholarId"])
    .index("by_scholar_domain", ["scholarId", "domain"])
    .index("by_scholar_current", ["scholarId", "isSuperseded"])
    .index("by_project", ["projectId"]),

  teacherMasteryOverrides: defineTable({
    scholarId: v.id("users"),
    observationId: v.id("masteryObservations"),
    teacherId: v.id("users"),
    masteryLevel: v.number(),
    notes: v.string(),
  })
    .index("by_scholar", ["scholarId"])
    .index("by_observation", ["observationId"]),

  // ─── Seeds (replaces suggestedTopics) ──────────────────────────────
  seeds: defineTable({
    scholarId: v.id("users"),
    origin: v.string(),
    status: v.string(),
    dismissedReason: v.optional(v.string()),
    topic: v.string(),
    domain: v.optional(v.string()),
    suggestionType: v.string(),
    rationale: v.string(),
    approachHint: v.optional(v.string()),
    connectionTo: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    teacherId: v.optional(v.id("users")),
    currentBloomsLevel: v.optional(v.number()),
    targetBloomsLevel: v.optional(v.number()),
  })
    .index("by_scholar_status", ["scholarId", "status"])
    .index("by_scholar_origin", ["scholarId", "origin"]),

  // ─── Session Signals (learner character) ───────────────────────────
  sessionSignals: defineTable({
    scholarId: v.id("users"),
    projectId: v.id("projects"),
    signalType: v.string(),
    description: v.string(),
    intensity: v.string(),
    transcriptExcerpt: v.optional(v.string()),
  })
    .index("by_scholar", ["scholarId"])
    .index("by_scholar_type", ["scholarId", "signalType"])
    .index("by_project", ["projectId"]),

  // ─── Cross-Domain Connections ──────────────────────────────────────
  crossDomainConnections: defineTable({
    scholarId: v.id("users"),
    domains: v.array(v.string()),
    conceptLabels: v.array(v.string()),
    description: v.string(),
    projectId: v.id("projects"),
    studentInitiated: v.boolean(),
    transcriptExcerpt: v.optional(v.string()),
  })
    .index("by_scholar", ["scholarId"])
    .index("by_project", ["projectId"]),

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
    // Phase 1: building-block references (unit composes these)
    personaId: v.optional(v.id("personas")),
    perspectiveId: v.optional(v.id("perspectives")),
    processId: v.optional(v.id("processes")),
    durationMinutes: v.optional(v.number()),
    youtubeUrl: v.optional(v.string()),
    videoTranscript: v.optional(v.string()),
    // null = teacher-created; set = scholar-created independent study unit
    scholarId: v.optional(v.id("users")),
    // PCM curriculum fields
    bigIdea: v.optional(v.string()),
    essentialQuestions: v.optional(v.array(v.string())),
    enduringUnderstandings: v.optional(v.array(v.string())),
    subject: v.optional(v.string()),
    gradeLevel: v.optional(v.string()),
    mathDomain: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_teacher", ["teacherId"])
    .index("by_active", ["isActive"])
    .index("by_slug", ["slug"])
    .index("by_scholar", ["scholarId"]),

  lessons: defineTable({
    unitId: v.id("units"),
    title: v.string(),
    strand: v.optional(v.union(
      v.literal("core"), v.literal("connections"),
      v.literal("practice"), v.literal("identity")
    )),
    systemPrompt: v.optional(v.string()),
    processId: v.optional(v.id("processes")),
    order: v.number(),
    durationMinutes: v.optional(v.number()),
  })
    .index("by_unit", ["unitId"])
    .index("by_unit_strand", ["unitId", "strand"]),

  focusSettings: defineTable({
    teacherId: v.id("users"),
    unitId: v.optional(v.id("units")),
    lessonId: v.optional(v.id("lessons")),
    scholarIds: v.optional(v.array(v.id("users"))), // targeted scholars (empty/undefined = all)
    isActive: v.boolean(),
    endsAt: v.optional(v.number()), // auto-expire: computed from unit.durationMinutes or teacher override
    completedAt: v.optional(v.number()), // timestamp when activity was completed/released
  })
    .index("by_active", ["isActive"])
    .index("by_teacher", ["teacherId"]),

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
    type: v.optional(v.union(v.literal("text"), v.literal("code"))),
    language: v.optional(v.string()), // e.g. "html", "javascript", "python"
  }).index("by_project", ["projectId"]),

  scholarDossiers: defineTable({
    scholarId: v.id("users"),
    content: v.string(),
  }).index("by_scholar", ["scholarId"]),

  teacherDirectives: defineTable({
    scholarId: v.id("users"),
    label: v.string(), // e.g. "SWI / stealth-dyslexia"
    content: v.string(), // teacher-authored instructions to the tutor
    authorId: v.id("users"), // teacher or admin who last wrote it
    isActive: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_scholar", ["scholarId"])
    .index("by_scholar_active", ["scholarId", "isActive"]),

  reports: defineTable({
    teacherId: v.id("users"),
    scholarId: v.id("users"),
    title: v.string(),
    content: v.string(),
  }).index("by_scholar", ["scholarId"]),

  curriculumMessages: defineTable({
    teacherId: v.id("users"),
    unitId: v.optional(v.id("units")),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    model: v.optional(v.string()),
    tokensUsed: v.optional(v.number()),
    streamId: v.optional(v.string()),
  })
    .index("by_teacher", ["teacherId"])
    .index("by_teacher_unit", ["teacherId", "unitId"])
    .index("by_stream", ["streamId"]),

  tokens: defineTable({
    token: v.string(),
    userId: v.id("users"),
    label: v.string(),
    expiresAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),

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
