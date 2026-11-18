import { CoachingResponse, CoachingResponseSchema } from "@/types";
import { ParentingPlaybook } from "@/types";

export const FREE_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-27b-it:free",
  "qwen/qwen-2.5-72b-instruct:free",
] as const;

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCallResult {
  content: string;
  model: string;
}

/**
 * Extracts and parses JSON from model output, handling markdown code fences.
 */
export function cleanAndParseJson<T>(rawText: string): T {
  let cleaned = rawText.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "");
    cleaned = cleaned.replace(/\n?```\s*$/, "");
    cleaned = cleaned.trim();
  }

  // Find the first '{' and last '}'
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return JSON.parse(cleaned) as T;
}

/**
 * Calls OpenRouter chat completion API with automatic model fallback across free models.
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

  const errors: string[] = [];

  for (const model of FREE_MODELS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout per model

      const payload: Record<string, unknown> = {
        model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 1000,
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
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content || typeof content !== "string") {
        errors.push(`Model ${model} returned empty content.`);
        continue;
      }

      return {
        content: content.trim(),
        model,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(`Model ${model} failed: ${errMsg}`);
    }
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
