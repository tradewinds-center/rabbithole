# 🐇🕳️ Rabbithole

*The AI learning platform for Tradewinds School*

---

## What It Is

Rabbithole is Tradewinds School's AI-powered learning platform. Every scholar has a daily 30-60 minute block where they sit with an AI tutor (Claude) and work — on teacher-assigned units, guided thinking processes, or free exploration. The teacher controls the mode. The AI doesn't lecture. It's Socratic: it asks questions, pushes thinking deeper, connects ideas across domains, and produces shared working documents when the work calls for it.

The system has three layers:

1. **The tutor** — the AI that scholars interact with directly, shaped by teacher-configured prompts
2. **The conductor** — the teacher's real-time dashboard for monitoring, guiding, and intervening
3. **The observer** — a separate AI process that silently reads every transcript and builds a living portrait of each scholar's intellectual life

---

## Units and Building Blocks

The **unit** is the primary thing a scholar works on in Rabbithole. A unit defines what the session is about and how the AI should behave. Teachers create units by composing three kinds of reusable building blocks:

**Personas** shape the AI's personality. Sensei is disciplined and demanding. Lil Sib is playful and peer-like. Feynman explains with analogies and joy. Socrates asks nothing but questions. Explorer goes wherever curiosity leads.

**Perspectives** are thinking lenses — inspired by the Hawaiian concept of makawalu (seeing with eight eyes). "Cause & Effect," "Patterns & Connections," "Multiple Viewpoints," "Debrief" (for reflecting on off-screen experiences). Each perspective guides the AI to approach the topic through a particular way of seeing.

**Processes** are guided step-by-step workflows. The CRAFT writing process walks a scholar through choose → research → arrange → form → transform. A VOICE civic analysis process guides them through view → origins → interests → civic check → evaluate. The AI tracks which step the scholar is on and guides transitions naturally.

A unit brings these together. For example:

| Unit | Persona | Perspective | Process |
|------|---------|-------------|---------|
| Weekend News | — | — | Weekend News (brainstorm → headline → draft → revise → publish) |
| Citizens' Report | Citizen | Democratic Principles | VOICE (view → origins → interests → civic check → evaluate) |
| Animal Adaptations | Explorer | Patterns | — |
| Tide Pool Debrief | — | Debrief | — |
| Free Exploration | Explorer | — | — |

Each building block is defined once and reused across many units. A teacher who creates a new "Aviation Pioneers" unit can attach the existing Explorer persona, the existing "Over Time" perspective, and the existing THINK research process — without rewriting any prompts.

### Teacher-Defined vs. Student-Defined Units

The teacher creates most units and can **focus lock** scholars to specific ones — "today everyone works on Animal Adaptations." But students can also create their own **Independent Study Units**, choosing from the available building blocks:

- Younger scholars mostly work on teacher-assigned units. The teacher designs the experience, picks the building blocks, sets the rubric and Bloom's target.
- Older scholars increasingly co-author their own units. A 5th grader interested in cryptography might create an Independent Study Unit, pick the Feynman persona and the THINK research process, and go.

This is a spectrum, not a binary. The teacher controls how much agency each scholar gets — some scholars might always work on assigned units, while others are ready to design their own investigations.

### The Scholar Experience

Each scholar sees a chat interface with their AI tutor. They type (or dictate via voice), the AI responds, and they go back and forth. When the work calls for it — an essay, a plan, a solution — the AI creates a shared document that both the scholar and AI can edit side by side.

The AI's behavior is shaped by the unit's building blocks: its persona, perspective, process, system prompt, rubric, and target Bloom's level all compose into a single coherent experience. The scholar doesn't need to think about dimensions — they just work on their unit.

### Reading Level Adaptation

Each scholar has a reading level set by the teacher. The AI adjusts its vocabulary and sentence complexity accordingly — a scholar reading at a 2nd grade level gets simpler language, while one reading at a college level gets the full vocabulary. The topic depth doesn't change, just the framing.

### Debrief Units

After any off-screen experience — a field trip, a maker project, a Socratic seminar, a lab — the teacher creates a debrief unit. "Tide Pool Debrief" with the Debrief perspective attached. The AI guides the scholar through reflection: What happened? What surprised you? Why do you think that happened? What connects to what you already know?

This is Dewey's insight: we don't learn from experience alone, we learn from reflecting on experience. The debrief is pedagogically valuable for the scholar (reflection consolidates understanding) and gives the observer a transcript to work with.

---

## The Teacher's Dashboard (Conductor)

The teacher's view is called the **Conductor**. It shows every scholar in real time — who's working, what they're working on, and how it's going.

### Status Orbs

Each scholar has a colored orb visible at a glance:

- **Green** — engaged, on task, conversation flowing well
- **Blue** — deep work, high complexity, strong engagement
- **Yellow** — may need attention — low engagement, off-task drift, or shallow interaction
- **Red** — concern flag — the AI detected something that needs teacher intervention
- **Gray** — idle, no active session

Orbs update automatically after every exchange. The teacher doesn't need to click into each scholar's session to know how things are going — peripheral awareness is built in.

### Live Monitoring & Remote View

The teacher can open any scholar's session to read the full transcript in real time. They can also open a scholar's actual view in a separate browser tab (remote mode) to see exactly what the scholar sees.

### Teacher Whispers

The teacher can inject private guidance into any scholar's AI conversation — in real time, without the scholar knowing. A whisper like "He's getting frustrated — try a different angle" or "She's ready for the challenge problem" gets woven into the AI's next response naturally. The scholar never sees the whisper. The AI never mentions receiving guidance.

Whispers are the teacher's way of coaching the AI in the moment, the same way a lead teacher might lean over to a student teacher and quietly say "try asking her why."

### Authoring Building Blocks and Units

Teachers create the building blocks (personas, perspectives, processes) and compose them into units — all directly in Rabbithole. They write the system prompts, set rubrics and Bloom's targets, and decide which building blocks each unit includes. They control which units are available to scholars and which are focus-locked.

This means the teacher is designing the learning experience, not just monitoring it. The AI is a tool the teacher configures, not an autonomous agent making pedagogical decisions.

### Teacher Observations

Separately from the AI, teachers can record their own freeform observations about any scholar — praise, concerns, suggestions, interventions. These are human observations about the whole child, including things Rabbithole can't see: social dynamics, emotional regulation, physical engagement, peer interactions.

### Teacher Reports

Teachers can write longer-form reports — progress reports, conference notes, end-of-unit reflections — that are stored permanently and automatically appended to the scholar's AI dossier. Unlike quick observations, reports are structured documents with a title and body. Once written, the report's content becomes part of the dossier that the AI tutor can reference in future sessions, creating continuity between the teacher's assessment and the AI's awareness of the scholar.

---

## The Observer (Passive Assessment)

Running silently behind every conversation — whether structured or free — is the **observer**. A separate AI process that reads the transcript after each session and writes down what it saw. Not grades. Not scores on a rubric. Just: what concepts did this scholar engage with, how deeply did they understand them, and what should we explore next?

The observer doesn't care whether the scholar was working on a teacher-assigned unit about ecosystems or following their own curiosity into knot theory. It watches the same way either way. Its output accumulates into a living portrait of each scholar's intellectual life.

### Concept Mastery

When the observer sees a scholar demonstrate understanding of a concept, it writes an observation: the concept name, the domain, the depth of understanding (Bloom's taxonomy, 0.0–5.0), and a brief evidence summary with the relevant transcript excerpt.

The key design choice: **observations are keyed by concept, not by standard.** The observer writes "Oliver demonstrated Analyze-level understanding of Nash equilibria in a game theory context" — not "Oliver met standard 4.OA.3." Nash equilibria don't appear in any K-8 standard, but they're exactly what Oliver was thinking about, and the observation is first-class data.

Concepts can be anything: the distributive property of multiplication, osmosis, the causes of the fall of Rome, knot theory, empathy in moral reasoning, how GPS triangulation works. The observer uses whatever label a knowledgeable teacher would use. Domains emerge organically — Mathematics, Life Science, Game Theory, Ancient History, Philosophy, Topology, Linguistics — rather than being forced into four bureaucratic subject buckets.

**Standards mapping is a secondary lens.** After writing concept-level observations, the system checks whether any of them happen to align with formal standards (Common Core, Hawaii HCPS III). When they do, that mapping is recorded as metadata. This means we can generate a standards compliance view for parent conferences, accreditation, or grant applications — "here's where Oliver stands relative to what the state expects a 3rd grader to know" — without making standards the organizing principle of the data.

The standards compliance view is genuinely useful. It's a common coordinate system for communicating with the outside world. But it's one lens on the sum of human knowledge, not a particularly special or privileged one. The primary view is the **domain map**: what does this child actually know and care about?

### Bloom's Taxonomy — With a Gifted Caveat

The observer rates depth of understanding on a 0.0–5.0 Bloom's scale. The integer boundaries are the classic Bloom's levels, but the observer can use fractional values to express "between levels" — a 2.5 means "clearly beyond Understand but not quite full Apply":

| Level | What it means |
|-------|--------------|
| 0 | No evidence (not "doesn't know it" — just "we haven't seen it") |
| 1 - Remember | Can recall facts, definitions, procedures. May have misconceptions — those are noted specifically, because a well-articulated misconception is more informative than a correct answer. |
| 2 - Understand | Explains in own words. Demonstrates a mental model, even if imperfect. The key distinction: they're interpreting, not just echoing. |
| 3 - Apply | Uses the concept to solve problems in contexts they haven't seen before. Knows when to use a procedure, not just how. |
| 4 - Analyze | Explains *why* something works. Compares, contrasts, identifies structure. Spots errors in reasoning. |
| 5 - Evaluate/Create | Judges, critiques, designs, invents. Extends concepts beyond what was presented. Teaches with genuine insight. |

**Critical for gifted learners:** Bloom's levels are not strictly hierarchical for our scholars. A child can Create (5) before they can reliably Remember (1) — they invent their own notation but can't recall standard terminology. They can Analyze (4) a system they can't yet Apply (3) procedurally. The observer is instructed to rate the highest level demonstrated and treat the gaps between levels as interesting data, not errors. Those gaps are the signature of asynchronous development.

Each observation also carries a **confidence score** (0-1) based on quality of evidence, not quantity. One profound demonstration — deriving something from first principles, independently extending a concept, teaching with real pedagogical skill — can be high confidence. Ten rote correct answers can be low confidence.

### Supersession

When the observer sees new evidence about a concept it's already recorded, it decides what to do: reinforce (raise confidence), contradict (lower the level, note why), or show growth (raise the level, mark the old observation as superseded). The full history is kept — you can always see the trajectory, including regressions and contradictions. A scholar who has both a 4 and a 1 on related concepts is telling you something important.

### Seeds

After each session, the observer suggests **seeds** — things this scholar should explore next. Seeds go in two directions:

**Frontier seeds** (new territory): Based on what the scholar is working on and excited about, what's the natural next concept? A kid fascinated by garden math and plant biology might get a seed for "Fibonacci sequence in sunflower spirals." A kid analyzing game strategies might get "Nash equilibria." Seeds are not limited to formal standards — the goal is to suggest whatever will make this child's eyes light up.

**Depth probe seeds** (going deeper on existing concepts): The scholar is at Apply (3) on the area model for multiplication. Can they Analyze — do they understand *why* the area model works? Can they explain the distributive property? Bloom's makes the depth direction visible instead of collapsing everything into "push forward."

Seeds from the AI start as **pending** — the teacher reviews and accepts or dismisses them before they become active. Teachers can also create seeds directly. This is the teacher's primary lever for steering the scholar's trajectory without prescribing a curriculum.

### Session Signals (Learner Profile)

Separately from concept mastery, the observer notes session-level patterns that reveal the learner's character. These don't map to concepts or standards — they map to who this person is as a thinker. Renzulli's three rings, Dabrowski's overexcitabilities — this is where those frameworks live in the data.

The observer looks for:
- **Task commitment** — sustained focus, persistence, returning to hard problems
- **Creative approach** — novel methods, inventions, original solutions nobody suggested
- **Self-direction** — student-initiated investigations, choosing their own path
- **Intellectual intensity** — rapid-fire questions, deep diving, "but what about...?" chains
- **Emotional engagement** — strong reactions to ideas, empathy in discussions, moral reasoning
- **Cross-domain thinking** — connecting ideas across subjects unprompted
- **Productive struggle** — wrestling with difficulty constructively
- **Metacognition** — thinking about their own thinking, noticing their own confusion

Each signal is rated low/moderate/high and accumulates over time. The learner profile that emerges from these signals is arguably more important than the mastery map — it's the difference between "what does this child know" and "what kind of thinker is this child becoming."

### Cross-Domain Connections

When a scholar links ideas across domains — using math in science, applying historical thinking to current events, connecting game theory to evolutionary biology — the observer records it as a first-class event. These connections are often more meaningful than isolated skill demonstration for gifted learners. They're the moments where the real learning is happening.

---

## What the Teacher Sees (Observer Views)

In addition to the Conductor's real-time monitoring, the teacher has several views into the observer's accumulated data for each scholar. These are organized as tabs in the scholar profile panel:

### Dossier

The scholar's persistent AI-maintained profile — a running narrative of who this scholar is, what they care about, how they learn best, and what the teacher has noted over time. Teacher reports auto-append here, creating a cumulative record that the AI tutor can reference in future sessions.

### Domain Map (Mastery tab — daily view)

The primary view organizes each scholar's knowledge by domain — Mathematics, Life Science, Game Theory, Ancient History, whatever domains have emerged. Within each domain, concepts are listed with their mastery level and confidence. Domains appear as they're encountered — there's no predefined list. Observations older than six months are visually dimmed as potentially stale, signaling they need refreshed evidence.

This is the view you'd use day-to-day: what is Lani working on? What does she understand well? Where are the interesting gaps?

### Standards Compliance Lens (reporting view)

A secondary view that projects concept observations onto the formal standards tree (Common Core Math, Hawaii Science, etc.). Only observations that happen to align with standards appear here. Useful for:
- Parent conferences ("here's where your child stands relative to grade-level expectations")
- Accreditation documentation
- Grant applications
- Identifying genuine blind spots in standard curriculum areas

Gray cells mean "we haven't observed evidence for this standard" — not "the child doesn't know it." There are no progress bars or percent-complete metrics. Wrong framing for a microschool where a 2nd grader might be doing 5th grade math in some areas and hasn't encountered certain 1st grade standards because they haven't come up yet.

### Seeds Review

Pending seeds from the AI, with accept/dismiss workflow. Active seeds (teacher-approved or teacher-created). The teacher's main tool for guiding without prescribing.

### Strengths (Learner Profile)

Signal frequencies and highlights over time. Which scholars show high task commitment? Who's demonstrating creative approaches? Where is productive struggle happening? Cross-domain connections are also listed here — moments when a scholar linked ideas across different domains unprompted.

### Documents

All shared working documents (artifacts) the scholar has produced across their projects — essays, plans, solutions, research notes. Plain text only, designed to be accessible for elementary students.

### Notes & Reports

Teacher observations (quick freeform notes) and longer-form teacher reports, side by side. Reports auto-append to the dossier; notes remain standalone.

### Inspection (click any concept)

Full evidence trail for any concept: every observation over time, transcript excerpts, teacher overrides. If you disagree with the observer's assessment, you can override it with your own rating and notes. Your rating wins in all views, but the observer keeps recording its opinion — you can always compare.

---

## What Rabbithole Doesn't Do

### No Social-Emotional Assessment

Rabbithole only sees the transcript between the scholar and the AI tutor. It has no visibility into:

- How the scholar interacts with peers
- Body language, facial expressions, tone of voice
- Emotional regulation in group settings
- Social dynamics, friendships, conflicts
- How the scholar handles frustration when there's no AI to scaffold
- Empathy as demonstrated in real human relationships (vs. discussing empathy as a concept)

The session signals (emotional engagement, productive struggle) capture some emotional dimensions, but only as expressed in text to an AI. A scholar who writes thoughtfully about moral dilemmas may or may not show that same reasoning when a classmate takes their pencil.

**SEL assessment requires human observation.** The teacher observations system (freeform notes: praise, concern, suggestion, intervention) is where this lives. Rabbithole is not a substitute for knowing your scholars as whole people.

### Limited Visibility Into Off-Screen Learning

Rabbithole only directly sees what happens during AI-mediated sessions. It has no direct visibility into hands-on lab work, field trips, collaborative projects, presentations, independent reading, art, music, or anything embodied.

**Debrief sessions** bridge much of this gap — after any off-screen experience, the teacher sets up a reflection project and the observer captures the scholar's articulated understanding. But debriefs can't capture everything. The physical dexterity of a maker project, the social dynamics of a group discussion, the sensory experience of a tide pool visit — those remain outside the system's view.

**The school's assessment picture should be wider than Rabbithole.** This system is one input alongside teacher observations, project portfolios, presentations, and everything else that makes up a Tradewinds education.

### No Autonomous Curriculum Decisions

Rabbithole observes and records. It does not:

- Generate lesson plans
- Assign work
- Sequence curriculum
- Decide what a scholar should learn next (seeds are *suggestions* for the teacher, not directives for the scholar)
- Replace teacher judgment about readiness, pacing, or priorities

The teacher decides what each scholar works on — units, processes, or free exploration. The teacher authors the AI's prompts. The teacher reviews and approves seeds. The observer just watches and maps what it sees, regardless of the mode.

### No Peer Interaction Assessment

The AI tutor is a one-on-one experience. Rabbithole cannot assess:

- How a scholar explains concepts to another scholar
- Collaborative problem-solving skills
- Leadership, followership, negotiation
- The quality of questions a scholar asks of peers vs. an AI
- Whether understanding demonstrated to an AI transfers to teaching a human

A scholar who can Analyze a concept in conversation with an AI may or may not be able to explain it to a classmate. Those are different skills, and only one of them is visible here.

### Concept Label Drift

The observer uses natural language to name concepts. Over time, it might use slightly different labels for the same concept — "area model for multiplication" vs. "area model for multi-digit multiplication." The observer is explicitly instructed to check existing observations and reuse exact labels when the concept is the same, which mitigates most drift. But some noise from label variation is a known tradeoff of using natural concept labels instead of rigid standard codes.

---

## Philosophy

Rabbithole is built on a few beliefs:

**The teacher is the architect.** The AI is a powerful tool, but it doesn't make pedagogical decisions. The teacher designs the learning experience — writing prompts, configuring dimensions, setting focus locks, reviewing seeds, overriding assessments. Rabbithole amplifies teacher judgment; it doesn't replace it.

**The graph of human knowledge already exists — in Claude's training data.** Common Core is a small, politically-negotiated subgraph. Wikipedia is a better map. A college course catalog is a better map. Claude's internal representation of how concepts relate to each other is probably the best map available, and we can access it one chunk at a time by asking. We don't need to pre-build the knowledge graph. We just need to record what each scholar touches and let the AI name it.

**Standards are for communication, not organization.** When a parent asks "is my child on grade level in math?" we should be able to answer clearly and specifically. When an accreditor asks for evidence of standards coverage, we should have it. But the daily experience of teaching and learning should not be organized around standards compliance. The domain map — "here's what Kai actually knows and cares about" — is the real artifact.

**Misconceptions are more informative than correct answers.** "Student believes heavier objects fall faster" tells you exactly where to intervene and exactly what mental model needs revision. "Got it wrong" tells you nothing. The observer is instructed to treat misconceptions as gold.

**The gaps are the signature.** A gifted child who can Create at Bloom's 5 but can't Remember at Bloom's 1 — who invents their own notation but can't recall standard terminology — is not broken. That's asynchronous development. The gaps between levels are interesting data, not errors to be corrected. Record them honestly.

**Seeds should excite, not just advance.** The question is "what would make this kid's eyes light up?" not "what's the next standard in the sequence?" A kid fascinated by garden math might love the Fibonacci sequence in sunflower spirals. A kid analyzing game strategies might be ready for the prisoner's dilemma. None of these appear in K-8 standards. All of them could be the seed that starts a lifelong intellectual obsession.

**Observation without prescription.** The observer watches and records. It does not tell the scholar what to learn or the teacher what to teach. It provides a map. The humans decide where to go.
