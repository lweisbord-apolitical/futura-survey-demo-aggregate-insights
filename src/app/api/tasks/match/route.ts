import { NextRequest, NextResponse } from "next/server";
import { taskProcessingService } from "@/lib/tasks";
import type { ProcessedTask } from "@/types/survey";

interface MatchTasksRequest {
  tasks: ProcessedTask[];
}

interface MatchTasksResponse {
  tasks: ProcessedTask[];
}

/**
 * POST /api/tasks/match
 *
 * Enrich tasks with O*NET matching data.
 * This can run in the background while the user rates tasks.
 *
 * Input: ProcessedTask[] (from /api/tasks/process)
 * Output: ProcessedTask[] with O*NET match data (onetTaskId, onetTaskDescription, similarityScore)
 */
export async function POST(request: NextRequest) {
  try {
    const body: MatchTasksRequest = await request.json();
    const { tasks } = body;

    // Get occupation code from headers (optional, improves matching)
    const occupationCode = request.headers.get("x-occupation-code") || undefined;

    if (!tasks || tasks.length === 0) {
      return NextResponse.json(
        { error: "Tasks array is required" },
        { status: 400 }
      );
    }

    console.log("[API /tasks/match] Matching", tasks.length, "tasks to O*NET");

    // Run O*NET matching
    const enrichedTasks = await taskProcessingService.matchTasks(
      tasks,
      occupationCode
    );

    console.log("[API /tasks/match] Matching complete:", enrichedTasks.length, "tasks enriched");

    const response: MatchTasksResponse = {
      tasks: enrichedTasks,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[API /tasks/match] Error:", error);
    return NextResponse.json(
      { error: "Failed to match tasks", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
