import { llmService } from "@/lib/chat/agent/llm-service";
import type {
  ExtractedTask,
  NormalizedTask,
  LLMNormalizationResponse,
} from "./types";

/**
 * Task Normalization Service
 *
 * Converts raw user task descriptions into O*NET-style task statements.
 *
 * O*NET style:
 * - Start with action verb (present tense)
 * - Specific and concrete
 * - No first person (I, my, we)
 * - Professional language
 * - 5-20 words typically
 */
class NormalizationService {
  /**
   * Normalize extracted tasks to O*NET style
   */
  async normalize(tasks: ExtractedTask[]): Promise<NormalizedTask[]> {
    if (tasks.length === 0) {
      return [];
    }

    // If LLM not configured, use fallback
    if (!llmService.isConfigured()) {
      console.log("[Normalization] LLM not configured, using fallback");
      return this.fallbackNormalization(tasks);
    }

    try {
      // Process in batches of 10 to avoid token limits
      const batchSize = 10;
      const results: NormalizedTask[] = [];

      for (let i = 0; i < tasks.length; i += batchSize) {
        const batch = tasks.slice(i, i + batchSize);
        const prompt = this.buildNormalizationPrompt(batch);
        const result = await llmService.generateJSON<LLMNormalizationResponse>(prompt);

        console.log("[Normalization] Batch normalized:", result.normalized_tasks.length);

        results.push(...result.normalized_tasks);
      }

      return results;
    } catch (error) {
      console.error("[Normalization] LLM normalization failed, using fallback:", error);
      return this.fallbackNormalization(tasks);
    }
  }

  /**
   * Build the LLM prompt for task normalization
   */
  private buildNormalizationPrompt(tasks: ExtractedTask[]): string {
    const taskList = tasks
      .map((t, i) => `${i + 1}. "${t.raw}"`)
      .join("\n");

    return `Convert these raw task descriptions into O*NET-style task statements.

RAW TASKS:
${taskList}

O*NET TASK FORMAT RULES:
- Start with action verb (present tense): "Prepare", "Coordinate", "Review", "Analyze"
- Be specific and concrete
- No first person (I, my, we, our)
- Professional language
- 5-20 words
- Focus on the WHAT, not the WHY

EXAMPLES:
Raw: "spending time in meetings coordinating with different teams"
Normalized: "Coordinate activities and schedules with cross-functional teams"

Raw: "write up quarterly summaries for leadership"
Normalized: "Prepare quarterly summary reports for senior leadership"

Raw: "review what other departments send over"
Normalized: "Review documents and materials submitted by other departments"

Raw: "make sure it aligns with our policies"
Normalized: "Evaluate materials for compliance with organizational policies"

Raw: "handle onboarding when new people join"
Normalized: "Conduct onboarding activities for new team members"

Return as JSON:
{
  "normalized_tasks": [
    {
      "original": "raw task text",
      "normalized": "O*NET style statement"
    },
    ...
  ]
}`;
  }

  /**
   * Fallback normalization when LLM is unavailable
   * Applies simple transformations to make tasks more standard
   */
  private fallbackNormalization(tasks: ExtractedTask[]): NormalizedTask[] {
    return tasks.map((task) => ({
      original: task.raw,
      normalized: this.simpleNormalize(task.raw),
    }));
  }

  /**
   * Simple rule-based normalization
   */
  private simpleNormalize(raw: string): string {
    let normalized = raw.trim();

    // Remove first person
    normalized = normalized
      .replace(/\bI\s+/gi, "")
      .replace(/\bmy\s+/gi, "")
      .replace(/\bwe\s+/gi, "")
      .replace(/\bour\s+/gi, "");

    // Remove filler words
    normalized = normalized
      .replace(/\b(basically|actually|usually|typically|sometimes|often|always)\b/gi, "")
      .replace(/\b(kind of|sort of|a lot of)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    // Capitalize first letter
    if (normalized.length > 0) {
      normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }

    // Ensure it starts with a verb-like word (if not, add "Perform")
    const startsWithVerb = /^(manage|create|write|develop|analyze|review|prepare|coordinate|communicate|handle|process|maintain|update|design|implement|test|support|lead|organize|plan|monitor|research|meet|present|report|build|schedule|train|evaluate|assess|document|negotiate|supervise|collaborate|facilitate|attend|draft|submit|approve|check|verify|send|receive|call|email|perform|conduct|provide|ensure|establish|identify|determine|develop|assist|support|oversee)/i;

    if (!startsWithVerb.test(normalized)) {
      // Try to extract a verb from the text
      const verbMatch = normalized.match(/\b(managing|creating|writing|developing|analyzing|reviewing|preparing|coordinating|communicating|handling|processing|maintaining|updating|designing|implementing|testing|supporting|leading|organizing|planning|monitoring|researching|meeting|presenting|reporting|building|scheduling|training|evaluating|assessing|documenting|negotiating|supervising|collaborating|facilitating|attending|drafting|submitting|approving|checking|verifying|sending|receiving|calling|emailing)\b/i);

      if (verbMatch) {
        // Convert gerund to base form and restructure
        const verb = verbMatch[1].replace(/ing$/i, "").replace(/tt$/, "t");
        const capitalizedVerb = verb.charAt(0).toUpperCase() + verb.slice(1);
        normalized = capitalizedVerb + " " + normalized.replace(verbMatch[0], "").trim();
      }
    }

    // Remove trailing punctuation and clean up
    normalized = normalized.replace(/[.!?]+$/, "").trim();

    // Limit length
    if (normalized.length > 100) {
      normalized = normalized.slice(0, 100).trim();
      const lastSpace = normalized.lastIndexOf(" ");
      if (lastSpace > 50) {
        normalized = normalized.slice(0, lastSpace);
      }
    }

    return normalized || raw; // Fallback to original if normalization fails
  }
}

// Export singleton
export const normalizationService = new NormalizationService();
