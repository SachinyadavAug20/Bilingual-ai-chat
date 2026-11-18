import { CoachingResponse, CoachingResponseSchema } from "@/types";
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
 * Generates an evidence-grounded fallback response when API keys are absent or services are unreachable.
 */
export function generateMockPlaybookResponse(
  playbook: ParentingPlaybook,
  language: "en" | "ur",
  boundaryNotice?: string
): CoachingResponse {
  if (language === "ur") {
    return CoachingResponseSchema.parse({
      language: "ur",
      empathy: boundaryNotice
        ? `${boundaryNotice} میں آپ کی فکر اور محبت کو بخوبی سمجھ سکتا ہوں۔`
        : "بچے کی پرورش میں ایسے لمحات صبر آزما ہوتے ہیں، آپ کی پریشانی بالکل فطری ہے۔",
      steps: [
        playbook.actionPrinciples[0]
          ? `پہلا قدم: ${playbook.actionPrinciples[0]}`
          : "سب سے پہلے اپنا لہجہ اور غصہ قابو میں رکھیں اور بچے کی سطح پر آئیں۔",
        playbook.actionPrinciples[1]
          ? `دوسرا قدم: ${playbook.actionPrinciples[1]}`
          : "بچے کے جذبات کو تسلیم کریں اور پیار سے بات سنیں۔",
        "صورتحال پرسکون ہونے کے بعد ہی بچے کو دوستانہ انداز میں سمجھائیں۔",
      ],
      avoid:
        playbook.avoidPrinciples[0] ||
        "غصے میں چیخنے، مارنے یا موازنہ کرنے سے گریز کریں۔",
      checkIn: {
        question:
          "کیا اس تدبیر کے بعد بچے کے رویے یا ردعمل میں کوئی بہتری محسوس ہوئی؟",
        timeframe: "اگلے 24 سے 48 گھنٹوں میں جائزہ لیں",
      },
      playbookSource: `${playbook.titleUrdu} (${playbook.title})`,
    });
  }

  return CoachingResponseSchema.parse({
    language: "en",
    empathy: boundaryNotice
      ? `${boundaryNotice} I hear how deeply you care about handling this thoughtfully.`
      : "Parenting through these challenging moments is genuinely tough, and your patience is admirable.",
    steps: [
      playbook.actionPrinciples[0] ||
        "Get down to your child's eye level and maintain a calm, steady voice.",
      playbook.actionPrinciples[1] ||
        "Acknowledge their underlying emotion before trying to redirect their behavior.",
      playbook.actionPrinciples[2] ||
        "Hold the boundary gently but firmly without engaging in back-and-forth arguments.",
    ],
    avoid:
      playbook.avoidPrinciples[0] ||
      "Avoid matching their emotional escalation with shouting or hasty punishments.",
    checkIn: {
      question:
        "How did your child respond once the initial intensity had subsided?",
      timeframe: "Check back in after the next 24 to 48 hours",
    },
    playbookSource: playbook.title,
  });
}
