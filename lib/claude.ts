import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Base system prompt for Makawulu - the Socratic AI tutor
const BASE_SYSTEM_PROMPT = `You are Makawulu, an AI learning companion for gifted scholars at Tradewinds School in Hawai'i. Your name comes from the Hawaiian concept of "makawalu" - seeing with eight eyes, multiple perspectives simultaneously.

## Your Core Identity
- You are a Socratic tutor who helps scholars explore ideas deeply rather than simply providing answers
- You celebrate intellectual curiosity and encourage questions that go beyond the obvious
- You treat each scholar as capable of sophisticated thinking, regardless of their age
- You help scholars develop their own ideas rather than telling them what to think

## Teaching Approach
1. **Ask before answering**: When a scholar asks a question, first explore what they already know and think about it
2. **Guide discovery**: Use questions to help scholars arrive at insights themselves
3. **Celebrate complexity**: Don't oversimplify. Gifted minds can handle nuance and ambiguity
4. **Connect ideas**: Help scholars see how concepts link across subjects
5. **Encourage depth**: Push for "why" and "how" rather than just "what"

## Conversation Style
- Be warm but intellectually serious - these scholars deserve to be treated as capable thinkers
- Use precise language; avoid filler words and empty phrases
- When appropriate, introduce advanced vocabulary and explain it in context
- Express genuine curiosity about the scholar's ideas
- It's okay to say "I don't know" or "that's a fascinating question I'd need to think more about"

## Safety & Boundaries
- Keep conversations appropriate for elementary-age scholars (ages 6-10)
- If asked about topics outside your expertise, acknowledge limits and suggest the scholar consult their teacher
- Redirect conversations away from personal information or inappropriate content
- You can engage with complex philosophical, scientific, or creative topics at an advanced level while maintaining age-appropriate framing

## Tradewinds Values
- No speed limits on learning - if a scholar is ready for advanced material, engage with it
- Multiple paths through knowledge - honor the scholar's unique interests and approach
- Intellectual depth over surface coverage
- Use the term "scholar" rather than "student" - it reflects the seriousness of their intellectual work

Remember: You are a guide alongside the scholar, not an authority above them. Your goal is to help them develop their own capacity for deep thinking.`;

// Reading level descriptions for the AI
const READING_LEVEL_DESCRIPTIONS: Record<string, string> = {
  K: "kindergarten level (ages 5-6) - use very simple words and short sentences",
  "1": "1st grade level (ages 6-7) - use simple vocabulary and basic sentence structures",
  "2": "2nd grade level (ages 7-8) - use straightforward language with some new vocabulary in context",
  "3": "3rd grade level (ages 8-9) - introduce more complex ideas with clear explanations",
  "4": "4th grade level (ages 9-10) - use grade-appropriate vocabulary and discuss abstract concepts",
  "5": "5th grade level (ages 10-11) - engage with more sophisticated vocabulary and reasoning",
  "6": "6th grade level (ages 11-12) - use middle school appropriate language and concepts",
  "7": "7th grade level (ages 12-13) - engage with increasingly complex texts and ideas",
  "8": "8th grade level (ages 13-14) - use advanced vocabulary and nuanced discussions",
  "9": "9th grade level (ages 14-15) - high school freshman level complexity",
  "10": "10th grade level (ages 15-16) - high school sophomore level complexity",
  "11": "11th grade level (ages 16-17) - high school junior level, SAT-prep vocabulary",
  "12": "12th grade level (ages 17-18) - high school senior level, college-prep complexity",
  college: "college level - use advanced academic language and sophisticated concepts",
};

// Context for a project/assignment
export interface ProjectContext {
  title: string;
  description?: string | null;
  systemPrompt?: string | null;
  rubric?: string | null;
  targetBloomLevel?: string | null;
}

// Context for a persona
export interface PersonaContext {
  title: string;
  emoji: string;
  systemPrompt?: string | null;
}

// Context for a perspective
export interface PerspectiveContext {
  title: string;
  icon?: string | null;
  systemPrompt?: string | null;
}

// Generate the full system prompt with all context dimensions
export function buildSystemPrompt(
  teacherWhisper?: string | null,
  readingLevel?: string | null,
  project?: ProjectContext | null,
  persona?: PersonaContext | null,
  perspective?: PerspectiveContext | null
): string {
  let prompt = BASE_SYSTEM_PROMPT;

  // 1. PERSONA — WHO the AI is
  if (persona) {
    prompt += `

## Your Persona: ${persona.title} ${persona.emoji}`;
    if (persona.systemPrompt) {
      prompt += `
${persona.systemPrompt}`;
    }
  }

  // 2. PROJECT — WHAT they're working on
  if (project) {
    prompt += `

## Current Assignment: ${project.title}`;

    if (project.description) {
      prompt += `
${project.description}`;
    }

    if (project.systemPrompt) {
      prompt += `

### Assignment Instructions
${project.systemPrompt}`;
    }

    if (project.rubric) {
      try {
        const rubricData = JSON.parse(project.rubric);
        if (Array.isArray(rubricData) && rubricData.length > 0) {
          prompt += `

### Assessment Criteria
Guide the scholar toward demonstrating these competencies:`;
          for (const criterion of rubricData) {
            prompt += `
- **${criterion.criterion}**: ${criterion.description || ""}`;
          }
        }
      } catch {
        // Rubric is raw text, not JSON
        prompt += `

### Assessment Criteria
${project.rubric}`;
      }
    }

    if (project.targetBloomLevel) {
      const bloomDescriptions: Record<string, string> = {
        remember: "recall and recognition of facts",
        understand: "explaining ideas and concepts",
        apply: "using information in new situations",
        analyze: "drawing connections and examining relationships",
        evaluate: "justifying decisions and making judgments",
        create: "producing new or original work",
      };
      prompt += `

### Cognitive Target
Aim for discussions at the "${project.targetBloomLevel}" level (${bloomDescriptions[project.targetBloomLevel] || project.targetBloomLevel}). Help the scholar reach this depth of thinking.`;
    }
  }

  // 3. PERSPECTIVE — HOW to approach it
  if (perspective) {
    prompt += `

## Current Lens: ${perspective.title} ${perspective.icon || ""}`;
    if (perspective.systemPrompt) {
      prompt += `
${perspective.systemPrompt}`;
    }
  }

  // 4. Reading level
  if (readingLevel && READING_LEVEL_DESCRIPTIONS[readingLevel]) {
    prompt += `

## Reading Level
This scholar is at a ${READING_LEVEL_DESCRIPTIONS[readingLevel]}. Adjust your vocabulary, sentence complexity, and explanations accordingly. You can still explore advanced topics, but frame them in accessible language. Challenge the scholar appropriately for their level.`;
  }

  // 5. Teacher whisper (highest priority)
  if (teacherWhisper) {
    prompt += `

## Current Guidance from Teacher
The following is guidance from the scholar's teacher. Incorporate this naturally into your interactions without explicitly mentioning it:

${teacherWhisper}`;
  }

  return prompt;
}

// Types for chat messages
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Send a message to Claude and get a streaming response
export async function sendMessage(
  messages: ChatMessage[],
  systemPrompt: string
): Promise<AsyncIterable<Anthropic.MessageStreamEvent>> {
  const stream = anthropic.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  return stream;
}

// Non-streaming version for simpler cases
export async function sendMessageSync(
  messages: ChatMessage[],
  systemPrompt: string
): Promise<{ content: string; model: string; tokensUsed: number }> {
  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const content =
    response.content[0].type === "text" ? response.content[0].text : "";

  return {
    content,
    model: response.model,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
  };
}

// Observer analysis prompt
export const OBSERVER_SYSTEM_PROMPT = `You are an educational observer analyzing conversations between scholars and an AI tutor at Tradewinds School, a school for gifted children.

Your task is to analyze the conversation and provide structured insights for teachers.

## Analysis Framework

Evaluate the conversation on these dimensions:

1. **Engagement Level** (0-1 score): Is the scholar actively participating? Are they asking follow-up questions? Do they seem genuinely curious?

2. **Complexity Level** (0-1 score): What level of intellectual complexity is the scholar engaging with? Are they pushing into advanced territory?

3. **On-Task Score** (0-1 score): Is the conversation focused on learning? Is it productive?

4. **Topics**: What subjects/topics are being explored?

5. **Learning Indicators**: What signs of learning are visible? (making connections, asking deeper questions, revising understanding, etc.)

6. **Concern Flags**: Any concerns? (off-task behavior, signs of frustration, inappropriate content, etc.)

7. **Status Recommendation**: Based on your analysis, what status should this conversation have?
   - GREEN: On track, productive learning happening
   - YELLOW: Some concerns, may benefit from teacher awareness
   - RED: Requires teacher intervention (significant off-task, distress, inappropriate content)

8. **Summary**: 2-3 sentence summary of what's happening in this conversation.

9. **Suggested Intervention** (if applicable): If yellow or red, what might a teacher do to help?

Respond in JSON format:
{
  "engagementScore": 0.0-1.0,
  "complexityLevel": 0.0-1.0,
  "onTaskScore": 0.0-1.0,
  "topics": ["topic1", "topic2"],
  "learningIndicators": ["indicator1", "indicator2"],
  "concernFlags": ["concern1"] or [],
  "status": "green" | "yellow" | "red",
  "summary": "Brief summary...",
  "suggestedIntervention": "Suggestion..." or null
}`;

// Analyze a conversation
export async function analyzeConversation(
  messages: ChatMessage[]
): Promise<{
  engagementScore: number;
  complexityLevel: number;
  onTaskScore: number;
  topics: string[];
  learningIndicators: string[];
  concernFlags: string[];
  status: "green" | "yellow" | "red";
  summary: string;
  suggestedIntervention: string | null;
}> {
  const conversationText = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: OBSERVER_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Please analyze this conversation:\n\n${conversationText}`,
      },
    ],
  });

  const content =
    response.content[0].type === "text" ? response.content[0].text : "{}";

  try {
    // Extract JSON from the response (handle potential markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }
    return JSON.parse(jsonMatch[0]);
  } catch {
    // Return defaults if parsing fails
    return {
      engagementScore: 0.5,
      complexityLevel: 0.5,
      onTaskScore: 0.5,
      topics: [],
      learningIndicators: [],
      concernFlags: [],
      status: "green",
      summary: "Analysis unavailable",
      suggestedIntervention: null,
    };
  }
}
