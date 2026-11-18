import { NextResponse } from "next/server";
import {
  ChatApiRequest,
  ChatApiResponse,
  CoachingResponse,
  CoachingResponseSchema,
} from "@/types";
import {
  buildCrisisEscalation,
  detectLanguage,
  runSafetyClassifier,
} from "@/lib/safety";
import { formatPlaybookForPrompt, retrievePlaybook } from "@/lib/rag";
import {
  callOpenRouterWithFallback,
  cleanAndParseJson,
  generateMockPlaybookResponse,
  LLMMessage,
} from "@/lib/llm";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse<ChatApiResponse>> {
  const startTime = Date.now();

  try {
    const body: ChatApiRequest = await request.json();

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        {
          success: false,
          isCrisis: false,
          error: "Invalid request: 'messages' array is required and cannot be empty.",
          metadata: {
            safetyStatus: "safe",
            playbookSource: "None",
            modelUsed: "none",
            latencyMs: Date.now() - startTime,
          },
        },
        { status: 400 }
      );
    }

    // Get the latest user message
    const userMessages = body.messages.filter((m) => m.role === "user");
    const latestUserMessage = userMessages[userMessages.length - 1]?.content || "";

    if (!latestUserMessage.trim()) {
      return NextResponse.json(
        {
          success: false,
          isCrisis: false,
          error: "Latest user message cannot be empty.",
          metadata: {
            safetyStatus: "safe",
            playbookSource: "None",
            modelUsed: "none",
            latencyMs: Date.now() - startTime,
          },
        },
        { status: 400 }
      );
    }

    // Detect language from the latest message
    const language = detectLanguage(latestUserMessage);

    // Stage 1 & 2: Safety Gate
    const safetyResult = await runSafetyClassifier(latestUserMessage);

    // IMMEDIATE CRISIS ESCALATION BYPASS
    if (safetyResult.status === "crisis") {
      const escalation = buildCrisisEscalation(language);
      return NextResponse.json({
        success: true,
        isCrisis: true,
        escalation,
        metadata: {
          safetyStatus: "crisis",
          playbookSource: "Crisis Escalation Protocol",
          modelUsed: safetyResult.isDeterministic
            ? "deterministic-safety-gate"
            : "safety-classifier",
          latencyMs: Date.now() - startTime,
        },
      });
    }

    // Lightweight In-Memory RAG: Retrieve best matching parenting playbook
    const { playbook, score } = retrievePlaybook(latestUserMessage);
    const playbookContext = formatPlaybookForPrompt(playbook, language);

    // Generate Structured Coaching Response
    let structuredResponse: CoachingResponse | null = null;
    let modelUsed = "in-memory-engine";

    const hasApiKey =
      Boolean(process.env.OPENROUTER_API_KEY) &&
      process.env.OPENROUTER_API_KEY !== "your_api_key_here";

    if (hasApiKey) {
      try {
        const isUrdu = language === "ur";

        const systemInstructions = `You are Vibbber, an evidence-based, empathetic, and practical AI parenting coach.
Language Requirement:
- The user is speaking in ${isUrdu ? "Urdu (or Roman Urdu)" : "English"}.
- You MUST respond in ${isUrdu ? "natural, warm Urdu script (اردو رسم الخط)" : "clear, concise English"}.
- Set "language": "${isUrdu ? "ur" : "en"}".

Safety Boundaries:
- NEVER diagnose medical or psychological conditions (e.g. ADHD, autism, depression, anxiety disorders).
- NEVER prescribe medication, antibiotics, or give dosages (e.g. paracetamol/calpol mg).
- NEVER give legal advice or custody instructions.
${
  safetyResult.status === "medical_legal_boundary"
    ? `- CRITICAL: The user has asked a question touching on medical/legal boundaries. ${safetyResult.boundaryNotice} Clearly include this non-clinical disclaimer in your empathy or steps, and advise consulting a qualified doctor or legal professional.`
    : ""
}

Parenting Playbook Guidance:
${playbookContext}

Format Requirement:
You MUST respond with a single, valid JSON object matching this exact schema:
{
  "language": "${isUrdu ? "ur" : "en"}",
  "empathy": "1 short validating sentence acknowledging the parent's feeling without lecturing",
  "steps": [
    "First brief, actionable step (imperative tone)",
    "Second brief, actionable step",
    "Third brief, actionable step (optional, maximum 3 total)"
  ],
  "avoid": "1 short thing NOT to say or do in this scenario",
  "checkIn": {
    "question": "A concrete follow-up question to reflect on",
    "timeframe": "A concrete timeframe (e.g., 'after bedtime tonight' or 'in 24-48 hours')"
  },
  "playbookSource": "${isUrdu ? playbook.titleUrdu : playbook.title}"
}
Output ONLY raw JSON. No markdown code blocks, no other text.`;

        const conversationHistory: LLMMessage[] = [
          { role: "system", content: systemInstructions },
          ...body.messages.slice(-5).map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ];

        const llmResult = await callOpenRouterWithFallback(conversationHistory, {
          temperature: 0.3,
          maxTokens: 1000,
          jsonResponse: true,
        });

        modelUsed = llmResult.model;
        const parsed = cleanAndParseJson<CoachingResponse>(llmResult.content);
        const validated = CoachingResponseSchema.parse(parsed);

        // Ensure language field matches detected language
        validated.language = isUrdu ? "ur" : "en";
        structuredResponse = validated;
      } catch (llmError) {
        console.warn("LLM generation failed, falling back to evidence engine:", llmError);
        // Fallback to grounded mock response
        structuredResponse = generateMockPlaybookResponse(
          playbook,
          language,
          safetyResult.boundaryNotice
        );
        modelUsed = "fallback-evidence-engine";
      }
    } else {
      // Mock / Offline mode
      structuredResponse = generateMockPlaybookResponse(
        playbook,
        language,
        safetyResult.boundaryNotice
      );
      modelUsed = "grounded-evidence-engine";
    }

    return NextResponse.json({
      success: true,
      isCrisis: false,
      data: structuredResponse,
      metadata: {
        safetyStatus: safetyResult.status,
        playbookSource:
          language === "ur" ? playbook.titleUrdu : playbook.title,
        modelUsed,
        latencyMs: Date.now() - startTime,
        boundaryNotice: safetyResult.boundaryNotice,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      {
        success: false,
        isCrisis: false,
        error: message,
        metadata: {
          safetyStatus: "safe",
          playbookSource: "Unknown",
          modelUsed: "none",
          latencyMs: Date.now() - startTime,
        },
      },
      { status: 500 }
    );
  }
}
