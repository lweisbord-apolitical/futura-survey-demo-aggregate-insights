"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SurveyLayout } from "./_components/survey-layout";
import { ArrowRight } from "lucide-react";

interface LookupResult {
  found: boolean;
  commonTitle?: string;
  onetCode?: string;
  onetTitle?: string;
  confidence?: number;
}

export default function SurveyLandingPage() {
  const router = useRouter();
  const [jobTitle, setJobTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitle.trim()) return;

    setIsLoading(true);
    const trimmedTitle = jobTitle.trim();

    try {
      const response = await fetch(
        `/api/job-titles/lookup?title=${encodeURIComponent(trimmedTitle)}`
      );
      const data: LookupResult = await response.json();

      sessionStorage.setItem("surveyJobTitle", trimmedTitle);
      if (data.found && data.onetCode) {
        sessionStorage.setItem("surveyOccupationCode", data.onetCode);
        sessionStorage.setItem("surveyOccupationTitle", data.onetTitle || "");
      } else {
        sessionStorage.removeItem("surveyOccupationCode");
        sessionStorage.removeItem("surveyOccupationTitle");
      }

      // Pre-fetch LLM-generated example tasks so the chat page doesn't flash
      try {
        const exampleRes = await fetch("/api/example-tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobTitle: trimmedTitle }),
        });
        const exampleData = await exampleRes.json();
        if (exampleData.tasks?.length > 0) {
          sessionStorage.setItem("surveyExampleTasks", JSON.stringify(exampleData.tasks));
        } else {
          sessionStorage.removeItem("surveyExampleTasks");
        }
      } catch {
        sessionStorage.removeItem("surveyExampleTasks");
      }

      router.push("/survey/chat");
    } catch (error) {
      console.error("Failed to lookup job title:", error);
      sessionStorage.setItem("surveyJobTitle", trimmedTitle);
      sessionStorage.removeItem("surveyExampleTasks");
      router.push("/survey/chat");
    }
  };

  return (
    <SurveyLayout>
      <div className="py-8 sm:py-12">
      <div className="max-w-md mx-auto">
        {/* Step indicator */}
        <p className="text-sm text-neutral-400 mb-2">Step 1 of 4</p>

        {/* Heading */}
        <h1 className="text-3xl sm:text-4xl font-semibold text-neutral-900 tracking-tight">
          What&apos;s your job title?
        </h1>

        <p className="mt-3 text-neutral-500 text-lg">
          This helps us personalise your learning and show how your role may evolve.
        </p>

        <form onSubmit={handleSubmit} className="mt-8">
          {/* Input */}
          <input
            type="text"
            placeholder="Policy Analyst"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            className="w-full text-xl sm:text-2xl font-medium text-neutral-900 placeholder:text-neutral-300 border-0 border-b-2 border-neutral-200 focus:border-violet-600 focus:ring-0 bg-transparent py-3 px-0 transition-colors outline-none"
            autoFocus
          />

          {/* Submit */}
          <button
            type="submit"
            disabled={!jobTitle.trim() || isLoading}
            className="mt-8 inline-flex items-center gap-2 text-base font-medium text-neutral-900 hover:text-neutral-600 disabled:text-neutral-300 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-1.5">
                Loading
                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms", animationDuration: "600ms" }} />
                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms", animationDuration: "600ms" }} />
                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms", animationDuration: "600ms" }} />
              </span>
            ) : (
              <>
                Continue
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </form>
      </div>
      </div>
    </SurveyLayout>
  );
}
