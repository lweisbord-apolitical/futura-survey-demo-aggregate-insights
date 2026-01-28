import type { ChatMessage } from "@/types/survey";
import { llmService } from "@/lib/chat/agent/llm-service";
import type { ExtractedTask, LLMExtractionResponse } from "./types";

/**
 * Task Extraction Service
 *
 * Extracts discrete work tasks from chat transcript using LLM.
 * Handles the messy, rambling nature of user descriptions.
 */
class ExtractionService {
  /**
   * Extract tasks from chat transcript
   */
  async extractFromChat(messages: ChatMessage[]): Promise<ExtractedTask[]> {
    // Get user messages only (for fallback and validation)
    const userMessages = messages.filter((m) => m.role === "user");

    if (userMessages.length === 0) {
      return [];
    }

    // Build full transcript with roles for context
    // This allows the LLM to understand references like "I do both of those"
    const transcript = messages
      .map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content}`)
      .join("\n\n");

    // If LLM not configured, use fallback
    if (!llmService.isConfigured()) {
      console.log("[Extraction] LLM not configured, using fallback extraction");
      return this.fallbackExtraction(userMessages);
    }

    try {
      const prompt = this.buildExtractionPrompt(transcript);
      const result = await llmService.generateJSON<LLMExtractionResponse>(prompt);

      console.log("[Extraction] Extracted tasks:", result.extracted_tasks);

      return result.extracted_tasks.map((raw, index) => ({
        raw,
        sourceMessageId: userMessages[Math.min(index, userMessages.length - 1)]?.id,
      }));
    } catch (error) {
      console.error("[Extraction] LLM extraction failed, using fallback:", error);
      return this.fallbackExtraction(userMessages);
    }
  }

  /**
   * Build the LLM prompt for task extraction
   */
  private buildExtractionPrompt(transcript: string): string {
    return `Extract all discrete work tasks from this chat transcript.

TRANSCRIPT:
${transcript}

RULES:
1. Extract each distinct task/activity the USER confirms or describes
2. Use ASSISTANT messages for context (e.g., if assistant asks "do you do X or Y?" and user says "both", extract X and Y)
3. Keep the user's language where possible (we'll normalize later)
4. Include tasks mentioned in passing or confirmed implicitly
5. Separate compound statements ("I write and review" → two tasks)
6. Ignore meta-conversation ("as I mentioned earlier")
7. Focus on WHAT they do, not HOW they feel about it
8. Each task should be a specific activity, not a general category

EXAMPLES of good extraction:
- "spending time in meetings coordinating with different teams" ✓
- "write up quarterly summaries for leadership" ✓
- "review what other departments send over" ✓
- If assistant asks "do you gather market research or customer insights?" and user says "I do both" → extract BOTH tasks ✓

EXAMPLES of what to avoid:
- "I enjoy my job" ✗ (not a task)
- "administrative stuff" ✗ (too vague - ask for specifics in chat)
- "as I said before" ✗ (meta-conversation)

Return as JSON:
{
  "extracted_tasks": [
    "task description 1",
    "task description 2",
    ...
  ]
}`;
  }

  /**
   * Fallback extraction when LLM is unavailable
   * Uses simple heuristics to split messages into tasks
   */
  private fallbackExtraction(messages: ChatMessage[]): ExtractedTask[] {
    const tasks: ExtractedTask[] = [];
    const seenTasks = new Set<string>();

    for (const message of messages) {
      // Split by common delimiters
      const segments = message.content
        .split(/[,;.\n]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 15); // Filter out very short segments

      for (const segment of segments) {
        // Check if it looks like a task (contains action verbs)
        const actionVerbs =
          /\b(manage|create|write|develop|analyze|review|prepare|coordinate|communicate|handle|process|maintain|update|design|implement|test|support|lead|organize|plan|monitor|research|meet|present|report|build|schedule|train|evaluate|assess|document|negotiate|supervise|collaborate|facilitate|attend|draft|submit|approve|check|verify|send|receive|call|email)\b/i;

        if (actionVerbs.test(segment)) {
          // Normalize for dedup check
          const normalized = segment.toLowerCase().trim();
          if (!seenTasks.has(normalized)) {
            seenTasks.add(normalized);
            tasks.push({
              raw: segment,
              sourceMessageId: message.id,
            });
          }
        }
      }
    }

    // If no tasks found, use the full messages
    if (tasks.length === 0) {
      for (const message of messages) {
        if (message.content.length > 20) {
          tasks.push({
            raw: message.content.slice(0, 200),
            sourceMessageId: message.id,
          });
        }
      }
    }

    return tasks.slice(0, 20); // Limit to 20 tasks
  }
}

// Export singleton
export const extractionService = new ExtractionService();
