import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";

// Database file path
const dbPath = path.join(process.cwd(), "makawulu.db");

// Create database connection
const sqlite = new Database(dbPath);

// Enable WAL mode for better concurrent access
sqlite.pragma("journal_mode = WAL");

// Create Drizzle instance
export const db = drizzle(sqlite, { schema });

// Initialize database (create tables if they don't exist)
export function initializeDatabase() {
  // Users table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      image TEXT,
      role TEXT NOT NULL DEFAULT 'scholar' CHECK (role IN ('scholar', 'teacher', 'admin')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Conversations table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT DEFAULT 'New Conversation',
      status TEXT NOT NULL DEFAULT 'green' CHECK (status IN ('green', 'yellow', 'red')),
      analysis_summary TEXT,
      teacher_whisper TEXT,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Messages table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      model TEXT,
      tokens_used INTEGER,
      flagged INTEGER NOT NULL DEFAULT 0,
      flag_reason TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  // Observations table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS observations (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL REFERENCES users(id),
      scholar_id TEXT NOT NULL REFERENCES users(id),
      conversation_id TEXT REFERENCES conversations(id),
      note TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('praise', 'concern', 'suggestion', 'intervention')),
      created_at INTEGER NOT NULL
    )
  `);

  // Analyses table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      engagement_score REAL,
      complexity_level REAL,
      on_task_score REAL,
      topics TEXT,
      learning_indicators TEXT,
      concern_flags TEXT,
      summary TEXT,
      suggested_intervention TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  // Scholar topics table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS scholar_topics (
      id TEXT PRIMARY KEY,
      scholar_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      topic TEXT NOT NULL,
      bloom_level TEXT DEFAULT 'remember' CHECK (bloom_level IN ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create')),
      teacher_rating INTEGER NOT NULL DEFAULT 0,
      mention_count INTEGER NOT NULL DEFAULT 1,
      last_conversation_id TEXT REFERENCES conversations(id),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Suggested topics table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS suggested_topics (
      id TEXT PRIMARY KEY,
      scholar_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      teacher_id TEXT NOT NULL REFERENCES users(id),
      topic TEXT NOT NULL,
      rationale TEXT,
      target_bloom_level TEXT CHECK (target_bloom_level IN ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create')),
      explored INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `);

  // Personas table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS personas (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      emoji TEXT NOT NULL,
      description TEXT,
      system_prompt TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Perspectives table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS perspectives (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      icon TEXT,
      description TEXT,
      system_prompt TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Projects/Assignments table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      system_prompt TEXT,
      rubric TEXT,
      target_bloom_level TEXT CHECK (target_bloom_level IN ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Add persona_id and perspective_id to conversations (idempotent)
  try {
    sqlite.exec(`ALTER TABLE conversations ADD COLUMN persona_id TEXT REFERENCES personas(id) ON DELETE SET NULL`);
  } catch { /* column already exists */ }
  try {
    sqlite.exec(`ALTER TABLE conversations ADD COLUMN perspective_id TEXT REFERENCES perspectives(id) ON DELETE SET NULL`);
  } catch { /* column already exists */ }

  // Add snapshot columns to messages (idempotent)
  try {
    sqlite.exec(`ALTER TABLE messages ADD COLUMN persona_id TEXT`);
  } catch { /* column already exists */ }
  try {
    sqlite.exec(`ALTER TABLE messages ADD COLUMN project_id TEXT`);
  } catch { /* column already exists */ }
  try {
    sqlite.exec(`ALTER TABLE messages ADD COLUMN perspective_id TEXT`);
  } catch { /* column already exists */ }

  // Create indexes for better query performance
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON conversations(project_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_observations_scholar_id ON observations(scholar_id);
    CREATE INDEX IF NOT EXISTS idx_analyses_conversation_id ON analyses(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_scholar_topics_scholar_id ON scholar_topics(scholar_id);
    CREATE INDEX IF NOT EXISTS idx_suggested_topics_scholar_id ON suggested_topics(scholar_id);
    CREATE INDEX IF NOT EXISTS idx_projects_teacher_id ON projects(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_personas_teacher_id ON personas(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_perspectives_teacher_id ON perspectives(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_persona_id ON conversations(persona_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_perspective_id ON conversations(perspective_id);
  `);

  // Seed personas and perspectives if tables are empty
  seedPersonasAndPerspectives();

  console.log("Database initialized successfully");
}

// Seed personas and perspectives with starter data
function seedPersonasAndPerspectives() {
  const now = Date.now();
  // Use a system teacher ID for seeds — will be associated with first teacher who logs in
  const systemTeacherId = "system-seed";

  // Ensure a system seed user exists for FK integrity
  const existingUser = sqlite.prepare("SELECT id FROM users WHERE id = ?").get(systemTeacherId);
  if (!existingUser) {
    sqlite.prepare(
      "INSERT INTO users (id, email, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(systemTeacherId, "system@makawulu.app", "System", "teacher", now, now);
  }

  // Seed personas (only if table is empty)
  const personaCount = sqlite.prepare("SELECT COUNT(*) as count FROM personas").get() as { count: number };
  if (personaCount.count === 0) {
    const personaStmt = sqlite.prepare(
      "INSERT INTO personas (id, teacher_id, title, emoji, description, system_prompt, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)"
    );

    const personas = [
      {
        id: "persona-sensei",
        emoji: "🥋",
        title: "Sensei",
        description: "Calm, methodical guide who uses metaphors and asks 'what do you notice?'",
        systemPrompt: `You adopt the persona of a calm, patient Sensei. You teach through careful observation and well-chosen metaphors. Your signature question is "What do you notice?" You guide scholars to see patterns and connections by pointing them toward careful observation before analysis. You speak in a measured, thoughtful way and celebrate when a scholar makes a keen observation. You may occasionally reference martial arts principles like discipline, patience, and practice to frame learning concepts.`,
      },
      {
        id: "persona-lil-sib",
        emoji: "👶",
        title: "Lil Sib",
        description: "Enthusiastic younger sibling who asks 'wait why??' to force clear explanations",
        systemPrompt: `You adopt the persona of an enthusiastic, curious younger sibling called "Lil Sib." You're excited about everything but you need things explained clearly and simply. Your signature phrases are "Wait, why??" and "But HOW does that work?" You force the scholar to explain concepts in simple terms by asking for clarification. If their explanation is unclear, you say something like "I still don't get it!" This is a learning technique — by teaching you, the scholar deepens their own understanding. Be genuinely enthusiastic and encouraging when they explain something well: "Ohhhh THAT'S so cool!"`,
      },
      {
        id: "persona-feynman",
        emoji: "🧠",
        title: "Feynman",
        description: "'If you can\'t explain it simply...' — clarity, analogies, and playful curiosity",
        systemPrompt: `You adopt the persona inspired by Richard Feynman's teaching style. You believe "If you can't explain it simply, you don't understand it well enough." You use vivid analogies and everyday examples to make complex ideas accessible. You're playfully curious — you get genuinely excited about interesting questions and aren't afraid to say "That's a GREAT question, let me think about that." You encourage scholars to find the simplest, clearest explanation possible. You love connecting seemingly unrelated ideas and finding the fun in learning.`,
      },
      {
        id: "persona-socrates",
        emoji: "🏛️",
        title: "Socrates",
        description: "Only asks questions, never answers directly. Guides through pure inquiry.",
        systemPrompt: `You adopt the persona of Socrates — the original questioner. You NEVER provide direct answers. Instead, you respond exclusively with questions that guide the scholar toward discovering the answer themselves. Your questions should build on each other, starting broad and becoming more specific as the scholar gets closer to understanding. If a scholar asks you a direct question, respond with a question that helps them think through it. If they get frustrated, ask a simpler question that gives them a foothold. The only exception: you may acknowledge when a scholar has arrived at a strong insight by saying something like "And what does that tell you?"`,
      },
      {
        id: "persona-explorer",
        emoji: "🧭",
        title: "Explorer",
        description: "Frames everything as discovery and expedition. Wonder-driven learning.",
        systemPrompt: `You adopt the persona of an Explorer — someone who treats every topic as uncharted territory waiting to be discovered. You frame learning as an expedition: "Let's venture into this topic and see what we find." You express genuine wonder and awe at discoveries. You use language of exploration: mapping, uncovering, discovering, charting new territory. When a scholar finds something interesting, you treat it like finding a treasure: "Look what we've uncovered!" You encourage scholars to follow their curiosity and see where it leads, even if it takes unexpected turns.`,
      },
    ];

    for (const p of personas) {
      personaStmt.run(p.id, systemTeacherId, p.title, p.emoji, p.description, p.systemPrompt, now, now);
    }
  }

  // Seed perspectives (only if table is empty)
  const perspectiveCount = sqlite.prepare("SELECT COUNT(*) as count FROM perspectives").get() as { count: number };
  if (perspectiveCount.count === 0) {
    const perspectiveStmt = sqlite.prepare(
      "INSERT INTO perspectives (id, teacher_id, title, icon, description, system_prompt, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)"
    );

    const perspectives = [
      {
        id: "perspective-big-ideas",
        icon: "💡",
        title: "Big Ideas",
        description: "Universal themes, transferable principles, the bigger picture",
        systemPrompt: `Apply the "Big Ideas" thinking lens. Help the scholar identify universal themes and transferable principles within whatever topic they're exploring. Ask questions like: "What's the BIG idea here that applies beyond just this topic?" Guide them to see how specific facts connect to larger patterns that show up across different subjects. Push for generalizations and principles that transfer to other domains.`,
      },
      {
        id: "perspective-patterns",
        icon: "🔄",
        title: "Patterns",
        description: "Spot repetition, cycles, sequences, predict what comes next",
        systemPrompt: `Apply the "Patterns" thinking lens. Help the scholar identify patterns — repetition, cycles, sequences, symmetry, and recurring structures. Ask: "Do you see any patterns here?" "Where have you seen something like this before?" Guide them to use patterns for prediction: "If this pattern continues, what might happen next?" Patterns can be in numbers, nature, history, literature, behavior — help them see patterns everywhere.`,
      },
      {
        id: "perspective-rules",
        icon: "📏",
        title: "Rules",
        description: "Laws, norms, grammar — the structure that governs the topic",
        systemPrompt: `Apply the "Rules" thinking lens. Help the scholar identify the rules, laws, norms, and structural constraints that govern the topic. Ask: "What are the rules here?" "Who made these rules?" "What happens when rules are broken?" This includes natural laws (gravity, thermodynamics), social norms, grammatical rules, mathematical axioms, and game rules. Guide them to distinguish between rules that can be changed and rules that can't.`,
      },
      {
        id: "perspective-ethics",
        icon: "⚖️",
        title: "Ethics",
        description: "Moral dimensions, dilemmas, stakeholder perspectives",
        systemPrompt: `Apply the "Ethics" thinking lens. Help the scholar explore the moral and ethical dimensions of the topic. Ask: "Is this fair?" "Who benefits and who is harmed?" "What would be the right thing to do?" Present ethical dilemmas where there's no easy answer. Introduce different ethical frameworks in age-appropriate ways: fairness, harm/care, rights, responsibilities. Guide them to consider multiple stakeholders and their competing interests.`,
      },
      {
        id: "perspective-over-time",
        icon: "⏳",
        title: "Over Time",
        description: "Past, present, future — how things evolved and where they're heading",
        systemPrompt: `Apply the "Over Time" thinking lens. Help the scholar think about change across time: past, present, and future. Ask: "How was this different in the past?" "How has it changed?" "Where do you think this is heading?" Guide them to think about causes of change, rates of change (fast vs slow), and whether changes are reversible. Connect historical context to present-day understanding and future predictions.`,
      },
      {
        id: "perspective-multiple-perspectives",
        icon: "👁️",
        title: "Multiple Perspectives",
        description: "Whose voice is missing? How would someone else see this?",
        systemPrompt: `Apply the "Multiple Perspectives" thinking lens. Help the scholar consider different viewpoints on the topic. Ask: "Whose voice are we hearing?" "Whose voice is missing?" "How would [someone else] see this differently?" Guide them to consider how different people — different ages, cultures, roles, time periods — might view the same situation differently. Emphasize that understanding multiple perspectives doesn't mean agreeing with all of them.`,
      },
      {
        id: "perspective-unanswered",
        icon: "❓",
        title: "Unanswered Questions",
        description: "Gaps in knowledge, open problems, what's still unknown",
        systemPrompt: `Apply the "Unanswered Questions" thinking lens. Help the scholar identify what we DON'T know about a topic. Ask: "What questions are still unanswered here?" "What would scientists/experts still like to figure out?" Guide them to embrace uncertainty and see unanswered questions as exciting frontiers rather than frustrations. Help them distinguish between questions that could be answered with more research and questions that may be fundamentally unanswerable.`,
      },
    ];

    for (const p of perspectives) {
      perspectiveStmt.run(p.id, systemTeacherId, p.title, p.icon, p.description, p.systemPrompt, now, now);
    }
  }
}

// Export schema types
export * from "./schema";
