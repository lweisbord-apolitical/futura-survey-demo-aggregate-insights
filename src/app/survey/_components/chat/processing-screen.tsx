"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

const STAGES = [
  { message: "Reading through your conversation...", duration: 2000 },
  { message: "Identifying your tasks...", duration: 2500 },
  { message: "Matching to job database...", duration: 3000 },
  { message: "Organizing everything...", duration: 2000 },
  { message: "Almost there...", duration: 10000 },
];

export function ProcessingScreen() {
  const [stageIndex, setStageIndex] = useState(0);

  // Cycle through stages
  useEffect(() => {
    if (stageIndex >= STAGES.length - 1) return;

    const timer = setTimeout(() => {
      setStageIndex((prev) => prev + 1);
    }, STAGES[stageIndex].duration);

    return () => clearTimeout(timer);
  }, [stageIndex]);

  const stage = STAGES[stageIndex];

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center">
      {/* Spinner */}
      <div className="relative mb-8">
        <div className="w-16 h-16 rounded-full border-4 border-neutral-100" />
        <Loader2 className="absolute inset-0 w-16 h-16 text-neutral-900 animate-spin" />
      </div>

      {/* Message */}
      <p className="text-lg text-neutral-700 text-center px-4">
        {stage.message}
      </p>

      {/* Progress dots */}
      <div className="mt-6 flex items-center gap-2">
        {STAGES.slice(0, -1).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i < stageIndex
                ? "bg-neutral-900"
                : i === stageIndex
                ? "bg-neutral-900 scale-125"
                : "bg-neutral-200"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
