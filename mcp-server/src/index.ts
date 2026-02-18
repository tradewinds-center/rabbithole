#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// ── Configuration ─────────────────────────────────────────────────────

const CONVEX_URL =
  process.env.CONVEX_URL || "https://perceptive-husky-735.convex.cloud";
const PARENT_TOKEN = process.env.PARENT_TOKEN;

if (!PARENT_TOKEN) {
  console.error("Error: PARENT_TOKEN environment variable is required.");
  console.error("Set it to the token provided by your child's teacher.");
  process.exit(1);
}

// ── API helpers ───────────────────────────────────────────────────────

async function parentApi(endpoint: string): Promise<unknown> {
  const url = `${CONVEX_URL}/parent-api/${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PARENT_TOKEN}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error (${res.status}): ${body}`);
  }

  return res.json();
}

// ── Validate token on startup ─────────────────────────────────────────

let scholarName = "your child";

async function validateOnStartup() {
  try {
    const result = (await parentApi("validate")) as {
      scholarName: string;
      parentName: string;
    };
    scholarName = result.scholarName;
  } catch {
    console.error("Warning: Could not validate token on startup.");
  }
}

// ── MCP Server ────────────────────────────────────────────────────────

const server = new McpServer({
  name: "Tradewinds Learn - Parent View",
  version: "1.0.0",
});

server.tool(
  "get_child_summary",
  "Get an overview of your child: their learning profile (dossier), reading level, recent engagement score, and high-level stats.",
  {},
  async () => {
    const summary = await parentApi("summary");
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
    };
  }
);

server.tool(
  "get_recent_projects",
  "See your child's recent learning projects — what they've been working on, which curriculum units, and engagement scores.",
  {},
  async () => {
    const projects = await parentApi("projects");
    return {
      content: [{ type: "text", text: JSON.stringify(projects, null, 2) }],
    };
  }
);

server.tool(
  "get_mastery_report",
  "Get your child's concept mastery by domain (math, science, language arts, etc.) with Bloom's taxonomy levels (0-5 scale: remember → create).",
  {},
  async () => {
    const mastery = await parentApi("mastery");
    return {
      content: [{ type: "text", text: JSON.stringify(mastery, null, 2) }],
    };
  }
);

server.tool(
  "get_learning_signals",
  "See your child's learning character signals: curiosity, persistence, collaboration, creativity, and more — with intensity ratings.",
  {},
  async () => {
    const signals = await parentApi("signals");
    return {
      content: [{ type: "text", text: JSON.stringify(signals, null, 2) }],
    };
  }
);

server.tool(
  "get_exploration_topics",
  "See what topics the teacher suggests your child explore next — seeds for deeper learning.",
  {},
  async () => {
    const seeds = await parentApi("seeds");
    return {
      content: [{ type: "text", text: JSON.stringify(seeds, null, 2) }],
    };
  }
);

server.tool(
  "get_teacher_notes",
  "Read recent teacher observations about your child: praise, areas of concern, suggestions, and interventions.",
  {},
  async () => {
    const observations = await parentApi("observations");
    return {
      content: [
        { type: "text", text: JSON.stringify(observations, null, 2) },
      ],
    };
  }
);

// ── Start ─────────────────────────────────────────────────────────────

async function main() {
  await validateOnStartup();

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
