import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// Users table - both scholars and teachers
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // Google OAuth ID
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  image: text("image"),
  role: text("role", { enum: ["scholar", "teacher", "admin"] })
    .notNull()
    .default("scholar"),
  // Reading level for scholars (teacher-settable)
  // Examples: "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "college"
  readingLevel: text("reading_level"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Conversations - each scholar has isolated conversations
export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Optional project this conversation belongs to (null = general chat)
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  // Sticky persona selection (current persona for this conversation)
  personaId: text("persona_id").references(() => personas.id, { onDelete: "set null" }),
  // Sticky perspective selection (current perspective for this conversation)
  perspectiveId: text("perspective_id").references(() => perspectives.id, { onDelete: "set null" }),
  title: text("title").default("New Conversation"),
  // Status indicator: green = on track, yellow = needs attention, red = requires intervention
  status: text("status", { enum: ["green", "yellow", "red"] })
    .notNull()
    .default("green"),
  // Observer analysis summary
  analysisSummary: text("analysis_summary"),
  // Teacher whisper - injected into system prompt
  teacherWhisper: text("teacher_whisper"),
  // Metadata
  isArchived: integer("is_archived", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Messages within conversations
export const messages = sqliteTable("messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  // Snapshot of active dimensions when this message was sent
  personaId: text("persona_id"),
  projectId: text("project_id"),
  perspectiveId: text("perspective_id"),
  // For tracking AI responses
  model: text("model"), // e.g., "claude-3-5-sonnet-20241022"
  tokensUsed: integer("tokens_used"),
  // Observer flags
  flagged: integer("flagged", { mode: "boolean" }).notNull().default(false),
  flagReason: text("flag_reason"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Teacher observations - notes on student progress
export const observations = sqliteTable("observations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  teacherId: text("teacher_id")
    .notNull()
    .references(() => users.id),
  scholarId: text("scholar_id")
    .notNull()
    .references(() => users.id),
  conversationId: text("conversation_id").references(() => conversations.id),
  note: text("note").notNull(),
  type: text("type", {
    enum: ["praise", "concern", "suggestion", "intervention"],
  }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Analysis results from the observer process
export const analyses = sqliteTable("analyses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  // Metrics
  engagementScore: real("engagement_score"), // 0-1
  complexityLevel: real("complexity_level"), // 0-1
  onTaskScore: real("on_task_score"), // 0-1
  // Detected patterns
  topics: text("topics"), // JSON array of topics
  learningIndicators: text("learning_indicators"), // JSON array
  concernFlags: text("concern_flags"), // JSON array
  // Summary
  summary: text("summary"),
  suggestedIntervention: text("suggested_intervention"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Scholar topics - tracks topics of interest with teacher ratings
export const scholarTopics = sqliteTable("scholar_topics", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  scholarId: text("scholar_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(),
  // Bloom's taxonomy level: remember, understand, apply, analyze, evaluate, create
  bloomLevel: text("bloom_level", {
    enum: ["remember", "understand", "apply", "analyze", "evaluate", "create"],
  }).default("remember"),
  // Teacher rating: 1 = thumbs up (encourage), -1 = thumbs down (discourage), 0 = neutral
  teacherRating: integer("teacher_rating").notNull().default(0),
  // How many times this topic appeared in conversations
  mentionCount: integer("mention_count").notNull().default(1),
  // Last conversation where this topic appeared
  lastConversationId: text("last_conversation_id").references(() => conversations.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Personas - AI character/personality for conversations
export const personas = sqliteTable("personas", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  teacherId: text("teacher_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  emoji: text("emoji").notNull(), // Required emoji for avatar display
  description: text("description"),
  systemPrompt: text("system_prompt"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Perspectives - thinking lens / Depth & Complexity framework
export const perspectives = sqliteTable("perspectives", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  teacherId: text("teacher_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  icon: text("icon"), // Emoji icon for display
  description: text("description"),
  systemPrompt: text("system_prompt"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Projects/Assignments - teacher-created with custom prompts and rubrics
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  teacherId: text("teacher_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  // System prompt to inject for this project (provides context for AI)
  systemPrompt: text("system_prompt"),
  // Rubric in JSON format: array of { criterion, description, levels: { exemplary, proficient, developing, beginning } }
  rubric: text("rubric"),
  // Optional: target Bloom level for adaptive rubric
  targetBloomLevel: text("target_bloom_level", {
    enum: ["remember", "understand", "apply", "analyze", "evaluate", "create"],
  }),
  // Whether this project is active/visible to scholars
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Suggested follow-up topics from teachers (Bloom's taxonomy inspired)
export const suggestedTopics = sqliteTable("suggested_topics", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  scholarId: text("scholar_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  teacherId: text("teacher_id")
    .notNull()
    .references(() => users.id),
  topic: text("topic").notNull(),
  // Why this suggestion (e.g., "pushes from understand to apply")
  rationale: text("rationale"),
  // Target Bloom level for this suggestion
  targetBloomLevel: text("target_bloom_level", {
    enum: ["remember", "understand", "apply", "analyze", "evaluate", "create"],
  }),
  // Whether the scholar has explored this topic
  explored: integer("explored", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  conversations: many(conversations),
  observations: many(observations, { relationName: "teacherObservations" }),
  scholarObservations: many(observations, { relationName: "scholarObservations" }),
  scholarTopics: many(scholarTopics),
  suggestedTopicsReceived: many(suggestedTopics, { relationName: "scholarSuggestions" }),
  suggestedTopicsGiven: many(suggestedTopics, { relationName: "teacherSuggestions" }),
  projectsCreated: many(projects),
  personasCreated: many(personas),
  perspectivesCreated: many(perspectives),
}));

export const personasRelations = relations(personas, ({ one, many }) => ({
  teacher: one(users, {
    fields: [personas.teacherId],
    references: [users.id],
  }),
  conversations: many(conversations),
}));

export const perspectivesRelations = relations(perspectives, ({ one, many }) => ({
  teacher: one(users, {
    fields: [perspectives.teacherId],
    references: [users.id],
  }),
  conversations: many(conversations),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  teacher: one(users, {
    fields: [projects.teacherId],
    references: [users.id],
  }),
  conversations: many(conversations),
}));

export const scholarTopicsRelations = relations(scholarTopics, ({ one }) => ({
  scholar: one(users, {
    fields: [scholarTopics.scholarId],
    references: [users.id],
  }),
  lastConversation: one(conversations, {
    fields: [scholarTopics.lastConversationId],
    references: [conversations.id],
  }),
}));

export const suggestedTopicsRelations = relations(suggestedTopics, ({ one }) => ({
  scholar: one(users, {
    fields: [suggestedTopics.scholarId],
    references: [users.id],
    relationName: "scholarSuggestions",
  }),
  teacher: one(users, {
    fields: [suggestedTopics.teacherId],
    references: [users.id],
    relationName: "teacherSuggestions",
  }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [conversations.projectId],
    references: [projects.id],
  }),
  persona: one(personas, {
    fields: [conversations.personaId],
    references: [personas.id],
  }),
  perspective: one(perspectives, {
    fields: [conversations.perspectiveId],
    references: [perspectives.id],
  }),
  messages: many(messages),
  observations: many(observations),
  analyses: many(analyses),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const observationsRelations = relations(observations, ({ one }) => ({
  teacher: one(users, {
    fields: [observations.teacherId],
    references: [users.id],
    relationName: "teacherObservations",
  }),
  scholar: one(users, {
    fields: [observations.scholarId],
    references: [users.id],
    relationName: "scholarObservations",
  }),
  conversation: one(conversations, {
    fields: [observations.conversationId],
    references: [conversations.id],
  }),
}));

export const analysesRelations = relations(analyses, ({ one }) => ({
  conversation: one(conversations, {
    fields: [analyses.conversationId],
    references: [conversations.id],
  }),
}));

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Observation = typeof observations.$inferSelect;
export type Analysis = typeof analyses.$inferSelect;
export type ScholarTopic = typeof scholarTopics.$inferSelect;
export type NewScholarTopic = typeof scholarTopics.$inferInsert;
export type SuggestedTopic = typeof suggestedTopics.$inferSelect;
export type NewSuggestedTopic = typeof suggestedTopics.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Persona = typeof personas.$inferSelect;
export type NewPersona = typeof personas.$inferInsert;
export type Perspective = typeof perspectives.$inferSelect;
export type NewPerspective = typeof perspectives.$inferInsert;
