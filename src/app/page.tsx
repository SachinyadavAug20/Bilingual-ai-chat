"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChatMessage, ChatApiResponse } from "@/types";
import { detectLanguage } from "@/lib/safety";
import { StructuredResponseCard } from "@/components/StructuredResponseCard";
import { EmergencyAlertCard } from "@/components/EmergencyAlertCard";
import { StarterChips } from "@/components/StarterChips";
import {
  Send,
  Trash2,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Heart,
  Globe,
  Loader2,
} from "lucide-react";

export default function HomePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend ?? input).trim();
    if (!messageContent || isLoading) return;

    setError(null);
    setInput("");

    // Append user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageContent,
      createdAt: Date.now(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data: ChatApiResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to receive coaching guidance.");
      }

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.isCrisis
          ? data.escalation?.message || "Emergency safety intervention required."
          : data.data?.empathy || "",
        structured: data.data,
        escalation: data.escalation,
        metadata: data.metadata,
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      const errText =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(errText);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <div className="flex flex-col min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      {/* Top Navbar */}
      <header className="sticky top-0 z-20 border-b border-stone-200/80 dark:border-stone-800/80 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              V
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg tracking-tight">
                  Vibbber
                </h1>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                  Bilingual AI Coach
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Evidence-based parenting advice in English & Urdu (اردو)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                title="Clear conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear Chat</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Conversation Canvas */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 flex flex-col justify-between">
        {messages.length === 0 ? (
          /* Welcome Screen */
          <div className="my-auto py-8 text-center max-w-2xl mx-auto space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shadow-inner">
              <Heart className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 dark:text-stone-100">
                Calm, Practical Parenting Support
              </h2>
              <p className="text-sm sm:text-base text-stone-600 dark:text-stone-400 max-w-lg mx-auto">
                Ask in English, Urdu script (اردو), or Roman Urdu. Get concise, structured guidance rooted in evidence playbooks with zero judgment.
              </p>
            </div>

            {/* Feature Badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs">
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300">
                <Globe className="w-3.5 h-3.5 text-emerald-600" />
                English & Urdu Script Mirroring
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Empathy + 2-3 Action Steps + Check-In
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                Strict Safety Gate & Clinical Guardrails
              </span>
            </div>

            {/* Starter Chips on Empty State */}
            <div className="pt-6">
              <StarterChips
                onSelectPrompt={(prompt) => handleSendMessage(prompt)}
                disabled={isLoading}
              />
            </div>
          </div>
        ) : (
          /* Active Chat Stream */
          <div className="space-y-6 pb-6">
            {messages.map((message) => {
              const isUser = message.role === "user";
              const isUrdu = detectLanguage(message.content) === "ur";

              return (
                <div
                  key={message.id}
                  className={`flex flex-col ${
                    isUser ? "items-end" : "items-start"
                  }`}
                >
                  {isUser ? (
                    /* User Bubble */
                    <div
                      dir={isUrdu ? "rtl" : "ltr"}
                      className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 bg-emerald-600 text-white shadow-sm text-sm sm:text-base leading-relaxed ${
                        isUrdu ? "font-urdu" : "font-sans"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  ) : (
                    /* Assistant Structured Bubble */
                    <div className="w-full max-w-3xl">
                      {message.escalation ? (
                        <EmergencyAlertCard
                          escalation={message.escalation}
                          metadata={message.metadata}
                        />
                      ) : message.structured ? (
                        <StructuredResponseCard
                          response={message.structured}
                          metadata={message.metadata}
                        />
                      ) : (
                        <div className="p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                          <p className="whitespace-pre-wrap text-stone-800 dark:text-stone-200">
                            {message.content}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 w-fit text-sm text-stone-500 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Consulting evidence playbook & safety gate...</span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-sm flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        )}
      </main>

      {/* Sticky Bottom Input Area */}
      <footer className="sticky bottom-0 z-20 border-t border-stone-200/80 dark:border-stone-800/80 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md py-4">
        <div className="max-w-4xl mx-auto px-4 space-y-3">
          {/* Quick starter chips above input when chatting */}
          {messages.length > 0 && (
            <div className="hidden sm:block">
              <StarterChips
                onSelectPrompt={(prompt) => handleSendMessage(prompt)}
                disabled={isLoading}
              />
            </div>
          )}

          {/* Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end gap-2"
          >
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your parenting challenge in English, اردو, or Roman Urdu..."
                rows={2}
                disabled={isLoading}
                className="w-full resize-none rounded-2xl border border-stone-300 dark:border-stone-700 bg-stone-50/80 dark:bg-stone-800/80 px-4 py-3 text-sm sm:text-base text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="h-12 w-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-sm transition-all disabled:opacity-40 disabled:pointer-events-none hover:scale-105 active:scale-95"
              title="Send message"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </form>

          {/* Micro Footer Notice */}
          <div className="flex items-center justify-between text-[11px] text-stone-400 px-1">
            <span>
              Zero login • No external database • Evidence playbooks
            </span>
            <span className="hidden sm:inline">
              Not a medical doctor or legal service. Press Enter to send.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
