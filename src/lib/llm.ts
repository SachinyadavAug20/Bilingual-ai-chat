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
 * Calls Google AI Studio OpenAI-compatible endpoint with automatic fallback
 * from gemini-2.5-flash to gemini-2.5-flash-lite.
 */
async function callGoogleAIStudio(
  messages: LLMMessage[],
  apiKey: string,
  options: {
    temperature?: number;
    maxTokens?: number;
    jsonResponse?: boolean;
  }
): Promise<LLMCallResult | null> {
  const geminiModels = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

  for (const model of geminiModels) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const payload: Record<string, unknown> = {
        model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 1500,
      };

      if (options.jsonResponse) {
        payload.response_format = { type: "json_object" };
      }

      // Google AI Studio OpenAI-compatible endpoint without OpenRouter headers
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`Google AI Studio ${model} failed (${response.status}): ${errText}`);
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content || typeof content !== "string" || content.trim() === "") {
        continue;
      }

      return {
        content: content.trim(),
        model: data.model || model,
      };
    } catch (err: unknown) {
      console.warn(`Google AI Studio ${model} error:`, err);
    }
  }

  return null;
}

/**
 * Dynamically queries OpenRouter catalog to find currently online :free chat models.
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
 * Calls OpenRouter chat completion API with automatic model fallback.
 */
async function callOpenRouter(
  messages: LLMMessage[],
  apiKey: string,
  options: {
    temperature?: number;
    maxTokens?: number;
    jsonResponse?: boolean;
  }
): Promise<LLMCallResult | null> {
  const candidateModels: string[] = [];

  if (process.env.OPENROUTER_MODEL && process.env.OPENROUTER_MODEL.trim()) {
    candidateModels.push(process.env.OPENROUTER_MODEL.trim());
  }

  if (!candidateModels.includes("openrouter/free")) {
    candidateModels.push("openrouter/free");
  }

  const tryModel = async (model: string): Promise<LLMCallResult | null> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

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
            "X-Title": "Bilingual Parenting Coach",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message;
      let content = message?.content;

      if (!content || typeof content !== "string" || content.trim() === "") {
        if (typeof message?.reasoning === "string" && message.reasoning.includes("{")) {
          content = message.reasoning;
        } else {
          return null;
        }
      }

      return {
        content: content.trim(),
        model: data.model || model,
      };
    } catch {
      return null;
    }
  };

  // Try configured models / openrouter/free
  for (const model of candidateModels) {
    const result = await tryModel(model);
    if (result) return result;
  }

  // Fallback to top dynamic free models
  try {
    const liveFree = await getLiveFreeModels();
    const dynamicCandidates = liveFree
      .filter((m) => !candidateModels.includes(m))
      .slice(0, 3);

    for (const model of dynamicCandidates) {
      const result = await tryModel(model);
      if (result) return result;
    }
  } catch {
    // Ignore dynamic query errors
  }

  return null;
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
    const sanitized = cleaned.replace(/[\u0000-\u001F]+/g, (match) =>
      match === "\n" ? "\\n" : match === "\r" ? "\\r" : match === "\t" ? "\\t" : ""
    );
    return JSON.parse(sanitized) as T;
  }
}

/**
 * Multi-provider LLM caller:
 * 1. Primary: Google AI Studio (GEMINI_API_KEY) with gemini-2.5-flash -> gemini-2.5-flash-lite
 * 2. Secondary: OpenRouter (OPENROUTER_API_KEY) with openrouter/free -> dynamic :free models
 * 3. Throws if both providers fail or are unconfigured (allowing in-memory fallback)
 */
export async function callLLMWithFallback(
  messages: LLMMessage[],
  options: {
    temperature?: number;
    maxTokens?: number;
    jsonResponse?: boolean;
  } = {}
): Promise<LLMCallResult> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  // 1. Primary Provider: Google AI Studio
  if (
    geminiKey &&
    geminiKey.trim() !== "" &&
    geminiKey !== "your_gemini_key_here"
  ) {
    const geminiResult = await callGoogleAIStudio(messages, geminiKey, options);
    if (geminiResult) {
      return geminiResult;
    }
    console.warn("Google AI Studio failed, falling back to secondary provider...");
  }

  // 2. Secondary Provider: OpenRouter
  if (
    openRouterKey &&
    openRouterKey.trim() !== "" &&
    openRouterKey !== "your_api_key_here"
  ) {
    const openRouterResult = await callOpenRouter(messages, openRouterKey, options);
    if (openRouterResult) {
      return openRouterResult;
    }
  }

  throw new Error("All configured LLM providers (Google AI Studio & OpenRouter) failed or are unconfigured.");
}

// Backward-compatible alias
export const callOpenRouterWithFallback = callLLMWithFallback;

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
