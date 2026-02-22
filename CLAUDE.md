# CLAUDE.md - Tradewinds Learn

AI-powered classroom learning app for Tradewinds School's gifted scholars.

---

## Roadmap

- [x] **Status Orbs** - Replace color-coded backgrounds on teacher dashboard with spherical "orbs" next to each student (green/blue/yellow/red/idle). Also show the orb somewhere peripherally visible in scholar view so status is always apparent to everyone.
- [x] **Unified Dimension Picker** - Shared `DimensionPicker` component used in both scholar ProjectHeader and teacher FocusBar. All dimensions in a single labeled row.
- [x] **Scholar Layout Revamp** - Revamp scholar view layout so artifact and process panel can be visible at the same time (currently one or the other).
- [x] **Rename "Conductor View" to "Conductor"**
- [x] **Scholar Home View** - Each scholar gets a home view with a list of their projects to click into. Left panel sidebar still exists for quick switching, but the home view is the primary navigation.
- [ ] **Google Classroom Integration** - Sync rosters, assignments, grades
- [x] **Categorize by Assignment** - Link projects to specific units
- [ ] **Kupuna/Parent Mode** - Read-only view for grandparents and parents to see scholar progress
- [x] **Reading Level** - Teacher-settable reading level per scholar
- [x] **Reading Level Auto-Increase** - Observer infers reading level from scholar messages, suggests to teacher
- [ ] **Best Quote of the Day -> FB** - Surface and post exceptional scholar insights to Facebook
- [ ] **Teacher Supervision Enhancements** - Expand teacher oversight and intervention tools
- [x] **Teacher Whispers** - Ephemeral private guidance injected into AI responses via remote view
- [x] **Focus Mode** - Teacher can "lock" a particular unit so scholars must work in it
- [x] **AI Personas** - Scholars can talk to different AI personas (e.g., scientist, historian, author)
- [x] **Scholar Dossier** - AI maintains a persistent profile per scholar (reading level, learning style, interests, etc.) + observer data flows into system prompt
- [ ] **Claude Agent SDK Migration** - Switch to agent SDK with tools for reading/writing dossier, web search, etc.
- [x] **Text-to-Speech** - Click to have Tradewinds Learn read responses aloud (browser SpeechSynthesis, hover to reveal speaker button)
- [x] **Convex Migration** - Migrated from SQLite/Drizzle/NextAuth to Convex (Feb 2026)
- [x] **Teacher Remote Into Scholar** - Teachers can open a scholar's view in a new tab (?remote={userId})
- [x] **Domain Terminology Rename** - "project" (curriculum) → "unit", "conversation/chat" → "project" (student work)
- [x] **Upload Image** - Scholars can upload images into chat (Convex file storage + Claude vision)
- [x] **Code Artifacts** - Support code blocks as interactive artifacts (create_code tool + live iframe preview)
- [x] **Generate Images** - AI image generation via Gemini 3 Pro (generate_image tool, inline in chat). **TODO:** "Generating image..." loading indicator may not be working — needs verification and debugging.
- [ ] **Volume Control** - Monitor microphone input levels during voice dictation. Show a big "TOO LOUD!" warning overlay when decibels exceed modest speaking volume. Uses Web Audio API AnalyserNode alongside existing MediaRecorder.
  - **Test:** Hold Tab to record voice. Speak normally — no warning. Yell or hold mic close — red warning overlay appears. Warning disappears when volume drops.
- [ ] **Self-Serve Guest Mode** - Visitors can enter their own name at `/guest` (no token needed) and get a unique bookmarkable link they can save and return to. Creates a scholar account automatically.
  - **Test:** Visit `/guest` with no token param. Enter a name, click "Start Learning". Should create account and redirect to `/scholar`. Copy the link shown and visit it in incognito — should auto-sign-in as that guest.
- [ ] **Time Limit Mode** - Parent sets a session time limit with a hardcoded parent password. Inserts a whisper to Claude to wrap things up with 1 minute to spare. Input is disabled when time expires.
  - **Test:** Click clock icon near input area. Enter parent password (set via PARENT_PASSWORD env var in Convex) and time limit (e.g., 2 minutes). Timer countdown appears. At 1 min remaining, check that a whisper is queued. When timer hits 0, input should be disabled with "Time's up!" message.

---

## Overview

**Tradewinds Learn** (from Hawaiian "makawalu" - seeing with eight eyes, multiple perspectives) is a Socratic AI tutoring platform where:

- **Scholars** work on projects with Claude (AI tutor)
- **Teachers** monitor, analyze, and guide learning through a dashboard
- **System** auto-analyzes projects for engagement, complexity, topics, and concerns

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
- Create and manage projects with AI tutor
- Real-time streaming chat (HTTP SSE via Convex HTTP action)
- Voice dictation (OpenAI Whisper)
- Dimension selectors: persona, unit, perspective
- Archive/rename projects

### Teacher Dashboard
- View all scholars with real-time status updates (no polling needed)
- Read any project with AI analysis
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
| `projects.ts` | Project CRUD + sendMessage + getWithMessages (reactive) |
| `messages.ts` | Message queries and insertions |
| `projectHelpers.ts` | System prompt builder, project context |
| `http.ts` | HTTP actions: /project-stream (SSE), /analyze |
| `personas.ts` | Persona CRUD |
| `perspectives.ts` | Perspective CRUD |
| `units.ts` | Unit (curriculum assignment) CRUD |
| `scholars.ts` | Scholar profile + reading level |
| `observations.ts` | Teacher observation CRUD |
| `analyses.ts` | Analysis queries |
| `observer.ts` | "use node" unified observer action (Sonnet) — mastery, signals, seeds |
| `masteryObservations.ts` | Concept mastery records (Bloom's 0-5 float) |
| `sessionSignals.ts` | Learner character signals per session |
| `crossDomainConnections.ts` | Cross-domain thinking records |
| `seeds.ts` | AI-generated + teacher-created exploration seeds |
| `analysisHelpers.ts` | Internal mutations for pulse/analysis results |
| `audioActions.ts` | "use node" action for OpenAI Whisper transcription |
| `seed.ts` | Seed personas, perspectives, test users |

### Frontend

| File | Purpose |
|------|---------|
| `app/providers.tsx` | ConvexAuthProvider + ChakraProvider |
| `app/page.tsx` | Auth redirect (role-based routing) |
| `app/login/page.tsx` | Google OAuth + test user login |
| `app/scholar/page.tsx` | Scholar landing (redirects to project) |
| `app/scholar/[projectId]/page.tsx` | Scholar project view with sidebar |
| `app/teacher/page.tsx` | Teacher dashboard (real-time via useQuery) |
| `hooks/useCurrentUser.ts` | Current user hook (replaces useSession) |
| `hooks/useVoiceDictation.ts` | Voice recording + Convex transcription |
| `components/ProjectInterface.tsx` | Streaming chat UI |
| `components/ProjectHeader.tsx` | Dimension selector dropdowns + editable title |
| `components/ProjectViewer.tsx` | Teacher project viewer + analysis |
| `components/ScholarProfile.tsx` | Scholar topics/suggestions panel |
| `components/EntityManager.tsx` | CRUD for personas/units/perspectives |

---

## Database Schema

```
users             -> scholars and teachers (role-based)
projects          -> per-scholar work sessions, with status and teacherWhisper
messages          -> project message history
artifacts         -> shared documents within a project
processState      -> guided workflow step tracking
analyses          -> AI analysis results (pulse scores)
observations      -> teacher notes on scholars
masteryObservations -> concept mastery records (Bloom's 0-5 float)
teacherMasteryOverrides -> teacher corrections to mastery observations
seeds             -> AI-generated + teacher-created exploration seeds
sessionSignals    -> learner character signals per session
crossDomainConnections -> cross-domain thinking records
standardsDocuments -> curriculum standards documents (future)
standards         -> individual curriculum standards (future)
personas          -> AI persona configurations
perspectives      -> learning perspectives (Makawalu lenses)
units             -> teacher-created curriculum assignments
processes         -> guided step workflows (CRAFT, Weekend News)
focusSettings     -> teacher dimension locks per scholar
```

**Key relationships:**
- 1 User -> Many Projects -> Many Messages
- 1 Project -> Many Analyses
- 1 Scholar -> Many MasteryObservations, Many Seeds, Many SessionSignals, Many Observations
- Projects reference optional persona, unit, perspective, process

---

## Authentication & Roles

| Role | Access |
|------|--------|
| Scholar | Own projects only |
| Teacher | All scholars, dashboard, whispers, observations |
| Admin | Full system access |

- First user to sign up gets admin role automatically
- All subsequent users get scholar role
- Admins promote others to teacher/admin via `/admin`
- Auth via @convex-dev/auth (Google OAuth + password provider for test users)

---

## Test Users (Development)

```
Teacher: test-teacher-001@test.rabbithole.dev (password: test-teacher-001)
Scholars:
  Kai Nakamura: test-scholar-001@test.rabbithole.dev
  Lani Kealoha: test-scholar-002@test.rabbithole.dev
  Noah Takahashi: test-scholar-003@test.rabbithole.dev
Seed data: pnpm db:seed
```

---

## Commands

```bash
npm run dev          # Next.js dev server (port 1041)
npm run build        # Production build
npm run start        # Production server (port 1041)
npx convex dev       # Convex dev server (run alongside npm run dev)
pnpm db:seed         # Seed data + import Common Core standards (non-destructive)
pnpm db:seed:prod    # Same but for production
pnpm db:reset        # Wipe ALL tables, re-seed, re-import standards
pnpm db:reset:prod   # Same but for production (be careful!)
```

## DevOps / Type-Checking Without Interactive Terminal

`npx convex dev` requires an interactive terminal (prompts for input) — it won't work from Claude Code directly.

**To type-check Convex functions without deploying:**

```bash
# 1. Generate types (needs CONVEX_DEPLOYMENT env var — the slug from your Convex URL)
CONVEX_DEPLOYMENT=<your-deployment-slug> npx convex codegen

# 2. Type-check Convex backend
npx tsc --noEmit --project convex/tsconfig.json

# 3. Type-check full Next.js frontend
npx tsc --noEmit
```

The deployment slug comes from `NEXT_PUBLIC_CONVEX_URL` in `.env.local` — strip `https://` and `.convex.cloud`.

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
- Chat streaming uses HTTP SSE via Convex HTTP action at /project-stream
- Teacher whispers are appended to system prompt, invisible to scholars
- Bloom's taxonomy: remember -> understand -> apply -> analyze -> evaluate -> create
- Voice dictation converts audio to base64, sends to Convex action which calls OpenAI Whisper
