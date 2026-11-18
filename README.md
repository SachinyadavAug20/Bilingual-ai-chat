# Bilingual AI Parenting Coach

Minimal Next.js + TypeScript chat app supporting English and Urdu with structured coaching replies, in-memory playbook grounding, and deterministic crisis escalation.

## How to Run

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment:
   ```bash
   cp .env.example .env.local
   ```
   Set `GEMINI_API_KEY` (primary provider via Google AI Studio's OpenAI-compatible endpoint with `gemini-2.5-flash` and `gemini-2.5-flash-lite`). Optionally set `OPENROUTER_API_KEY` as a secondary fallback.
3. Start the development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

## Run Safety & Schema Evals

Run the automated evaluation suite:
```bash
npm run eval
```
Executes 10 automated test cases asserting schema validity, WhatsApp-scannable brevity caps, casual greeting handling, medical/legal boundary disclaimers, and 100% deterministic crisis escalation accuracy across English, Urdu script, and Roman Urdu.

## Architecture & Safety Overview

- **Two-Stage Safety Gate** (`src/lib/safety.ts`): Fast deterministic regex + low-temperature classifier bypasses the coaching LLM immediately on emergency, abuse, or self-harm triggers to return verified 24/7 emergency helplines.
- **Medical & Legal Boundaries**: Identifies requests for diagnoses, medication dosages, or custody disputes and attaches non-clinical/non-legal disclaimers directing to licensed professionals.
- **In-Memory RAG** (`src/lib/rag.ts`): Lightweight BM25 token-overlap engine matches user input against 6 bilingual evidence-based parenting micro-playbooks (`src/data/playbooks.ts`).
- **Structured Replies** (`src/types/index.ts`): Zod schema strictly enforces compact, practical outputs comprising one empathy sentence, 2 to 3 actionable steps, one thing to avoid, and a timed check-in question.
- **Multi-Provider Fallback** (`src/lib/llm.ts`): Primary inference via Google AI Studio (`gemini-2.5-flash` / `gemini-2.5-flash-lite`), secondary fallback via OpenRouter (`openrouter/free` and live `:free` models), and final offline fallback via in-memory playbooks.

## Coding Agent Workflow

Built with Antigravity CLI using small atomic commits (`safety` -> `rag` -> `llm` -> `api` -> `eval` -> `ui`). Every step was continuously validated with `npx tsc --noEmit`, `npm run build`, and `npm run eval`.
