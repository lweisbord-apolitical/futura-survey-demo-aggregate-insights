"use client";

import { Check } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "@/types/survey";
import type { TaskSuggestion } from "@/lib/chat/types";

interface ChatMessageProps {
  message: ChatMessageType;
  suggestions?: TaskSuggestion[];
  selectedSuggestions?: Set<string>;
  onToggleSuggestion?: (id: string) => void;
  onConfirmSuggestions?: () => void;
  showSuggestions?: boolean;
}

export function ChatMessage({
  message,
  suggestions,
  selectedSuggestions,
  onToggleSuggestion,
  onConfirmSuggestions,
  showSuggestions,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const hasSuggestions = showSuggestions && suggestions && suggestions.length > 0;

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
      role="listitem"
      aria-label={`${isUser ? "You" : "Assistant"} said: ${message.content}`}
    >
      {isUser ? (
        // User message: right-aligned with accent
        <div className="max-w-[85%] sm:max-w-[75%] flex gap-3 flex-row-reverse">
          <div className="w-0.5 bg-neutral-300 rounded-full flex-shrink-0" />
          <div className="py-1">
            <p className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed text-neutral-800">
              {message.content}
            </p>
          </div>
        </div>
      ) : (
        // Assistant message: left-aligned with accent
        <div className="max-w-[85%] sm:max-w-[80%] flex gap-3">
          <div className="w-0.5 bg-neutral-200 rounded-full flex-shrink-0" />
          <div className="py-1">
            <p className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed text-neutral-800">
              {message.content}
            </p>

            {/* Inline suggestions */}
            {hasSuggestions && (
              <div className="mt-4 pt-4 border-t border-neutral-100" role="group" aria-label="Selectable task suggestions">
                <p className="text-sm text-neutral-500 mb-3">
                  Select any that apply:
                </p>
                <div className="space-y-2">
                  {suggestions.slice(0, 4).map((suggestion) => {
                    const isSelected = selectedSuggestions?.has(suggestion.id);
                    return (
                      <button
                        key={suggestion.id}
                        onClick={() => onToggleSuggestion?.(suggestion.id)}
                        className={`w-full text-left py-2 border-b transition-colors ${
                          isSelected
                            ? "border-neutral-900"
                            : "border-neutral-100 hover:border-neutral-300"
                        }`}
                        aria-pressed={isSelected}
                        aria-label={`${suggestion.statement}. ${isSelected ? "Selected" : "Not selected"}`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-1 w-4 h-4 rounded-sm border flex items-center justify-center flex-shrink-0 ${
                              isSelected
                                ? "bg-neutral-900 border-neutral-900"
                                : "border-neutral-300"
                            }`}
                            aria-hidden="true"
                          >
                            {isSelected && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-neutral-900">{suggestion.statement}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Footer with count and confirm button */}
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-neutral-400" aria-live="polite">
                    {selectedSuggestions && selectedSuggestions.size > 0
                      ? `${selectedSuggestions.size} selected`
                      : "Select tasks that match your work"
                    }
                  </p>
                  <button
                    onClick={onConfirmSuggestions}
                    disabled={!selectedSuggestions || selectedSuggestions.size === 0}
                    className="text-sm font-medium text-neutral-900 hover:text-neutral-600 disabled:text-neutral-300 disabled:cursor-not-allowed transition-colors"
                  >
                    Confirm →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
