"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ChatMessage, ProcessedTask } from "@/types/survey";
import type { ChatResponse, TaskSuggestion } from "@/lib/chat/types";
import { ChatHeader } from "./chat-header";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";
import { InitialPrompt } from "./initial-prompt";
import { ProcessingScreen } from "./processing-screen";

// Helper to safely parse JSON from a response
async function safeParseJson<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return null;
  }
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// Helper to calculate word overlap between two task statements
// Returns a value between 0 and 1 (1 = identical words)
function calculateWordOverlap(text1: string, text2: string): number {
  const stopWords = new Set([
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "into", "through", "during", "before",
    "after", "between", "under", "again", "further", "then", "also", "their",
  ]);

  const extractWords = (text: string) =>
    text.toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

  const words1 = new Set(extractWords(text1));
  const words2 = new Set(extractWords(text2));

  if (words1.size === 0 || words2.size === 0) return 0;

  let shared = 0;
  for (const word of words1) {
    if (words2.has(word)) shared++;
  }

  // Return Jaccard similarity
  const union = new Set([...words1, ...words2]).size;
  return shared / union;
}

interface ChatContainerProps {
  jobTitle: string;
}

export function ChatContainer({ jobTitle }: ChatContainerProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<"initial" | "chat">("initial");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [extractedTaskCount, setExtractedTaskCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Handle initial prompt submission - starts session with initial tasks (streaming)
  const handleInitialSubmit = async (initialTasks: string) => {
    setError(null);

    // Create user message from initial dump
    const userMessage: ChatMessage = {
      id: `initial-${Date.now()}`,
      role: "user",
      content: initialTasks,
      timestamp: new Date().toISOString(),
    };

    // Create placeholder for streaming assistant message
    const assistantMessageId = `assistant-initial-${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };

    // Immediately show chat with user message and placeholder
    setMessages([userMessage, assistantMessage]);
    setPhase("chat");
    setIsLoading(true);

    // Fetch suggestions in background
    fetchSuggestions();

    try {
      const occupationCode = sessionStorage.getItem("surveyOccupationCode");

      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle,
          occupationCode: occupationCode || undefined,
          initialTasks,
        }),
      });

      if (!response.ok) {
        const errorData = await safeParseJson<{ error?: string }>(response);
        throw new Error(errorData?.error || "Failed to start session");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response stream available");
      }

      const decoder = new TextDecoder();
      let streamedContent = "";
      let firstChunkReceived = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "chunk" && data.content) {
                // Hide typing indicator once we start receiving content
                if (!firstChunkReceived) {
                  firstChunkReceived = true;
                  setIsLoading(false);
                }
                streamedContent += data.content;
                // Update the assistant message with streamed content
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, content: streamedContent }
                      : m
                  )
                );
              } else if (data.type === "done") {
                // Final response with metadata - includes sessionId
                setSessionId(data.sessionId);

                const finalMessage = data.message as ChatMessage;

                // Replace streaming message with final message
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId ? finalMessage : m
                  )
                );

                // Update suggestions if provided
                if (data.suggestions && data.suggestions.length > 0) {
                  setSuggestions(data.suggestions);
                }

                // Show suggestions if backend recommends
                if (data.shouldShowSuggestions) {
                  setShowSuggestions(true);
                }

                // Update completion status
                setIsComplete(data.isComplete);

                // Update extracted task count from backend state
                if (data.updatedState?.estimatedTaskCount !== undefined) {
                  setExtractedTaskCount(data.updatedState.estimatedTaskCount);
                }
              } else if (data.type === "error") {
                throw new Error(data.error || "Streaming error");
              }
            } catch (parseError) {
              // Ignore parse errors for incomplete chunks
              if (line.trim() !== "data: ") {
                console.warn("Failed to parse SSE data:", line);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to start session:", err);
      setError("Failed to start chat session. Please try again.");
      // Remove the placeholder message on error
      setMessages([userMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch O*NET suggestions
  const fetchSuggestions = useCallback(async () => {
    try {
      const occupationCode = sessionStorage.getItem("surveyOccupationCode");
      const params = new URLSearchParams({ jobTitle });
      if (occupationCode) {
        params.set("occupationCode", occupationCode);
      }
      params.set("limit", "8");

      const response = await fetch(`/api/onet/suggestions?${params}`);
      if (response.ok) {
        const data = await safeParseJson<{ tasks?: TaskSuggestion[] }>(response);
        if (data?.tasks) {
          setSuggestions(data.tasks);
        }
      }
    } catch (err) {
      console.error("Failed to fetch suggestions:", err);
    }
  }, [jobTitle]);

  // Send message to backend with streaming response
  const handleSendMessage = async (content: string) => {
    if (!sessionId) {
      setError("Session not initialized. Please refresh the page.");
      return;
    }

    // Optimistically add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };

    // Create placeholder for streaming assistant message
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: content,
        }),
      });

      if (!response.ok) {
        // Fall back to non-streaming if stream endpoint fails
        const errorData = await safeParseJson<{ error?: string }>(response);
        throw new Error(errorData?.error || "Failed to send message");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response stream available");
      }

      const decoder = new TextDecoder();
      let streamedContent = "";
      let firstChunkReceived = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "chunk" && data.content) {
                // Hide typing indicator once we start receiving content
                if (!firstChunkReceived) {
                  firstChunkReceived = true;
                  setIsLoading(false);
                }
                streamedContent += data.content;
                // Update the assistant message with streamed content
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, content: streamedContent }
                      : m
                  )
                );
              } else if (data.type === "done") {
                // Final response with metadata
                const finalMessage = data.message as ChatMessage;

                // Replace streaming message with final message
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId ? finalMessage : m
                  )
                );

                // Update suggestions if provided
                if (data.suggestions && data.suggestions.length > 0) {
                  setSuggestions(data.suggestions);
                }

                // Show suggestions panel (if backend says to)
                if (data.shouldShowSuggestions && !showSuggestions) {
                  setShowSuggestions(true);
                }

                // Hide suggestions after user sends a message
                if (showSuggestions && selectedSuggestions.size > 0 && !data.shouldShowSuggestions) {
                  setShowSuggestions(false);
                }

                // Update completion status
                setIsComplete(data.isComplete);

                // Update extracted task count from backend state
                if (data.updatedState?.estimatedTaskCount !== undefined) {
                  setExtractedTaskCount(data.updatedState.estimatedTaskCount);
                }
              } else if (data.type === "error") {
                throw new Error(data.error || "Streaming error");
              }
            } catch (parseError) {
              // Ignore parse errors for incomplete chunks
              if (line.trim() !== "data: ") {
                console.warn("Failed to parse SSE data:", line);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
      // Remove the optimistic messages on error
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id && m.id !== assistantMessageId));
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSuggestion = (suggestionId: string) => {
    setSelectedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(suggestionId)) {
        next.delete(suggestionId);
      } else {
        next.add(suggestionId);
      }
      return next;
    });
  };

  // Debounce and notify backend of card selections
  const selectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!sessionId || selectedSuggestions.size === 0) return;

    // Clear any pending timeout
    if (selectionTimeoutRef.current) {
      clearTimeout(selectionTimeoutRef.current);
    }

    // Debounce: wait 500ms before notifying backend
    selectionTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch("/api/chat", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            selectedSuggestionIds: Array.from(selectedSuggestions),
          }),
        });
      } catch (err) {
        console.error("Failed to update selections:", err);
      }
    }, 500);

    return () => {
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
    };
  }, [sessionId, selectedSuggestions]);

  const handleProceedToTasks = async () => {
    setIsProcessing(true);

    try {
      // Store chat history and sessionId
      sessionStorage.setItem("surveyChatHistory", JSON.stringify(messages));
      if (sessionId) {
        sessionStorage.setItem("surveySessionId", sessionId);
      }

      // Get occupation code if available
      const occupationCode = sessionStorage.getItem("surveyOccupationCode");

      // Call the task processing API
      // This runs the full pipeline: Extract → Normalize → Match
      const response = await fetch("/api/tasks/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-job-title": jobTitle,
          ...(occupationCode && { "x-occupation-code": occupationCode }),
        },
        body: JSON.stringify({
          sessionId,
          chatHistory: messages,
          selectedSuggestions: Array.from(selectedSuggestions),
        }),
      });

      let processedTasks: ProcessedTask[] = [];

      if (response.ok) {
        const data = await response.json();
        processedTasks = data.tasks || [];
      }

      // Add selected suggestions as tasks (they're already normalized)
      // But first, filter out any that are already in processedTasks (extracted from chat)
      const extractedStatements = new Set(
        processedTasks.map((t) => t.normalizedDescription.toLowerCase().trim())
      );

      const selectedSuggestionTasks: ProcessedTask[] = suggestions
        .filter((s) => selectedSuggestions.has(s.id))
        .filter((s) => {
          // Check if this suggestion was already extracted from chat
          const normalized = s.statement.toLowerCase().trim();
          const isDuplicate = extractedStatements.has(normalized) ||
            // Also check for high similarity (>80% word overlap)
            Array.from(extractedStatements).some((existing) =>
              calculateWordOverlap(normalized, existing) > 0.8
            );
          if (isDuplicate) {
            console.log("[ChatContainer] Skipping duplicate suggestion:", s.statement.slice(0, 50));
          }
          return !isDuplicate;
        })
        .map((s) => ({
          id: `suggestion-${s.id}`,
          userDescription: s.statement,
          normalizedDescription: s.statement,
          gwaCategory: s.gwaCategory,
          // Don't set onetTaskId - AI-generated suggestions need background matching
          // to find real O*NET task IDs (s.id is just a UUID like "ai-abc123...")
          onetTaskDescription: s.statement,
          source: "suggestion" as const,
        }));

      // Combine processed tasks with non-duplicate suggestions
      processedTasks = [...processedTasks, ...selectedSuggestionTasks];

      // Ensure we have at least some tasks
      if (processedTasks.length === 0) {
        processedTasks = [
          {
            id: "default-1",
            userDescription: "General work tasks",
            normalizedDescription: "Perform general job duties",
            gwaCategory: "workOutput",
            source: "chat",
          },
        ];
      }

      sessionStorage.setItem("surveyTasks", JSON.stringify(processedTasks));
      router.push("/survey/tasks");
    } catch (err) {
      console.error("Failed to process tasks:", err);
      // Fallback with basic tasks
      const fallbackTasks: ProcessedTask[] = [
        {
          id: "fallback-1",
          userDescription: "Daily work activities",
          normalizedDescription: "Perform regular job responsibilities",
          gwaCategory: "workOutput",
          source: "chat",
        },
      ];
      sessionStorage.setItem("surveyTasks", JSON.stringify(fallbackTasks));
      router.push("/survey/tasks");
    }
    // No finally block - component unmounts on navigation anyway
  };

  // Handle confirming suggestions and continuing chat
  const handleConfirmSuggestions = async () => {
    if (selectedSuggestions.size === 0) return;

    // Build a message from the selected suggestions
    const selectedTasks = suggestions
      .filter(s => selectedSuggestions.has(s.id))
      .map(s => s.statement);

    const message = `Yes, I also do: ${selectedTasks.join("; ")}`;

    // Hide suggestions panel
    setShowSuggestions(false);

    // Send as a regular message
    handleSendMessage(message);
  };

  // Calculate total tasks (extracted from chat + selected suggestions)
  const totalTaskCount = extractedTaskCount + selectedSuggestions.size;

  // Show proceed button when:
  // 1. 10+ total tasks, OR
  // 2. User explicitly said they're done (isComplete from backend)
  const showProceedButton = totalTaskCount >= 10 || isComplete;

  // Initial prompt phase
  if (phase === "initial") {
    return (
      <div className="flex flex-col bg-white pt-8 sm:pt-12">
        {error && (
          <div className="mx-4 mt-4 text-sm text-red-600">
            {error}
          </div>
        )}
        <InitialPrompt
          jobTitle={jobTitle}
          onSubmit={handleInitialSubmit}
          voiceEnabled={true}
        />
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
            <div className="text-neutral-500">Starting chat...</div>
          </div>
        )}
      </div>
    );
  }

  // Processing screen
  if (isProcessing) {
    return <ProcessingScreen />;
  }

  // Chat phase
  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)] bg-white -mx-6 sm:-mx-8">
      <ChatHeader />

      {error && (
        <div className="mx-4 mt-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <ChatMessages
        messages={messages}
        isLoading={isLoading}
        suggestions={suggestions}
        selectedSuggestions={selectedSuggestions}
        onToggleSuggestion={handleToggleSuggestion}
        onConfirmSuggestions={handleConfirmSuggestions}
        showSuggestions={showSuggestions}
      />

      <ChatInput
        onSend={handleSendMessage}
        disabled={isLoading || isProcessing || !sessionId}
        placeholder="Describe your tasks..."
        showProceedButton={showProceedButton}
        onProceed={handleProceedToTasks}
        isProcessing={isProcessing}
      />
    </div>
  );
}
