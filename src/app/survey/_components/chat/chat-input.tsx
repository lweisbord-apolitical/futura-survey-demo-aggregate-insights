"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Mic, MicOff, Loader2 } from "lucide-react";
import { useWhisper } from "@/hooks/use-whisper";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  showProceedButton?: boolean;
  onProceed?: () => void;
  isProcessing?: boolean;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Describe your tasks...",
  showProceedButton = false,
  onProceed,
  isProcessing = false,
}: ChatInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Whisper voice recording - auto-submit on transcription
  const {
    isRecording,
    isTranscribing,
    isSupported: voiceSupported,
    toggleRecording,
  } = useWhisper({
    onTranscript: (text) => {
      if (text && text.trim()) {
        // Auto-send the transcribed message
        onSend(text.trim());
      }
    },
    onError: (err) => {
      setError(err);
      setTimeout(() => setError(null), 5000);
    },
  });

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  // Refocus input when it becomes enabled (after sending a message and receiving response)
  const wasDisabledRef = useRef(disabled);
  useEffect(() => {
    if (wasDisabledRef.current && !disabled && inputRef.current) {
      inputRef.current.focus();
    }
    wasDisabledRef.current = disabled;
  }, [disabled]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || disabled) return;

    onSend(inputValue.trim());
    setInputValue("");

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-100 bg-white">
      <div className="max-w-3xl mx-auto px-6 sm:px-8">
      {/* Voice input indicator */}
      {isRecording && (
        <div className="px-4 py-2 flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm text-red-600">Recording... tap mic to stop</span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="px-4 py-2">
          <span className="text-sm text-red-600">{error}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="p-4 flex items-center gap-3"
      >
        {/* Voice input button */}
        <button
          type="button"
          className={`flex items-center justify-center w-12 h-12 rounded-full transition-all flex-shrink-0 ${
            isRecording
              ? "bg-red-500 text-white"
              : "bg-violet-100 text-violet-600 hover:bg-violet-200"
          } ${isTranscribing || !voiceSupported || disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          onClick={toggleRecording}
          disabled={!voiceSupported || disabled || isTranscribing}
          aria-label={
            voiceSupported
              ? isRecording
                ? "Stop recording"
                : isTranscribing
                ? "Transcribing"
                : "Start voice input"
              : "Voice input not supported"
          }
          aria-pressed={isRecording}
        >
          {isTranscribing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isRecording ? (
            <MicOff className="h-5 w-5" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </button>

        {/* Text input */}
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 text-neutral-900 placeholder:text-neutral-300 border-0 border-b-2 border-neutral-200 focus:border-violet-600 focus:ring-0 bg-transparent py-2 px-0 resize-none outline-none disabled:text-neutral-400 overflow-y-auto"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#d4d4d4 transparent' }}
          aria-label="Message input"
          aria-describedby="input-hint"
        />
        <span id="input-hint" className="sr-only">
          Press Enter to send, Shift+Enter for new line
        </span>

        {/* Send button */}
        <button
          type="submit"
          disabled={!inputValue.trim() || disabled}
          className="text-neutral-900 hover:text-neutral-600 disabled:text-neutral-300 disabled:cursor-not-allowed transition-colors"
          aria-label="Send message"
        >
          <Send className="h-5 w-5" />
        </button>

        {/* Proceed button - appears on right when visible */}
        {showProceedButton && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-500">
              Captured most of your tasks?
            </span>
            <button
              type="button"
              onClick={onProceed}
              disabled={isProcessing}
              className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? "Processing..." : "Continue →"}
            </button>
          </div>
        )}
      </form>
      </div>
    </div>
  );
}
