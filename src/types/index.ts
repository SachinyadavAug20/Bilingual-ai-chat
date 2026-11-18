import { z } from "zod";

export const CoachingResponseSchema = z.object({
  language: z.enum(["en", "ur"]),
  empathy: z.string().min(1, "Empathy sentence is required"),
  steps: z
    .array(z.string().min(1))
    .min(2, "At least 2 actionable steps required")
    .max(3, "Maximum 3 actionable steps"),
  avoid: z.string().min(1, "Avoid sentence is required"),
  checkIn: z.object({
    question: z.string().min(1, "Follow-up question is required"),
    timeframe: z.string().min(1, "Follow-up timeframe is required"),
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
