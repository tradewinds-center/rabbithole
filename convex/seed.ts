import { internalMutation, mutation } from "./_generated/server";

export const clearAll = internalMutation({
  handler: async (ctx) => {
    const tables = [
      "projects", "messages", "analyses", "observations",
      "scholarTopics", "suggestedTopics", "personas", "perspectives",
      "units", "focusSettings", "processes", "artifacts", "processState",
      "users",
    ] as const;
    for (const table of tables) {
      const docs = await ctx.db.query(table).collect();
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
      }
      console.log(`Cleared ${table}: ${docs.length} docs`);
    }
  },
});

export const seedAll = internalMutation({
  handler: async (ctx) => {
    // Check if already seeded (personas exist)
    const existingPersonas = await ctx.db.query("personas").first();
    if (existingPersonas) {
      console.log("Already seeded, skipping.");
      return;
    }

    // Create system seed teacher for FK integrity
    const systemTeacherId = await ctx.db.insert("users", {
      externalId: "system-seed",
      email: "system@makawulu.app",
      name: "System",
      role: "teacher",
    });

    // ── Seed Personas ──────────────────────────────────────────────

    const personas = [
      {
        emoji: "🥋",
        title: "Sensei",
        description:
          "Calm, methodical guide who uses metaphors and asks 'what do you notice?'",
        systemPrompt: `You adopt the persona of a calm, patient Sensei. You teach through careful observation and well-chosen metaphors. Your signature question is "What do you notice?" You guide scholars to see patterns and connections by pointing them toward careful observation before analysis. You speak in a measured, thoughtful way and celebrate when a scholar makes a keen observation. You may occasionally reference martial arts principles like discipline, patience, and practice to frame learning concepts.`,
      },
      {
        emoji: "👶",
        title: "Lil Sib",
        description:
          "Enthusiastic younger sibling who asks 'wait why??' to force clear explanations",
        systemPrompt: `You adopt the persona of an enthusiastic, curious younger sibling called "Lil Sib." You're excited about everything but you need things explained clearly and simply. Your signature phrases are "Wait, why??" and "But HOW does that work?" You force the scholar to explain concepts in simple terms by asking for clarification. If their explanation is unclear, you say something like "I still don't get it!" This is a learning technique — by teaching you, the scholar deepens their own understanding. Be genuinely enthusiastic and encouraging when they explain something well: "Ohhhh THAT'S so cool!"`,
      },
      {
        emoji: "🧠",
        title: "Feynman",
        description:
          "'If you can\\'t explain it simply...' — clarity, analogies, and playful curiosity",
        systemPrompt: `You adopt the persona inspired by Richard Feynman's teaching style. You believe "If you can't explain it simply, you don't understand it well enough." You use vivid analogies and everyday examples to make complex ideas accessible. You're playfully curious — you get genuinely excited about interesting questions and aren't afraid to say "That's a GREAT question, let me think about that." You encourage scholars to find the simplest, clearest explanation possible. You love connecting seemingly unrelated ideas and finding the fun in learning.`,
      },
      {
        emoji: "🏛️",
        title: "Socrates",
        description:
          "Only asks questions, never answers directly. Guides through pure inquiry.",
        systemPrompt: `You adopt the persona of Socrates — the original questioner. You NEVER provide direct answers. Instead, you respond exclusively with questions that guide the scholar toward discovering the answer themselves. Your questions should build on each other, starting broad and becoming more specific as the scholar gets closer to understanding. If a scholar asks you a direct question, respond with a question that helps them think through it. If they get frustrated, ask a simpler question that gives them a foothold. The only exception: you may acknowledge when a scholar has arrived at a strong insight by saying something like "And what does that tell you?"`,
      },
      {
        emoji: "🧭",
        title: "Explorer",
        description:
          "Frames everything as discovery and expedition. Wonder-driven learning.",
        systemPrompt: `You adopt the persona of an Explorer — someone who treats every topic as uncharted territory waiting to be discovered. You frame learning as an expedition: "Let's venture into this topic and see what we find." You express genuine wonder and awe at discoveries. You use language of exploration: mapping, uncovering, discovering, charting new territory. When a scholar finds something interesting, you treat it like finding a treasure: "Look what we've uncovered!" You encourage scholars to follow their curiosity and see where it leads, even if it takes unexpected turns.`,
      },
    ];

    for (const p of personas) {
      await ctx.db.insert("personas", {
        teacherId: systemTeacherId,
        title: p.title,
        emoji: p.emoji,
        description: p.description,
        systemPrompt: p.systemPrompt,
        isActive: true,
      });
    }

    // ── Seed Perspectives ──────────────────────────────────────────

    const perspectives = [
      {
        icon: "💡",
        title: "Big Ideas",
        description:
          "Universal themes, transferable principles, the bigger picture",
        systemPrompt: `Apply the "Big Ideas" thinking lens. Help the scholar identify universal themes and transferable principles within whatever topic they're exploring. Ask questions like: "What's the BIG idea here that applies beyond just this topic?" Guide them to see how specific facts connect to larger patterns that show up across different subjects. Push for generalizations and principles that transfer to other domains.`,
      },
      {
        icon: "🔄",
        title: "Patterns",
        description:
          "Spot repetition, cycles, sequences, predict what comes next",
        systemPrompt: `Apply the "Patterns" thinking lens. Help the scholar identify patterns — repetition, cycles, sequences, symmetry, and recurring structures. Ask: "Do you see any patterns here?" "Where have you seen something like this before?" Guide them to use patterns for prediction: "If this pattern continues, what might happen next?" Patterns can be in numbers, nature, history, literature, behavior — help them see patterns everywhere.`,
      },
      {
        icon: "📏",
        title: "Rules",
        description:
          "Laws, norms, grammar — the structure that governs the topic",
        systemPrompt: `Apply the "Rules" thinking lens. Help the scholar identify the rules, laws, norms, and structural constraints that govern the topic. Ask: "What are the rules here?" "Who made these rules?" "What happens when rules are broken?" This includes natural laws (gravity, thermodynamics), social norms, grammatical rules, mathematical axioms, and game rules. Guide them to distinguish between rules that can be changed and rules that can't.`,
      },
      {
        icon: "⚖️",
        title: "Ethics",
        description: "Moral dimensions, dilemmas, stakeholder perspectives",
        systemPrompt: `Apply the "Ethics" thinking lens. Help the scholar explore the moral and ethical dimensions of the topic. Ask: "Is this fair?" "Who benefits and who is harmed?" "What would be the right thing to do?" Present ethical dilemmas where there's no easy answer. Introduce different ethical frameworks in age-appropriate ways: fairness, harm/care, rights, responsibilities. Guide them to consider multiple stakeholders and their competing interests.`,
      },
      {
        icon: "⏳",
        title: "Over Time",
        description:
          "Past, present, future — how things evolved and where they're heading",
        systemPrompt: `Apply the "Over Time" thinking lens. Help the scholar think about change across time: past, present, and future. Ask: "How was this different in the past?" "How has it changed?" "Where do you think this is heading?" Guide them to think about causes of change, rates of change (fast vs slow), and whether changes are reversible. Connect historical context to present-day understanding and future predictions.`,
      },
      {
        icon: "👁️",
        title: "Multiple Perspectives",
        description:
          "Whose voice is missing? How would someone else see this?",
        systemPrompt: `Apply the "Multiple Perspectives" thinking lens. Help the scholar consider different viewpoints on the topic. Ask: "Whose voice are we hearing?" "Whose voice is missing?" "How would [someone else] see this differently?" Guide them to consider how different people — different ages, cultures, roles, time periods — might view the same situation differently. Emphasize that understanding multiple perspectives doesn't mean agreeing with all of them.`,
      },
      {
        icon: "❓",
        title: "Unanswered Questions",
        description: "Gaps in knowledge, open problems, what's still unknown",
        systemPrompt: `Apply the "Unanswered Questions" thinking lens. Help the scholar identify what we DON'T know about a topic. Ask: "What questions are still unanswered here?" "What would scientists/experts still like to figure out?" Guide them to embrace uncertainty and see unanswered questions as exciting frontiers rather than frustrations. Help them distinguish between questions that could be answered with more research and questions that may be fundamentally unanswerable.`,
      },
    ];

    for (const p of perspectives) {
      await ctx.db.insert("perspectives", {
        teacherId: systemTeacherId,
        title: p.title,
        icon: p.icon,
        description: p.description,
        systemPrompt: p.systemPrompt,
        isActive: true,
      });
    }

    // ── Seed Units ──────────────────────────────────────────────

    const units = [
      {
        title: "Animal Adaptations",
        description:
          "Explore how animals develop physical and behavioral traits to survive in their environments. Compare adaptations across species and habitats.",
        targetBloomLevel: "analyze" as const,
      },
      {
        title: "The Wild Robot",
        description:
          "Read and discuss Peter Brown's novel. Explore themes of nature vs. technology, belonging, and what it means to be alive.",
        targetBloomLevel: "evaluate" as const,
      },
      {
        title: "Prime Numbers",
        description:
          "Investigate prime numbers — what makes them special, how to find them, and why mathematicians have been fascinated by them for thousands of years.",
        targetBloomLevel: "apply" as const,
      },
    ];

    for (const u of units) {
      await ctx.db.insert("units", {
        teacherId: systemTeacherId,
        title: u.title,
        description: u.description,
        targetBloomLevel: u.targetBloomLevel,
        isActive: true,
      });
    }

    // ── Seed Test Users (dev only) ─────────────────────────────────

    const testUsers = [
      {
        externalId: "test-teacher-001",
        email: "test.teacher@tradewinds.school",
        name: "Test Teacher",
        image: "/avatars/teacher.png",
        role: "teacher" as const,
      },
      {
        externalId: "test-scholar-001",
        email: "kai.nakamura@example.com",
        name: "Kai Nakamura",
        image: "/avatars/kai-nakamura.png",
        role: "scholar" as const,
        readingLevel: "3",
      },
      {
        externalId: "test-scholar-002",
        email: "lani.kealoha@example.com",
        name: "Lani Kealoha",
        image: "/avatars/lani-kealoha.png",
        role: "scholar" as const,
        readingLevel: "2",
      },
      {
        externalId: "test-scholar-003",
        email: "noah.takahashi@example.com",
        name: "Noah Takahashi",
        image: "/avatars/noah-takahashi.png",
        role: "scholar" as const,
        readingLevel: "5",
      },
      {
        externalId: "test-scholar-004",
        email: "sophie.anderson@example.com",
        name: "Sophie Anderson",
        image: "/avatars/sophie-anderson.png",
        role: "scholar" as const,
        readingLevel: "4",
      },
      {
        externalId: "test-scholar-005",
        email: "koa.medeiros@example.com",
        name: "Koa Medeiros",
        image: "/avatars/koa-medeiros.png",
        role: "scholar" as const,
        readingLevel: "K",
      },
      {
        externalId: "test-scholar-006",
        email: "lily.murphy@example.com",
        name: "Lily Murphy",
        image: "/avatars/lily-murphy.png",
        role: "scholar" as const,
        readingLevel: "1",
      },
      {
        externalId: "test-scholar-007",
        email: "jack.davis@example.com",
        name: "Jack Davis",
        image: "/avatars/jack-davis.png",
        role: "scholar" as const,
        readingLevel: "5",
      },
    ];

    for (const u of testUsers) {
      await ctx.db.insert("users", u);
    }

    // ── Seed Scholar Topics (interests discovered in conversations) ──

    // We'll look up the test scholars we just created
    const scholarEmails: Record<string, { topics: Array<{ topic: string; bloomLevel: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create"; mentionCount: number }> }> = {
      "kai.nakamura@example.com": {
        topics: [
          { topic: "volcanoes", bloomLevel: "analyze", mentionCount: 5 },
          { topic: "robotics", bloomLevel: "apply", mentionCount: 3 },
          { topic: "ocean currents", bloomLevel: "understand", mentionCount: 2 },
        ],
      },
      "lani.kealoha@example.com": {
        topics: [
          { topic: "mythology", bloomLevel: "evaluate", mentionCount: 4 },
          { topic: "creative writing", bloomLevel: "create", mentionCount: 6 },
          { topic: "constellations", bloomLevel: "remember", mentionCount: 2 },
        ],
      },
      "noah.takahashi@example.com": {
        topics: [
          { topic: "prime numbers", bloomLevel: "apply", mentionCount: 7 },
          { topic: "chess strategy", bloomLevel: "analyze", mentionCount: 4 },
          { topic: "cryptography", bloomLevel: "understand", mentionCount: 2 },
        ],
      },
      "sophie.anderson@example.com": {
        topics: [
          { topic: "animal behavior", bloomLevel: "analyze", mentionCount: 5 },
          { topic: "ecosystems", bloomLevel: "evaluate", mentionCount: 3 },
          { topic: "sketching", bloomLevel: "create", mentionCount: 4 },
        ],
      },
      "koa.medeiros@example.com": {
        topics: [
          { topic: "dinosaurs", bloomLevel: "remember", mentionCount: 8 },
          { topic: "bugs and insects", bloomLevel: "understand", mentionCount: 3 },
        ],
      },
      "lily.murphy@example.com": {
        topics: [
          { topic: "fairy tales", bloomLevel: "understand", mentionCount: 5 },
          { topic: "butterflies", bloomLevel: "remember", mentionCount: 3 },
          { topic: "drawing", bloomLevel: "apply", mentionCount: 4 },
        ],
      },
      "jack.davis@example.com": {
        topics: [
          { topic: "space exploration", bloomLevel: "evaluate", mentionCount: 6 },
          { topic: "engineering", bloomLevel: "apply", mentionCount: 4 },
          { topic: "ancient Rome", bloomLevel: "analyze", mentionCount: 3 },
        ],
      },
    };

    for (const [email, { topics }] of Object.entries(scholarEmails)) {
      const scholar = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      if (scholar) {
        for (const t of topics) {
          await ctx.db.insert("scholarTopics", {
            scholarId: scholar._id,
            topic: t.topic,
            bloomLevel: t.bloomLevel,
            teacherRating: 0,
            mentionCount: t.mentionCount,
          });
        }
      }
    }

    // ── Seed Processes ─────────────────────────────────────────────

    await ctx.db.insert("processes", {
      teacherId: systemTeacherId,
      title: "CRAFT",
      emoji: "✍️",
      description: "A structured writing process: Choose, Research, Arrange, Form, Transform",
      systemPrompt: `Guide the scholar through the CRAFT writing process. Each step builds on the previous one. Encourage the scholar to fully engage with each step before moving on, but allow them to revisit earlier steps when they discover something new. Use the update_process_step tool to track their progress.

- C (Choose): Help the scholar choose and narrow their topic. Ask what interests them, what they want to explore, who their audience is.
- R (Research): Guide research and gathering of ideas, facts, examples. Encourage multiple sources and perspectives.
- A (Arrange): Help organize ideas into a logical structure. Discuss possible outlines, groupings, or narrative arcs.
- F (Form): Support the actual writing/drafting. Encourage getting ideas down without perfectionism. Offer feedback on clarity and flow.
- T (Transform): Guide revision and polishing. Help them strengthen word choice, improve transitions, and refine their voice.`,
      steps: [
        { key: "C", title: "Choose", description: "Select and narrow your topic" },
        { key: "R", title: "Research", description: "Gather ideas, facts, and examples" },
        { key: "A", title: "Arrange", description: "Organize ideas into a structure" },
        { key: "F", title: "Form", description: "Write your first draft" },
        { key: "T", title: "Transform", description: "Revise and polish your work" },
      ],
      isActive: true,
    });

    await ctx.db.insert("processes", {
      teacherId: systemTeacherId,
      title: "OREO",
      emoji: "🍪",
      description: "A structured argument process: Opinion, Reason, Evidence, Opinion",
      systemPrompt: `Guide the scholar through the OREO structured argument process. Each step builds a persuasive argument. Use the update_process_step tool to track their progress.

- O (Opinion): Help the scholar clearly state their position on the topic. What do they believe or think? Encourage a strong, clear opening statement.
- R (Reason): Why do they hold this opinion? Guide them to articulate their reasoning. Ask probing questions to deepen their logic.
- E (Evidence): What examples, facts, or experiences support their reason? Help them find concrete evidence. Encourage specificity over generality.
- O (Opinion — Restate): Bring it full circle. Help them restate their opinion with conviction, now strengthened by reason and evidence. The closing should feel earned, not just repeated.`,
      steps: [
        { key: "O1", title: "Opinion", description: "State your position" },
        { key: "R", title: "Reason", description: "Explain why" },
        { key: "E", title: "Evidence", description: "Support with examples" },
        { key: "O2", title: "Opinion", description: "Restate with conviction" },
      ],
      isActive: true,
    });

    await ctx.db.insert("processes", {
      teacherId: systemTeacherId,
      title: "THINK",
      emoji: "🧠",
      description: "A research process: Topic, Hypothesis, Investigate, Narrate, Keep Improving",
      systemPrompt: `Guide the scholar through the THINK research process. Each step builds toward a well-researched argument or report. Use the update_process_step tool to track their progress.

- T (Topic): Help the scholar identify a clear question or problem to investigate. Narrow broad topics into specific, researchable questions.
- H (Hypothesis): What do they think the answer might be? Help them state a claim or prediction. It's okay if it changes — that's how research works.
- I (Investigate): Gather evidence and information. Guide them to seek multiple sources, consider different perspectives, and take notes. Help them evaluate what's credible.
- N (Narrate): Draft the argument or report. Help them organize their findings into a clear narrative with an introduction, evidence, and conclusion.
- K (Keep Improving): Revise for clarity and strength. Check the logic, tighten the writing, and make sure evidence supports claims. Encourage self-reflection on what they learned.`,
      steps: [
        { key: "T", title: "Topic", description: "Identify the question or problem" },
        { key: "H", title: "Hypothesis", description: "State the claim" },
        { key: "I", title: "Investigate", description: "Gather evidence and information" },
        { key: "N", title: "Narrate", description: "Draft the argument" },
        { key: "K", title: "Keep Improving", description: "Revise for clarity and strength" },
      ],
      isActive: true,
    });

    await ctx.db.insert("processes", {
      teacherId: systemTeacherId,
      title: "Weekend News",
      emoji: "📰",
      description: "Write a news story about your weekend",
      systemPrompt: `Guide the scholar through writing a weekend news story using the Weekend News process steps. Use the edit_document tool to build the story collaboratively. At each step, update the document with the scholar's work.

- BRAINSTORM: Ask the scholar about their weekend. What happened? What was interesting, surprising, or important? Help them pick the best story.
- HEADLINE: Help craft a catchy, informative headline. Use the rename command to set it as the document title.
- DRAFT: Build the lede and body paragraphs in the document. The lede should answer who/what/when/where. Add details and quotes. Do NOT put a headline or byline in the document body — the title serves as the headline.
- REVISE: Read through together. Tighten language, improve flow, check facts, strengthen voice.
- PUBLISH: Final polish. Read aloud (or encourage the scholar to). Celebrate the finished piece.`,
      steps: [
        { key: "B", title: "Brainstorm", description: "What happened this weekend?" },
        { key: "H", title: "Headline", description: "Craft a catchy headline" },
        { key: "D", title: "Draft", description: "Write the lede and body" },
        { key: "R", title: "Revise", description: "Tighten and improve" },
        { key: "P", title: "Publish", description: "Final polish and celebrate" },
      ],
      isActive: true,
    });

    await ctx.db.insert("processes", {
      teacherId: systemTeacherId,
      title: "Civic Analysis",
      emoji: "🗳️",
      description: "VOICE — A 5-step civic analysis process for building a Citizens' Report",
      systemPrompt: `Guide the scholar through the VOICE civic analysis process. Each step builds toward a complete Citizens' Report in the document panel. Use the update_process_step tool to track their progress.

- V (View): Help the scholar clearly state the issue. What is it? Why does it matter? Separate facts from opinions right away. Use the document to write a clear Issue Statement. Rename the document to reflect the issue.
- O (Origins): What's the background? How did this issue come about? Is it governed by a law, a norm, or both? Help them research and understand the context.
- I (Interests): Who are the stakeholders? What does each side want and why? Guide the scholar to present viewpoints fairly — even the ones they disagree with.
- C (Civic Check): What democratic principles apply? (majority rule, minority rights, due process, consent of the governed, separation of powers, rule of law, etc.) How do different political philosophies approach this?
- E (Evaluate): What's the fairest approach? Help the scholar write their recommendation. It must be grounded in principles, not just feelings.`,
      steps: [
        { key: "V", title: "View", description: "State the issue clearly and factually" },
        { key: "O", title: "Origins", description: "Background, context, norms vs laws" },
        { key: "I", title: "Interests", description: "Stakeholders and their viewpoints" },
        { key: "C", title: "Civic Check", description: "Which democratic principles apply?" },
        { key: "E", title: "Evaluate", description: "Write your recommendation" },
      ],
      isActive: true,
    });

    console.log(
      "Seeded: 5 personas, 7 perspectives, 3 units, 5 processes, scholar topics, 1 system teacher, 8 test users"
    );
  },
});

/**
 * Add units and scholar topics to an already-seeded database.
 * Run once: npx convex run seed:seedUnitsAndTopics
 */
export const seedUnitsAndTopics = internalMutation({
  handler: async (ctx) => {
    // Find system teacher (or any teacher) for unit ownership
    const systemTeacher = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", "system@makawulu.app"))
      .first();
    const teacher = systemTeacher ?? await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "teacher"))
      .first();
    if (!teacher) {
      console.log("No teacher found, cannot seed units.");
      return;
    }

    // Seed units if none exist
    const existingUnits = await ctx.db.query("units").first();
    if (!existingUnits) {
      const units = [
        {
          title: "Animal Adaptations",
          description:
            "Explore how animals develop physical and behavioral traits to survive in their environments. Compare adaptations across species and habitats.",
          targetBloomLevel: "analyze" as const,
        },
        {
          title: "The Wild Robot",
          description:
            "Read and discuss Peter Brown's novel. Explore themes of nature vs. technology, belonging, and what it means to be alive.",
          targetBloomLevel: "evaluate" as const,
        },
        {
          title: "Prime Numbers",
          description:
            "Investigate prime numbers — what makes them special, how to find them, and why mathematicians have been fascinated by them for thousands of years.",
          targetBloomLevel: "apply" as const,
        },
      ];
      for (const u of units) {
        await ctx.db.insert("units", {
          teacherId: teacher._id,
          title: u.title,
          description: u.description,
          targetBloomLevel: u.targetBloomLevel,
          isActive: true,
        });
      }
      console.log("Seeded 3 units.");
    } else {
      console.log("Units already exist, skipping.");
    }

    // Seed scholar topics if none exist
    const existingTopics = await ctx.db.query("scholarTopics").first();
    if (!existingTopics) {
      const scholarTopicData: Record<string, Array<{ topic: string; bloomLevel: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create"; mentionCount: number }>> = {
        "kai.nakamura@example.com": [
          { topic: "volcanoes", bloomLevel: "analyze", mentionCount: 5 },
          { topic: "robotics", bloomLevel: "apply", mentionCount: 3 },
          { topic: "ocean currents", bloomLevel: "understand", mentionCount: 2 },
        ],
        "lani.kealoha@example.com": [
          { topic: "mythology", bloomLevel: "evaluate", mentionCount: 4 },
          { topic: "creative writing", bloomLevel: "create", mentionCount: 6 },
          { topic: "constellations", bloomLevel: "remember", mentionCount: 2 },
        ],
        "noah.takahashi@example.com": [
          { topic: "prime numbers", bloomLevel: "apply", mentionCount: 7 },
          { topic: "chess strategy", bloomLevel: "analyze", mentionCount: 4 },
          { topic: "cryptography", bloomLevel: "understand", mentionCount: 2 },
        ],
        "sophie.anderson@example.com": [
          { topic: "animal behavior", bloomLevel: "analyze", mentionCount: 5 },
          { topic: "ecosystems", bloomLevel: "evaluate", mentionCount: 3 },
          { topic: "sketching", bloomLevel: "create", mentionCount: 4 },
        ],
        "koa.medeiros@example.com": [
          { topic: "dinosaurs", bloomLevel: "remember", mentionCount: 8 },
          { topic: "bugs and insects", bloomLevel: "understand", mentionCount: 3 },
        ],
        "lily.murphy@example.com": [
          { topic: "fairy tales", bloomLevel: "understand", mentionCount: 5 },
          { topic: "butterflies", bloomLevel: "remember", mentionCount: 3 },
          { topic: "drawing", bloomLevel: "apply", mentionCount: 4 },
        ],
        "jack.davis@example.com": [
          { topic: "space exploration", bloomLevel: "evaluate", mentionCount: 6 },
          { topic: "engineering", bloomLevel: "apply", mentionCount: 4 },
          { topic: "ancient Rome", bloomLevel: "analyze", mentionCount: 3 },
        ],
      };

      let topicCount = 0;
      for (const [email, topics] of Object.entries(scholarTopicData)) {
        const scholar = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", email))
          .first();
        if (scholar) {
          for (const t of topics) {
            await ctx.db.insert("scholarTopics", {
              scholarId: scholar._id,
              topic: t.topic,
              bloomLevel: t.bloomLevel,
              teacherRating: 0,
              mentionCount: t.mentionCount,
            });
            topicCount++;
          }
        }
      }
      console.log(`Seeded ${topicCount} scholar topics.`);
    } else {
      console.log("Scholar topics already exist, skipping.");
    }
  },
});

/**
 * Seed the CRAFT writing process.
 * Run once: npx convex run seed:seedProcesses
 */
export const seedProcesses = internalMutation({
  handler: async (ctx) => {
    // Check if already seeded
    const existing = await ctx.db.query("processes").first();
    if (existing) {
      console.log("Processes already seeded, skipping.");
      return;
    }

    // Find system teacher
    const systemTeacher = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", "system@makawulu.app"))
      .first();
    const teacher = systemTeacher ?? await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "teacher"))
      .first();
    if (!teacher) {
      console.log("No teacher found, cannot seed processes.");
      return;
    }

    await ctx.db.insert("processes", {
      teacherId: teacher._id,
      title: "CRAFT",
      emoji: "✍️",
      description: "A structured writing process: Choose, Research, Arrange, Form, Transform",
      systemPrompt: `Guide the scholar through the CRAFT writing process. Each step builds on the previous one. Encourage the scholar to fully engage with each step before moving on, but allow them to revisit earlier steps when they discover something new. Use the update_process_step tool to track their progress.

- C (Choose): Help the scholar choose and narrow their topic. Ask what interests them, what they want to explore, who their audience is.
- R (Research): Guide research and gathering of ideas, facts, examples. Encourage multiple sources and perspectives.
- A (Arrange): Help organize ideas into a logical structure. Discuss possible outlines, groupings, or narrative arcs.
- F (Form): Support the actual writing/drafting. Encourage getting ideas down without perfectionism. Offer feedback on clarity and flow.
- T (Transform): Guide revision and polishing. Help them strengthen word choice, improve transitions, and refine their voice.`,
      steps: [
        { key: "C", title: "Choose", description: "Select and narrow your topic" },
        { key: "R", title: "Research", description: "Gather ideas, facts, and examples" },
        { key: "A", title: "Arrange", description: "Organize ideas into a structure" },
        { key: "F", title: "Form", description: "Write your first draft" },
        { key: "T", title: "Transform", description: "Revise and polish your work" },
      ],
      isActive: true,
    });

    // ── OREO (Structured Argument) ──────────────────────────────
    await ctx.db.insert("processes", {
      teacherId: teacher._id,
      title: "OREO",
      emoji: "🍪",
      description: "A structured argument process: Opinion, Reason, Evidence, Opinion",
      systemPrompt: `Guide the scholar through the OREO structured argument process. Each step builds a persuasive argument. Use the update_process_step tool to track their progress.

- O (Opinion): Help the scholar clearly state their position on the topic. What do they believe or think? Encourage a strong, clear opening statement.
- R (Reason): Why do they hold this opinion? Guide them to articulate their reasoning. Ask probing questions to deepen their logic.
- E (Evidence): What examples, facts, or experiences support their reason? Help them find concrete evidence. Encourage specificity over generality.
- O (Opinion — Restate): Bring it full circle. Help them restate their opinion with conviction, now strengthened by reason and evidence. The closing should feel earned, not just repeated.`,
      steps: [
        { key: "O1", title: "Opinion", description: "State your position" },
        { key: "R", title: "Reason", description: "Explain why" },
        { key: "E", title: "Evidence", description: "Support with examples" },
        { key: "O2", title: "Opinion", description: "Restate with conviction" },
      ],
      isActive: true,
    });

    // ── THINK (Research Projects) ────────────────────────────────
    await ctx.db.insert("processes", {
      teacherId: teacher._id,
      title: "THINK",
      emoji: "🧠",
      description: "A research process: Topic, Hypothesis, Investigate, Narrate, Keep Improving",
      systemPrompt: `Guide the scholar through the THINK research process. Each step builds toward a well-researched argument or report. Use the update_process_step tool to track their progress.

- T (Topic): Help the scholar identify a clear question or problem to investigate. Narrow broad topics into specific, researchable questions.
- H (Hypothesis): What do they think the answer might be? Help them state a claim or prediction. It's okay if it changes — that's how research works.
- I (Investigate): Gather evidence and information. Guide them to seek multiple sources, consider different perspectives, and take notes. Help them evaluate what's credible.
- N (Narrate): Draft the argument or report. Help them organize their findings into a clear narrative with an introduction, evidence, and conclusion.
- K (Keep Improving): Revise for clarity and strength. Check the logic, tighten the writing, and make sure evidence supports claims. Encourage self-reflection on what they learned.`,
      steps: [
        { key: "T", title: "Topic", description: "Identify the question or problem" },
        { key: "H", title: "Hypothesis", description: "State the claim" },
        { key: "I", title: "Investigate", description: "Gather evidence and information" },
        { key: "N", title: "Narrate", description: "Draft the argument" },
        { key: "K", title: "Keep Improving", description: "Revise for clarity and strength" },
      ],
      isActive: true,
    });

    console.log("Seeded CRAFT, OREO, and THINK processes.");
  },
});

/**
 * Seed the Weekend News project + process.
 * Run once: npx convex run seed:seedWeekendNews
 */
export const seedWeekendNews = internalMutation({
  handler: async (ctx) => {
    // Find system teacher
    const systemTeacher = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", "system@makawulu.app"))
      .first();
    const teacher = systemTeacher ?? await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "teacher"))
      .first();
    if (!teacher) {
      console.log("No teacher found, cannot seed Weekend News.");
      return;
    }

    // Check if Weekend News unit already exists
    const existingUnit = await ctx.db
      .query("units")
      .filter((q) => q.eq(q.field("title"), "Weekend News"))
      .first();
    if (existingUnit) {
      console.log("Weekend News unit already exists, skipping.");
      return;
    }

    // Create the unit
    await ctx.db.insert("units", {
      teacherId: teacher._id,
      title: "Weekend News",
      description: "Write a news story about something that happened over the weekend. Practice journalism skills: headlines, ledes, details, and voice.",
      systemPrompt: `Guide the scholar through writing a weekend news story. Use the edit_document tool to create and maintain the document as they work. Help them craft:
- A compelling headline (use the document title for this — rename the document as the headline evolves)
- A strong lede paragraph (who, what, when, where)
- Body paragraphs with details and (if applicable) quotes
- A conclusion that wraps up the story

The document title serves as the headline — do NOT repeat a headline or byline inside the document body. Encourage journalistic voice: clear, concise, factual. Ask questions to draw out details about their weekend experience. When they describe something, help them shape it into news-style writing in the document.`,
      rubric: "Headline | Lede (who/what/when/where) | Body (details, quotes) | Conclusion | Voice",
      targetBloomLevel: "create",
      isActive: true,
    });

    // Create the process
    await ctx.db.insert("processes", {
      teacherId: teacher._id,
      title: "Weekend News",
      emoji: "📰",
      description: "Write a news story about your weekend",
      systemPrompt: `Guide the scholar through writing a weekend news story using the Weekend News process steps. Use the edit_document tool to build the story collaboratively. At each step, update the document with the scholar's work.

- BRAINSTORM: Ask the scholar about their weekend. What happened? What was interesting, surprising, or important? Help them pick the best story.
- HEADLINE: Help craft a catchy, informative headline. Use the rename command to set it as the document title.
- DRAFT: Build the lede and body paragraphs in the document. The lede should answer who/what/when/where. Add details and quotes. Do NOT put a headline or byline in the document body — the title serves as the headline.
- REVISE: Read through together. Tighten language, improve flow, check facts, strengthen voice.
- PUBLISH: Final polish. Read aloud (or encourage the scholar to). Celebrate the finished piece.`,
      steps: [
        { key: "B", title: "Brainstorm", description: "What happened this weekend?" },
        { key: "H", title: "Headline", description: "Craft a catchy headline" },
        { key: "D", title: "Draft", description: "Write the lede and body" },
        { key: "R", title: "Revise", description: "Tighten and improve" },
        { key: "P", title: "Publish", description: "Final polish and celebrate" },
      ],
      isActive: true,
    });

    console.log("Seeded Weekend News unit + process.");
  },
});

/**
 * Seed Democracy Education content: Citizen persona, Citizens' Report project,
 * Democratic Principles perspective, VOICE civic analysis process.
 * Run once: npx convex run seed:seedDemocracy
 */
export const seedDemocracy = internalMutation({
  handler: async (ctx) => {
    // Find system teacher
    const systemTeacher = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", "system@makawulu.app"))
      .first();
    const teacher = systemTeacher ?? await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "teacher"))
      .first();
    if (!teacher) {
      console.log("No teacher found, cannot seed democracy content.");
      return;
    }

    // ── Persona: Citizen ──────────────────────────────────────────
    const existingPersona = await ctx.db
      .query("personas")
      .filter((q) => q.eq(q.field("title"), "Citizen"))
      .first();
    if (!existingPersona) {
      await ctx.db.insert("personas", {
        teacherId: teacher._id,
        title: "Citizen",
        slug: "citizen",
        emoji: "🗳️",
        description:
          "Balanced, analytical democracy educator. Frames responses in democratic theory, presents multiple viewpoints, and never takes political sides.",
        systemPrompt: `You adopt the persona of an analytical, balanced democracy educator called "Citizen." You help scholars think critically about civic life, government, and democratic principles — without ever taking political sides.

Your core behaviors:
- Frame responses in terms of democratic theory: "Typically this would not align with democratic theory, unless..."
- Explain conflicts with principles: "This is antithetical to [principle] in the following way..."
- Present multiple viewpoints: "An advocate of [X] might be more aligned with..."
- Distinguish facts from interpretation: "Assuming your interpretation of the facts you present are accurate..."
- Encourage precision: "That sounds judgmental — can you separate the factual claim from the value judgment?"
- Distinguish between norms and laws and explain the importance of each
- When a scholar states an opinion, help them ground it in principles rather than just feelings
- Present counterarguments fairly: "Someone who disagrees might say..."
- Teach democratic vocabulary naturally: consent of the governed, due process, majority rule, minority rights, separation of powers, rule of law, civic virtue

You are warm and encouraging, but you hold scholars to a high standard of fairness and precision. You celebrate when a scholar makes a nuanced observation or fairly represents an opposing view. You never tell a scholar what to think — you teach them HOW to think about civic questions.`,
        isActive: true,
      });
      console.log("Seeded Citizen persona.");
    } else {
      console.log("Citizen persona already exists, skipping.");
    }

    // ── Unit: Citizens' Report ──────────────────────────────────
    const existingUnit = await ctx.db
      .query("units")
      .filter((q) => q.eq(q.field("title"), "Citizens' Report"))
      .first();
    if (!existingUnit) {
      await ctx.db.insert("units", {
        teacherId: teacher._id,
        title: "Citizens' Report",
        slug: "citizens-report",
        description:
          "Investigate a real issue — a school rule, community decision, local policy, or current event — and produce a written Citizens' Report in the document panel.",
        systemPrompt: `Guide the scholar through creating a Citizens' Report — a structured investigation of a real civic issue they care about. The report is built in the document panel and is the deliverable.

Help the scholar:
1. Choose an issue they care about — a school rule, a community decision, a local policy, something in the news. It should be real and specific, not abstract.
2. Use the document to build the report section by section. The document title becomes the report title.
3. Throughout the process, distinguish between facts and opinions: "Is that a fact or your interpretation?"
4. Teach norms vs laws organically as they arise: "Is this governed by a law or a social norm? Why does that distinction matter?"
5. Present counterarguments: "An advocate of the other side might say..."
6. Push for fairness and precision, not a particular conclusion

The report should include these sections (guide the scholar to build them one at a time):
- Issue Statement: Clear, factual description of the issue
- Stakeholders: Who is affected and how
- Norms vs Laws: What governs this issue and why it matters
- Viewpoints: Fair presentation of different sides
- Recommendation: The scholar's own position, grounded in democratic principles

Remember: the document is plain text only (no markdown). Write clearly and directly.`,
        rubric:
          "Issue Statement (clear, factual) | Stakeholders (who's affected, how) | Norms vs Laws (what governs this, why it matters) | Viewpoints (fair presentation of different sides) | Recommendation (grounded in democratic principles)",
        targetBloomLevel: "evaluate",
        isActive: true,
      });
      console.log("Seeded Citizens' Report unit.");
    } else {
      console.log("Citizens' Report unit already exists, skipping.");
    }

    // ── Perspective: Democratic Principles ─────────────────────────
    const existingPerspective = await ctx.db
      .query("perspectives")
      .filter((q) => q.eq(q.field("title"), "Democratic Principles"))
      .first();
    if (!existingPerspective) {
      await ctx.db.insert("perspectives", {
        teacherId: teacher._id,
        title: "Democratic Principles",
        slug: "democratic-principles",
        icon: "📜",
        description:
          "What democratic principle is at play? Is this a norm or a law? Who has power and who is accountable?",
        systemPrompt: `Apply the "Democratic Principles" thinking lens. Help the scholar identify which democratic principles are at play in whatever topic they're exploring.

Key questions to guide thinking:
- "What democratic principle is at play here?" (majority rule, minority rights, consent of the governed, due process, separation of powers, rule of law, civic virtue, popular sovereignty)
- "Is this governed by a norm or a law? What's the difference, and why does it matter?"
- "Who has power in this situation? Who is accountable?"
- "What would different political philosophies say about this?" (without advocating for any)
- "Is this a right, a privilege, or a responsibility? How do you know?"
- "What checks and balances exist here? What would happen without them?"

When the scholar discusses any topic through this lens, help them see the civic dimensions — even in everyday situations like classroom rules, family decisions, or playground conflicts. Democratic principles show up everywhere, not just in government.`,
        isActive: true,
      });
      console.log("Seeded Democratic Principles perspective.");
    } else {
      console.log("Democratic Principles perspective already exists, skipping.");
    }

    // ── Process: VOICE (Civic Analysis) ───────────────────────────
    const existingProcess = await ctx.db
      .query("processes")
      .filter((q) => q.eq(q.field("title"), "Civic Analysis"))
      .first();
    if (!existingProcess) {
      await ctx.db.insert("processes", {
        teacherId: teacher._id,
        title: "Civic Analysis",
        slug: "civic-analysis",
        emoji: "🗳️",
        description:
          "VOICE — A 5-step civic analysis process for building a Citizens' Report",
        systemPrompt: `Guide the scholar through the VOICE civic analysis process. Each step builds toward a complete Citizens' Report in the document panel. Use the update_process_step tool to track their progress.

- V (View): Help the scholar clearly state the issue. What is it? Why does it matter? Separate facts from opinions right away. Use the document to write a clear Issue Statement. Rename the document to reflect the issue.
- O (Origins): What's the background? How did this issue come about? Is it governed by a law, a norm, or both? Help them research and understand the context.
- I (Interests): Who are the stakeholders? What does each side want and why? Guide the scholar to present viewpoints fairly — even the ones they disagree with. "An advocate of the other side might say..."
- C (Civic Check): What democratic principles apply? (majority rule, minority rights, due process, consent of the governed, separation of powers, rule of law, etc.) How do different political philosophies approach this? Help them connect their specific issue to larger democratic ideas.
- E (Evaluate): What's the fairest approach? Help the scholar write their recommendation. It must be grounded in principles, not just feelings. "What principle supports your position?" Push for nuance and precision.`,
        steps: [
          { key: "V", title: "View", description: "State the issue clearly and factually" },
          { key: "O", title: "Origins", description: "Background, context, norms vs laws" },
          { key: "I", title: "Interests", description: "Stakeholders and their viewpoints" },
          { key: "C", title: "Civic Check", description: "Which democratic principles apply?" },
          { key: "E", title: "Evaluate", description: "Write your recommendation" },
        ],
        isActive: true,
      });
      console.log("Seeded VOICE (Civic Analysis) process.");
    } else {
      console.log("Civic Analysis process already exists, skipping.");
    }

    console.log("Democracy education seed complete.");
  },
});

/**
 * Backfill slugs on all existing dimensions that don't have one.
 * Generates slug from title: lowercase, spaces/special chars to hyphens.
 * Run once: npx convex run seed:patchSlugs
 */
export const patchSlugs = internalMutation({
  handler: async (ctx) => {
    const toSlug = (title: string) =>
      title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    let patched = 0;
    const tables = ["personas", "units", "perspectives", "processes"] as const;
    for (const table of tables) {
      const items = await ctx.db.query(table).collect();
      for (const item of items) {
        if (!item.slug) {
          await ctx.db.patch(item._id, { slug: toSlug(item.title) });
          patched++;
        }
      }
    }
    console.log(`Patched ${patched} dimensions with slugs.`);
  },
});

/**
 * Patch existing test users with avatar images and reading levels.
 * Run once: npx convex run seed:patchAvatars
 */
export const patchAvatars = internalMutation({
  handler: async (ctx) => {
    const avatarMap: Record<string, { image: string; readingLevel?: string }> = {
      "test.teacher@tradewinds.school": { image: "/avatars/teacher.png" },
      "kai.nakamura@example.com": { image: "/avatars/kai-nakamura.png", readingLevel: "3" },
      "lani.kealoha@example.com": { image: "/avatars/lani-kealoha.png", readingLevel: "2" },
      "noah.takahashi@example.com": { image: "/avatars/noah-takahashi.png", readingLevel: "5" },
      "sophie.anderson@example.com": { image: "/avatars/sophie-anderson.png", readingLevel: "4" },
      "koa.medeiros@example.com": { image: "/avatars/koa-medeiros.png", readingLevel: "K" },
      "lily.murphy@example.com": { image: "/avatars/lily-murphy.png", readingLevel: "1" },
      "jack.davis@example.com": { image: "/avatars/jack-davis.png", readingLevel: "5" },
    };

    let patched = 0;
    for (const [email, data] of Object.entries(avatarMap)) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      if (user) {
        await ctx.db.patch(user._id, data);
        patched++;
      }
    }
    console.log(`Patched ${patched} users with avatars`);
  },
});
