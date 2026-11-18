import { PARENTING_PLAYBOOKS } from "@/data/playbooks";
import { ParentingPlaybook } from "@/types";

/**
 * Normalizes text for keyword matching across English, Urdu script, and Roman Urdu.
 */
export function normalizeText(text: string): string {
  if (!text) return "";

  return (
    text
      .toLowerCase()
      // Remove Urdu diacritics (zer, zabar, pesh, jazm, tashdeed, etc.)
      .replace(/[\u064B-\u065F\u0670]/g, "")
      // Normalize Urdu characters
      .replace(/آ/g, "ا")
      .replace(/[يى]/g, "ی")
      .replace(/ك/g, "ک")
      .replace(/ة/g, "ہ")
      .replace(/[\u200B-\u200D\uFEFF]/g, "") // Zero-width spaces
      // Replace punctuation with spaces
      .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'۔،؟]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Tokenizes normalized text into words.
 */
export function tokenize(text: string): string[] {
  const norm = normalizeText(text);
  if (!norm) return [];
  return norm.split(/\s+/).filter((token) => token.length > 1);
}

/**
 * Scores a playbook against a user query using token overlap and keyword weighted matches.
 */
export function scorePlaybook(
  queryTokens: string[],
  playbook: ParentingPlaybook
): number {
  if (queryTokens.length === 0) return 0;

  let score = 0;
  const playbookTextTokens = new Set([
    ...tokenize(playbook.title),
    ...tokenize(playbook.titleUrdu),
    ...tokenize(playbook.summary),
    ...tokenize(playbook.summaryUrdu),
  ]);

  const highWeightKeywords = new Set([
    ...playbook.keywordsEn.map(normalizeText),
    ...playbook.keywordsUr.map(normalizeText),
    ...playbook.keywordsRomanUr.map(normalizeText),
  ]);

  for (const token of queryTokens) {
    // Exact keyword match (high priority: 3.5 points)
    if (highWeightKeywords.has(token)) {
      score += 3.5;
    }

    // Partial keyword match (e.g. "tantrums" matches "tantrum")
    for (const kw of highWeightKeywords) {
      if (kw.length > 3 && (kw.includes(token) || token.includes(kw))) {
        score += 2.0;
        break;
      }
    }

    // Playbook summary / text match (1.0 point)
    if (playbookTextTokens.has(token)) {
      score += 1.0;
    }
  }

  return score;
}

export interface RetrievalResult {
  playbook: ParentingPlaybook;
  score: number;
  matchedKeywords: string[];
}

/**
 * Retrieves the most relevant parenting playbook for a user's query.
 */
export function retrievePlaybook(query: string): RetrievalResult {
  const queryTokens = tokenize(query);

  let bestPlaybook = PARENTING_PLAYBOOKS[0]; // fallback default
  let maxScore = -1;

  for (const pb of PARENTING_PLAYBOOKS) {
    const s = scorePlaybook(queryTokens, pb);
    if (s > maxScore) {
      maxScore = s;
      bestPlaybook = pb;
    }
  }

  // Find which keywords actually matched for debugging/traceability
  const matchedKeywords: string[] = [];
  const allKeywords = [
    ...bestPlaybook.keywordsEn,
    ...bestPlaybook.keywordsUr,
    ...bestPlaybook.keywordsRomanUr,
  ];

  for (const kw of allKeywords) {
    const normKw = normalizeText(kw);
    if (queryTokens.some((t) => t === normKw || normKw.includes(t))) {
      matchedKeywords.push(kw);
    }
  }

  return {
    playbook: bestPlaybook,
    score: maxScore,
    matchedKeywords: Array.from(new Set(matchedKeywords)).slice(0, 5),
  };
}

/**
 * Formats the retrieved playbook as clean context for the LLM prompt.
 */
export function formatPlaybookForPrompt(
  playbook: ParentingPlaybook,
  language: "en" | "ur"
): string {
  if (language === "ur") {
    return `
عنوان رہنمائی: ${playbook.titleUrdu} (${playbook.title})
اصول:
${playbook.summaryUrdu}
عملی اقدامات:
${playbook.actionPrinciples.map((a, i) => `${i + 1}. ${a}`).join("\n")}
اجتناب کریں:
${playbook.avoidPrinciples.map((av) => `- ${av}`).join("\n")}
`.trim();
  }

  return `
PLAYBOOK CONTEXT: ${playbook.title}
Core Insight: ${playbook.summary}
Evidence-Based Action Principles:
${playbook.actionPrinciples.map((a, i) => `${i + 1}. ${a}`).join("\n")}
Avoid These Common Pitfalls:
${playbook.avoidPrinciples.map((av) => `- ${av}`).join("\n")}
`.trim();
}
