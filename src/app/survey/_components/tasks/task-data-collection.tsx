"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ProcessedTask, TaskWithData, AIFrequency, TaskAnalysis } from "@/types/survey";
import { X, Mic, Square, Loader2, ArrowRight, ArrowLeft, Check, Keyboard } from "lucide-react";
import { useWhisper } from "@/hooks/use-whisper";
import { TaskReview } from "./task-review";

interface TaskDataCollectionProps {
  tasks: ProcessedTask[];
  isMatchingComplete: boolean;
}

const AI_USAGE_EXAMPLES = [
  "ChatGPT helps me draft tricky emails",
  "I use Perplexity to research topics I'm unfamiliar with",
  "Copilot suggests text while I write in Word",
  "I brainstorm with AI when I'm stuck on a problem",
];

const AI_TOOLS = [
  { id: "chatgpt", label: "ChatGPT" },
  { id: "claude", label: "Claude" },
  { id: "copilot", label: "Microsoft Copilot" },
  { id: "gemini", label: "Google Gemini" },
  { id: "grok", label: "Grok" },
  { id: "perplexity", label: "Perplexity" },
  { id: "org-internal", label: "Internal AI" },
  { id: "other", label: "Other" },
] as const;

type Phase = "ai-intro" | "ai-tools" | "ai-details" | "tasks" | "analyzing" | "review";

// Hour bucket options (maps to 1-5 scale)
const HOUR_OPTIONS = [
  { value: 1, label: '< 1' },
  { value: 2, label: '1–5' },
  { value: 3, label: '5–10' },
  { value: 4, label: '10–20' },
  { value: 5, label: '20+' },
];

// AI frequency options (maps to 1-5 scale)
const AI_OPTIONS = [
  { value: 1, label: 'Never' },
  { value: 2, label: 'Rarely' },
  { value: 3, label: 'Sometimes' },
  { value: 4, label: 'Often' },
  { value: 5, label: 'Always' },
];

// Hour estimates for distribution calculation (midpoints)
const HOUR_ESTIMATES = [0.5, 3, 7.5, 15, 25];

// GWA category labels
const GWA_LABELS: Record<string, string> = {
  informationInput: 'Gathering info',
  mentalProcesses: 'Making decisions',
  workOutput: 'Getting things done',
  interactingWithOthers: 'Working with people',
};

// Helper functions for label display (5-point scale: 1-5)
const getTimeLabel = (value: number): string => {
  const labels = ["< 1 hr", "1–5 hrs", "5–10 hrs", "10–20 hrs", "20+ hrs"];
  return labels[value - 1] || "";
};

const getAiLabel = (value: number): string => {
  const labels = ["Never", "Rarely", "Sometimes", "Often", "Always"];
  return labels[value - 1] || "";
};

// Pill button component
interface PillButtonsProps {
  options: { value: number; label: string }[];
  value: number | undefined;
  onChange: (value: number) => void;
}

function PillButtons({ options, value, onChange }: PillButtonsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
            value === opt.value
              ? "bg-neutral-900 text-white"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// GWA Distribution sidebar component
function GWADistribution({
  tasks,
  timeValues,
  currentGwaCategory
}: {
  tasks: ProcessedTask[];
  timeValues: Record<string, number>;
  currentGwaCategory?: string;
}) {
  const distribution = useMemo(() => {
    const totals: Record<string, number> = {};
    tasks.forEach((task) => {
      if (task.gwaCategory && timeValues[task.id]) {
        const hours = HOUR_ESTIMATES[timeValues[task.id] - 1];
        totals[task.gwaCategory] = (totals[task.gwaCategory] || 0) + hours;
      }
    });
    return totals;
  }, [tasks, timeValues]);

  const totalHours = Object.values(distribution).reduce((a, b) => a + b, 0);
  const maxHours = Math.max(...Object.values(distribution), 1);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-neutral-900">Your time</span>
        <span className="text-2xl font-semibold text-neutral-900">
          {Math.round(totalHours)} <span className="text-sm font-normal text-neutral-400">hrs/mo</span>
        </span>
      </div>
      <div className="space-y-2">
        {Object.entries(GWA_LABELS).map(([key, label]) => {
          const hours = distribution[key] || 0;
          const width = (hours / maxHours) * 100;
          const isCurrent = key === currentGwaCategory;
          return (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className={isCurrent ? "text-neutral-900 font-medium" : "text-neutral-500"}>
                  {isCurrent && "● "}{label}
                </span>
                <span className="text-neutral-400">{Math.round(hours)}h</span>
              </div>
              <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isCurrent ? "bg-neutral-900" : "bg-neutral-300"
                  }`}
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Mobile collapsible distribution bar
function MobileDistributionBar({
  tasks,
  timeValues,
  isExpanded,
  onToggle,
  currentGwaCategory,
}: {
  tasks: ProcessedTask[];
  timeValues: Record<string, number>;
  isExpanded: boolean;
  onToggle: () => void;
  currentGwaCategory?: string;
}) {
  const totalHours = useMemo(() => {
    let total = 0;
    tasks.forEach((task) => {
      if (timeValues[task.id]) {
        total += HOUR_ESTIMATES[timeValues[task.id] - 1];
      }
    });
    return Math.round(total);
  }, [tasks, timeValues]);

  return (
    <div className="bg-neutral-50 rounded-lg p-3">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between"
      >
        <span className="text-sm font-medium text-neutral-900">
          {totalHours} hrs/mo
        </span>
        <span className="text-xs text-neutral-400">
          {isExpanded ? "▲" : "▼"}
        </span>
      </button>
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-neutral-200">
          <GWADistribution tasks={tasks} timeValues={timeValues} currentGwaCategory={currentGwaCategory} />
        </div>
      )}
    </div>
  );
}

// Completed task row component
interface CompletedTaskRowProps {
  task: ProcessedTask;
  timeValue: number;
  aiValue?: number;
  usesAi: boolean;
  onRemove: () => void;
}

function CompletedTaskRow({ task, timeValue, aiValue, usesAi, onRemove }: CompletedTaskRowProps) {
  const timeLabel = getTimeLabel(timeValue);
  const aiLabel = usesAi && aiValue !== undefined ? getAiLabel(aiValue) : null;

  return (
    <div className="flex items-center gap-3 py-2 text-sm">
      <Check className="h-4 w-4 text-violet-600 flex-shrink-0" />
      <span className="flex-1 truncate text-neutral-700">
        {task.normalizedDescription || task.userDescription}
      </span>
      <span className="text-neutral-400 text-xs whitespace-nowrap">
        {timeLabel}{aiLabel ? ` · ${aiLabel}` : ''}
      </span>
      <button onClick={onRemove} className="text-neutral-300 hover:text-red-500 transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function TaskDataCollection({ tasks: initialTasks, isMatchingComplete }: TaskDataCollectionProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<ProcessedTask[]>(initialTasks);

  // Sync tasks when parent prop updates (e.g., after O*NET matching)
  useEffect(() => {
    // Only update if we have new O*NET data
    const hasNewOnetData = initialTasks.some(t => t.onetTaskId);
    const currentHasOnetData = tasks.some(t => t.onetTaskId);

    if (hasNewOnetData && !currentHasOnetData) {
      setTasks(initialTasks);
    }
  }, [initialTasks]);

  const [timeValues, setTimeValues] = useState<Record<string, number>>({});
  const [aiValues, setAiValues] = useState<Record<string, number>>({});
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("ai-intro");
  const [usesAi, setUsesAi] = useState<boolean | null>(null);
  const [selectedAiTools, setSelectedAiTools] = useState<string[]>([]);
  const [aiReflection, setAiReflection] = useState("");
  const [aiInputMode, setAiInputMode] = useState<"talk" | "type">("talk");
  const [isAnimating, setIsAnimating] = useState(false);
  const [isMobileDistributionExpanded, setIsMobileDistributionExpanded] = useState(false);
  const prevTaskIndexRef = useRef(currentTaskIndex);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const skipAutoAdvanceRef = useRef(false);

  // Review phase state
  const [ratedTasks, setRatedTasks] = useState<TaskWithData[]>([]);
  const [analysis, setAnalysis] = useState<TaskAnalysis | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [isWaitingForMatching, setIsWaitingForMatching] = useState(false);

  // Merge O*NET enrichment into ratedTasks when background matching completes
  useEffect(() => {
    const enrichedTasks = tasks.filter((t) => t.onetTaskId);
    if (enrichedTasks.length === 0) return;

    setRatedTasks((prev) => {
      if (prev.length === 0) return prev;
      const taskMap = new Map(enrichedTasks.map((t) => [t.id, t]));
      let changed = false;
      const merged = prev.map((rt) => {
        const enriched = taskMap.get(rt.id);
        if (enriched && !rt.onetTaskId) {
          changed = true;
          return {
            ...rt,
            onetTaskId: enriched.onetTaskId,
            onetTaskDescription: enriched.onetTaskDescription,
            similarityScore: enriched.similarityScore,
          };
        }
        return rt;
      });
      return changed ? merged : prev;
    });
  }, [tasks]);

  // Ref to track pending submit (avoids stale closure in useEffect)
  const pendingSubmitRef = useRef(false);

  // Proceed with submit when matching completes (if we were waiting)
  useEffect(() => {
    if (isWaitingForMatching && isMatchingComplete && !pendingSubmitRef.current) {
      pendingSubmitRef.current = true;
      setIsWaitingForMatching(false);
      // Inline the submit to avoid stale closure issues
      (async () => {
        try {
          const response = await fetch("/api/tasks/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assessmentId,
              sessionId: sessionStorage.getItem("surveySessionId"),
              // Use tasks prop (has onetTaskId) and merge rating values from ratedTasks or state
              tasks: tasks.map((task) => {
                const rated = ratedTasks.find((rt) => rt.id === task.id);
                return {
                  ...task, // Has onetTaskId from enriched tasks prop
                  timePercentage: rated?.timePercentage ?? Math.round(((timeValues[task.id] ?? 3) / 5) * 100),
                  aiFrequency: rated?.aiFrequency ?? (usesAi ? (aiValues[task.id] ?? 1) : 1),
                  aiDescription: rated?.aiDescription ?? aiReflection ?? undefined,
                };
              }),
              jobTitle: sessionStorage.getItem("surveyJobTitle"),
              occupationCode: sessionStorage.getItem("surveyOccupationCode"),
              usesAi,
              aiTools: selectedAiTools,
              aiDescription: aiReflection,
            }),
          });

          if (!response.ok) throw new Error("Submit failed");
          router.push("/survey/complete");
        } catch (error) {
          console.error("Submit error:", error);
          setSubmitError(true);
          setIsSubmitting(false);
          pendingSubmitRef.current = false;
        }
      })();
    }
  }, [isMatchingComplete, isWaitingForMatching, assessmentId, ratedTasks, tasks, timeValues, aiValues, usesAi, selectedAiTools, aiReflection, router]);

  const {
    isRecording,
    isTranscribing,
    isSupported: voiceSupported,
    toggleRecording,
  } = useWhisper({
    onTranscript: (text) => {
      if (text?.trim()) {
        setAiReflection((prev) => (prev ? `${prev} ${text.trim()}` : text.trim()));

        // Auto-advance if recorded for more than 3 seconds
        const recordingDuration = Date.now() - (recordingStartTimeRef.current || Date.now());
        if (recordingDuration > 3000) {
          setTimeout(() => setPhase("tasks"), 500);
        }
      }
    },
  });

  const currentTask = tasks[currentTaskIndex];
  const remainingTasks = tasks.length - currentTaskIndex - 1;
  const allTasksComplete = currentTaskIndex >= tasks.length;

  const isCurrentTaskComplete = (taskId: string) => {
    const hasTime = timeValues[taskId] !== undefined;
    if (!usesAi) return hasTime;
    return hasTime && aiValues[taskId] !== undefined;
  };

  // Animation effect when task changes
  useEffect(() => {
    if (prevTaskIndexRef.current !== currentTaskIndex) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 300);
      prevTaskIndexRef.current = currentTaskIndex;
      return () => clearTimeout(timer);
    }
  }, [currentTaskIndex]);

  // Auto-advance effect for tasks
  useEffect(() => {
    if (!currentTask) return;

    // Skip auto-advance if user just navigated back
    if (skipAutoAdvanceRef.current) {
      skipAutoAdvanceRef.current = false;
      return;
    }

    if (isCurrentTaskComplete(currentTask.id)) {
      const timer = setTimeout(() => {
        if (currentTaskIndex < tasks.length - 1) {
          setCurrentTaskIndex(prev => prev + 1);
        } else {
          setCurrentTaskIndex(tasks.length);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [timeValues, aiValues, currentTaskIndex, tasks.length, usesAi, currentTask]);

  // Track recording start time
  useEffect(() => {
    if (isRecording) {
      recordingStartTimeRef.current = Date.now();
    }
  }, [isRecording]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [aiReflection]);

  // Focus textarea when switching to type mode in AI details phase
  useEffect(() => {
    if (aiInputMode === "type" && phase === "ai-details" && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [aiInputMode, phase]);

  const setTime = (taskId: string, value: number) => {
    setTimeValues((prev) => ({ ...prev, [taskId]: value }));
  };

  const setAi = (taskId: string, value: number) => {
    setAiValues((prev) => ({ ...prev, [taskId]: value }));
  };

  const toggleAiTool = (toolId: string) => {
    setSelectedAiTools((prev) =>
      prev.includes(toolId)
        ? prev.filter((id) => id !== toolId)
        : [...prev, toolId]
    );
  };

  const removeTask = (taskId: string) => {
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    if (taskIndex < currentTaskIndex) {
      setCurrentTaskIndex(prev => Math.max(0, prev - 1));
    } else if (taskIndex === currentTaskIndex && taskIndex === tasks.length - 1) {
      setCurrentTaskIndex(prev => Math.max(0, prev - 1));
    }

    setTimeValues((prev) => {
      const { [taskId]: _, ...rest } = prev;
      return rest;
    });
    setAiValues((prev) => {
      const { [taskId]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleBack = () => {
    if (phase === "tasks") {
      skipAutoAdvanceRef.current = true;
      if (currentTaskIndex > 0) {
        setCurrentTaskIndex(prev => prev - 1);
      } else if (usesAi) {
        setPhase("ai-details");
      } else {
        setPhase("ai-intro");
      }
    } else if (phase === "review") {
      skipAutoAdvanceRef.current = true;
      setPhase("tasks");
      setCurrentTaskIndex(tasks.length);
    } else if (phase === "ai-details") {
      setPhase("ai-tools");
    } else if (phase === "ai-tools") {
      setPhase("ai-intro");
      setUsesAi(null);
    }
  };

  // Build TaskWithData from current state
  const buildTaskData = (): TaskWithData[] => {
    return tasks.map((task) => ({
      ...task,
      timePercentage: Math.round(((timeValues[task.id] ?? 3) / 5) * 100),
      aiFrequency: usesAi ? (aiValues[task.id] ?? 1) : 1,
      aiDescription: aiReflection || undefined,
    }));
  };

  // Handle proceeding to review (analyze tasks)
  const handleProceedToReview = async () => {
    setPhase("analyzing");
    const startTime = Date.now();

    try {
      const taskData = buildTaskData();
      setRatedTasks(taskData);

      const jobTitle = sessionStorage.getItem("surveyJobTitle") || "General Worker";
      const sessionId = sessionStorage.getItem("surveySessionId");

      // Early save to database (non-blocking on error)
      try {
        const submitResponse = await fetch("/api/tasks/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            tasks: taskData,
            jobTitle,
            occupationCode: sessionStorage.getItem("surveyOccupationCode"),
            usesAi,
            aiTools: selectedAiTools,
            aiDescription: aiReflection,
          }),
        });

        if (submitResponse.ok) {
          const { assessmentId: id } = await submitResponse.json();
          setAssessmentId(id);
        }
      } catch (err) {
        console.error("Early save failed:", err);
        // Continue anyway - final submit will create new assessment
      }

      const response = await fetch("/api/tasks/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: taskData,
          jobTitle,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze tasks");
      }

      const analysisResult: TaskAnalysis = await response.json();
      setAnalysis(analysisResult);

      // Ensure minimum 2 second display
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, 2000 - elapsed);

      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      setPhase("review");
    } catch (error) {
      console.error("Analysis error:", error);
      // Analysis failed - skip review, go straight to submit
      setPhase("review");
      setAnalysis({ themes: [], insights: { mostTimeTheme: "", mostAiUseTask: null, leastAiUseTask: null } });
      await handleFinalSubmit();
    }
  };

  // Handle removing a task in review phase
  const handleReviewRemoveTask = (taskId: string) => {
    setRatedTasks((prev) => prev.filter((t) => t.id !== taskId));

    if (analysis) {
      const updatedThemes = analysis.themes.map((theme) => ({
        ...theme,
        tasks: theme.tasks.filter((id) => id !== taskId),
      })).filter((theme) => theme.tasks.length > 0);

      const remainingTasksList = ratedTasks.filter((t) => t.id !== taskId);
      const taskById = new Map(remainingTasksList.map((t) => [t.id, t]));

      const recalculatedThemes = updatedThemes.map((theme) => {
        const themeTasks = theme.tasks
          .map((id) => taskById.get(id))
          .filter((t): t is TaskWithData => t !== undefined);
        const totalTimePercent = themeTasks.reduce((sum, t) => sum + t.timePercentage, 0);
        return { ...theme, totalTimePercent };
      });

      setAnalysis({
        ...analysis,
        themes: recalculatedThemes,
      });
    }
  };

  // Actual submit logic (called directly or after matching completes)
  const doFinalSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(false);
    try {
      const response = await fetch("/api/tasks/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId,
          sessionId: sessionStorage.getItem("surveySessionId"),
          // Use tasks prop (has onetTaskId) and merge rating values from ratedTasks or state
          tasks: tasks.map((task) => {
            const rated = ratedTasks.find((rt) => rt.id === task.id);
            return {
              ...task, // Has onetTaskId from enriched tasks prop
              timePercentage: rated?.timePercentage ?? Math.round(((timeValues[task.id] ?? 3) / 5) * 100),
              aiFrequency: rated?.aiFrequency ?? (usesAi ? (aiValues[task.id] ?? 1) : 1),
              aiDescription: rated?.aiDescription ?? aiReflection ?? undefined,
            };
          }),
          jobTitle: sessionStorage.getItem("surveyJobTitle"),
          occupationCode: sessionStorage.getItem("surveyOccupationCode"),
          usesAi,
          aiTools: selectedAiTools,
          aiDescription: aiReflection,
        }),
      });

      if (!response.ok) throw new Error("Submit failed");

      router.push("/survey/complete");
    } catch (error) {
      console.error("Submit error:", error);
      setSubmitError(true);
      setIsSubmitting(false);
    }
  };

  // Final submit after review confirmation - waits for O*NET matching if needed
  const handleFinalSubmit = async () => {
    if (!isMatchingComplete) {
      // Wait for O*NET matching to complete before saving
      setIsSubmitting(true);
      setIsWaitingForMatching(true);
      return;
    }
    await doFinalSubmit();
  };

  // Analyzing state
  if (phase === "analyzing") {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center">
        <div className="relative mb-8">
          <div className="w-16 h-16 rounded-full border-4 border-neutral-100" />
          <Loader2 className="absolute inset-0 w-16 h-16 text-neutral-900 animate-spin" />
        </div>
        <p className="text-lg text-neutral-700 text-center px-4">
          Analyzing your work...
        </p>
      </div>
    );
  }

  // Review phase
  if (phase === "review" && analysis) {
    return (
      <TaskReview
        tasks={ratedTasks}
        analysis={analysis}
        onRemoveTask={handleReviewRemoveTask}
        onConfirm={handleFinalSubmit}
        onBack={handleBack}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    );
  }

  // Phase 1: AI Introduction
  if (phase === "ai-intro") {
    return (
      <div className="max-w-md mx-auto">
        <p className="text-sm text-neutral-400 mb-2">Step 3 of 4</p>

        <h1 className="text-3xl sm:text-4xl font-semibold text-neutral-900 tracking-tight">
          Do you use AI tools?
        </h1>

        <p className="mt-3 text-neutral-500 text-lg">
          This helps us understand how AI fits into your work.
        </p>

        <div className="mt-8 space-y-3">
          <button
            onClick={() => {
              setUsesAi(true);
              setPhase("ai-tools");
            }}
            className={`w-full text-left py-4 border-b-2 transition-colors ${
              usesAi === true
                ? "border-violet-600 text-neutral-900"
                : "border-neutral-200 text-neutral-600 hover:border-violet-300"
            }`}
          >
            <span className="text-lg font-medium">Yes, I use AI tools</span>
            <p className="text-sm text-neutral-500 mt-0.5">ChatGPT, Copilot, Claude, etc.</p>
          </button>

          <button
            onClick={() => {
              setUsesAi(false);
              setPhase("tasks");
            }}
            className={`w-full text-left py-4 border-b-2 transition-colors ${
              usesAi === false
                ? "border-violet-600 text-neutral-900"
                : "border-neutral-200 text-neutral-600 hover:border-violet-300"
            }`}
          >
            <span className="text-lg font-medium">No, I don&apos;t use AI</span>
            <p className="text-sm text-neutral-500 mt-0.5">Not currently part of my workflow</p>
          </button>
        </div>
      </div>
    );
  }

  // Phase 1b: AI Tools Selection
  if (phase === "ai-tools") {
    return (
      <div className="max-w-md mx-auto">
        <p className="text-sm text-neutral-400 mb-2">Step 3 of 4</p>

        <h1 className="text-3xl sm:text-4xl font-semibold text-neutral-900 tracking-tight">
          Which AI tools do you use?
        </h1>

        <p className="mt-3 text-neutral-500 text-lg">
          Select all that you have access to at work.
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          {AI_TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => toggleAiTool(tool.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedAiTools.includes(tool.id)
                  ? "bg-violet-600 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {tool.label}
            </button>
          ))}
        </div>

        <div className="mt-10 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <button
            onClick={() => setPhase("ai-details")}
            disabled={selectedAiTools.length === 0}
            className={`inline-flex items-center gap-2 text-base font-medium transition-colors ${
              selectedAiTools.length === 0
                ? "text-neutral-300 cursor-not-allowed"
                : "text-neutral-900 hover:text-neutral-600"
            }`}
          >
            Continue
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  // Phase 2: AI Details
  if (phase === "ai-details") {
    return (
      <div className="max-w-md mx-auto">
        <p className="text-sm text-neutral-400 mb-2">Step 3 of 4</p>

        <h1 className="text-3xl sm:text-4xl font-semibold text-neutral-900 tracking-tight">
          Tell us about your AI usage
        </h1>

        <p className="mt-3 text-neutral-500 text-lg">
          Which tools do you use and what for?
        </p>

        {/* Examples in blockquote style */}
        <div className="mt-4 pl-4 border-l-2 border-neutral-200">
          <div className="space-y-1.5 text-neutral-500">
            {AI_USAGE_EXAMPLES.map((example, i) => (
              <p key={i}>{example}</p>
            ))}
          </div>
        </div>

        {/* Toggle pills */}
        <div className="mt-10 inline-flex bg-neutral-100 rounded-full p-1">
          {voiceSupported && (
            <button
              onClick={() => setAiInputMode("talk")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                aiInputMode === "talk"
                  ? "bg-white shadow-sm text-neutral-900"
                  : "text-neutral-400 hover:text-neutral-600"
              }`}
            >
              <Mic className={`inline-block w-4 h-4 mr-1.5 ${aiInputMode === "talk" ? "text-violet-500" : ""}`} />
              Talk
            </button>
          )}
          <button
            onClick={() => setAiInputMode("type")}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
              aiInputMode === "type"
                ? "bg-white shadow-sm text-neutral-900"
                : "text-neutral-400 hover:text-neutral-600"
            }`}
          >
            <Keyboard className={`inline-block w-4 h-4 mr-1.5 ${aiInputMode === "type" ? "text-violet-500" : ""}`} />
            Type
          </button>
        </div>

        {/* Input panels */}
        <div className="mt-8">
          {/* Voice Panel */}
          {aiInputMode === "talk" && voiceSupported && (
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
                  {isRecording ? "Recording..." : "Take a minute to describe your AI usage"}
                </p>
              </div>
            </div>
          )}

          {/* Type Panel */}
          {(aiInputMode === "type" || !voiceSupported) && (
            <div>
              <textarea
                ref={textareaRef}
                value={aiReflection}
                onChange={(e) => setAiReflection(e.target.value)}
                placeholder="I use ChatGPT for drafting, Claude for research..."
                rows={1}
                className="w-full text-neutral-900 placeholder:text-neutral-300 border-0 border-b-2 border-neutral-200 focus:border-violet-600 focus:ring-0 bg-transparent py-3 px-0 resize-none outline-none text-base leading-relaxed"
              />
              <button
                onClick={() => setPhase("tasks")}
                className="mt-4 inline-flex items-center gap-2 text-base font-medium text-neutral-900 hover:text-neutral-600 transition-colors"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Back button - always visible */}
        <div className="mt-10">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      </div>
    );
  }

  // Phase 3: Tasks (one at a time)
  return (
    <div className="max-w-4xl mx-auto">
      <p className="text-sm text-neutral-400 mb-2">Step 3 of 4</p>
      <h1 className="text-2xl font-semibold text-neutral-900">Rate your tasks</h1>

      {/* Mobile: collapsible distribution bar at top */}
      <div className="md:hidden mt-4">
        <MobileDistributionBar
          tasks={tasks}
          timeValues={timeValues}
          isExpanded={isMobileDistributionExpanded}
          onToggle={() => setIsMobileDistributionExpanded(!isMobileDistributionExpanded)}
          currentGwaCategory={currentTask?.gwaCategory}
        />
      </div>

      {/* Desktop: side-by-side layout */}
      <div className="mt-6 flex gap-8">
        {/* Main task rating area */}
        <div className="flex-1 max-w-lg">
          {/* Segmented progress */}
          {!allTasksComplete && (
            <div className="mb-6">
              <div className="flex justify-between text-sm text-neutral-400 mb-2">
                <span>Rating tasks</span>
                <span>{currentTaskIndex} of {tasks.length}</span>
              </div>
              <div className="flex gap-1">
                {tasks.map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-1.5 rounded-full transition-colors ${
                      i < currentTaskIndex
                        ? "bg-green-500"
                        : i === currentTaskIndex
                        ? "bg-neutral-300"
                        : "bg-neutral-200"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Current task card */}
          {currentTask && !allTasksComplete && (
            <div className="space-y-6">
              <div
                key={currentTask.id}
                className={`transition-all duration-300 ease-out ${
                  isAnimating
                    ? "opacity-0 translate-x-4"
                    : "opacity-100 translate-x-0"
                }`}
              >
                <p className="text-neutral-900 font-medium">
                  {currentTask.normalizedDescription || currentTask.userDescription}
                </p>
                {currentTask.gwaCategory && (
                  <span className="inline-block mt-2 text-xs text-neutral-400 bg-neutral-50 px-2 py-0.5 rounded">
                    {GWA_LABELS[currentTask.gwaCategory] || currentTask.gwaCategory}
                  </span>
                )}
              </div>

              {/* Time pills */}
              <div>
                <p className="text-sm text-neutral-700 mb-3">
                  In a typical month, how many hours do you spend on this?
                </p>
                <PillButtons
                  options={HOUR_OPTIONS}
                  value={timeValues[currentTask.id]}
                  onChange={(v) => setTime(currentTask.id, v)}
                />
              </div>

              {/* AI pills (if usesAi) */}
              {usesAi && (
                <div>
                  <p className="text-sm text-neutral-700 mb-3">
                    How often do you use AI for this?
                  </p>
                  <PillButtons
                    options={AI_OPTIONS}
                    value={aiValues[currentTask.id]}
                    onChange={(v) => setAi(currentTask.id, v)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Remaining count */}
          {!allTasksComplete && (
            <div className="mt-8 pt-4 border-t border-neutral-100">
              <p className="text-sm text-neutral-400 text-center">
                {remainingTasks === 0 ? "Last one!" : `${remainingTasks} more to go`}
              </p>
            </div>
          )}

          {allTasksComplete && (
            <div className="mt-6">
              <div className="flex items-center gap-2 text-green-600 mb-6">
                <Check className="h-5 w-5" />
                <span className="font-medium">All {tasks.length} tasks rated!</span>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="mt-10 flex items-center justify-between">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            {allTasksComplete && (
              <button
                onClick={handleProceedToReview}
                className="inline-flex items-center gap-2 text-base font-medium text-neutral-900 hover:text-neutral-600 transition-colors"
              >
                Continue
                <ArrowRight className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Sidebar - desktop only */}
        <div className="hidden md:block w-64 flex-shrink-0">
          <GWADistribution
            tasks={tasks}
            timeValues={timeValues}
            currentGwaCategory={currentTask?.gwaCategory}
          />
        </div>
      </div>
    </div>
  );
}
