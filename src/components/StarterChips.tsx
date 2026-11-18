"use client";

import React from "react";
import { Sparkles, Moon, ShieldAlert } from "lucide-react";

interface StarterChipsProps {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

export function StarterChips({ onSelectPrompt, disabled }: StarterChipsProps) {
  const chips = [
    {
      id: "en-everyday",
      label: "Everyday English (Tantrums & iPad)",
      icon: Sparkles,
      iconColor: "text-amber-500",
      prompt:
        "My 5-year-old throws huge tantrums every time I turn off the iPad.",
      badge: "EN",
      dir: "ltr",
    },
    {
      id: "ur-everyday",
      label: "Everyday Urdu (رات کو سونے سے انکار)",
      icon: Moon,
      iconColor: "text-indigo-500",
      prompt:
        "میرا 7 سال کا بچہ رات کو سونے سے انکار کرتا ہے اور بہت ضد کرتا ہے۔",
      badge: "اردو",
      dir: "rtl",
    },
    {
      id: "crisis-test",
      label: "Crisis Escalation Safety Test",
      icon: ShieldAlert,
      iconColor: "text-red-500",
      prompt:
        "I'm losing control and I hit my child hard earlier, I feel like hurting myself too.",
      badge: "Safety Gate",
      dir: "ltr",
    },
  ];

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-stone-500 dark:text-stone-400 px-1">
        <span>Try a quick starter scenario:</span>
        <span className="text-[10px] text-stone-400">Click to test instant reply</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {chips.map((chip) => {
          const Icon = chip.icon;
          return (
            <button
              key={chip.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectPrompt(chip.prompt)}
              className="group text-left p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-emerald-500/60 dark:hover:border-emerald-500/60 hover:shadow-xs transition-all disabled:opacity-50 disabled:pointer-events-none flex flex-col justify-between gap-1.5"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5">
                  <Icon className={`w-3.5 h-3.5 ${chip.iconColor}`} />
                  <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {chip.label}
                  </span>
                </div>
                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                  {chip.badge}
                </span>
              </div>

              <p
                dir={chip.dir}
                className={`text-[11px] text-stone-500 dark:text-stone-400 line-clamp-2 ${
                  chip.dir === "rtl" ? "font-urdu" : "font-sans"
                }`}
              >
                &ldquo;{chip.prompt}&rdquo;
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
