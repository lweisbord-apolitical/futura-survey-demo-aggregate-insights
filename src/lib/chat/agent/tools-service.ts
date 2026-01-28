import { suggestionGeneratorService } from "./suggestion-generator-service";
import type { TaskSuggestion } from "../types";
import type { AgentState, AgentTool } from "./agent-types";

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  /** O*NET task suggestions (only for show_suggestions tool) */
  suggestions?: TaskSuggestion[];
  /** Whether to end the conversation */
  shouldProceed: boolean;
  /** Additional context for response generation */
  context?: {
    customQuestion?: string;
  };
}

/**
 * Tools Service — "The Hands"
 *
 * Executes actions for selected tools.
 * Most tools don't have side effects - they're just prompt templates.
 * But some tools actually do things:
 * - show_suggestions: Fetches O*NET tasks from database
 * - proceed: Sets flag to end conversation
 */
class ToolsService {
  /**
   * Execute a tool and return the result
   *
   * Tool effects:
   * - open_ended_prompt: Nothing — just a prompt template
   * - custom_question: Nothing — just a prompt template
   * - encourage_more: Nothing — just a prompt template
   * - show_suggestions: GENERATES AI task suggestions (falls back to O*NET)
   * - offer_to_proceed: Nothing — just a prompt template
   * - proceed: Sets flag to end conversation
   */
  async execute(
    tool: AgentTool,
    state: AgentState,
    params?: {
      question?: string;
      gapArea?: string;
    }
  ): Promise<ToolExecutionResult> {
    switch (tool) {
      case "show_suggestions":
        return await this.executeShowSuggestions(state);

      case "proceed":
        return {
          shouldProceed: true,
        };

      case "offer_to_proceed":
        // User can still continue, but we're offering to end
        return {
          shouldProceed: false,
        };

      case "custom_question":
        return {
          shouldProceed: false,
          context: {
            customQuestion: params?.question,
          },
        };

      // These tools are just prompt templates, no execution needed
      case "open_ended_prompt":
      case "encourage_more":
      default:
        return {
          shouldProceed: false,
        };
    }
  }

  /**
   * Execute show_suggestions tool
   * Generates AI-powered contextual task suggestions (falls back to O*NET)
   */
  private async executeShowSuggestions(state: AgentState): Promise<ToolExecutionResult> {
    const suggestions = await suggestionGeneratorService.generateSuggestions(state, {
      count: 5,
    });

    return {
      suggestions,
      shouldProceed: false,
    };
  }

}

// Export singleton instance
export const toolsService = new ToolsService();
