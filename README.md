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
- A [Convex](https://convex.dev) account (free — Andy will add you to the team)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Convex

Contact **Andy** at [andy@tradewinds.school](mailto:andy@tradewinds.school) to get added to the Convex team. Once added:

1. Create a free account at [dashboard.convex.dev](https://dashboard.convex.dev) (if you don't have one)
2. Run `npx convex dev` and select the existing **rabbithole** project — this gives you your own isolated dev deployment
3. This generates `.env.local` with your `NEXT_PUBLIC_CONVEX_URL`

Keep this terminal running — it watches for changes and deploys automatically.

### 3. Convex environment variables

API keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.) are configured as project-level defaults, so your dev deployment should have them automatically. Verify with:

```bash
npx convex env list
```

If any are missing, ask Andy.

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
  seedData.ts           # Database seed data
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
