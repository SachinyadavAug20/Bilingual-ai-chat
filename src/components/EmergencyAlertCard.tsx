"use client";

import React, { useState } from "react";
import { EmergencyEscalation, SafetyStatus } from "@/types";
import {
  AlertTriangle,
  PhoneCall,
  ShieldAlert,
  Heart,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

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
  const [showTrace, setShowTrace] = useState(false);
  const isUrdu = escalation.language === "ur";

  return (
    <div
      dir={isUrdu ? "rtl" : "ltr"}
      className={`w-full rounded-2xl border-2 border-red-500/80 bg-red-50/80 dark:bg-red-950/40 text-red-950 dark:text-red-100 shadow-md overflow-hidden ${
        isUrdu ? "font-urdu" : "font-sans"
      }`}
    >
      {/* Top Banner */}
      <div className="bg-red-600 dark:bg-red-700 text-white px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>
            {isUrdu
              ? "فوری ہنگامی معاونت اور تحفظ (Emergency Support)"
              : "Emergency Safety Support Needed"}
          </span>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-red-800 text-white">
          {isUrdu ? "فوری الرٹ" : "Immediate Alert"}
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* Empathetic Crisis Message */}
        <div className="flex items-start gap-3 bg-white/70 dark:bg-stone-900/60 border border-red-200 dark:border-red-900/50 rounded-xl p-4">
          <Heart className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm sm:text-base font-medium leading-relaxed text-red-950 dark:text-red-100">
            {escalation.message}
          </p>
        </div>

        {/* Breathing Grounding Callout */}
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-red-100/60 dark:bg-red-900/30 text-xs sm:text-sm text-red-800 dark:text-red-200">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          <span>
            {isUrdu
              ? "ایک گہرا سانس لیں • کچھ دیر کے لیے رُک جائیں • سب سے پہلے بچے اور اپنی حفاظت یقینی بنائیں"
              : "Pause for a moment • Take a slow breath • Ensure everyone is physically safe right now"}
          </span>
        </div>

        {/* Verified Emergency Numbers */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-red-800 dark:text-red-300">
            {isUrdu
              ? "رابطہ نمبرز (24/7 مفت کال کریں):"
              : "Verified 24/7 Free Helplines:"}
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {escalation.emergencyNumbers.map((item, idx) => (
              <a
                key={idx}
                href={`tel:${item.number.split("/")[0].trim().replace(/[^\d+]/g, "")}`}
                className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-stone-900 border border-red-200 dark:border-red-900/60 hover:border-red-400 hover:shadow transition-all group"
              >
                <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="font-bold text-sm text-stone-900 dark:text-white truncate">
                      {item.name}
                    </span>
                  </div>
                  <div className="font-mono font-bold text-base text-red-600 dark:text-red-400">
                    {item.number}
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight">
                    {item.description}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Safety Trace Footer */}
      {metadata && (
        <div className="border-t border-red-200/60 dark:border-red-900/60 bg-red-100/40 dark:bg-red-950/20 px-5 py-2">
          <button
            onClick={() => setShowTrace(!showTrace)}
            className="flex items-center justify-between w-full text-xs text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Safety Gate: Crisis Bypass Active</span>
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
            <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-900/50 text-[11px] font-mono text-red-700 dark:text-red-300">
              Coaching LLM completely bypassed via deterministic safety gate.
              Immediate crisis escalation triggered for user & child protection.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
