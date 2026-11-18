"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChatMessage, ChatApiResponse } from "@/types";
import { detectLanguage } from "@/lib/safety";
import { StructuredResponseCard } from "@/components/StructuredResponseCard";
import { EmergencyAlertCard } from "@/components/EmergencyAlertCard";
import { StarterChips } from "@/components/StarterChips";
import { ArrowUp, Loader2 } from "lucide-react";

const STORAGE_KEY = "parenting_coach_messages";

export default function HomePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history from localStorage on initial mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch (e) {
      console.warn("Failed to load chat history from localStorage:", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save chat history to localStorage on every change (after initial hydration)
  useEffect(() => {
    if (!isLoaded) return;
    try {
      if (messages.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn("Failed to persist chat history to localStorage:", e);
    }
  }, [messages, isLoaded]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isLoaded) {
      scrollToBottom();
    }
  }, [messages, isLoading, isLoaded]);

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
          : data.isGreeting
          ? data.greeting || ""
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
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn("Failed to remove chat history from localStorage:", e);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      {/* 1. Subtle, Minimal Top Bar */}
      <header className="sticky top-0 z-10 border-b border-stone-200/60 dark:border-stone-800/60 bg-stone-50/80 dark:bg-stone-950/80 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 h-12 flex items-center justify-between">
          <span className="text-sm font-medium text-stone-600 dark:text-stone-400">
            Parenting Coach
          </span>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="text-xs text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </header>

      {/* 2. Messages Canvas */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 flex flex-col justify-between">
        {!isLoaded ? null : messages.length === 0 ? (
          /* Empty State */
          <div className="my-auto py-12 flex flex-col items-center justify-center text-center space-y-6">
            <p className="text-sm text-stone-400 dark:text-stone-500">
              How can I help with your child today?
            </p>
            <StarterChips
              onSelectPrompt={(prompt) => handleSendMessage(prompt)}
              disabled={isLoading}
            />
          </div>
        ) : (
          /* Chat Stream */
          <div className="space-y-4 pb-4">
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
                    <div
                      dir={isUrdu ? "rtl" : "ltr"}
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 bg-stone-900 dark:bg-stone-100 text-stone-50 dark:text-stone-900 text-sm sm:text-base leading-relaxed ${
                        isUrdu ? "font-urdu" : "font-sans"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  ) : (
                    <div className="w-full">
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
                        <div
                          dir={isUrdu ? "rtl" : "ltr"}
                          className={`rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800/80 p-4 text-sm sm:text-base text-stone-800 dark:text-stone-200 leading-relaxed ${
                            isUrdu ? "font-urdu" : "font-sans"
                          }`}
                        >
                          {message.content}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-stone-400 py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Thinking...</span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs border border-red-200 dark:border-red-900">
                {error}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        )}
      </main>

      {/* 3. Clean Input Bar */}
      <footer className="sticky bottom-0 z-10 bg-stone-50/90 dark:bg-stone-950/90 backdrop-blur-md pb-4 pt-2">
        <div className="max-w-2xl mx-auto px-4 space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="relative flex items-center"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a parenting concern in English or اردو..."
              rows={1}
              disabled={isLoading}
              className="w-full resize-none rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 pl-4 pr-12 py-3 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-stone-400 dark:focus:border-stone-600 transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 flex items-center justify-center transition-opacity disabled:opacity-20"
              title="Send message"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ArrowUp className="w-4 h-4" />
              )}
            </button>
          </form>

          <p className="text-center text-[11px] text-stone-400 dark:text-stone-500">
            Not medical or legal advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
