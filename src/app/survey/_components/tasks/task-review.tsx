"use client";

import { useState } from "react";
import type { TaskWithData, TaskAnalysis } from "@/types/survey";
import { X, ChevronDown, ChevronRight, ArrowRight, ArrowLeft, Check, Loader2 } from "lucide-react";

// Theme colors for the distribution bar
const THEME_COLORS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
];

interface TaskReviewProps {
  tasks: TaskWithData[];
  analysis: TaskAnalysis;
  onRemoveTask: (taskId: string) => void;
  onConfirm: () => void;
  onBack: () => void;
  isSubmitting?: boolean;
  submitError?: boolean;
}

export function TaskReview({
  tasks,
  analysis,
  onRemoveTask,
  onConfirm,
  onBack,
  isSubmitting,
  submitError,
}: TaskReviewProps) {
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());

  // Build task lookup
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  // Toggle theme expansion
  const toggleTheme = (themeName: string) => {
    setExpandedThemes((prev) => {
      const next = new Set(prev);
      if (next.has(themeName)) {
        next.delete(themeName);
      } else {
        next.add(themeName);
      }
      return next;
    });
  };

  // Calculate total time across all themes
  const totalTime = analysis.themes.reduce((sum, t) => sum + t.totalTimePercent, 0);

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <p className="text-sm text-neutral-400 mb-2">Step 4 of 4</p>
      <h1 className="text-2xl font-semibold text-neutral-900">Review your tasks</h1>
      <p className="mt-2 text-neutral-500">
        We grouped your {tasks.length} tasks into themes. Review and confirm.
      </p>

      {/* Quick Insights Row */}
      <div className="mt-6 flex gap-6 text-sm">
        <div>
          <p className="text-neutral-400">Most time on</p>
          <p className="font-medium text-neutral-900">{analysis.insights.mostTimeTheme || "—"}</p>
        </div>
        {analysis.insights.mostAiUseTask && (
          <div>
            <p className="text-neutral-400">Most AI use</p>
            <p className="font-medium text-neutral-900 truncate max-w-[120px]" title={analysis.insights.mostAiUseTask.description}>
              {truncateText(analysis.insights.mostAiUseTask.description, 20)}
            </p>
          </div>
        )}
        {analysis.insights.leastAiUseTask && (
          <div>
            <p className="text-neutral-400">Least AI use</p>
            <p className="font-medium text-neutral-900 truncate max-w-[120px]" title={analysis.insights.leastAiUseTask.description}>
              {truncateText(analysis.insights.leastAiUseTask.description, 20)}
            </p>
          </div>
        )}
      </div>

      {/* Time Distribution Bar */}
      <div className="mt-6">
        <p className="text-sm text-neutral-500 mb-2">Time distribution</p>
        <div className="h-3 flex rounded-full overflow-hidden bg-neutral-100">
          {analysis.themes.map((theme, i) => {
            const widthPercent = totalTime > 0 ? (theme.totalTimePercent / totalTime) * 100 : 0;
            return (
              <div
                key={theme.name}
                className={`${THEME_COLORS[i % THEME_COLORS.length]} transition-all`}
                style={{ width: `${widthPercent}%` }}
                title={`${theme.name}: ${Math.round(widthPercent)}%`}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {analysis.themes.map((theme, i) => (
            <div key={theme.name} className="flex items-center gap-1.5 text-xs text-neutral-500">
              <span className={`w-2 h-2 rounded-full ${THEME_COLORS[i % THEME_COLORS.length]}`} />
              {theme.name}
            </div>
          ))}
        </div>
      </div>

      {/* Expandable Task List by Theme */}
      <div className="mt-8 space-y-1">
        {analysis.themes.map((theme, i) => {
          const isExpanded = expandedThemes.has(theme.name);
          const themeTasks = theme.tasks
            .map((id) => taskById.get(id))
            .filter((t): t is TaskWithData => t !== undefined);

          return (
            <div key={theme.name} className="border-b border-neutral-100">
              <button
                onClick={() => toggleTheme(theme.name)}
                className="w-full py-3 flex items-center justify-between hover:bg-neutral-50 transition-colors -mx-2 px-2 rounded"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-neutral-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-neutral-400" />
                  )}
                  <span
                    className={`w-2 h-2 rounded-full ${THEME_COLORS[i % THEME_COLORS.length]}`}
                  />
                  <span className="text-neutral-900">{theme.name}</span>
                </div>
                <span className="text-neutral-400 text-sm">{themeTasks.length} tasks</span>
              </button>

              {isExpanded && (
                <div className="pb-4 pl-8 space-y-1">
                  {themeTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between py-1.5 group"
                    >
                      <span className="text-sm text-neutral-600">
                        {task.normalizedDescription || task.userDescription}
                      </span>
                      <button
                        onClick={() => onRemoveTask(task.id)}
                        className="text-neutral-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Error message */}
      {submitError && (
        <p className="mt-6 text-sm text-red-600 text-center">
          Something went wrong. Please try again.
        </p>
      )}

      {/* Navigation */}
      <div className="mt-10 flex items-center justify-between">
        <button
          onClick={onBack}
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-600 transition-colors disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <button
          onClick={onConfirm}
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 text-base font-medium text-neutral-900 hover:text-neutral-600 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Check className="h-5 w-5" />
              {submitError ? "Try again" : "Confirm & finish"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Helper to truncate text
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}
