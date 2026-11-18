"use client";

import React from "react";

interface StarterChipsProps {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

export function StarterChips({ onSelectPrompt, disabled }: StarterChipsProps) {
  const pills = [
    {
      id: "en-tantrums",
      label: "iPad tantrums (EN)",
      prompt: "My 5-year-old throws huge tantrums every time I turn off the iPad.",
    },
    {
      id: "ur-bedtime",
      label: "سونے سے انکار (اردو)",
      prompt: "میرا 7 سال کا بچہ رات کو سونے سے انکار کرتا ہے اور بہت ضد کرتا ہے۔",
    },
    {
      id: "crisis-test",
      label: "Crisis test",
      prompt: "I'm losing control and I hit my child hard earlier, I feel like hurting myself too.",
    },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {pills.map((pill) => (
        <button
          key={pill.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelectPrompt(pill.prompt)}
          className="text-xs px-3 py-1.5 rounded-full border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:border-stone-400 dark:hover:border-stone-600 hover:text-stone-900 dark:hover:text-stone-100 transition-colors disabled:opacity-50"
        >
          {pill.label}
        </button>
      ))}
    </div>
  );
}
