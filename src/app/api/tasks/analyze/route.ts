import { NextRequest, NextResponse } from "next/server";
import type { TaskWithData, TaskAnalysis, TaskAnalysisRequest } from "@/types/survey";
import { llmService } from "@/lib/chat/agent/llm-service";

interface LLMThemeResponse {
  themes: {
    name: string;
    task_ids: string[];
  }[];
}


export async function POST(request: NextRequest) {
  try {
    const body: TaskAnalysisRequest = await request.json();
    const { tasks, jobTitle } = body;

    if (!tasks || tasks.length === 0) {
      return NextResponse.json(
        { error: "Tasks are required" },
        { status: 400 }
      );
    }

    // Build task descriptions for LLM
    const taskDescriptions = tasks
      .map((t) => `- ID: ${t.id} | ${t.normalizedDescription || t.userDescription}`)
      .join("\n");

    // Use LLM to group tasks into themes
    let themeAssignments: LLMThemeResponse;

    if (llmService.isConfigured()) {
      const prompt = `Group these work tasks for a "${jobTitle}" into 2-4 thematic categories.

TASKS:
${taskDescriptions}

Return JSON with this exact structure:
{
  "themes": [
    { "name": "Theme Name", "task_ids": ["id1", "id2"] }
  ]
}

RULES:
- Each task must belong to exactly one theme
- Theme names should be short (2-4 words)
- Create 2-4 themes based on the work activities
- Use professional, clear theme names`;

      try {
        themeAssignments = await llmService.generateJSON<LLMThemeResponse>(prompt);
      } catch (error) {
        console.error("[Analyze] LLM grouping failed:", error);
        themeAssignments = fallbackGrouping(tasks);
      }
    } else {
      themeAssignments = fallbackGrouping(tasks);
    }

    // Build task lookup for calculations
    const taskById = new Map(tasks.map((t) => [t.id, t]));

    // Calculate theme metrics
    const themes = themeAssignments.themes.map((theme) => {
      const themeTasks = theme.task_ids
        .map((id) => taskById.get(id))
        .filter((t): t is TaskWithData => t !== undefined);

      const totalTimePercent = themeTasks.reduce((sum, t) => sum + t.timePercentage, 0);
      const avgAiUsage =
        themeTasks.length > 0
          ? themeTasks.reduce((sum, t) => sum + t.aiFrequency, 0) / themeTasks.length
          : 1;

      return {
        name: theme.name,
        tasks: theme.task_ids.filter((id) => taskById.has(id)),
        totalTimePercent,
        avgAiUsage,
      };
    });

    // Find the theme with most time
    const mostTimeTheme =
      themes.length > 0
        ? themes.reduce((max, t) => (t.totalTimePercent > max.totalTimePercent ? t : max)).name
        : "";

    // Find most/least AI use tasks
    const tasksWithAi = tasks.filter((t) => t.aiFrequency > 1);
    const sortedByAi = [...tasks].sort((a, b) => b.aiFrequency - a.aiFrequency);

    const mostAiUseTask =
      tasksWithAi.length > 0
        ? {
            id: sortedByAi[0].id,
            description: sortedByAi[0].normalizedDescription || sortedByAi[0].userDescription,
          }
        : null;

    const leastAiUseTask =
      sortedByAi.length > 1
        ? {
            id: sortedByAi[sortedByAi.length - 1].id,
            description:
              sortedByAi[sortedByAi.length - 1].normalizedDescription ||
              sortedByAi[sortedByAi.length - 1].userDescription,
          }
        : null;

    const analysis: TaskAnalysis = {
      themes,
      insights: {
        mostTimeTheme,
        mostAiUseTask,
        leastAiUseTask,
      },
    };

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("[Analyze] Error:", error);
    return NextResponse.json(
      { error: "Failed to analyze tasks" },
      { status: 500 }
    );
  }
}

// Fallback grouping when LLM is not available
function fallbackGrouping(tasks: TaskWithData[]): LLMThemeResponse {
  // Simple grouping by GWA category
  const groups: Record<string, string[]> = {};

  const categoryNames: Record<string, string> = {
    informationInput: "Information Gathering",
    mentalProcesses: "Analysis & Planning",
    workOutput: "Task Execution",
    interactingWithOthers: "Communication",
  };

  for (const task of tasks) {
    const category = task.gwaCategory || "workOutput";
    const themeName = categoryNames[category] || "Other Work";
    if (!groups[themeName]) {
      groups[themeName] = [];
    }
    groups[themeName].push(task.id);
  }

  return {
    themes: Object.entries(groups).map(([name, task_ids]) => ({
      name,
      task_ids,
    })),
  };
}
