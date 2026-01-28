import { llmService } from "./llm-service";
import type {
  AgentState,
  GWACoverage,
  GWACoverageLevel,
  MessageAnalysis,
  UserEngagement,
} from "./agent-types";

/**
 * State Service — "The Memory"
 *
 * Tracks what's happened in the conversation so far.
 * The LLM doesn't inherently remember conversation state,
 * so we explicitly track:
 * - How many tasks have been mentioned
 * - What topics have been covered
 * - Is the user engaged or giving short answers
 * - Have they said "I'm done"
 */
class StateService {
  /**
   * Analyze a user message and update state accordingly
   * This is called after every user message to extract:
   * - New tasks/activities mentioned
   * - GWA coverage updates
   * - Engagement level
   * - Stop intent
   */
  async analyzeAndUpdateState(
    message: string,
    currentState: AgentState
  ): Promise<AgentState> {
    // First, detect explicit stop intent (no LLM needed)
    const wantsToStop = this.detectStopIntent(message);

    // Check if user is confirming pending suggestions
    const isConfirmation = this.detectConfirmationIntent(message);
    let confirmedActivities: string[] = [];

    if (isConfirmation && currentState.pendingSuggestions.length > 0) {
      console.log("[State] User confirmed pending suggestions:", currentState.pendingSuggestions);
      confirmedActivities = [...currentState.pendingSuggestions];
    }

    // Get analysis from LLM if configured
    let analysis: MessageAnalysis;
    if (llmService.isConfigured()) {
      try {
        analysis = await this.analyzeMessageWithLLM(message, currentState);
        // Override with our stop detection (more reliable for explicit phrases)
        analysis.wantsToStop = wantsToStop || analysis.wantsToStop;
      } catch (error) {
        console.error("LLM message analysis failed, using fallback:", error);
        analysis = this.analyzeMessageFallback(message, wantsToStop);
      }
    } else {
      analysis = this.analyzeMessageFallback(message, wantsToStop);
    }

    // Add confirmed activities to new activities
    if (confirmedActivities.length > 0) {
      analysis.newActivities = [...analysis.newActivities, ...confirmedActivities];
      analysis.newTaskCount += confirmedActivities.length;
    }

    // Update state with analysis results
    return {
      ...currentState,
      turnCount: currentState.turnCount + 1,
      estimatedTaskCount: currentState.estimatedTaskCount + analysis.newTaskCount,
      mentionedActivities: [
        ...currentState.mentionedActivities,
        ...analysis.newActivities,
      ],
      underexploredActivities: analysis.underexploredActivities,
      gwaCoverage: this.updateGwaCoverage(
        currentState.gwaCoverage,
        analysis.gwaUpdates
      ),
      userEngagement: analysis.engagement,
      userWantsToStop: analysis.wantsToStop,
      // Clear pending suggestions after processing (they're now either confirmed or discarded)
      pendingSuggestions: [],
    };
  }

  /**
   * Detect if user is confirming suggested tasks
   */
  private detectConfirmationIntent(message: string): boolean {
    const confirmPatterns =
      /\b(yes|yeah|yep|yup|correct|right|exactly|all of those|all of them|i do those|i do all|those apply|that applies|those are right|all three|all four|all of the above|definitely|absolutely|for sure)\b/i;
    return confirmPatterns.test(message);
  }

  /**
   * Extract task mentions from agent response text
   * Call this after generating a response to store pending suggestions
   */
  extractTaskMentionsFromResponse(responseText: string): string[] {
    // Look for patterns like "conducting market research, defining product strategy, and coordinating with teams"
    // These are typically comma-separated or "and"-joined phrases with action verbs

    const tasks: string[] = [];

    // Pattern 1: Tasks in a list format (comma-separated or "and"-joined)
    // Match phrases like "conducting X, defining Y, and coordinating Z"
    const listPattern = /\b(conducting|defining|managing|coordinating|analyzing|reviewing|preparing|creating|developing|writing|presenting|leading|organizing|planning|monitoring|researching|building|scheduling|training|evaluating|documenting)[^,;.!?]+/gi;

    const matches = responseText.match(listPattern);
    if (matches) {
      for (const match of matches) {
        const cleaned = match.trim().replace(/\band\s*$/i, "").trim();
        if (cleaned.length > 10 && cleaned.length < 100) {
          tasks.push(cleaned);
        }
      }
    }

    return tasks.slice(0, 5); // Limit to 5 pending suggestions
  }

  /**
   * Check if the conversation should end
   * Returns true when we have enough information or user wants to stop
   */
  checkExitConditions(state: AgentState): boolean {
    // User explicitly said "done"
    if (state.userWantsToStop) {
      return true;
    }

    // Enough tasks + good GWA coverage
    if (state.estimatedTaskCount >= 10) {
      const coverage = Object.values(state.gwaCoverage);
      const goodCategories = coverage.filter(
        (l) => l === "medium" || l === "high"
      ).length;
      if (goodCategories >= 3) {
        return true;
      }
    }

    // Many turns + good task count (don't trap them forever)
    if (state.turnCount >= 10 && state.estimatedTaskCount >= 8) {
      return true;
    }

    return false;
  }

  /**
   * Analyze message using LLM for accurate extraction
   */
  private async analyzeMessageWithLLM(
    message: string,
    state: AgentState
  ): Promise<MessageAnalysis> {
    const prompt = `Analyze this message from someone describing their work as a "${state.jobTitle}".

Their message: "${message}"

Previously mentioned activities: ${state.mentionedActivities.join(", ") || "none yet"}
Current estimated task count: ${state.estimatedTaskCount}

Extract the following information and respond in JSON:
{
  "newTaskCount": <number of NEW distinct tasks/activities mentioned in this message>,
  "newActivities": [<list of new specific activities/tasks mentioned>],
  "underexploredActivities": [<activities mentioned but not detailed enough>],
  "gwaUpdates": {
    "informationInput": "none" | "low" | "medium" | "high" | null,
    "mentalProcesses": "none" | "low" | "medium" | "high" | null,
    "workOutput": "none" | "low" | "medium" | "high" | null,
    "interactingWithOthers": "none" | "low" | "medium" | "high" | null
  },
  "engagement": "high" | "medium" | "low",
  "wantsToStop": <true if they say "done", "that's all", "finished", etc.>
}

GWA category definitions:
- informationInput: gathering data, reading, researching, observing, monitoring
- mentalProcesses: analyzing, deciding, planning, problem-solving, evaluating
- workOutput: producing documents, code, designs, reports, physical outputs
- interactingWithOthers: communicating, coordinating, supervising, presenting, collaborating

Set gwaUpdates values to null if not mentioned, or to the coverage level based on detail provided.

Engagement levels (based on RESPONSE QUALITY, not just word count):
- high: Provides multiple activities with specific detail, regardless of length
- medium: Answers the question clearly with at least one task or activity
- low: Vague, deflecting, or doesn't answer the question (e.g., "not really", "some stuff", "I don't know")

IMPORTANT: A SHORT but CLEAR answer is NOT low engagement.
- "Yes, I review financial reports weekly" = MEDIUM (clear answer with specific activity)
- "Yeah, some data stuff" = LOW (vague, no specific activity)
- "No, I don't do that" = MEDIUM (clear direct answer)`;

    return llmService.generateJSON<MessageAnalysis>(prompt);
  }

  /**
   * Fallback message analysis without LLM
   * Uses heuristics based on message content
   */
  private analyzeMessageFallback(
    message: string,
    wantsToStop: boolean
  ): MessageAnalysis {
    const words = message.split(/\s+/).length;

    // Determine engagement based on message length
    let engagement: UserEngagement;
    if (words >= 50) {
      engagement = "high";
    } else if (words >= 20) {
      engagement = "medium";
    } else {
      engagement = "low";
    }

    // Simple task extraction by looking for action verbs
    const actionVerbs =
      /\b(manage|create|write|develop|analyze|review|prepare|coordinate|communicate|handle|process|maintain|update|design|implement|test|support|lead|organize|plan|monitor|research|meet|present|report|build|schedule|train|evaluate|assess|document|negotiate|supervise|collaborate|facilitate)\b/gi;
    const matches = message.match(actionVerbs) || [];
    const newTaskCount = Math.min(matches.length, 5);

    // Extract activities from message
    const newActivities: string[] = [];
    if (newTaskCount > 0) {
      // Split by common delimiters and find task-like segments
      const segments = message.split(/[,;.\n]+/).filter((s) => {
        const trimmed = s.trim();
        return trimmed.length > 10 && actionVerbs.test(trimmed);
      });
      newActivities.push(...segments.slice(0, 5).map((s) => s.trim()));
    }

    // Rough GWA categorization based on keywords
    const gwaUpdates: Partial<Record<keyof GWACoverage, GWACoverageLevel>> = {};
    const lowerMessage = message.toLowerCase();

    if (/\b(read|research|monitor|gather|observe|collect|review data|look up)\b/.test(lowerMessage)) {
      gwaUpdates.informationInput = words >= 30 ? "medium" : "low";
    }
    if (/\b(analyze|decide|plan|evaluate|assess|think|consider|problem.?solv|strateg)\b/.test(lowerMessage)) {
      gwaUpdates.mentalProcesses = words >= 30 ? "medium" : "low";
    }
    if (/\b(write|create|build|produce|develop|design|draft|prepare|make|code|implement)\b/.test(lowerMessage)) {
      gwaUpdates.workOutput = words >= 30 ? "medium" : "low";
    }
    if (/\b(meet|communicate|coordinate|present|collaborate|discuss|email|call|team|supervise|train|negotiate)\b/.test(lowerMessage)) {
      gwaUpdates.interactingWithOthers = words >= 30 ? "medium" : "low";
    }

    return {
      newTaskCount,
      newActivities,
      underexploredActivities: [],
      gwaUpdates,
      engagement,
      wantsToStop,
    };
  }

  /**
   * Detect if user wants to stop the conversation
   */
  private detectStopIntent(message: string): boolean {
    const stopPatterns =
      /\b(done|finished|that's all|that's it|nothing else|no more|complete|that covers it|i think that's everything|that's everything|nothing more|i'm good|im good|all done)\b/i;
    return stopPatterns.test(message);
  }

  /**
   * Update GWA coverage levels (only increases, never decreases)
   */
  private updateGwaCoverage(
    current: GWACoverage,
    updates: Partial<Record<keyof GWACoverage, GWACoverageLevel | null>>
  ): GWACoverage {
    const levels: GWACoverageLevel[] = ["none", "low", "medium", "high"];
    const result = { ...current };

    for (const [key, value] of Object.entries(updates)) {
      if (value && key in result) {
        const currentLevel = levels.indexOf(result[key as keyof GWACoverage]);
        const newLevel = levels.indexOf(value);
        // Only increase, never decrease
        if (newLevel > currentLevel) {
          result[key as keyof GWACoverage] = value;
        }
      }
    }

    return result;
  }

  /**
   * Get the GWA category with lowest coverage (for probing)
   */
  getLowestGwaCategory(
    state: AgentState
  ): keyof GWACoverage | undefined {
    const levels: GWACoverageLevel[] = ["none", "low", "medium", "high"];
    let lowest: keyof GWACoverage | undefined;
    let lowestLevel = 4;

    for (const [category, level] of Object.entries(state.gwaCoverage)) {
      const levelIndex = levels.indexOf(level as GWACoverageLevel);
      if (levelIndex < lowestLevel) {
        lowestLevel = levelIndex;
        lowest = category as keyof GWACoverage;
      }
    }

    // Only return if coverage is actually low
    return lowestLevel < 2 ? lowest : undefined;
  }

  /**
   * Mark that a clarifying question has been asked
   * Called when custom_question is used
   */
  markClarifyingQuestionAsked(state: AgentState): AgentState {
    return {
      ...state,
      hasAskedClarifyingQuestion: true,
    };
  }

  /**
   * Check if a tool counts as a clarifying question
   */
  isClarifyingQuestionTool(tool: string): boolean {
    return tool === "custom_question";
  }
}

// Export singleton instance
export const stateService = new StateService();
