import {
  CoachingResponse,
  CoachingResponseSchema,
  truncateToWordLimit,
} from "@/types";
import { ParentingPlaybook } from "@/types";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCallResult {
  content: string;
  model: string;
}

// In-memory cache for dynamic free models
let cachedLiveFreeModels: { models: string[]; expiresAt: number } | null = null;

/**
 * Builds the formal, high-precision coaching system prompt enforcing
 * WhatsApp-ready brevity, strict length caps, and safety boundaries.
 */
export function buildCoachingSystemPrompt(options: {
  language: "en" | "ur";
  playbookContext: string;
  boundaryNotice?: string;
}): string {
  const isUrdu = options.language === "ur";

  return `You are an expert, calm, and practical AI parenting coach providing brief, structured, WhatsApp-scannable guidance.

ROLE & COMMUNICATION STYLE:
- A stressed parent is reading this on their phone; every second counts.
- Be compassionate, grounded, and ultra-concise. Zero generic fluff, preambles, or conversational filler.
- Language Mirroring: The user is communicating in ${isUrdu ? "Urdu (or Roman Urdu)" : "English"}. You MUST reply entirely in ${isUrdu ? "natural, everyday Urdu script (اردو رسم الخط)" : "clear, simple English"}. Never mix languages awkwardly.
- Output: Set "language": "${isUrdu ? "ur" : "en"}".

STRICT BREVITY & WORD LIMITS (MANDATORY):
1. "empathy": EXACTLY 1 short validating sentence (MAX 12 words).
2. "steps": EXACTLY 2 or 3 ultra-crisp action bullets, imperative tone (MAX 12 words per step).
3. "avoid": EXACTLY 1 concrete thing NOT to say or do (MAX 12 words).
4. "checkIn":
   - "question": 1 simple follow-up question (MAX 15 words).
   - "timeframe": A concrete timeframe (MAX 6 words, e.g. "Tonight after bedtime" or "In 24 hours").
Total words across all fields MUST stay under 75 words.

STRICT SAFETY & NON-CLINICAL BOUNDARIES:
- NEVER diagnose developmental, behavioral, or medical conditions (e.g., ADHD, autism, anxiety, depression).
- NEVER recommend medications, prescriptions, or dosages (e.g., paracetamol/calpol mg).
- NEVER provide legal or custody instructions.
${
  options.boundaryNotice
    ? `- CRITICAL BOUNDARY ACTIVE: ${options.boundaryNotice} State this non-clinical/non-legal boundary in one calm sentence and redirect to a licensed doctor or family lawyer, while offering safe everyday emotional support.`
    : ""
}
- If any situation involves an emergency, child violence/abuse, or self-harm, immediately defer to crisis intervention.

EVIDENCE PLAYBOOK GUIDANCE:
${options.playbookContext}

OUTPUT FORMAT:
Respond with ONLY a raw, valid JSON object matching this schema:
{
  "language": "${isUrdu ? "ur" : "en"}",
  "empathy": "1 validating sentence (max 12 words)",
  "steps": [
    "Step 1 (imperative, max 12 words)",
    "Step 2 (imperative, max 12 words)",
    "Step 3 (optional, max 12 words)"
  ],
  "avoid": "1 thing not to do (max 12 words)",
  "checkIn": {
    "question": "1 follow-up question (max 15 words)",
    "timeframe": "timeframe (max 6 words)"
  },
  "playbookSource": "Playbook title"
}`;
}

/**
 * Dynamically queries OpenRouter catalog to find currently online :free chat models,
 * prioritizing strong instruction and chat families while filtering out vision/audio models.
 */
export async function getLiveFreeModels(): Promise<string[]> {
  const now = Date.now();
  if (cachedLiveFreeModels && cachedLiveFreeModels.expiresAt > now) {
    return cachedLiveFreeModels.models;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch("https://openrouter.ai/api/v1/models", {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    const models: Array<{
      id: string;
      pricing?: { prompt?: string | number; completion?: string | number };
    }> = data.data || [];

    const freeModels = models.filter((m) => {
      const isFreeId = m.id.endsWith(":free") && m.id !== "openrouter/free";
      const lower = m.id.toLowerCase();
      // Filter out multimodal/vision/audio/embed models for text chat
      const isNonText =
        lower.includes("-vl") ||
        lower.includes("clip") ||
        lower.includes("audio") ||
        lower.includes("embed");

      const isZeroPrice = m.pricing
        ? Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0
        : false;

      return isFreeId && isZeroPrice && !isNonText;
    });

    const getScore = (id: string): number => {
      const lower = id.toLowerCase();
      if (lower.includes("llama")) return 100;
      if (lower.includes("gemma")) return 95;
      if (lower.includes("qwen")) return 90;
      if (lower.includes("mistral")) return 85;
      if (lower.includes("ernie")) return 80;
      if (lower.includes("ling")) return 78;
      if (lower.includes("dots")) return 75;
      if (lower.includes("deepseek")) return 70;
      if (lower.includes("nemotron")) return 65;
      return 50;
    };

    const sorted = freeModels
      .sort((a, b) => getScore(b.id) - getScore(a.id))
      .map((m) => m.id);

    // Cache top results for 10 minutes
    cachedLiveFreeModels = {
      models: sorted,
      expiresAt: now + 10 * 60 * 1000,
    };

    return sorted;
  } catch {
    return [];
  }
}

/**
 * Extracts and parses JSON from model output, handling markdown code fences and control characters.
 */
export function cleanAndParseJson<T>(rawText: string): T {
  let cleaned = rawText.trim();

  // 1. Look for ```json ... ``` code fence
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch && fenceMatch[1]) {
    cleaned = fenceMatch[1].trim();
  }

  // 2. Extract first '{' and matching last '}'
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Attempt fix for literal unescaped newlines or control characters
    const sanitized = cleaned.replace(/[\u0000-\u001F]+/g, (match) =>
      match === "\n" ? "\\n" : match === "\r" ? "\\r" : match === "\t" ? "\\t" : ""
    );
    return JSON.parse(sanitized) as T;
  }
}

/**
 * Calls OpenRouter chat completion API:
 * 1. Honors OPENROUTER_MODEL env override if present.
 * 2. Uses "openrouter/free" official auto-router.
 * 3. Falls back to dynamically discovered live :free models if openrouter/free fails or rate-limits.
 */
export async function callOpenRouterWithFallback(
  messages: LLMMessage[],
  options: {
    temperature?: number;
    maxTokens?: number;
    jsonResponse?: boolean;
  } = {}
): Promise<LLMCallResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey || apiKey.trim() === "" || apiKey === "your_api_key_here") {
    throw new Error(
      "OPENROUTER_API_KEY is not configured in environment variables."
    );
  }

  // Build candidate model list
  const candidateModels: string[] = [];

  // 1. Optional manual override from .env.local
  if (process.env.OPENROUTER_MODEL && process.env.OPENROUTER_MODEL.trim()) {
    candidateModels.push(process.env.OPENROUTER_MODEL.trim());
  }

  // 2. Primary model: OpenRouter official free router
  if (!candidateModels.includes("openrouter/free")) {
    candidateModels.push("openrouter/free");
  }

  const errors: string[] = [];

  // Helper to attempt a single model
  const tryModel = async (model: string): Promise<LLMCallResult | null> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout per model

      const payload: Record<string, unknown> = {
        model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 1500,
      };

      if (options.jsonResponse) {
        payload.response_format = { type: "json_object" };
      }

      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://vibbber.app",
            "X-Title": "Vibbber Bilingual Parenting Coach",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        errors.push(`Model ${model} returned ${response.status}: ${errorText}`);
        return null;
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message;
      let content = message?.content;

      // Handle reasoning models where output was placed in reasoning
      if (!content || typeof content !== "string" || content.trim() === "") {
        if (typeof message?.reasoning === "string" && message.reasoning.includes("{")) {
          content = message.reasoning;
        } else {
          errors.push(`Model ${model} returned empty content.`);
          return null;
        }
      }

      // If openrouter/free was used, report the actual underlying model if provided in the response
      const resolvedModel = data.model || model;

      return {
        content: content.trim(),
        model: resolvedModel,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(`Model ${model} failed: ${errMsg}`);
      return null;
    }
  };

  // 1. Try initial candidates (OPENROUTER_MODEL and/or "openrouter/free")
  for (const model of candidateModels) {
    const result = await tryModel(model);
    if (result) return result;
  }

  // 2. If primary router failed or rate-limited, query dynamic live :free models and try top 4
  try {
    const liveFree = await getLiveFreeModels();
    const dynamicCandidates = liveFree
      .filter((m) => !candidateModels.includes(m))
      .slice(0, 4);

    for (const model of dynamicCandidates) {
      const result = await tryModel(model);
      if (result) return result;
    }
  } catch (err: unknown) {
    errors.push(`Dynamic free model discovery failed: ${String(err)}`);
  }

  throw new Error(
    `All OpenRouter models failed:\n${errors.map((e) => `• ${e}`).join("\n")}`
  );
}

/**
 * Generates an ultra-brief, WhatsApp-scannable fallback response adhering strictly to word caps.
 */
export function generateMockPlaybookResponse(
  playbook: ParentingPlaybook,
  language: "en" | "ur",
  boundaryNotice?: string
): CoachingResponse {
  if (language === "ur") {
    const empathy = boundaryNotice
      ? "طبی یا قانونی مشورہ ممکن نہیں، لیکن میں ساتھ ہوں۔"
      : "بچے کی پرورش میں ایسے لمحات واقعی صبر آزماتے ہیں۔";

    return CoachingResponseSchema.parse({
      language: "ur",
      empathy: truncateToWordLimit(empathy, 12),
      steps: [
        truncateToWordLimit(
          "اپنا لہجہ دھیما رکھیں اور بچے کی سطح پر بیٹھیں۔",
          12
        ),
        truncateToWordLimit(
          "پہلے بچے کے جذبات تسلیم کریں، پھر دھیان بٹائیں۔",
          12
        ),
        truncateToWordLimit(
          "بحث کیے بغیر نرمی سے اپنے اصول پر قائم رہیں۔",
          12
        ),
      ],
      avoid: truncateToWordLimit(
        "غصے میں چیخنے، مارنے یا طعنہ دینے سے پرہیز کریں۔",
        12
      ),
      checkIn: {
        question: truncateToWordLimit(
          "پرسکون ہونے کے بعد بچے کا رویہ کیسا رہا؟",
          15
        ),
        timeframe: truncateToWordLimit("آج رات سونے کے بعد", 6),
      },
      playbookSource: playbook.titleUrdu,
    });
  }

  const empathy = boundaryNotice
    ? "I cannot provide medical or legal advice, but I support you."
    : "I hear how challenging this moment is; your patience is admirable.";

  return CoachingResponseSchema.parse({
    language: "en",
    empathy: truncateToWordLimit(empathy, 12),
    steps: [
      truncateToWordLimit(
        "Get down to eye level and speak in a calm, quiet tone.",
        12
      ),
      truncateToWordLimit(
        "Acknowledge their big feelings before attempting to redirect their behavior.",
        12
      ),
      truncateToWordLimit(
        "Hold the boundary kindly but firmly without arguing back.",
        12
      ),
    ],
    avoid: truncateToWordLimit(
      "Avoid yelling, lengthy lecturing, or negotiating during a meltdown.",
      12
    ),
    checkIn: {
      question: truncateToWordLimit(
        "How did your child respond after the intensity passed?",
        15
      ),
      timeframe: truncateToWordLimit("Tonight after bedtime", 6),
    },
    playbookSource: playbook.title,
  });
}
