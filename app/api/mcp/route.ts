import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

// Derive Convex .site URL from the .cloud URL
const CONVEX_CLOUD_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_CLOUD_URL) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
}
const CONVEX_SITE_URL = CONVEX_CLOUD_URL.replace(".cloud", ".site");

// ── API helper ───────────────────────────────────────────────────────

async function parentApi(
  token: string,
  endpoint: string,
  body?: Record<string, unknown>
): Promise<unknown> {
  const url = `${CONVEX_SITE_URL}/parent-api/${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error (${res.status}): ${text}`);
  }
  return res.json();
}

// ── Validate token and get role ──────────────────────────────────────

interface TokenAuth {
  userName: string;
  label: string;
  role: string;
}

async function validateToken(token: string): Promise<TokenAuth | null> {
  try {
    const result = await parentApi(token, "validate");
    const auth = result as TokenAuth;
    if (auth.role) return auth;
    return null;
  } catch {
    return null;
  }
}

// ── Response formatters (keep MCP responses compact) ─────────────────

const BLOOM_LABELS = ["remember", "understand", "apply", "analyze", "evaluate", "create"];

function formatMastery(data: Record<string, { concept: string; level: number; evidence: string }[]>): string {
  const lines: string[] = [];
  for (const [domain, concepts] of Object.entries(data)) {
    lines.push(`## ${domain}`);
    for (const c of concepts) {
      const label = BLOOM_LABELS[Math.round(c.level)] ?? `${c.level}`;
      lines.push(`- ${c.concept}: ${c.level.toFixed(1)} (${label})`);
    }
  }
  return lines.length > 0 ? lines.join("\n") : "No mastery observations yet.";
}

function formatSeeds(data: { topic: string; domain?: string | null; rationale: string; status: string }[]): string {
  if (!Array.isArray(data) || data.length === 0) return "No exploration topics yet.";
  return data.map((s) => `- [${s.status}] ${s.topic}${s.domain ? ` (${s.domain})` : ""}`).join("\n");
}

// ── Build MCP server based on role ───────────────────────────────────

function createParentServer(token: string) {
  const server = new McpServer({
    name: "Tradewinds Learn — Parent View",
    version: "1.0.0",
  });

  server.tool(
    "get_child_summary",
    "Get an overview of your child: their learning profile, reading level, recent engagement score, and high-level stats.",
    {},
    async () => {
      const summary = await parentApi(token, "summary");
      return {
        content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
      };
    }
  );

  server.tool(
    "get_recent_projects",
    "See your child's recent learning projects — what they've been working on, which curriculum units, and engagement scores.",
    {},
    async () => {
      const projects = await parentApi(token, "projects");
      return {
        content: [{ type: "text" as const, text: JSON.stringify(projects, null, 2) }],
      };
    }
  );

  server.tool(
    "get_mastery_report",
    "Get your child's concept mastery by domain (math, science, language arts, etc.) with Bloom's taxonomy levels (0-5 scale: remember → create).",
    {},
    async () => {
      const mastery = await parentApi(token, "mastery") as Record<string, { concept: string; level: number; evidence: string }[]>;
      return {
        content: [{ type: "text" as const, text: formatMastery(mastery) }],
      };
    }
  );

  server.tool(
    "get_learning_signals",
    "See your child's learning character signals: curiosity, persistence, collaboration, creativity, and more — with intensity ratings.",
    {},
    async () => {
      const signals = await parentApi(token, "signals");
      return {
        content: [{ type: "text" as const, text: JSON.stringify(signals, null, 2) }],
      };
    }
  );

  server.tool(
    "get_exploration_topics",
    "See what topics the teacher suggests your child explore next — seeds for deeper learning.",
    {},
    async () => {
      const seeds = await parentApi(token, "seeds") as { topic: string; domain?: string | null; rationale: string; status: string }[];
      return {
        content: [{ type: "text" as const, text: formatSeeds(seeds) }],
      };
    }
  );

  server.tool(
    "get_teacher_notes",
    "Read recent teacher observations about your child: praise, areas of concern, suggestions, and interventions.",
    {},
    async () => {
      const observations = await parentApi(token, "observations") as { note: string; type: string; createdAt: number }[];
      const text = Array.isArray(observations) && observations.length > 0
        ? observations.map((o) => `- [${o.type}] ${o.note}`).join("\n")
        : "No teacher observations yet.";
      return {
        content: [{ type: "text" as const, text }],
      };
    }
  );

  return server;
}

function createTeacherServer(token: string) {
  const server = new McpServer({
    name: "Tradewinds Learn — Teacher View",
    version: "1.0.0",
  });

  const scholarIdSchema = { scholarId: z.string().describe("The scholar's user ID") };

  server.tool(
    "list_scholars",
    "List all scholars with their name, reading level, and ID. Call this first to get scholar IDs for other tools.",
    {},
    async () => {
      const scholars = await parentApi(token, "scholars");
      return {
        content: [{ type: "text" as const, text: JSON.stringify(scholars, null, 2) }],
      };
    }
  );

  server.tool(
    "get_scholar_summary",
    "Get a scholar's overview: learning profile, reading level, recent engagement score, and high-level stats.",
    scholarIdSchema,
    async ({ scholarId }) => {
      const summary = await parentApi(token, "summary", { scholarId });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
      };
    }
  );

  server.tool(
    "get_scholar_projects",
    "See a scholar's recent learning projects — what they've been working on, which curriculum units, and engagement scores.",
    scholarIdSchema,
    async ({ scholarId }) => {
      const projects = await parentApi(token, "projects", { scholarId });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(projects, null, 2) }],
      };
    }
  );

  server.tool(
    "get_scholar_mastery",
    "Get a scholar's concept mastery by domain (math, science, language arts, etc.) with Bloom's taxonomy levels (0-5 scale: remember → create).",
    scholarIdSchema,
    async ({ scholarId }) => {
      const mastery = await parentApi(token, "mastery", { scholarId }) as Record<string, { concept: string; level: number; evidence: string }[]>;
      return {
        content: [{ type: "text" as const, text: formatMastery(mastery) }],
      };
    }
  );

  server.tool(
    "get_scholar_signals",
    "See a scholar's learning character signals: curiosity, persistence, collaboration, creativity, and more — with intensity ratings.",
    scholarIdSchema,
    async ({ scholarId }) => {
      const signals = await parentApi(token, "signals", { scholarId });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(signals, null, 2) }],
      };
    }
  );

  server.tool(
    "get_scholar_observations",
    "Read teacher observations about a scholar: praise, areas of concern, suggestions, and interventions.",
    scholarIdSchema,
    async ({ scholarId }) => {
      const observations = await parentApi(token, "observations", { scholarId }) as { note: string; type: string; createdAt: number }[];
      const text = Array.isArray(observations) && observations.length > 0
        ? observations.map((o) => `- [${o.type}] ${o.note}`).join("\n")
        : "No teacher observations yet.";
      return {
        content: [{ type: "text" as const, text }],
      };
    }
  );

  server.tool(
    "get_scholar_seeds",
    "See what exploration topics are suggested for a scholar — seeds for deeper learning.",
    scholarIdSchema,
    async ({ scholarId }) => {
      const seeds = await parentApi(token, "seeds", { scholarId }) as { topic: string; domain?: string | null; rationale: string; status: string }[];
      return {
        content: [{ type: "text" as const, text: formatSeeds(seeds) }],
      };
    }
  );

  return server;
}

// ── Next.js route handlers ───────────────────────────────────────────

function getToken(request: Request): string | null {
  const url = new URL(request.url);
  return url.searchParams.get("token");
}

async function handleMcpRequest(request: Request): Promise<Response> {
  const token = getToken(request);
  if (!token) {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Missing ?token= query parameter" },
        id: null,
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Validate token and determine role
  const auth = await validateToken(token);
  if (!auth) {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Invalid or expired token" },
        id: null,
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const isTeacher = auth.role === "teacher" || auth.role === "admin";
  const server = isTeacher ? createTeacherServer(token) : createParentServer(token);

  const transport = new WebStandardStreamableHTTPServerTransport();
  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function GET(request: Request) {
  // Stateless servers don't support GET (SSE session resumption)
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed. Use POST for stateless MCP." },
      id: null,
    }),
    { status: 405, headers: { "Content-Type": "application/json" } }
  );
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  // Stateless — no sessions to terminate
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed. Stateless server has no sessions." },
      id: null,
    }),
    { status: 405, headers: { "Content-Type": "application/json" } }
  );
}
