# Vibbber — Bilingual AI Parenting Coach (English & Urdu)

> A clean, minimal, zero-login, and zero-external-database parenting coach built with Next.js (App Router), TypeScript, and Tailwind CSS. Provides evidence-based parenting guidance in English, Urdu (Nastaliq script with RTL rendering), and Roman Urdu with strict two-stage safety guardrails.

---

## 🌟 Key Features

1. **Bilingual Input & Mirroring (English + Urdu)**:
   - Understands queries in **English**, **Urdu (Arabic/Nastaliq script)**, and **Roman Urdu** (e.g. `bacha rota hai`, `zidd karta hai`).
   - Automatically detects input language and mirrors the response in natural, warm Urdu script (`dir="rtl"`) or clear English.
2. **Brief, Structured, Practical Replies**:
   - Every coaching reply strictly validates against a Zod schema (`CoachingResponseSchema`):
     - **Empathy**: 1 short validating sentence acknowledging parental overwhelm without lecturing.
     - **Steps**: 2–3 concise, imperative, actionable steps.
     - **What to Avoid**: 1 clear thing not to say or do.
     - **Follow-up Check-in**: A concrete follow-up question and actionable timeframe (e.g., *after bedtime tonight* or *in 24–48 hours*).
     - **Playbook Source**: Grounded in 1 of 6 evidence-based parenting playbooks.
3. **Strict Safety Guardrails**:
   - **Never Diagnoses or Prescribes**: Non-clinical boundaries enforce that the AI never diagnoses conditions (ADHD, autism, depression) and never gives medication dosages (e.g. paracetamol mg) or legal/custody advice.
   - **Deterministic Crisis Bypass**: Any query indicating child abuse/violence, emergency danger, or self-harm/suicide bypasses the coaching LLM entirely and immediately returns a verified emergency escalation card with direct 24/7 helplines (988, 112/999/911, Childline 1098, Edhi 115).
4. **Zero Login & Zero External Database**:
   - Session state is kept entirely in client memory with zero tracking, cookies, or external persistence.

---

## 🏗️ Architecture

```
User Query (English / Urdu / Roman Urdu)
   │
   ▼
1. Language Detection & Safety Gate (`src/lib/safety.ts`)
   ├─► [Deterministic Crisis Match?] ──► YES ──► Immediate Emergency Card (Bypasses LLM)
   │                                          (988, 112/999, Childline 1098, 115)
   ├─► [Medical / Legal Boundary?]   ──► YES ──► Injects Non-Clinical Disclaimers
   │
   ▼
2. Lightweight In-Memory RAG (`src/lib/rag.ts` & `src/data/playbooks.ts`)
   └─► BM25 / token-overlap scoring retrieves top matched evidence playbook:
       • Tantrums & Meltdowns
       • Bedtime & Sleep Struggles
       • Screen Time & Device Battles
       • School Anxiety & Morning Reluctance
       • Sibling Rivalry & Squabbles
       • Picky Eating & Mealtime Standoffs
   │
   ▼
3. LLM Provider (`src/lib/llm.ts`)
   └─► OpenRouter API with automatic fallback across free models:
       1. `meta-llama/llama-3.3-70b-instruct:free`
       2. `google/gemma-3-27b-it:free`
       3. `qwen/qwen-2.5-72b-instruct:free`
       *(Graceful zero-API-key fallback to in-memory grounded evidence engine)*
   │
   ▼
4. Zod Validation & Structured Presentation (`src/components/StructuredResponseCard.tsx`)
   └─► Empathy • 2-3 Action Steps • Avoid • Follow-up Check-in • Collapsible Trace Badge
```

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+ (tested on Node v24)
- npm or pnpm

### 2. Installation
```bash
npm install
```

### 3. Environment Variables (Optional)
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Add your OpenRouter API key:
```env
OPENROUTER_API_KEY=sk-or-v1-...
```
> **Note**: If `OPENROUTER_API_KEY` is not provided, Vibbber automatically runs in **offline grounded evidence mode** using the 6 in-memory micro-playbooks, ensuring full functionality and testing out of the box.

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Build for Production
```bash
npm run build
npm start
```

---

## 🧪 Automated Evaluation Suite

An automated test suite is included in `scripts/eval.ts` asserting schema compliance, brevity, language detection, medical/legal boundaries, and 100% crisis escalation accuracy across 8 bilingual scenarios:

```bash
npm run eval
```

### Tested Scenarios:
1. **[TC-1] Everyday English**: 5yo iPad tantrum (tests screen time playbook grounding & schema)
2. **[TC-2] Everyday Urdu Script**: Bedtime resistance (tests Urdu script mirroring & RTL rendering)
3. **[TC-3] Roman Urdu**: School anxiety (`"Mera bacha school jane se bohot darta hai..."`)
4. **[TC-4] Medical Boundary**: Fever & paracetamol dosage inquiry (verifies non-clinical boundary notice)
5. **[TC-5] Legal Boundary**: Child custody dispute inquiry (verifies legal boundary notice)
6. **[TC-6] English Crisis**: Self-harm intent (verifies immediate crisis escalation & emergency card)
7. **[TC-7] English Crisis**: Physical child abuse (verifies immediate crisis escalation & emergency card)
8. **[TC-8] Urdu Crisis**: Severe abuse & self-harm (verifies Urdu crisis escalation & emergency numbers)

---

## 🔒 Safety & Guardrail Specifications

| Scenario | System Action | Output |
| :--- | :--- | :--- |
| **Normal Parenting Query** | Matches RAG Playbook → Prompts LLM | Empathy + 2-3 Steps + Avoid + Check-In |
| **Medical / Drug Dosage** | Flags `medical_legal_boundary` | Non-clinical disclaimer + gentle pediatric referral |
| **Legal / Custody Dispute** | Flags `medical_legal_boundary` | Non-legal disclaimer + family counselor referral |
| **Emergency / Abuse / Self-harm** | **Deterministic Safety Bypass** | High-contrast Emergency Card with 24/7 helplines (988, 112, 999, 1098, 115) |

---

## 📁 Repository Structure

```
├── scripts/
│   └── eval.ts                   # Automated 8-scenario evaluation runner
├── src/
│   ├── app/
│   │   ├── api/chat/route.ts     # Edge/Node API route (Safety -> RAG -> Coach LLM)
│   │   ├── globals.css           # Tailwind CSS + Noto Nastaliq Urdu fonts
│   │   ├── layout.tsx            # Root HTML & metadata
│   │   └── page.tsx              # Minimal responsive chat UI with starter chips
│   ├── components/
│   │   ├── EmergencyAlertCard.tsx # High-contrast red/amber crisis intervention card
│   │   ├── StarterChips.tsx       # 3 quick test prompt chips
│   │   └── StructuredResponseCard.tsx # Structured coaching card with collapsible trace
│   ├── data/
│   │   └── playbooks.ts          # 6 bilingual evidence-based parenting playbooks
│   ├── lib/
│   │   ├── llm.ts                # OpenRouter client with multi-model fallback & JSON parser
│   │   ├── rag.ts                # BM25 / token-overlap keyword scoring engine
│   │   └── safety.ts             # Two-stage safety gate & crisis emergency numbers
│   └── types/
│       └── index.ts              # Zod schemas, TypeScript types, and interfaces
├── .env.example                  # Environment template
└── package.json                  # Scripts (dev, build, eval, lint)
```
