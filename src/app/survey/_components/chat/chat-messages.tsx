"use client";

import { useRef, useEffect } from "react";
import type { ChatMessage as ChatMessageType } from "@/types/survey";
import type { TaskSuggestion } from "@/lib/chat/types";
import { ChatMessage } from "./chat-message";
import { TypingIndicator } from "./typing-indicator";

interface ChatMessagesProps {
  messages: ChatMessageType[];
  isLoading: boolean;
  suggestions?: TaskSuggestion[];
  selectedSuggestions?: Set<string>;
  onToggleSuggestion?: (id: string) => void;
  onConfirmSuggestions?: () => void;
  showSuggestions?: boolean;
}

export function ChatMessages({
  messages,
  isLoading,
  suggestions,
  selectedSuggestions,
  onToggleSuggestion,
  onConfirmSuggestions,
  showSuggestions,
}: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find the index of the last assistant message
  const lastAssistantIndex = messages.findLastIndex(m => m.role === "assistant");

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, showSuggestions]);

  return (
    <div
      ref={containerRef}
      className="flex-1 p-4 pb-24 space-y-4"
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
      aria-relevant="additions"
    >
      <div role="list" className="space-y-4">
        {messages.map((message, index) => (
          <ChatMessage
            key={message.id}
            message={message}
            suggestions={index === lastAssistantIndex && showSuggestions ? suggestions : undefined}
            selectedSuggestions={selectedSuggestions}
            onToggleSuggestion={onToggleSuggestion}
            onConfirmSuggestions={onConfirmSuggestions}
            showSuggestions={index === lastAssistantIndex && showSuggestions}
          />
        ))}
      </div>

      {isLoading && <TypingIndicator />}

      {/* Scroll anchor */}
      <div ref={messagesEndRef} aria-hidden="true" />
    </div>
  );
}
