"use client";

import React from "react";
import { EmergencyEscalation, SafetyStatus } from "@/types";
import { AlertCircle, PhoneCall } from "lucide-react";

interface EmergencyAlertCardProps {
  escalation: EmergencyEscalation;
  metadata?: {
    safetyStatus: SafetyStatus;
    playbookSource?: string;
    modelUsed?: string;
    latencyMs?: number;
  };
}

export function EmergencyAlertCard({
  escalation,
  metadata,
}: EmergencyAlertCardProps) {
  const isUrdu = escalation.language === "ur";

  return (
    <div
      dir={isUrdu ? "rtl" : "ltr"}
      className={`rounded-2xl border-2 border-red-500/80 bg-red-50/90 dark:bg-red-950/40 p-4 sm:p-5 shadow-sm space-y-4 text-red-950 dark:text-red-100 ${
        isUrdu ? "font-urdu" : "font-sans"
      }`}
    >
      {/* Title */}
      <div className="flex items-center gap-2 font-semibold text-sm sm:text-base text-red-700 dark:text-red-300">
        <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
        <span>
          {isUrdu
            ? "فوری ہنگامی معاونت (Emergency Support)"
            : "Emergency Safety Support"}
        </span>
      </div>

      {/* Message */}
      <p className="text-sm sm:text-base font-normal leading-relaxed text-stone-900 dark:text-stone-100">
        {escalation.message}
      </p>

      {/* Breathing Grounding Note */}
      <p className="text-xs text-red-800 dark:text-red-300 bg-red-100/70 dark:bg-red-900/40 px-3 py-1.5 rounded-lg">
        {isUrdu
          ? "ایک لمحے کے لیے رکیں • گہرا سانس لیں • بچے اور اپنی فوری حفاظت یقینی بنائیں"
          : "Pause for a moment • Take a slow breath • Ensure everyone is physically safe"}
      </p>

      {/* Helplines List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        {escalation.emergencyNumbers.map((item, idx) => (
          <a
            key={idx}
            href={`tel:${item.number.split("/")[0].trim().replace(/[^\d+]/g, "")}`}
            className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-red-200 dark:border-red-900/70 hover:border-red-400 transition-colors text-xs"
          >
            <div className="min-w-0 pr-2">
              <div className="font-semibold text-stone-900 dark:text-stone-100 truncate">
                {item.name}
              </div>
              <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                {item.description}
              </div>
            </div>
            <div className="flex items-center gap-1.5 font-mono font-bold text-red-600 dark:text-red-400 text-xs shrink-0">
              <PhoneCall className="w-3.5 h-3.5" />
              <span>{item.number}</span>
            </div>
          </a>
        ))}
      </div>

      {/* Tiny Muted Trace */}
      {metadata && (
        <div className="pt-1 border-t border-red-200/60 dark:border-red-900/60 text-[11px] font-mono text-red-600/70 dark:text-red-400/70 select-none">
          crisis bypass • {metadata.latencyMs}ms
        </div>
      )}
    </div>
  );
}
