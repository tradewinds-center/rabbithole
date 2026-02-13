# CLAUDE.md - Makawulu

AI-powered classroom learning app for Tradewinds School's gifted scholars.

---

## Roadmap

- [ ] **Google Classroom Integration** - Sync rosters, assignments, grades
- [x] **Categorize by Assignment** - Link conversations to specific assignments/projects ✅ (Jan 2026)
- [ ] **Kupuna/Parent Mode** - Read-only view for grandparents and parents to see scholar progress
- [x] **Reading Level** - Teacher-settable reading level per scholar ✅ (Jan 2026)
- [ ] **Reading Level Auto-Increase** - Auto-increase reading level over time based on performance
- [ ] **Best Quote of the Day → FB** - Surface and post exceptional scholar insights to Facebook
- [ ] **Teacher Supervision Enhancements** - Expand teacher oversight and intervention tools
- [ ] **Focus Mode** - Teacher can "lock" a particular project so scholars must work in it
- [ ] **AI Personas** - Scholars can talk to different AI personas (e.g., scientist, historian, author)
- [ ] **Scholar Dossier** - AI maintains a persistent profile per scholar (reading level, learning style, interests, etc.)
- [ ] **Claude Agent SDK Migration** - Switch to agent SDK with tools for reading/writing dossier, web search, etc.
- [ ] **Scholar Projects UI Redesign** - Replace current project UI with dropdown selector; current IA is confusing
- [ ] **Text-to-Speech** - Click to have Makawulu read responses aloud (OpenAI TTS or browser SpeechSynthesis)
- [ ] **Stack Migration** - Migrate from SQLite/Next.js to Convex + TanStack Router + Vite
- [ ] **Teacher Remote Into Scholar** - Teachers can open a scholar's view in a new tab (?remote={userId}), seeing exactly what the scholar sees using existing routes

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
| Backend | Next.js App Router, NextAuth.js |
| Database | SQLite (better-sqlite3), Drizzle ORM |
| AI | Anthropic Claude (claude-sonnet-4-20250514) |
| Auth | Google OAuth, role-based (scholar/teacher/admin) |

---

## Key Features

### Scholar Interface
- Create and manage conversations with AI tutor
- Real-time streaming chat
- Archive/rename conversations

### Teacher Dashboard
- View all scholars with status indicators (green/yellow/red)
- Read any conversation with AI analysis
- **Teacher Whispers**: Inject private guidance into system prompt
- **Topic Tracking**: Bloom's taxonomy levels, teacher ratings, mention counts
- **Suggested Topics**: Curate exploration areas for each scholar
- **Observations**: Record praise, concerns, suggestions, interventions

### AI Analysis (auto-generated)
- Engagement score (0-1)
- Complexity level (0-1)
- On-task assessment
- Topic extraction
- Learning indicators
- Concern flags
- Intervention recommendations

---

## Database Schema

```
users           → scholars and teachers (role-based)
conversations   → per-scholar, with status and teacherWhisper
messages        → conversation history
analyses        → AI analysis results
observations    → teacher notes on scholars
scholar_topics  → topics discovered + Bloom level + teacher rating
suggested_topics → teacher-curated suggestions
```

**Key relationships:**
- 1 User → Many Conversations → Many Messages
- 1 Conversation → Many Analyses
- 1 Scholar → Many Topics, Many Suggestions, Many Observations

---

## Authentication & Roles

| Role | Access |
|------|--------|
| Scholar | Own conversations only |
| Teacher | All scholars, dashboard, whispers, observations |
| Admin | Full system access |

- `@tradewinds.school` emails → auto-assigned teacher role
- Others → scholar role
- Admins: andy@tradewinds.school, carl@tradewinds.school

---

## Test Users (Development)

```
Teacher: test.teacher@tradewinds.school
Scholars (K-5):
  Koa Medeiros (K), Lily Murphy (1st), Lani Kealoha (2nd), Kai Nakamura (3rd),
  Sophie Anderson (4th), Noah Takahashi (5th), Jack Davis (5th)
Reset: pnpm db:reset
```

---

## Commands

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run db:push      # Run Drizzle migrations
npm run db:studio    # Open Drizzle Studio UI
```

---

## Environment Variables

```
ANTHROPIC_API_KEY     # Claude API key
GOOGLE_CLIENT_ID      # OAuth
GOOGLE_CLIENT_SECRET  # OAuth
NEXTAUTH_URL          # e.g., http://localhost:3000
NEXTAUTH_SECRET       # Random secret for sessions
```

---

## Key Files

| File | Purpose |
|------|---------|
| `db/schema.ts` | Database schema (7 tables) |
| `lib/auth.ts` | NextAuth config, roles, test users |
| `lib/claude.ts` | Claude API, system prompts, analysis |
| `app/scholar/page.tsx` | Scholar chat interface |
| `app/teacher/page.tsx` | Teacher dashboard |
| `components/ChatInterface.tsx` | Streaming chat UI |
| `components/ScholarProfile.tsx` | Scholar topics/suggestions panel |

---

## Google Classroom Integration (TODO)

**Current Status:** No integration - standalone system

**Required for integration:**
- Google Classroom API OAuth scopes (roster, assignments, grades)
- Roster sync: Classroom students → makawulu scholars
- Assignment linking: conversations tied to coursework
- Grade posting: feedback back to Classroom

**Key API scopes needed:**
- `classroom.courses.readonly` - List courses
- `classroom.rosters.readonly` - Get students
- `classroom.coursework.readonly` - Get assignments
- `classroom.coursework.students` - Submit/grade work (read/write)

---

## Kupuna/Parent Mode (TODO)

Read-only access for family members:
- View scholar's conversation history
- See topic progression and Bloom levels
- View teacher observations (praise type)
- No chat capability, no whispers, no editing

**Possible implementation:**
- New role: `kupuna` or `parent`
- Relationship table: parent_scholar (which parents see which scholars)
- Filtered dashboard with celebration focus

---

## Reading Level System ✅

Teachers can set a reading level for each scholar (K through college):
- Set via dropdown in Scholar Profile panel
- Stored in `users.reading_level` column
- Injected into Claude system prompt to adjust vocabulary/complexity
- AI still explores advanced topics but frames them appropriately

**TODO:** Auto-increase reading level based on AI analysis of vocabulary complexity over time.

---

## Projects/Assignments ✅

Teachers can create projects (assignments) with custom AI context:

**Database:** `projects` table with:
- `title`, `description`, `system_prompt`, `rubric`
- `target_bloom_level` (optional cognitive depth target)
- `is_active` (soft delete)

**Teacher Workflow:**
1. Click "Projects" button in dashboard header
2. Create project with title, description, AI instructions, and rubric
3. Set optional Bloom level (remember → create)

**Scholar Workflow:**
1. Sidebar shows "PROJECT" selector (General + any active projects)
2. Select a project to see only conversations for that project
3. "New Project Chat" creates a conversation linked to that project
4. AI tutor receives project context, rubric, and cognitive target

**API Endpoints:**
- `GET/POST /api/projects` - List/create projects
- `GET/PATCH/DELETE /api/projects/[id]` - Single project operations
- `GET/POST /api/conversations?projectId=...` - Filter/create by project

---

## Best Quote to Facebook (TODO)

Surface and share exceptional insights:
- AI flags "notable quotes" during analysis
- Teacher approves/selects best quote
- Integration with Meta Graph API to post to Tradewinds FB page
- Include scholar first name (with permission) or anonymous

---

## Notes

- Database is SQLite file (`makawulu.db`) - consider PostgreSQL for production
- Streaming chat uses Server-Sent Events (SSE)
- Teacher whispers are appended to system prompt, invisible to scholars
- Bloom's taxonomy: remember → understand → apply → analyze → evaluate → create
