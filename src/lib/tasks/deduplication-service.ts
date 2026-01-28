import { llmService } from "@/lib/chat/agent/llm-service";
import type {
  NormalizedTask,
  DeduplicatedTask,
  LLMDeduplicationResponse,
} from "./types";

/**
 * Task Deduplication Service
 *
 * Identifies and merges semantically similar tasks to prevent duplicates
 * in the final task list. Uses LLM to understand semantic similarity.
 *
 * Example:
 * Input:
 *   1. "Prepare quarterly reports for leadership"
 *   2. "Create quarterly summary documents for executives"
 *   3. "Coordinate meetings with team members"
 *
 * Output:
 *   1. "Prepare quarterly reports for leadership" (merged from 1, 2)
 *   2. "Coordinate meetings with team members" (unique)
 */
class DeduplicationService {
  /**
   * Deduplicate normalized tasks by merging semantically similar ones
   */
  async deduplicate(tasks: NormalizedTask[]): Promise<DeduplicatedTask[]> {
    if (tasks.length === 0) {
      return [];
    }

    // Single task - no deduplication needed
    if (tasks.length === 1) {
      return [
        {
          finalStatement: tasks[0].normalized,
          mergedFrom: [tasks[0].normalized],
        },
      ];
    }

    // If LLM not configured, use fallback
    if (!llmService.isConfigured()) {
      console.log("[Deduplication] LLM not configured, using fallback");
      return this.fallbackDeduplication(tasks);
    }

    try {
      const prompt = this.buildDeduplicationPrompt(tasks);
      const result = await llmService.generateJSON<LLMDeduplicationResponse>(prompt);

      console.log(
        "[Deduplication] LLM merged",
        tasks.length,
        "tasks into",
        result.deduplicated_tasks.length
      );

      // Convert LLM response to DeduplicatedTask format
      return result.deduplicated_tasks.map((task) => ({
        finalStatement: task.final_statement,
        mergedFrom: task.merged_from.map((idx) => tasks[idx - 1]?.original || ""),
        reasoning: task.reasoning,
      }));
    } catch (error) {
      console.error("[Deduplication] LLM deduplication failed, using fallback:", error);
      return this.fallbackDeduplication(tasks);
    }
  }

  /**
   * Build the LLM prompt for task deduplication
   */
  private buildDeduplicationPrompt(tasks: NormalizedTask[]): string {
    const taskList = tasks
      .map((t, i) => `${i + 1}. "${t.normalized}"`)
      .join("\n");

    return `Analyze these normalized task statements and identify any that are semantically similar or duplicates. Merge similar tasks into a single representative statement.

TASKS:
${taskList}

RULES:
- Two tasks are "similar" if they describe essentially the same work activity
- When merging, pick the most complete and professional-sounding statement
- Keep tasks separate if they represent genuinely different activities
- Report writing and document preparation are similar; coordinating meetings is different
- Don't over-merge: "Write emails" and "Respond to customer inquiries" should stay separate

EXAMPLES OF SIMILAR TASKS (should merge):
- "Prepare quarterly reports" + "Create quarterly summary documents" → "Prepare quarterly reports for leadership"
- "Schedule team meetings" + "Organize meetings with colleagues" → "Schedule and organize team meetings"
- "Review financial data" + "Analyze financial reports" → "Review and analyze financial data and reports"

EXAMPLES OF DIFFERENT TASKS (should NOT merge):
- "Write technical documentation" vs "Write marketing copy" (different purposes)
- "Coordinate with clients" vs "Coordinate with team members" (different audiences)
- "Review code" vs "Write code" (different activities)

Return as JSON:
{
  "deduplicated_tasks": [
    {
      "final_statement": "The best representative task statement",
      "merged_from": [1, 3],
      "reasoning": "Brief explanation of why these were merged or kept separate"
    },
    ...
  ]
}

Use 1-based indices for merged_from. Include all tasks - unique tasks should have merged_from containing just their own index.`;
  }

  /**
   * Fallback deduplication using simple string similarity
   * Used when LLM is unavailable
   */
  private fallbackDeduplication(tasks: NormalizedTask[]): DeduplicatedTask[] {
    const result: DeduplicatedTask[] = [];
    const used = new Set<number>();

    for (let i = 0; i < tasks.length; i++) {
      if (used.has(i)) continue;

      const similar: number[] = [i];
      const currentTask = tasks[i].normalized.toLowerCase();

      // Find similar tasks
      for (let j = i + 1; j < tasks.length; j++) {
        if (used.has(j)) continue;

        const otherTask = tasks[j].normalized.toLowerCase();
        if (this.areSimilar(currentTask, otherTask)) {
          similar.push(j);
          used.add(j);
        }
      }

      used.add(i);

      // Pick the longest statement as the representative
      const bestIndex = similar.reduce((best, idx) =>
        tasks[idx].normalized.length > tasks[best].normalized.length ? idx : best
      , similar[0]);

      result.push({
        finalStatement: tasks[bestIndex].normalized,
        mergedFrom: similar.map((idx) => tasks[idx].normalized),
        reasoning: similar.length > 1
          ? `Merged ${similar.length} similar tasks based on word overlap`
          : undefined,
      });
    }

    console.log(
      "[Deduplication] Fallback merged",
      tasks.length,
      "tasks into",
      result.length
    );

    return result;
  }

  /**
   * Simple similarity check based on word overlap
   * Returns true if tasks share significant vocabulary
   */
  private areSimilar(task1: string, task2: string): boolean {
    const words1 = new Set(this.extractKeywords(task1));
    const words2 = new Set(this.extractKeywords(task2));

    if (words1.size === 0 || words2.size === 0) return false;

    // Count shared words
    let shared = 0;
    for (const word of words1) {
      if (words2.has(word)) shared++;
    }

    // Calculate Jaccard similarity
    const union = new Set([...words1, ...words2]).size;
    const similarity = shared / union;

    // Also check if one contains most words of the other
    const containment1 = shared / words1.size;
    const containment2 = shared / words2.size;

    // Similar if high overlap or one mostly contains the other
    return similarity > 0.5 || containment1 > 0.7 || containment2 > 0.7;
  }

  /**
   * Extract meaningful keywords from task text
   */
  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
      "of", "with", "by", "from", "as", "into", "through", "during", "before",
      "after", "above", "below", "between", "under", "again", "further", "then",
      "once", "here", "there", "when", "where", "why", "how", "all", "each",
      "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only",
      "own", "same", "so", "than", "too", "very", "just", "also", "now",
    ]);

    return text
      .toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));
  }
}

// Export singleton
export const deduplicationService = new DeduplicationService();
