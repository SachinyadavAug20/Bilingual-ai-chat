import { NextResponse } from "next/server";
import {
  ChatApiRequest,
  ChatApiResponse,
  CoachingResponse,
  CoachingResponseSchema,
  truncateToWordLimit,
} from "@/types";
import {
  buildCrisisEscalation,
  buildGreetingResponse,
  detectLanguage,
  isCasualGreeting,
  runSafetyClassifier,
} from "@/lib/safety";
import { formatPlaybookForPrompt, retrievePlaybook } from "@/lib/rag";
import {
  buildCoachingSystemPrompt,
  callOpenRouterWithFallback,
  cleanAndParseJson,
  generateMockPlaybookResponse,
  LLMMessage,
} from "@/lib/llm";

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

    // 1. Casual Greeting Detection ("hi", "hello", "salam", "السلام علیکم")
    if (isCasualGreeting(latestUserMessage)) {
      const greeting = buildGreetingResponse(language);
      return NextResponse.json({
        success: true,
        isCrisis: false,
        isGreeting: true,
        greeting,
        metadata: {
          safetyStatus: "safe",
          playbookSource: "Casual Greeting",
          modelUsed: "greeting-handler",
          latencyMs: Date.now() - startTime,
        },
      });
    }

    // 2. Stage 1 & 2: Safety Gate
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

    // 3. Lightweight In-Memory RAG: Retrieve best matching parenting playbook
    const { playbook, score } = retrievePlaybook(latestUserMessage);
    const playbookContext = formatPlaybookForPrompt(playbook, language);

    // 4. Generate Structured Coaching Response
    let structuredResponse: CoachingResponse | null = null;
    let modelUsed = "in-memory-engine";

    const hasApiKey =
      Boolean(process.env.OPENROUTER_API_KEY) &&
      process.env.OPENROUTER_API_KEY !== "your_api_key_here";

    if (hasApiKey) {
      try {
        const isUrdu = language === "ur";

        const systemInstructions = buildCoachingSystemPrompt({
          language,
          playbookContext,
          boundaryNotice: safetyResult.boundaryNotice,
        });

        const conversationHistory: LLMMessage[] = [
          { role: "system", content: systemInstructions },
          ...body.messages.slice(-5).map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ];

        const llmResult = await callOpenRouterWithFallback(conversationHistory, {
          temperature: 0.3,
          maxTokens: 1500,
          jsonResponse: true,
        });

        modelUsed = llmResult.model;
        const parsed = cleanAndParseJson<CoachingResponse>(llmResult.content);

        // Normalize and enforce strict WhatsApp word caps before Zod validation
        if (parsed.empathy) {
          parsed.empathy = truncateToWordLimit(parsed.empathy, 12);
        }

        if (Array.isArray(parsed.steps)) {
          parsed.steps = parsed.steps
            .slice(0, 3)
            .map((s) => truncateToWordLimit(String(s), 12));
          // If less than 2 steps, supplement from evidence playbook
          if (parsed.steps.length < 2) {
            parsed.steps.push(
              truncateToWordLimit(
                isUrdu
                  ? "بچے کے جذبات تسلیم کریں اور پیار سے بات سنیں۔"
                  : "Acknowledge feelings before attempting to redirect behavior.",
                12
              )
            );
          }
        }

        if (parsed.avoid) {
          parsed.avoid = truncateToWordLimit(parsed.avoid, 12);
        }

        if (parsed.checkIn) {
          if (parsed.checkIn.question) {
            parsed.checkIn.question = truncateToWordLimit(
              parsed.checkIn.question,
              15
            );
          }
          if (parsed.checkIn.timeframe) {
            parsed.checkIn.timeframe = truncateToWordLimit(
              parsed.checkIn.timeframe,
              6
            );
          }
        }

        // Ensure language is aligned
        if (!parsed.language || (parsed.language !== "en" && parsed.language !== "ur")) {
          parsed.language = isUrdu ? "ur" : "en";
        }

        if (!parsed.playbookSource) {
          parsed.playbookSource = isUrdu ? playbook.titleUrdu : playbook.title;
        }

        const validated = CoachingResponseSchema.parse(parsed);
        validated.language = isUrdu ? "ur" : "en";
        structuredResponse = validated;
      } catch (llmError) {
        console.warn("LLM generation failed, falling back to evidence engine:", llmError);
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
