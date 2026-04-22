function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const stripped = w.replace(/e$/, "");
  return Math.max(1, (stripped.match(/[aeiou]+/g) ?? []).length);
}

export interface FKResult {
  gradeLevel: number;
  level: string; // "K", "7", "college" — maps to READING_LEVELS dropdown values
  wordCount: number;
}

/**
 * Flesch-Kincaid Grade Level from an array of text strings.
 * Returns null if there are fewer than 10 words (insufficient sample).
 */
export function fleschKincaid(texts: string[]): FKResult | null {
  const combined = texts.join(" ").trim();
  const words = combined.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w));
  if (words.length < 10) return null;

  const sentences = combined.split(/[.!?]+/).filter((s) => s.trim().length > 2);
  const syllables = words.reduce((n, w) => n + countSyllables(w), 0);
  const asl = words.length / Math.max(1, sentences.length);
  const asw = syllables / words.length;
  const raw = Math.max(0, 0.39 * asl + 11.8 * asw - 15.59);
  const gradeLevel = Math.round(raw * 10) / 10;

  const level =
    gradeLevel < 1 ? "K" : gradeLevel > 12 ? "college" : String(Math.round(gradeLevel));

  return { gradeLevel, level, wordCount: words.length };
}
