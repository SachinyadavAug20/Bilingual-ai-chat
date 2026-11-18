"use client";

import React, { useState } from "react";
import { CoachingResponse, SafetyStatus } from "@/types";
import {
  HeartHandshake,
  CheckCircle2,
  AlertOctagon,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  Cpu,
  ShieldCheck,
  BookOpen,
  AlertTriangle,
} from "lucide-react";

interface StructuredResponseCardProps {
  response: CoachingResponse;
  metadata?: {
    safetyStatus: SafetyStatus;
    playbookSource?: string;
    modelUsed?: string;
    latencyMs?: number;
    boundaryNotice?: string;
  };
}

export function StructuredResponseCard({
  response,
  metadata,
}: StructuredResponseCardProps) {
  const [showTrace, setShowTrace] = useState(false);
  const isUrdu = response.language === "ur";

  return (
    <div
      dir={isUrdu ? "rtl" : "ltr"}
      className={`w-full rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm overflow-hidden transition-all text-stone-800 dark:text-stone-100 ${
        isUrdu ? "font-urdu" : "font-sans"
      }`}
    >
      {/* Medical/Legal Boundary Notice Banner */}
      {metadata?.boundaryNotice && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 px-4 py-3 flex items-start gap-2.5 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="leading-relaxed">{metadata.boundaryNotice}</p>
        </div>
      )}

      {/* Playbook Header Pill */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between border-b border-stone-100 dark:border-stone-800/60 bg-stone-50/70 dark:bg-stone-900/60">
        <div className="flex items-center gap-2 text-xs font-medium text-stone-500 dark:text-stone-400">
          <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>{response.playbookSource}</span>
        </div>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
          {isUrdu ? "اردو رہنمائی" : "Evidence Playbook"}
        </span>
      </div>

      <div className="p-5 space-y-5">
        {/* 1. Empathy Section */}
        <div className="flex items-start gap-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl p-3.5">
          <HeartHandshake className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              {isUrdu ? "ہمدلی اور احساس" : "Empathy & Validation"}
            </span>
            <p className="text-sm sm:text-base text-stone-700 dark:text-stone-200 font-medium leading-relaxed">
              &ldquo;{response.empathy}&rdquo;
            </p>
          </div>
        </div>

        {/* 2. Action Steps */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{isUrdu ? "عملی اقدامات (2-3 طریقے)" : "Actionable Steps"}</span>
          </div>
          <div className="grid gap-2.5">
            {response.steps.map((step, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 rounded-xl p-3 bg-stone-50 dark:bg-stone-800/40 border border-stone-200/80 dark:border-stone-800"
              >
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 dark:bg-emerald-500 text-white font-bold text-xs shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <p className="text-sm sm:text-base leading-relaxed text-stone-800 dark:text-stone-100">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 3. What to Avoid */}
        <div className="flex items-start gap-3 bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 rounded-xl p-3.5">
          <AlertOctagon className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
              {isUrdu ? "اس سے پرہیز کریں" : "What to Avoid"}
            </span>
            <p className="text-sm sm:text-base text-stone-700 dark:text-stone-200 leading-relaxed">
              {response.avoid}
            </p>
          </div>
        </div>

        {/* 4. Follow-up Check-in */}
        <div className="flex items-start gap-3 bg-sky-50/60 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/40 rounded-xl p-3.5">
          <CalendarCheck className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <div className="space-y-1 w-full">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300">
                {isUrdu ? "فالو اپ اور جائزہ" : "Follow-up Check-in"}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200 font-medium">
                {response.checkIn.timeframe}
              </span>
            </div>
            <p className="text-sm sm:text-base text-stone-700 dark:text-stone-200 leading-relaxed italic">
              &ldquo;{response.checkIn.question}&rdquo;
            </p>
          </div>
        </div>
      </div>

      {/* 5. Trace Footer (Collapsible) */}
      {metadata && (
        <div className="border-t border-stone-100 dark:border-stone-800/80 bg-stone-50/40 dark:bg-stone-900/40 px-5 py-2.5">
          <button
            onClick={() => setShowTrace(!showTrace)}
            className="flex items-center justify-between w-full text-xs text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                Safety: <strong className="text-emerald-600 dark:text-emerald-400 capitalize">{metadata.safetyStatus}</strong>
              </span>
              <span className="text-stone-300 dark:text-stone-600">•</span>
              <span className="truncate max-w-[140px] sm:max-w-[220px]">
                {metadata.playbookSource}
              </span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[11px]">
              <span>{metadata.latencyMs}ms</span>
              {showTrace ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </div>
          </button>

          {showTrace && (
            <div className="mt-3 pt-3 border-t border-stone-200/60 dark:border-stone-800 text-[11px] font-mono text-stone-600 dark:text-stone-400 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3 h-3 text-stone-400" />
                <span>Model: {metadata.modelUsed || "in-memory-engine"}</span>
              </div>
              <div>
                <span>Guardrails: Deterministic Regex + Fast Classifier</span>
              </div>
              <div className="sm:col-span-2 text-stone-400">
                Playbook: {metadata.playbookSource}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
