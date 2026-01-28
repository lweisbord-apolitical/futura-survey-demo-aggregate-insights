import { llmService } from "./llm-service";
import { buildSuggestionGenerationPrompt } from "./prompts";
import type { TaskSuggestion } from "../types";
import type { AgentState, GWACoverage } from "./agent-types";

/**
 * LLM response for generated suggestions
 */
interface GeneratedSuggestion {
  statement: string;
  gwaCategory: keyof GWACoverage;
}

interface SuggestionGenerationResponse {
  suggestions: GeneratedSuggestion[];
}

/**
 * Suggestion Generator Service
 *
 * Generates contextual task suggestions using LLM instead of static O*NET lookups.
 * Suggestions are:
 * - Contextual to the conversation
 * - Written in O*NET style format ("Verb + object + context")
 * - Targeted at GWA coverage gaps
 */
class SuggestionGeneratorService {
  /**
   * Generate AI-powered task suggestions based on conversation context
   */
  async generateSuggestions(
    state: AgentState,
    options: { count?: number } = {}
  ): Promise<TaskSuggestion[]> {
    const { count = 5 } = options;

    try {
      const prompt = buildSuggestionGenerationPrompt({
        jobTitle: state.jobTitle,
        conversationHistory: state.conversationHistory,
        gwaCoverage: state.gwaCoverage,
        mentionedActivities: state.mentionedActivities,
        excludeStatements: state.shownSuggestionStatements || [],
        count,
      });

      const response = await llmService.generateJSON<SuggestionGenerationResponse>(prompt);

      if (!response.suggestions || !Array.isArray(response.suggestions)) {
        console.warn("[SuggestionGenerator] Invalid LLM response, returning empty");
        return [];
      }

      // Map LLM output to TaskSuggestion type
      const suggestions = response.suggestions
        .filter((s) => s.statement && s.gwaCategory)
        .map((s) => this.mapToTaskSuggestion(s, state.jobTitle));

      if (suggestions.length === 0) {
        console.warn("[SuggestionGenerator] No valid suggestions generated");
        return [];
      }

      console.log(`[SuggestionGenerator] Generated ${suggestions.length} AI suggestions`);
      return suggestions;
    } catch (error) {
      console.error("[SuggestionGenerator] LLM generation failed:", error);
      return [];
    }
  }

  /**
   * Map LLM-generated suggestion to TaskSuggestion type
   */
  private mapToTaskSuggestion(
    generated: GeneratedSuggestion,
    jobTitle: string
  ): TaskSuggestion {
    return {
      id: `ai-${crypto.randomUUID()}`,
      statement: generated.statement,
      gwaCategory: generated.gwaCategory,
      occupationCode: "AI-GENERATED",
      occupationTitle: jobTitle,
      importance: 0.8, // Default high importance for AI suggestions
    };
  }
}

// Export singleton instance
export const suggestionGeneratorService = new SuggestionGeneratorService();
