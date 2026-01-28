import { NextRequest, NextResponse } from "next/server";
import { taskProcessingService } from "@/lib/tasks";
import type { ProcessTasksRequest, ProcessTasksResponse } from "@/types/survey";

/**
 * POST /api/tasks/process
 *
 * Process chat transcript into structured tasks (FAST mode).
 *
 * Pipeline (fast - no O*NET matching):
 * 1. EXTRACT — LLM pulls discrete tasks from chat transcript
 * 2. NORMALIZE — LLM converts to O*NET-style statements
 * 3. FORMAT — Return ProcessedTask[] for UI
 *
 * O*NET matching is done separately via /api/tasks/match (can run in background)
 */
export async function POST(request: NextRequest) {
  try {
    const body: ProcessTasksRequest = await request.json();
    const { chatHistory, selectedSuggestions } = body;

    // Get job title from headers
    const jobTitle = request.headers.get("x-job-title") || "General Worker";

    if (!chatHistory || chatHistory.length === 0) {
      return NextResponse.json(
        { error: "Chat history is required" },
        { status: 400 }
      );
    }

    console.log("[API /tasks/process] Processing chat with", chatHistory.length, "messages (FAST mode)");

    // Run the FAST processing pipeline (Extract + Normalize only, no O*NET matching)
    const result = await taskProcessingService.processChatFast(
      chatHistory,
      jobTitle
    );

    console.log("[API /tasks/process] Fast pipeline complete:", {
      extracted: result.extractedTasks.length,
      normalized: result.normalizedTasks.length,
      final: result.processedTasks.length,
    });

    // Add any selected suggestions that weren't already extracted
    // (User may have selected O*NET suggestions during chat)
    if (selectedSuggestions && selectedSuggestions.length > 0) {
      console.log("[API /tasks/process] Adding", selectedSuggestions.length, "selected suggestions");
      // TODO: Fetch suggestion details and add to tasks
    }

    const response: ProcessTasksResponse = {
      tasks: result.processedTasks,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[API /tasks/process] Error:", error);
    return NextResponse.json(
      { error: "Failed to process tasks", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
