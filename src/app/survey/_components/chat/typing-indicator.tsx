"use client";

export function TypingIndicator() {
  return (
    <div
      className="flex justify-start"
      role="status"
      aria-label="Assistant is typing"
      aria-live="polite"
    >
      <div className="flex gap-3">
        <div className="w-0.5 bg-neutral-300 rounded-full flex-shrink-0 animate-pulse" />
        <div className="py-2">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span
              className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce"
              style={{ animationDelay: "0ms", animationDuration: "600ms" }}
            />
            <span
              className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce"
              style={{ animationDelay: "150ms", animationDuration: "600ms" }}
            />
            <span
              className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce"
              style={{ animationDelay: "300ms", animationDuration: "600ms" }}
            />
          </div>
          <span className="sr-only">Assistant is typing a response</span>
        </div>
      </div>
    </div>
  );
}
