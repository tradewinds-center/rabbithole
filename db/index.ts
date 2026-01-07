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

  // Create indexes for better query performance
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_observations_scholar_id ON observations(scholar_id);
    CREATE INDEX IF NOT EXISTS idx_analyses_conversation_id ON analyses(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_scholar_topics_scholar_id ON scholar_topics(scholar_id);
    CREATE INDEX IF NOT EXISTS idx_suggested_topics_scholar_id ON suggested_topics(scholar_id);
  `);

  console.log("Database initialized successfully");
}

// Export schema types
export * from "./schema";
