"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { SurveyLayout } from "../_components/survey-layout";
import { TaskDataCollection } from "../_components/tasks/task-data-collection";
import type { ProcessedTask } from "@/types/survey";

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<ProcessedTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMatchingComplete, setIsMatchingComplete] = useState(false);
  const matchingStartedRef = useRef(false);

  useEffect(() => {
    const storedTasks = sessionStorage.getItem("surveyTasks");
    const storedJobTitle = sessionStorage.getItem("surveyJobTitle");

    if (!storedJobTitle) {
      router.replace("/survey");
      return;
    }

    if (!storedTasks) {
      router.replace("/survey/chat");
      return;
    }

    try {
      const parsedTasks = JSON.parse(storedTasks) as ProcessedTask[];
      setTasks(parsedTasks);
      setIsLoading(false);

      // Start background O*NET matching if not already done
      // Check if any tasks are missing O*NET data (regardless of source)
      const needsMatching = parsedTasks.some((t) => !t.onetTaskId);

      if (needsMatching && !matchingStartedRef.current) {
        matchingStartedRef.current = true;
        startBackgroundMatching(parsedTasks);
      } else {
        // No matching needed - already complete
        setIsMatchingComplete(true);
      }
    } catch {
      router.replace("/survey/chat");
      return;
    }
  }, [router]);

  // Background O*NET matching
  const startBackgroundMatching = async (tasksToMatch: ProcessedTask[]) => {
    try {
      const occupationCode = sessionStorage.getItem("surveyOccupationCode");

      // Only match tasks that need it (no O*NET data yet, regardless of source)
      const tasksNeedingMatch = tasksToMatch.filter((t) => !t.onetTaskId);

      if (tasksNeedingMatch.length === 0) {
        console.log("[TasksPage] No tasks need O*NET matching");
        return;
      }

      console.log("[TasksPage] Starting background O*NET matching for", tasksNeedingMatch.length, "tasks");

      const response = await fetch("/api/tasks/match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(occupationCode && { "x-occupation-code": occupationCode }),
        },
        body: JSON.stringify({ tasks: tasksNeedingMatch }),
      });

      if (!response.ok) {
        console.error("[TasksPage] O*NET matching failed:", response.status);
        setIsMatchingComplete(true);
        return;
      }

      const data = await response.json();
      const enrichedTasks = data.tasks as ProcessedTask[];

      console.log("[TasksPage] Background matching complete, enriched", enrichedTasks.length, "tasks");

      // Merge enriched tasks back with original tasks
      setTasks((currentTasks) => {
        const enrichedMap = new Map(enrichedTasks.map((t) => [t.id, t]));
        const merged = currentTasks.map((t) => enrichedMap.get(t.id) || t);

        // Update sessionStorage with enriched data
        sessionStorage.setItem("surveyTasks", JSON.stringify(merged));

        return merged;
      });

      setIsMatchingComplete(true);
    } catch (error) {
      console.error("[TasksPage] Background matching error:", error);
      setIsMatchingComplete(true);
      // Non-fatal - user can still complete the survey without O*NET matches
    }
  };

  if (isLoading) {
    return (
      <SurveyLayout>
        <div className="py-8 sm:py-12">
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-gray-500">Loading tasks...</div>
          </div>
        </div>
      </SurveyLayout>
    );
  }

  return (
    <SurveyLayout>
      <div className="py-8 sm:py-12">
        <TaskDataCollection tasks={tasks} isMatchingComplete={isMatchingComplete} />
      </div>
    </SurveyLayout>
  );
}
