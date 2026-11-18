import { z } from "zod";

export const countWords = (text: string): number => {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
};

export const truncateToWordLimit = (text: string, maxWords: number): string => {
  if (!text) return "";
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(" ").replace(/[,;:\s]+$/, "");
};

// Strict WhatsApp-scannable length limits:
// - empathy: max 12 words
// - steps: 2-3 items, max 12 words per step
// - avoid: max 12 words
// - checkIn.question: max 15 words
// - checkIn.timeframe: max 6 words
export const CoachingResponseSchema = z.object({
  language: z.enum(["en", "ur"]),
  empathy: z
    .string()
    .min(1, "Empathy sentence is required")
    .refine((val) => countWords(val) <= 12, {
      message: "Empathy line must be 12 words or fewer for quick scannability",
    }),
  steps: z
    .array(
      z
        .string()
        .min(1)
        .refine((val) => countWords(val) <= 12, {
          message: "Each action step must be 12 words or fewer",
        })
    )
    .min(2, "At least 2 actionable steps required")
    .max(3, "Maximum 3 actionable steps"),
  avoid: z
    .string()
    .min(1, "Avoid sentence is required")
    .refine((val) => countWords(val) <= 12, {
      message: "Avoid guidance must be 12 words or fewer",
    }),
  checkIn: z.object({
    question: z
      .string()
      .min(1, "Follow-up question is required")
      .refine((val) => countWords(val) <= 15, {
        message: "Check-in question must be 15 words or fewer",
      }),
    timeframe: z
      .string()
      .min(1, "Follow-up timeframe is required")
      .refine((val) => countWords(val) <= 6, {
        message: "Check-in timeframe must be 6 words or fewer",
      }),
  }),
  playbookSource: z.string().min(1, "Playbook source title is required"),
});

export type CoachingResponse = z.infer<typeof CoachingResponseSchema>;

export type SafetyStatus = "safe" | "medical_legal_boundary" | "crisis";

export interface EmergencyNumber {
  name: string;
  number: string;
  description: string;
}

export interface EmergencyEscalation {
  isCrisis: true;
  language: "en" | "ur";
  message: string;
  emergencyNumbers: EmergencyNumber[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  structured?: CoachingResponse;
  escalation?: EmergencyEscalation;
  metadata?: {
    safetyStatus: SafetyStatus;
    playbookSource?: string;
    modelUsed?: string;
    latencyMs?: number;
    boundaryNotice?: string;
  };
  createdAt: number;
}

export interface ChatApiRequest {
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

export interface ChatApiResponse {
  success: boolean;
  isCrisis: boolean;
  isGreeting?: boolean;
  greeting?: string;
  data?: CoachingResponse;
  escalation?: EmergencyEscalation;
  metadata: {
    safetyStatus: SafetyStatus;
    playbookSource: string;
    modelUsed: string;
    latencyMs: number;
    boundaryNotice?: string;
  };
  error?: string;
}

export interface ParentingPlaybook {
  id: string;
  title: string;
  titleUrdu: string;
  category: string;
  keywordsEn: string[];
  keywordsUr: string[];
  keywordsRomanUr: string[];
  summary: string;
  summaryUrdu: string;
  actionPrinciples: string[];
  avoidPrinciples: string[];
}
