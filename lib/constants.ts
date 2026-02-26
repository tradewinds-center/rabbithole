export const STRAND_CONFIG = {
  core: { label: "Core", color: "orange", emoji: "🔍" },
  connections: { label: "Connections", color: "blue", emoji: "🔗" },
  practice: { label: "Practice", color: "green", emoji: "🎯" },
  identity: { label: "Identity", color: "purple", emoji: "🌱" },
} as const;

export type Strand = keyof typeof STRAND_CONFIG;

export const STRAND_ORDER: Strand[] = ["core", "connections", "practice", "identity"];
