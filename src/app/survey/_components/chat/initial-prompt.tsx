"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Square, Loader2, ArrowRight, Keyboard } from "lucide-react";
import { useWhisper } from "@/hooks/use-whisper";

interface InitialPromptProps {
  jobTitle: string;
  onSubmit: (initialTasks: string) => void;
  voiceEnabled?: boolean;
}

type InputMode = "talk" | "type";

const DEFAULT_EXAMPLE_TASKS = [
  "I gather and analyze information relevant to my work",
  "I communicate with colleagues and stakeholders",
  "I prepare documents and recommendations",
];

export function InitialPrompt({
  jobTitle,
  onSubmit,
  voiceEnabled = true,
}: InitialPromptProps) {
  const [textInput, setTextInput] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("talk");
  const [error, setError] = useState<string | null>(null);
  const [exampleTasks, setExampleTasks] = useState<string[]>(() => {
    // Try to read pre-fetched tasks from sessionStorage
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("surveyExampleTasks");
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          return DEFAULT_EXAMPLE_TASKS;
        }
      }
    }
    return DEFAULT_EXAMPLE_TASKS;
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const usedVoiceRef = useRef(false);

  // Whisper voice recording - auto-submit on transcription
  const {
    isRecording,
    isTranscribing,
    isSupported: voiceSupported,
    toggleRecording,
  } = useWhisper({
    onTranscript: (text) => {
      if (text && text.trim()) {
        usedVoiceRef.current = true;
        const newText = text.trim();
        setTextInput(newText);
        setTimeout(() => {
          onSubmit(newText);
        }, 500);
      }
    },
    onError: (err) => {
      setError(err);
      setTimeout(() => setError(null), 5000);
    },
  });

  const isVoiceEnabled = voiceSupported && voiceEnabled;

  // Only fall back to type mode if voice is explicitly disabled via prop
  useEffect(() => {
    if (!voiceEnabled) {
      setInputMode("type");
    }
  }, [voiceEnabled]);

  // Focus textarea when type mode is selected
  useEffect(() => {
    if (inputMode === "type" && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [inputMode]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [textInput]);

  const handleSubmit = () => {
    if (textInput.trim()) {
      onSubmit(textInput.trim());
    }
  };

  const canSubmit = textInput.trim().length > 0;

  return (
    <div className="max-w-md mx-auto">
      {/* Step indicator */}
      <p className="text-sm text-neutral-400 mb-2">Step 2 of 4</p>

      {/* Heading */}
      <h1 className="text-3xl sm:text-4xl font-semibold text-neutral-900 tracking-tight leading-tight">
        Break down your role
      </h1>

      {/* Subhead */}
      <p className="mt-3 text-neutral-500 text-lg">
        Walk us through the 10–20 tasks that make up the majority of your role.
      </p>

      {/* Example tasks in blockquote style */}
      <div className="mt-4 pl-4 border-l-2 border-neutral-200">
        <div className="space-y-1.5 text-neutral-500">
          {exampleTasks.map((task, index) => (
            <p key={index}>{task}</p>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      )}

      {/* Toggle pills */}
      <div className="mt-10 inline-flex bg-neutral-100 rounded-full p-1">
        {isVoiceEnabled && (
          <button
            onClick={() => setInputMode("talk")}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
              inputMode === "talk"
                ? "bg-white shadow-sm text-neutral-900"
                : "text-neutral-400 hover:text-neutral-600"
            }`}
          >
            <Mic className={`inline-block w-4 h-4 mr-1.5 ${inputMode === "talk" ? "text-violet-500" : ""}`} />
            Talk
          </button>
        )}
        <button
          onClick={() => setInputMode("type")}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
            inputMode === "type"
              ? "bg-white shadow-sm text-neutral-900"
              : "text-neutral-400 hover:text-neutral-600"
          }`}
        >
          <Keyboard className={`inline-block w-4 h-4 mr-1.5 ${inputMode === "type" ? "text-violet-500" : ""}`} />
          Type
        </button>
      </div>

      {/* Input panels */}
      <div className="mt-8">
        {/* Voice Panel - show if in talk mode AND voice is available */}
        {inputMode === "talk" && isVoiceEnabled && (
          <div className="flex items-center gap-5">
            <button
              onClick={toggleRecording}
              disabled={isTranscribing}
              className={`flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center shadow-sm transition-colors ${
                isRecording
                  ? "bg-violet-600 text-white shadow-violet-200"
                  : "bg-violet-500 text-white shadow-violet-200 hover:bg-violet-600"
              } ${isTranscribing ? "opacity-50" : ""}`}
            >
              {isTranscribing ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : isRecording ? (
                <Square className="h-5 w-5 fill-current" />
              ) : (
                <Mic className="h-6 w-6" />
              )}
            </button>
            <div>
              <p className="text-neutral-900 font-medium text-lg">
                {isRecording ? "Tap to stop" : isTranscribing ? "Processing..." : "Tap to start talking"}
              </p>
              <p className="text-neutral-400 mt-1">
                {isRecording ? "Recording..." : "Take 2-3 minutes — don't worry about ums and ers"}
              </p>
            </div>
          </div>
        )}

        {/* Type Panel - show if in type mode OR if voice not available */}
        {(inputMode === "type" || !isVoiceEnabled) && (
          <div>
            <textarea
              ref={textareaRef}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="List the activities that fill your days..."
              rows={1}
              className="w-full text-neutral-900 placeholder:text-neutral-300 border-0 border-b-2 border-neutral-200 focus:border-violet-600 focus:ring-0 bg-transparent py-3 px-0 resize-none outline-none text-base leading-relaxed"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.metaKey) {
                  handleSubmit();
                }
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="mt-4 inline-flex items-center gap-2 text-base font-medium text-neutral-900 hover:text-neutral-600 disabled:text-neutral-300 disabled:cursor-not-allowed transition-colors"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
