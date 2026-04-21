import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const TEACHER_MARKER = "[Teacher-authored 2026-04-20: SWI / stealth-dyslexia directives]";

const SWI_SECTION = `

---

${TEACHER_MARKER}

Cognitive profile (internal / tutor-only — do not surface to Noah):
- Neuropsych eval (Feb 2026): Full Scale IQ 127. Verbal Comprehension, Visual-Spatial, and Fluid Reasoning all at the 99th percentile. Working Memory 84th. Processing Speed 9th (Mildly Impaired). Diagnosed ADHD, Mild Inattentive.
- Reading and spelling scores sit in Average range despite superior verbal reasoning — profile consistent with stealth dyslexia. Still spells phonetically. Difficulty with multisyllabic words.
- Orthographic mapping has not fully developed.

Pedagogical directives for word/spelling work:
- Use Structured Word Inquiry (SWI): when an interesting, multisyllabic, or morphologically rich word shows up in conversation, briefly pause to investigate its structure. Break into morphemes, trace the root, show sibling words. Example: *volcano* → Latin *Vulcanus* → *vulcanize*, *volcanic*.
- Do NOT drill phonics or "sound it out" practice. The standard phonics approach doesn't address his orthographic-mapping gap and Noah is too bright for it — he will disengage.
- Frame spelling as a puzzle with hidden logic, not memorization. Respect his giftedness.
- Keep word investigations short and curiosity-driven — 2–3 turns, not a lecture.
- Occasionally ask him to type a word from memory after an investigation (framed as curiosity, not a quiz — e.g. "can you write *cinematography* without looking?"). This is the orthographic-mapping practice he most needs.
- Celebrate pattern-discovery moments ("whoa — *sign*, *signature*, and *design* are all cousins").
- Never label this as spelling practice, remediation, or extra help. It's just how we talk about interesting words.

Morphology hook via filmmaking (his passion):
- Film and cinema vocabulary is unusually rich in Latin, Greek, and French roots — use it as the primary on-ramp for word investigations.
- Examples: *cinema* / Greek *kinema* ("movement") → *kinetic*, *kinesiology*; *director* (Latin *directus*, "led straight"); *produce* (Latin *producere*, "lead forward"); *scene*, *genre*, *cinematography*, *montage*, *sequel*, *prequel*, *trilogy*, *documentary*.
- When he brings up a film, director, or filmmaking concept, treat it as an opening to investigate word structure. Tie morpheme work to stories, directors, and how movies are made whenever possible.
`;

const SEED_DEFS: Array<{
  topic: string;
  rationale: string;
  approachHint: string;
}> = [
  {
    topic: "Latin and Greek roots hiding inside a word that surprised you today",
    rationale:
      "Low-barrier opportunistic morphology investigation anchored to whatever caught Noah's curiosity in the session. Builds the habit of noticing word structure without any specific target vocabulary.",
    approachHint:
      "When Noah uses or encounters an interesting multisyllabic word, briefly investigate its structure. Break into morphemes, trace the root, show 2–3 sibling words. Keep it to 2–3 turns.",
  },
  {
    topic: "Film vocabulary etymology — cinema, director, scene, genre, montage",
    rationale:
      "Hooks morphology work directly into Noah's filmmaker identity (Spielberg idol, iMovie work, POV horror theory). Cinema vocabulary is morphologically rich (Greek/Latin/French) and keeps his curiosity high because it's tied to his real interest.",
    approachHint:
      "Anchor around Greek *kinema* (motion → cinema, kinetic), Latin *director* (one who leads → direct, indirect, direction), French *montage* (to mount/assemble). Let Noah pick what to investigate first — he likely has opinions.",
  },
  {
    topic: "The -spect- morpheme family — spectacle, inspect, respect, perspective, suspect",
    rationale:
      "Classic SWI morpheme family. One root (Latin specere, 'to look') unlocks many high-utility words. Shows Noah that knowing a root gives him multiple spellings at once.",
    approachHint:
      "Build the family together. Start with *spectacle* (a thing to look at) and ladder out: *inspect* (look in), *respect* (look back at), *perspective* (look through), *suspect* (look up at with suspicion). Film tie-in: a *spectacle* in filmmaking is a big visual event — Spielberg is famous for them.",
  },
  {
    topic: "The -port- morpheme family — import, export, portable, report, transport",
    rationale:
      "Another high-utility Latin root (portare, 'to carry'). Pairs naturally with -spect- to give Noah two foundational morpheme families early.",
    approachHint:
      "Start with *transport* and work both directions: *portable* (can be carried), *import* (carry in), *export* (carry out), *report* (carry back). Film angle: movies are exported internationally; film reels used to be physically transported between theaters.",
  },
  {
    topic: "Why is the g in 'sign' silent?",
    rationale:
      "The silent-g puzzle is the ideal 'whoa' moment for morphologically-aware spellers. It reveals that English spells meaning (morphemes), not sound — because *sign* is related to *signature*, *signal*, *design*, *assign*, the g has to stay. This single insight reframes spelling for kids like Noah.",
    approachHint:
      "Ask if Noah has ever wondered why words are spelled weirdly. Walk *sign* → *signature*: same morpheme, pronounced differently. Expand to *design*, *signal*, *assign*. Land: English spells morphemes, not sounds.",
  },
  {
    topic: "Build a word from parts — tele- + -scope, photo- + -graph, cine- + -ma",
    rationale:
      "Compositional spelling — English words as building blocks. Once Noah sees this, he can decode and spell long words by their parts rather than guessing phonetically. Direct antidote to the 'sounds it out' habit.",
    approachHint:
      "Start with *telescope*. Break: *tele-* (far) + *-scope* (look). Show combinations: *telephone* (far-sound), *telegraph* (far-writing), *photograph* (light-writing), *cinematograph* (motion-writing → cinema). Challenge Noah to invent a word.",
  },
];

const LESSON_DEFS: Array<{
  strand: "core" | "connections" | "practice" | "identity";
  title: string;
  systemPrompt: string;
}> = [
  {
    strand: "core",
    title: "What is a morpheme?",
    systemPrompt:
      "Guide Noah to discover that English words are built from reusable parts called morphemes. Start by asking him to think of a word from a recent film (or something he's interested in) and investigate its parts. Examples: *director* = direct + -or (one who directs); *cinematographer* = cine + mat(o) + graph + er. Don't lecture — let him discover by breaking apart words he already knows. Use Structured Word Inquiry (SWI). Frame as detective work. Never call this 'spelling practice.'",
  },
  {
    strand: "connections",
    title: "Latin and Greek roots in filmmaking and science",
    systemPrompt:
      "Show Noah that the same ancient roots appear in film, science, and everyday words. Example: Greek *kinema* (motion) → cinema, kinetic, kinesiology. Greek *graph* (to write) → photograph, telegraph, cinematograph, paragraph. Latin *port* (to carry) → transport, export, report. Connect across domains whenever you can — if he mentions a rocket, probe *propulsion*, *astronaut* (Greek *aster* + *naut*, 'star-sailor'). The goal is to feel the connectivity of language.",
  },
  {
    strand: "practice",
    title: "Build and break words",
    systemPrompt:
      "Active practice: have Noah compose new words from known parts (tele- + -vision, micro- + -scope) and decompose unfamiliar words he encounters. When he spells a word phonetically, gently investigate the correct form through morpheme structure rather than correcting him directly. Example: if he writes 'prefered', walk through prefer + -ed and the consonant-doubling rule. Occasionally ask him to type a target word from memory after an investigation — frame as curiosity ('can you spell *cinematography* without looking?'), never as a quiz.",
  },
  {
    strand: "identity",
    title: "You are a word detective",
    systemPrompt:
      "Help Noah build the identity of a word detective — someone who notices roots in film credits, book titles, scientific names, game lore. Ask him to spot a word in the wild this week (from a movie, a book, Poppy Playtime lore) and investigate it together. Celebrate his discoveries. The goal: words stop being things to memorize and start being things to investigate. Over time this builds orthographic confidence and curiosity about language.",
  },
];

export const seedNoahMorphology = internalMutation({
  args: {
    scholarId: v.id("users"),
    teacherId: v.id("users"),
  },
  handler: async (ctx, { scholarId, teacherId }) => {
    const summary: {
      dossierAction: "appended" | "created" | "already_present";
      seedsCreated: number;
      seedsSkipped: number;
      unitId: string | null;
      unitAction: "created" | "already_exists";
      lessonsCreated: number;
      lessonsSkipped: number;
    } = {
      dossierAction: "already_present",
      seedsCreated: 0,
      seedsSkipped: 0,
      unitId: null,
      unitAction: "already_exists",
      lessonsCreated: 0,
      lessonsSkipped: 0,
    };

    // 1. Dossier — append SWI section to existing content (preserve what the observer built)
    const existingDossier = await ctx.db
      .query("scholarDossiers")
      .withIndex("by_scholar", (q) => q.eq("scholarId", scholarId))
      .first();

    const existingContent = existingDossier?.content ?? "";
    const alreadyHasSection = existingContent.includes(TEACHER_MARKER);

    if (!alreadyHasSection) {
      const newContent = (existingContent.trim() + SWI_SECTION).trimStart();
      if (existingDossier) {
        await ctx.db.patch(existingDossier._id, { content: newContent });
        summary.dossierAction = "appended";
      } else {
        await ctx.db.insert("scholarDossiers", { scholarId, content: newContent });
        summary.dossierAction = "created";
      }
    }

    // 2. Seeds — idempotent per topic
    for (const def of SEED_DEFS) {
      const existing = await ctx.db
        .query("seeds")
        .withIndex("by_scholar_status", (q) =>
          q.eq("scholarId", scholarId).eq("status", "active")
        )
        .filter((q) => q.eq(q.field("topic"), def.topic))
        .first();
      if (existing) {
        summary.seedsSkipped++;
        continue;
      }
      await ctx.db.insert("seeds", {
        scholarId,
        origin: "teacher",
        status: "active",
        topic: def.topic,
        domain: "language arts",
        suggestionType: "teacher_suggestion",
        rationale: def.rationale,
        approachHint: def.approachHint,
        teacherId,
      });
      summary.seedsCreated++;
    }

    // 3. Unit — scholar-scoped "Word Detective"
    const UNIT_TITLE = "Word Detective";
    const existingUnit = await ctx.db
      .query("units")
      .withIndex("by_scholar", (q) => q.eq("scholarId", scholarId))
      .filter((q) => q.eq(q.field("title"), UNIT_TITLE))
      .first();

    let unitId;
    if (existingUnit) {
      unitId = existingUnit._id;
      summary.unitAction = "already_exists";
    } else {
      unitId = await ctx.db.insert("units", {
        teacherId,
        scholarId,
        title: UNIT_TITLE,
        emoji: "🔍",
        description:
          "Investigate English words like a filmmaker investigating a mystery. Break them into morphemes, trace roots, and discover the hidden logic of English spelling — with cinema vocabulary as the on-ramp.",
        bigIdea:
          "English words are built from reusable parts (morphemes) that carry meaning across words. When you know the parts, you can spell and understand words you've never seen before.",
        essentialQuestions: [
          "How does English spell meaning, not just sound?",
          "What hidden parts show up in words again and again?",
          "Why do filmmakers, scientists, and writers use words built from the same ancient roots?",
        ],
        enduringUnderstandings: [
          "Most English words are made of morphemes (roots, prefixes, suffixes).",
          "Morphemes keep their spelling even when their pronunciation changes (sign / signature).",
          "Latin and Greek roots are reusable building blocks — learning one root unlocks many words.",
        ],
        subject: "Language Arts",
        gradeLevel: "3",
        isActive: true,
      });
      summary.unitAction = "created";
    }
    summary.unitId = unitId;

    // 4. Lessons — idempotent per (unit, title)
    for (const def of LESSON_DEFS) {
      const existing = await ctx.db
        .query("lessons")
        .withIndex("by_unit", (q) => q.eq("unitId", unitId))
        .filter((q) => q.eq(q.field("title"), def.title))
        .first();
      if (existing) {
        summary.lessonsSkipped++;
        continue;
      }
      const lessonsInUnit = await ctx.db
        .query("lessons")
        .withIndex("by_unit", (q) => q.eq("unitId", unitId))
        .collect();
      const nextOrder =
        lessonsInUnit.reduce((m, l) => Math.max(m, l.order), -1) + 1;

      await ctx.db.insert("lessons", {
        unitId,
        title: def.title,
        strand: def.strand,
        systemPrompt: def.systemPrompt,
        order: nextOrder,
      });
      summary.lessonsCreated++;
    }

    return summary;
  },
});
