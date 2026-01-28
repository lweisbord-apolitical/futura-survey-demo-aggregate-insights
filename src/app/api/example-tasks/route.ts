import { NextRequest, NextResponse } from "next/server";
import { llmService } from "@/lib/chat/agent/llm-service";

export const runtime = "nodejs";

interface ExampleTasksResponse {
  tasks: string[];
}

const FALLBACK_TASKS = [
  "I gather and analyze information relevant to my work",
  "I communicate with colleagues and stakeholders",
  "I prepare documents and recommendations",
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobTitle } = body;

    if (!jobTitle || typeof jobTitle !== "string") {
      return NextResponse.json(
        { error: "jobTitle is required" },
        { status: 400 }
      );
    }

    const systemPrompt = `You generate example work tasks for different job roles.
Always respond with a JSON object containing a "tasks" array of exactly 3 strings.`;

    const prompt = `Generate 3 example work tasks for a ${jobTitle} in first person.
- Format: "I [verb] [what]..." (e.g., "I conduct market research to identify customer needs")
- Each should be 8-15 words, natural and conversational
- Be specific to the role but not overly technical

Return as JSON: {"tasks": ["task1", "task2", "task3"]}`;

    const result = await llmService.generateJSON<ExampleTasksResponse>(
      prompt,
      systemPrompt
    );

    if (result.tasks && Array.isArray(result.tasks) && result.tasks.length > 0) {
      return NextResponse.json({ tasks: result.tasks.slice(0, 3) });
    }

    // LLM returned unexpected format
    return NextResponse.json({ tasks: FALLBACK_TASKS });
  } catch (error) {
    console.error("Example tasks generation error:", error);
    // Return fallback tasks on error
    return NextResponse.json({ tasks: FALLBACK_TASKS });
  }
}
