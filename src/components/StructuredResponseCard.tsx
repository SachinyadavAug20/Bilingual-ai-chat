"use client";

import React from "react";
import { CoachingResponse, SafetyStatus } from "@/types";

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
  const isUrdu = response.language === "ur";

  return (
    <div
      dir={isUrdu ? "rtl" : "ltr"}
      className={`rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800/80 p-4 sm:p-5 shadow-xs space-y-3.5 text-stone-800 dark:text-stone-200 leading-relaxed text-sm sm:text-base ${
        isUrdu ? "font-urdu" : "font-sans"
      }`}
    >
      {/* Medical/Legal Boundary Notice (if flagged) */}
      {metadata?.boundaryNotice && (
        <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 rounded-lg border border-amber-200/70 dark:border-amber-900/50">
          {metadata.boundaryNotice}
        </p>
      )}

      {/* 1. Empathy Sentence */}
      <p className="font-normal text-stone-800 dark:text-stone-200">
        {response.empathy}
      </p>

      {/* 2. Brief Actionable Steps */}
      <ol className="list-decimal list-outside ps-5 space-y-1.5 font-normal">
        {response.steps.map((step, idx) => (
          <li key={idx} className="ps-0.5">
            {step}
          </li>
        ))}
      </ol>

      {/* 3. What to Avoid */}
      <p className="text-stone-700 dark:text-stone-300">
        <span className="font-semibold text-stone-900 dark:text-stone-100">
          {isUrdu ? "اجتناب: " : "Avoid: "}
        </span>
        {response.avoid}
      </p>

      {/* 4. Follow-up Check-in */}
      <p className="text-stone-700 dark:text-stone-300">
        <span className="font-semibold text-stone-900 dark:text-stone-100">
          {isUrdu
            ? `فالو اپ (${response.checkIn.timeframe}): `
            : `Check-in (${response.checkIn.timeframe}): `}
        </span>
        {response.checkIn.question}
      </p>

      {/* 5. Tiny Muted Trace Line */}
      {metadata && (
        <div className="pt-1.5 border-t border-stone-100 dark:border-stone-800/70 text-[11px] font-mono text-stone-400 dark:text-stone-500 select-none">
          {metadata.safetyStatus} • {metadata.playbookSource} • {metadata.latencyMs}ms
        </div>
      )}
    </div>
  );
}
