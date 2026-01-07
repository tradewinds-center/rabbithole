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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  conversations: many(conversations),
  observations: many(observations, { relationName: "teacherObservations" }),
  scholarObservations: many(observations, { relationName: "scholarObservations" }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
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
