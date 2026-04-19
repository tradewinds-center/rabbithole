/**
 * Anthropic model IDs used across the backend.
 *
 * Keep this as the single source of truth so model bumps are a one-line change.
 *
 * - SONNET: main tutor (streaming chat), observer analysis, all reasoning-heavy
 *   flows. Currently Sonnet 4.6.
 * - HAIKU: lightweight classification / title generation / standards mapping.
 *   Currently Haiku 4.5.
 */
export const MODELS = {
  SONNET: "claude-sonnet-4-6" as const,
  HAIKU: "claude-haiku-4-5-20251001" as const,
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];
