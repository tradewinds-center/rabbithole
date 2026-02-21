# Rabbithole

AI-powered Socratic tutoring platform at Tradewinds Center for Advanced Learning. Scholars work on projects with Claude (AI tutor) while teachers monitor, analyze, and guide learning through a real-time dashboard.

## Features

- **Scholar workspace** — Streaming chat with Claude, voice dictation, image uploads, code artifacts, AI image generation
- **Dimension system** — Personas, units, perspectives, and guided processes overlay the AI's system prompt
- **Teacher dashboard** — Real-time monitoring of all scholars, whisper injection, topic tracking, observations
- **Observer analysis** — Automatic concept mastery tracking, session signals, cross-domain connections

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React 18, Chakra UI 3 |
| Backend | [Convex](https://convex.dev) (real-time queries, mutations, actions, HTTP actions) |
| AI | Anthropic Claude via streaming SSE |
| Voice | OpenAI Whisper (transcription via Convex action) |
| Auth | @convex-dev/auth with Password provider |

## Prerequisites

- Node.js 18+
- npm or pnpm
- A [Convex](https://convex.dev) account (free tier works)
- API keys: Anthropic (Claude), OpenAI (Whisper), optionally Google Gemini (image generation)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Convex

Create a Convex project at [dashboard.convex.dev](https://dashboard.convex.dev):

```bash
npx convex dev
```

This will:
- Prompt you to log in to Convex (or create an account)
- Create a new project (or link to an existing one)
- Generate `.env.local` with your `NEXT_PUBLIC_CONVEX_URL`
- Start the Convex dev server and push your schema + functions

Keep this terminal running — it watches for changes and deploys automatically.

### 3. Set Convex environment variables

In the [Convex dashboard](https://dashboard.convex.dev) → Settings → Environment Variables, add:

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key for chat |
| `OPENAI_API_KEY` | Yes | OpenAI key for Whisper transcription |
| `GEMINI_API_KEY` | No | Google Gemini key for AI image generation |
| `PARENT_PASSWORD` | No | Password for parent time-limit feature |

Or via CLI:

```bash
npx convex env set ANTHROPIC_API_KEY sk-ant-...
npx convex env set OPENAI_API_KEY sk-proj-...
```

### 4. Seed the database

With `npx convex dev` running in another terminal:

```bash
pnpm db:seed
```

This creates test users, personas, perspectives, units, and processes. It also imports Common Core standards data.

### 5. Start the dev server

```bash
npm run dev
```

The app runs at [http://localhost:1041](http://localhost:1041).

### 6. Log in

Use any of the seeded test accounts:

| Role | Username | Password |
|------|----------|----------|
| Teacher | `test-teacher-001` | `test-teacher-001` |
| Scholar | `test-scholar-001` | `test-scholar-001` |
| Scholar | `test-scholar-002` | `test-scholar-002` |
| Scholar | `test-scholar-003` | `test-scholar-003` |

Or create a new account from the login page.

## Project Structure

```
app/                    # Next.js pages and layouts
  login/                # Username/password login
  scholar/              # Scholar workspace (project view)
  teacher/              # Teacher dashboard
components/             # React components
hooks/                  # Custom React hooks
convex/                 # Convex backend
  schema.ts             # Database schema
  auth.ts               # Auth configuration
  http.ts               # HTTP actions (SSE streaming, analysis)
  projects.ts           # Project CRUD + messaging
  projectHelpers.ts     # System prompt builder
  observer.ts           # AI observer (mastery, signals, seeds)
  seed.ts               # Database seed data
  lib/                  # Auth helpers, custom function wrappers
scripts/                # Utility scripts
mcp-server/             # MCP server for parent access
public/                 # Static assets (avatars, logos)
```

## Commands

```bash
npm run dev             # Next.js dev server (port 1041)
npm run build           # Production build
npx convex dev          # Convex dev server (run alongside npm run dev)
pnpm db:seed            # Seed data (non-destructive)
pnpm db:reset           # Wipe all tables and re-seed
```

## Production Deployment

```bash
npx convex deploy                        # Deploy Convex functions to production
npx convex env set KEY value --prod      # Set prod environment variables
vercel --prod                            # Deploy Next.js frontend
```
