"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SurveyLayout } from "../_components/survey-layout";
import { Check, ArrowRight } from "lucide-react";

export default function CompletePage() {
  const [jobTitle, setJobTitle] = useState<string>("");

  useEffect(() => {
    const storedJobTitle = sessionStorage.getItem("surveyJobTitle");
    if (storedJobTitle) {
      setJobTitle(storedJobTitle);
    }
  }, []);

  const handleStartOver = () => {
    sessionStorage.removeItem("surveyJobTitle");
    sessionStorage.removeItem("surveyOccupationCode");
    sessionStorage.removeItem("surveyTasks");
    sessionStorage.removeItem("surveyChatHistory");
  };

  return (
    <SurveyLayout>
      <div className="py-8 sm:py-12">
      <div className="max-w-md">
        {/* Step indicator */}
        <p className="text-sm text-neutral-400 mb-2">Complete</p>

        {/* Success icon */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="h-4 w-4 text-green-600" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-neutral-900 tracking-tight">
            All done!
          </h1>
        </div>

        <p className="text-neutral-500 text-lg">
          Thank you for completing the task capture
          {jobTitle && (
            <>
              {" "}for your role as{" "}
              <span className="text-neutral-700">{jobTitle}</span>
            </>
          )}
          .
        </p>

        {/* What's next */}
        <div className="mt-10 pt-8 border-t border-neutral-100">
          <h2 className="text-lg font-medium text-neutral-900 mb-4">
            What happens next
          </h2>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-neutral-400 text-sm">1</span>
              <div>
                <p className="text-neutral-900">Personalized insights</p>
                <p className="text-sm text-neutral-500">
                  Your tasks are analyzed against workforce trends
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-neutral-400 text-sm">2</span>
              <div>
                <p className="text-neutral-900">Role evolution map</p>
                <p className="text-sm text-neutral-500">
                  See how your role may change over time
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-neutral-400 text-sm">3</span>
              <div>
                <p className="text-neutral-900">Learning recommendations</p>
                <p className="text-sm text-neutral-500">
                  Curated resources to stay ahead of change
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Demo: Leader View */}
        <div className="mt-10 pt-8 border-t border-neutral-100">
          <p className="text-sm text-neutral-500 mb-3">
            See what it looks like when your whole workforce completes the survey:
          </p>
          <Link
            href="/leader"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
          >
            View aggregate dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* CTA */}
        <Link href="/survey" onClick={handleStartOver}>
          <button className="mt-8 inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-600 transition-colors">
            Start new survey
            <ArrowRight className="h-4 w-4" />
          </button>
        </Link>
      </div>
      </div>
    </SurveyLayout>
  );
}
