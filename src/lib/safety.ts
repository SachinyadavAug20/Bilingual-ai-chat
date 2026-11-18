import {
  EmergencyEscalation,
  EmergencyNumber,
  SafetyStatus,
} from "@/types";
import { callOpenRouterWithFallback, LLMMessage } from "./llm";

// Standard verified emergency helplines
export const EMERGENCY_NUMBERS_EN: EmergencyNumber[] = [
  {
    name: "988 Suicide & Crisis Lifeline",
    number: "988",
    description: "24/7 free, confidential mental health and crisis support (US & Canada).",
  },
  {
    name: "Emergency Services",
    number: "112 / 999 / 911",
    description: "Immediate emergency response for police, ambulance, or urgent physical safety.",
  },
  {
    name: "Childline & Child Protection",
    number: "1098 / 1-800-422-4453",
    description: "24/7 dedicated helpline for child welfare, protection, and crisis intervention.",
  },
  {
    name: "Parent Stress Line",
    number: "1-800-632-8188",
    description: "24/7 trained, compassionate counselors dedicated to overwhelmed parents.",
  },
];

export const EMERGENCY_NUMBERS_UR: EmergencyNumber[] = [
  {
    name: "ایمرجنسی سروسز (Emergency Services)",
    number: "112 / 15 / 999",
    description: "فوری پولیس، ایمبولینس یا ہنگامی جسمانی تحفظ کے لیے رابطہ کریں۔",
  },
  {
    name: "چائلڈ پروٹیکشن ہیلپ لائن (Child Protection Bureau)",
    number: "1121 / 1098",
    description: "بچوں کے تحفظ، فلاح اور ہنگامی معاونت کی مفت 24 گھنٹے ہیلپ لائن۔",
  },
  {
    name: "ایدھی ایمرجنسی فاؤنڈیشن (Edhi Emergency)",
    number: "115",
    description: "کسی بھی فوری ہنگامی صورتحال، ایمبولینس اور مدد کے لیے مفت رابطہ۔",
  },
  {
    name: "ذہنی صحت و بحران معاونت (Crisis Lifeline)",
    number: "042-35761999 / 988",
    description: "شدید ذہنی دباؤ اور پریشانی میں مفت اور رازدارانہ مشورے کے لیے۔",
  },
];

/**
 * Detects whether the input text is in Urdu (Script or Roman Urdu) or English.
 */
export function detectLanguage(text: string): "en" | "ur" {
  if (!text) return "en";

  // Check for Arabic/Urdu script Unicode characters
  const urduScriptRegex = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
  if (urduScriptRegex.test(text)) {
    return "ur";
  }

  // Check for common Roman Urdu words/markers
  const romanUrduMarkers = [
    /\b(?:salam|salaam|assalam|aoa)\b/i,
    /\bmera\b/i,
    /\bmeri\b/i,
    /\bmere\b/i,
    /\bbacha\b/i,
    /\bbache\b/i,
    /\bbachay\b/i,
    /\bbachi\b/i,
    /\bnahi\b/i,
    /\bnah\b/i,
    /\bkarta\b/i,
    /\bkarti\b/i,
    /\bkarte\b/i,
    /\braat\b/i,
    /\bbohot\b/i,
    /\bboht\b/i,
    /\bbohot\b/i,
    /\bhain\b/i,
    /\bhai\b/i,
    /\bhota\b/i,
    /\bhoti\b/i,
    /\bkyun\b/i,
    /\bkya\b/i,
    /\bkaise\b/i,
    /\bkarein\b/i,
    /\bkaro\b/i,
    /\bzidd\b/i,
    /\bgussa\b/i,
    /\bkhana\b/i,
    /\bmar\b/i,
    /\bmara\b/i,
    /\blarai\b/i,
    /\bmujhe\b/i,
    /\bapne\b/i,
    /\bapna\b/i,
  ];

  let matches = 0;
  for (const marker of romanUrduMarkers) {
    if (marker.test(text)) {
      matches++;
      if (matches >= 2) {
        return "ur";
      }
    }
  }

  return "en";
}

// Stage 1 Deterministic Crisis Regex Patterns
const CRISIS_PATTERNS = [
  // English Self-harm & Suicide
  /\b(?:suicid|kill\s+myself|end\s+my\s+life|hurt(?:ing)?\s+myself|want\s+to\s+die|cut\s+myself|self[\s-]?harm|overdos(?:e|ing))\b/i,
  // English Child abuse & Severe physical harm
  /\b(?:hit\s+(?:my\s+)?child\s+hard|beat\s+(?:my\s+)?(?:child|baby|kid)|punch(?:ed)?\s+(?:my\s+)?child|chok(?:e|ed|ing)|burn(?:ed)?\s+(?:my\s+)?child|batter(?:ing)?|abus(?:e|ing)\s+(?:my\s+)?(?:child|baby)|losing\s+control\s+and\s+hit)\b/i,
  // English Critical Medical Emergencies
  /\b(?:unconscious|stopped\s+breathing|choking|having\s+a\s+seizure|blue\s+lips|swallowed\s+(?:battery|poison|bleach))\b/i,

  // Urdu Script Crisis Patterns
  /خودکشی/,
  /جان\s*لے\s*لوں/,
  /مر\s*جانا/,
  /اپنے\s*آپ\s*کو\s*مار/,
  /زندگی\s*ختم/,
  /بچے\s*کو\s*(?:شدید|بہت)?\s*(?:مارا|پیٹا|تھپڑ)/,
  /بچے\s*پر\s*تشدد/,
  /مار\s*ڈالوں/,
  /بے\s*ہوش/,
  /سانس\s*(?:رک|بند)/,
  /زہر\s*کھا/,

  // Roman Urdu Crisis Patterns
  /\b(?:khudkushi|apne\s+aap\s+ko\s+mar|mar\s+jana\s+chahta|mar\s+jana\s+chahti|jaan\s+le\s+loon|zindagi\s+khatam|khud\s+ko\s+nuksan)\b/i,
  /\b(?:bachay\s+ko\s+(?:bohot\s+)?mara|bachi\s+ko\s+mara|bacha\s+ko\s+peeta|tashaddud|jaan\s+se\s+mar)\b/i,
  /\b(?:behosh|be\s+hosh|saans\s+(?:ruk|band)|zehar\s+kha\s+liya)\b/i,
];

// Stage 1 Deterministic Medical / Legal Boundaries
const MEDICAL_PATTERNS = [
  /\b(?:prescrib|dos(?:e|age)|how\s+many\s+mg|\bmg\b|paracetamol|calpol|ibuprofen|antibiotic|diagnos(?:e|is)|adhd|autism|depression|bipolar|fever\s+medicine)\b/i,
  /دوائی\s*کی\s*مقدار/,
  /شربت\s*کی\s*خوراک/,
  /طبی\s*تشخیص/,
  /اے\s*ڈی\s*ایچ\s*ڈی/,
  /آٹزم/,
  /\b(?:dawai|dawa\b|dose|bimari|adhd|autism)\b/i,
];

const LEGAL_PATTERNS = [
  /\b(?:custody|family\s+court|divorce|lawsuit|sue\s+my|court\s+order|child\s+support\s+law|custody\s+agreement|custody\s+battle|legal\s+rights|legal\s+custody)\b/i,
  /عدالتی\s*کارروائی/,
  /طلاق\s*کا\s*کیس/,
  /قانونی\s*حق/,
  /کسٹڈی/,
  /\b(?:court\s+case|kanoni\s+haq|talaq\s+ka\s+faisla|custody|family\s+court)\b/i,
];

export interface SafetyCheckResult {
  status: SafetyStatus;
  detectedLanguage: "en" | "ur";
  reason?: string;
  boundaryNotice?: string;
  isDeterministic: boolean;
}

/**
 * Stage 1: Fast deterministic keyword/regex safety check.
 */
export function checkDeterministicSafety(text: string): SafetyCheckResult {
  const detectedLanguage = detectLanguage(text);

  // Check Crisis first (highest priority)
  for (const pattern of CRISIS_PATTERNS) {
    if (pattern.test(text)) {
      return {
        status: "crisis",
        detectedLanguage,
        reason: "Matched emergency safety trigger pattern.",
        isDeterministic: true,
      };
    }
  }

  // Check Medical boundaries
  for (const pattern of MEDICAL_PATTERNS) {
    if (pattern.test(text)) {
      return {
        status: "medical_legal_boundary",
        detectedLanguage,
        reason: "Medical diagnosis or medication dosage inquiry.",
        boundaryNotice:
          detectedLanguage === "ur"
            ? "اہم وضاحت: میں طبی معالج یا ڈاکٹر نہیں ہوں اور ادویات یا تشخیص فراہم نہیں کر سکتا۔ برائے مہربانی معالج اطفال (پیڈیاٹریشن) سے رجوع کریں۔"
            : "Important boundary: I am an AI parenting coach, not a doctor or clinical specialist. I cannot diagnose conditions or prescribe medications. Please consult a qualified pediatrician for medical advice.",
        isDeterministic: true,
      };
    }
  }

  // Check Legal boundaries
  for (const pattern of LEGAL_PATTERNS) {
    if (pattern.test(text)) {
      return {
        status: "medical_legal_boundary",
        detectedLanguage,
        reason: "Legal or custody advice inquiry.",
        boundaryNotice:
          detectedLanguage === "ur"
            ? "اہم وضاحت: میں قانونی مشیر نہیں ہوں اور عدالتی معاملات پر قانونی رائے نہیں دے سکتا۔ قانونی رہنمائی کے لیے وکیل سے رجوع کریں۔"
            : "Important boundary: I cannot provide legal advice or custody dispute instructions. Please consult a qualified family law professional for legal matters.",
        isDeterministic: true,
      };
    }
  }

  return {
    status: "safe",
    detectedLanguage,
    isDeterministic: false,
  };
}

/**
 * Stage 2: Low-temperature LLM safety classifier.
 * Only called if Stage 1 is not deterministic crisis/boundary and an LLM is available.
 */
export async function runSafetyClassifier(
  text: string
): Promise<SafetyCheckResult> {
  const stage1 = checkDeterministicSafety(text);

  // If Stage 1 already identified crisis or boundary, bypass LLM
  if (stage1.isDeterministic) {
    return stage1;
  }

  // If no API key configured, trust Stage 1 result
  if (!process.env.OPENROUTER_API_KEY) {
    return stage1;
  }

  try {
    const systemPrompt = `You are an ultra-fast, zero-tolerance safety classifier for a parenting application.
Analyze the user's message and classify it into EXACTLY ONE of these categories:
1. "CRISIS": Emergency, immediate threat to child or adult physical safety, child abuse, severe physical violence, self-harm, or suicide.
2. "MEDICAL_LEGAL": Requesting medical diagnosis (e.g. ADHD, autism, depression), medication dosage/prescriptions, or legal/custody court advice.
3. "SAFE": Normal everyday parenting concern, emotional struggle, discipline, routines, or communication question.

Output ONLY a single JSON object with this exact format:
{"classification": "CRISIS" | "MEDICAL_LEGAL" | "SAFE", "reason": "brief explanation"}`;

    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ];

    const result = await callOpenRouterWithFallback(messages, {
      temperature: 0.0,
      maxTokens: 100,
      jsonResponse: true,
    });

    const parsed = JSON.parse(result.content.replace(/```(?:json)?/g, "").trim());
    const classification = parsed.classification?.toUpperCase();

    if (classification === "CRISIS") {
      return {
        status: "crisis",
        detectedLanguage: stage1.detectedLanguage,
        reason: parsed.reason || "LLM safety classifier flagged crisis.",
        isDeterministic: false,
      };
    }

    if (classification === "MEDICAL_LEGAL") {
      return {
        status: "medical_legal_boundary",
        detectedLanguage: stage1.detectedLanguage,
        reason: parsed.reason || "LLM safety classifier flagged medical/legal boundary.",
        boundaryNotice:
          stage1.detectedLanguage === "ur"
            ? "اہم وضاحت: میں طبی تشخیص یا قانونی مشورے نہیں دے سکتا۔ برائے مہربانی مستند ڈاکٹر یا وکیل سے مشورہ کریں۔"
            : "Important boundary: I cannot diagnose conditions, prescribe medications, or provide legal advice. Please consult a qualified physician or family lawyer.",
        isDeterministic: false,
      };
    }

    return {
      status: "safe",
      detectedLanguage: stage1.detectedLanguage,
      isDeterministic: false,
    };
  } catch {
    // If the classifier call fails, gracefully rely on Stage 1
    return stage1;
  }
}

/**
 * Builds the immediate Emergency Escalation object when a crisis is detected.
 */
export function buildCrisisEscalation(
  language: "en" | "ur"
): EmergencyEscalation {
  if (language === "ur") {
    return {
      isCrisis: true,
      language: "ur",
      message:
        "ہمیں آپ کی اور آپ کے بچے کی فوری سلامتی کی گہری فکر ہے۔ آپ اس مشکل گھڑی میں اکیلے نہیں ہیں۔ برائے مہربانی ایک لمحے کے لیے رکیں، گہرا سانس لیں، اپنے اور بچے کے فوری جسمانی تحفظ کو یقینی بنائیں اور بلا جھجھک ان مفت اور 24 گھنٹے دستیاب ہنگامی ہیلپ لائنز سے فوری رابطہ کریں:",
      emergencyNumbers: EMERGENCY_NUMBERS_UR,
    };
  }

  return {
    isCrisis: true,
    language: "en",
    message:
      "We are deeply concerned about your and your child's immediate safety. You do not have to carry this alone. Please pause, take a slow breath, ensure everyone is physically safe right now, and reach out immediately to one of these free, 24/7 emergency support services:",
    emergencyNumbers: EMERGENCY_NUMBERS_EN,
  };
}

/**
 * Detects whether the user's input is a casual standalone greeting without an actual parenting concern.
 */
export function isCasualGreeting(text: string): boolean {
  if (!text) return false;
  const clean = text.trim().toLowerCase().replace(/[!?.,۔،؟]/g, "");
  const words = clean.split(/\s+/).filter(Boolean);

  if (words.length > 5) return false;

  const concernIndicators = [
    "child", "kid", "baby", "toddler", "son", "daughter", "tantrum", "sleep", "eat", "school",
    "fever", "ipad", "screen", "fight", "hit", "help", "problem", "advice", "cry", "yell",
    "بچہ", "بیٹا", "بیٹی", "نیند", "ضد", "مار", "اسکول", "کھانا", "بخار", "پریشانی", "مسئلہ",
    "bacha", "bache", "bachay", "bachi", "neend", "zidd", "zid", "larai"
  ];

  if (words.some((w) => concernIndicators.includes(w))) {
    return false;
  }

  const greetingPatterns = [
    /^(?:hi|hii|hiii|hello|helloo|hey|heyy|howdy|sup|good\s+morning|good\s+afternoon|good\s+evening)$/i,
    /^(?:salam|salaam|assalam\s*o?\s*alaikum|asalam\s*alaikum|aoa|kya\s+hal\s+hai|kaise\s+ho|kese\s+ho)$/i,
    /^(?:سلام|السلام\s*علیکم|وعلیکم\s*السلام|آداب|ہیلو)$/,
  ];

  return greetingPatterns.some((pattern) => pattern.test(clean));
}

/**
 * Returns a 1-sentence warm welcome asking what parenting challenge they'd like help with today.
 */
export function buildGreetingResponse(language: "en" | "ur"): string {
  if (language === "ur") {
    return "السلام علیکم! آج آپ اپنے بچے کے کس معاملے یا الجھن میں رہنمائی چاہتے ہیں؟";
  }
  return "Hello! What parenting challenge can I help you navigate with your child today?";
}
