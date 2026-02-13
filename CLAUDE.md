# CLAUDE.md - Makawulu

AI-powered classroom learning app for Tradewinds School's gifted scholars.

---

## Roadmap

- [ ] **Google Classroom Integration** - Sync rosters, assignments, grades
- [x] **Categorize by Assignment** - Link conversations to specific assignments/projects
- [ ] **Kupuna/Parent Mode** - Read-only view for grandparents and parents to see scholar progress
- [x] **Reading Level** - Teacher-settable reading level per scholar
- [ ] **Reading Level Auto-Increase** - Auto-increase reading level over time based on performance
- [ ] **Best Quote of the Day -> FB** - Surface and post exceptional scholar insights to Facebook
- [ ] **Teacher Supervision Enhancements** - Expand teacher oversight and intervention tools
- [ ] **Focus Mode** - Teacher can "lock" a particular project so scholars must work in it
- [x] **AI Personas** - Scholars can talk to different AI personas (e.g., scientist, historian, author)
- [ ] **Scholar Dossier** - AI maintains a persistent profile per scholar (reading level, learning style, interests, etc.)
- [ ] **Claude Agent SDK Migration** - Switch to agent SDK with tools for reading/writing dossier, web search, etc.
- [ ] **Text-to-Speech** - Click to have Makawulu read responses aloud (OpenAI TTS or browser SpeechSynthesis)
- [x] **Convex Migration** - Migrated from SQLite/Drizzle/NextAuth to Convex (Feb 2026)
- [x] **Teacher Remote Into Scholar** - Teachers can open a scholar's view in a new tab (?remote={userId})

---

## Overview

**Makawulu** (from Hawaiian "makawalu" - seeing with eight eyes, multiple perspectives) is a Socratic AI tutoring platform where:

- **Scholars** have conversations with Claude (AI tutor)
- **Teachers** monitor, analyze, and guide learning through a dashboard
- **System** auto-analyzes conversations for engagement, complexity, topics, and concerns

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React 18, Chakra UI 3 |
| Backend | Convex (queries, mutations, actions, HTTP actions) |
| Database | Convex (real-time, reactive) |
| AI | Anthropic Claude (claude-sonnet-4-20250514) |
| Auth | @convex-dev/auth with Google OAuth |
| Voice | OpenAI Whisper (transcription via Convex action) |

---

## Key Features

### Scholar Interface
- Create and manage conversations with AI tutor
- Real-time streaming chat (HTTP SSE via Convex HTTP action)
- Voice dictation (OpenAI Whisper)
- Dimension selectors: persona, project, perspective
- Archive/rename conversations

### Teacher Dashboard
- View all scholars with real-time status updates (no polling needed)
- Read any conversation with AI analysis
- **Teacher Whispers**: Inject private guidance into system prompt
- **Topic Tracking**: Bloom's taxonomy levels, teacher ratings, mention counts
- **Suggested Topics**: Curate exploration areas for each scholar
- **Observations**: Record praise, concerns, suggestions, interventions
- **Remote Mode**: Open scholar view in new tab (?remote={userId})

### AI Analysis (triggered by teacher)
- Observer analysis: engagement score, complexity level, on-task assessment, topics, learning indicators, concern flags
- Detailed analysis: Bloom's taxonomy level, nudges, follow-up suggestions, topic upsert

---

## Architecture

### Convex Backend (`convex/`)

| File | Purpose |
|------|---------|
| `schema.ts` | Database schema (10 tables with indexes) |
| `auth.config.ts` | Google OAuth provider config |
| `auth.ts` | Auth functions from @convex-dev/auth |
| `lib/auth.ts` | Helpers: getCurrentUser, requireTeacher, requireAdmin |
| `lib/customFunctions.ts` | authedQuery/Mutation, teacherQuery/Mutation wrappers |
| `users.ts` | User queries: currentUser, listScholars, getUser |
| `conversations.ts` | CRUD + getWithMessages (reactive) |
| `messages.ts` | Message queries and insertions |
| `chat.ts` | sendMessage mutation (creates user msg + placeholder) |
| `chatHelpers.ts` | System prompt builder, conversation context |
| `http.ts` | HTTP actions: /chat-stream (SSE), /analyze |
| `personas.ts` | Persona CRUD |
| `perspectives.ts` | Perspective CRUD |
| `projects.ts` | Project CRUD |
| `scholars.ts` | Scholar profile, topics, suggestions |
| `observations.ts` | Teacher observation CRUD |
| `analyses.ts` | Analysis queries |
| `analysisActions.ts` | "use node" actions for Claude Haiku analysis |
| `analysisHelpers.ts` | Internal mutations for analysis results |
| `audioActions.ts` | "use node" action for OpenAI Whisper transcription |
| `seed.ts` | Seed personas, perspectives, test users |

### Frontend

| File | Purpose |
|------|---------|
| `app/providers.tsx` | ConvexAuthProvider + ChakraProvider |
| `app/page.tsx` | Auth redirect (role-based routing) |
| `app/login/page.tsx` | Google OAuth + test user login |
| `app/scholar/page.tsx` | Scholar chat interface with sidebar |
| `app/teacher/page.tsx` | Teacher dashboard (real-time via useQuery) |
| `hooks/useCurrentUser.ts` | Current user hook (replaces useSession) |
| `hooks/useVoiceDictation.ts` | Voice recording + Convex transcription |
| `components/ChatInterface.tsx` | Streaming chat UI |
| `components/ChatHeader.tsx` | Dimension selector dropdowns |
| `components/ConversationViewer.tsx` | Teacher conversation viewer + analysis |
| `components/ScholarProfile.tsx` | Scholar topics/suggestions panel |
| `components/EntityManager.tsx` | CRUD for personas/projects/perspectives |

---

## Database Schema

```
users             -> scholars and teachers (role-based)
conversations     -> per-scholar, with status and teacherWhisper
messages          -> conversation history
analyses          -> AI analysis results
observations      -> teacher notes on scholars
scholarTopics     -> topics discovered + Bloom level + teacher rating
suggestedTopics   -> teacher-curated suggestions
personas          -> AI persona configurations
perspectives      -> learning perspectives (Makawalu lenses)
projects          -> teacher-created assignments/projects
```

**Key relationships:**
- 1 User -> Many Conversations -> Many Messages
- 1 Conversation -> Many Analyses
- 1 Scholar -> Many Topics, Many Suggestions, Many Observations
- Conversations reference optional persona, project, perspective

---

## Authentication & Roles

| Role | Access |
|------|--------|
| Scholar | Own conversations only |
| Teacher | All scholars, dashboard, whispers, observations |
| Admin | Full system access |

- `@tradewinds.school` emails -> auto-assigned teacher role
- Others -> scholar role
- Admins: andy@tradewinds.school, carl@tradewinds.school
- Auth via @convex-dev/auth (Google OAuth + password provider for test users)

---

## Test Users (Development)

```
Teacher: test-teacher-001@test.makawulu.dev (password: test-teacher-001)
Scholars:
  Kai Nakamura: test-scholar-001@test.makawulu.dev
  Lani Kealoha: test-scholar-002@test.makawulu.dev
  Noah Takahashi: test-scholar-003@test.makawulu.dev
Seed data: npx convex run seed:seedAll
```

---

## Commands

```bash
npm run dev          # Next.js dev server (port 1041)
npm run build        # Production build
npm run start        # Production server (port 1041)
npx convex dev       # Convex dev server (run alongside npm run dev)
npx convex run seed:seedAll  # Seed personas, perspectives, test users
```

## DevOps / Type-Checking Without Interactive Terminal

`npx convex dev` requires an interactive terminal (prompts for input) — it won't work from Claude Code directly.

**To type-check Convex functions without deploying:**

```bash
# 1. Generate types (needs CONVEX_DEPLOYMENT env var — the slug from the URL)
CONVEX_DEPLOYMENT=perceptive-husky-735 npx convex codegen

# 2. Type-check Convex backend
npx tsc --noEmit --project convex/tsconfig.json

# 3. Type-check full Next.js frontend
npx tsc --noEmit
```

The deployment slug (`perceptive-husky-735`) comes from `NEXT_PUBLIC_CONVEX_URL` in `.env.local` — strip `https://` and `.convex.cloud`.

**To deploy:** Andy runs `npx convex dev` in a terminal (interactive), or `npx convex deploy` for production.

---

## Environment Variables

```
NEXT_PUBLIC_CONVEX_URL  # Convex deployment URL
ANTHROPIC_API_KEY       # Claude API key (set in Convex dashboard)
OPENAI_API_KEY          # OpenAI Whisper key (set in Convex dashboard)
GOOGLE_CLIENT_ID        # OAuth (set in Convex dashboard)
GOOGLE_CLIENT_SECRET    # OAuth (set in Convex dashboard)
```

---

## Notes

- Convex provides real-time reactivity -- teacher dashboard updates instantly when scholars send messages (no polling)
- Chat streaming uses HTTP SSE via Convex HTTP action at /chat-stream
- Teacher whispers are appended to system prompt, invisible to scholars
- Bloom's taxonomy: remember -> understand -> apply -> analyze -> evaluate -> create
- Voice dictation converts audio to base64, sends to Convex action which calls OpenAI Whisper
