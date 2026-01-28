import { llmService } from "./llm-service";
import { stateService } from "./state-service";
import {
  AGENT_SYSTEM_PROMPT,
  buildToolSelectionPrompt,
  buildResponsePrompt,
  buildONetGapAnalysisPrompt,
  buildCompletenessAssessmentPrompt,
} from "./prompts";
import { pineconeService } from "@/lib/onet/pinecone-service";
import type {
  AgentState,
  AgentTool,
  ToolSelection,
  LLMToolSelection,
} from "./agent-types";

/**
 * Agent Service — "The Brain"
 *
 * Decides what to do next in the conversation.
 * Implements the strategy for eliciting complete task information.
 *
 * The core decision: "What tool should I use?"
 *
 * Tool selection flow (from spec):
 * ─────────────────────────────────────────────────────────────────
 * Is this turn 1?
 *     YES → open_ended_prompt ("Tell me everything")
 *     NO  ↓
 *
 * Did user say "done" / "finished"?
 *     YES → proceed (end chat)
 *     NO  ↓
 *
 * Ask LLM: "Does this task list seem complete for a {jobTitle}?"
 *     │
 *     ├── Complete + High confidence → offer_to_proceed
 *     │
 *     ├── Incomplete → custom_question (O*NET-grounded gap detection)
 *     │
 *     └── User stuck? → show_suggestions
 *
 * Default → encourage_more ("Anything else?")
 * ─────────────────────────────────────────────────────────────────
 */
class AgentService {
  /**
   * Get O*NET tasks for a job title/occupation code
   * Used for gap analysis to generate role-specific questions
   *
   * Uses Pinecone semantic search (has all O*NET occupations).
   * Results are cached in state to avoid repeated Pinecone calls.
   * Returns empty array if Pinecone is unavailable.
   */
  private async getOnetTasksForJob(state: AgentState): Promise<string[]> {
    // Return cached tasks if available
    if (state.cachedOnetTasks !== undefined) {
      console.log("[Agent] Using cached O*NET tasks");
      return state.cachedOnetTasks;
    }

    if (!pineconeService.isConfigured()) {
      console.warn("[Agent] Pinecone not configured, cannot get O*NET tasks");
      state.cachedOnetTasks = [];
      return [];
    }

    try {
      // Step 1: Find matching occupation
      const jobHits = await pineconeService.searchJobs(state.jobTitle, 1);

      if (jobHits.length > 0 && jobHits[0]._score >= 0.3) {
        const matchedCode = jobHits[0].fields.code;
        console.log(`[Agent] Pinecone matched "${state.jobTitle}" to ${jobHits[0].fields.title} (${matchedCode})`);

        // Step 2: Get tasks for that occupation
        const taskHits = await pineconeService.searchByOccupation(state.jobTitle, matchedCode, 15);

        if (taskHits.length > 0) {
          const tasks = taskHits.map(hit => hit.fields.text);
          state.cachedOnetTasks = tasks;
          return tasks;
        }
      }
    } catch (error) {
      console.error("[Agent] Pinecone O*NET lookup failed:", error);
    }

    state.cachedOnetTasks = [];
    return [];
  }

  /**
   * Check if initial dump is comprehensive enough to skip chat
   * Uses LLM to compare against O*NET tasks (single call)
   *
   * Returns { isComprehensive: true } if user provided enough info to skip follow-up questions
   */
  async checkInitialDumpCompleteness(
    state: AgentState,
    initialTasks: string
  ): Promise<{ isComprehensive: boolean; reason: string }> {
    // Quick heuristics first (avoid LLM call if clearly not comprehensive)
    if (state.estimatedTaskCount < 10) {
      console.log("[Agent] Initial dump not comprehensive: Not enough tasks", state.estimatedTaskCount);
      return { isComprehensive: false, reason: "Not enough tasks" };
    }

    const gwaCoverage = Object.values(state.gwaCoverage);
    const goodCategories = gwaCoverage.filter(l => l === "medium" || l === "high").length;
    if (goodCategories < 3) {
      console.log("[Agent] Initial dump not comprehensive: GWA coverage too sparse", goodCategories);
      return { isComprehensive: false, reason: "GWA coverage too sparse" };
    }

    // Check if LLM is configured
    if (!llmService.isConfigured()) {
      console.log("[Agent] Initial dump not comprehensive: LLM not configured");
      return { isComprehensive: false, reason: "LLM not configured for assessment" };
    }

    // Fetch O*NET tasks
    const onetTasks = await this.getOnetTasksForJob(state);
    if (onetTasks.length === 0) {
      console.log("[Agent] Initial dump not comprehensive: No O*NET reference available");
      return { isComprehensive: false, reason: "No O*NET reference available" };
    }

    try {
      // Ask LLM to assess completeness
      const prompt = buildCompletenessAssessmentPrompt({
        jobTitle: state.jobTitle,
        userInput: initialTasks,
        mentionedActivities: state.mentionedActivities,
        onetTasks,
      });

      const result = await llmService.generateJSON<{
        isComprehensive: boolean;
        coverage: "high" | "medium" | "low";
        missingAreas: string[];
        reason: string;
      }>(prompt);

      console.log("[Agent] Initial dump completeness assessment:", result);

      const isComprehensive = result.isComprehensive && result.coverage === "high";

      return {
        isComprehensive,
        reason: result.reason,
      };
    } catch (error) {
      console.error("[Agent] Initial dump completeness check failed:", error);
      return { isComprehensive: false, reason: "Assessment failed" };
    }
  }

  /**
   * Check if there are new card selections that haven't been acknowledged
   */
  hasNewCardSelections(state: AgentState): boolean {
    const hasNew = state.selectedSuggestionIds.length > state.previouslyAcknowledgedSelections;
    console.log("[Agent] hasNewCardSelections:", {
      selectedCount: state.selectedSuggestionIds.length,
      previouslyAcknowledged: state.previouslyAcknowledgedSelections,
      hasNew,
    });
    return hasNew;
  }

  /**
   * Get the number of new card selections since last acknowledgment
   */
  getNewSelectionCount(state: AgentState): number {
    return state.selectedSuggestionIds.length - state.previouslyAcknowledgedSelections;
  }

  /**
   * Select which tool to use for the next turn
   * The LLM decides based on conversation context, engagement, and coverage
   */
  async selectTool(state: AgentState): Promise<ToolSelection> {
    // ─────────────────────────────────────────────────────────────
    // Step 1: Is this turn 1?
    // ─────────────────────────────────────────────────────────────
    if (state.turnCount === 0) {
      return { tool: "open_ended_prompt" };
    }

    // ─────────────────────────────────────────────────────────────
    // Step 2: Did user say "done" / "finished"?
    // ─────────────────────────────────────────────────────────────
    if (state.userWantsToStop) {
      return { tool: "proceed" };
    }

    // ─────────────────────────────────────────────────────────────
    // Step 2.5: Has user selected new suggestion cards?
    // Only offer to proceed if we have 10+ tasks total
    // ─────────────────────────────────────────────────────────────
    if (this.hasNewCardSelections(state)) {
      const totalSelected = state.selectedSuggestionIds.length;
      // Only offer to proceed if 3+ cards AND 10+ total tasks
      if (totalSelected >= 3 && state.estimatedTaskCount >= 10) {
        return { tool: "offer_to_proceed" };
      }
      // Otherwise, acknowledge selections but keep probing for more tasks
      return { tool: "encourage_more" };
    }

    // ─────────────────────────────────────────────────────────────
    // Step 2.6: Low task capture after multiple turns? → suggestions
    // If we've had 3+ turns but captured < 3 tasks, try suggestions
    // This catches scenarios where user gives clear but negative responses
    // (e.g., "no", "not really") that don't yield tasks
    // ─────────────────────────────────────────────────────────────
    if (
      state.turnCount >= 3 &&
      state.estimatedTaskCount < 3 &&
      state.suggestionsShown < 3
    ) {
      console.log("[Agent] Low task capture after multiple turns, showing suggestions");
      return { tool: "show_suggestions" };
    }

    // ─────────────────────────────────────────────────────────────
    // Step 3: Check if LLM service is configured
    // ─────────────────────────────────────────────────────────────
    if (!llmService.isConfigured()) {
      return this.selectToolFallback(state);
    }

    try {
      // ─────────────────────────────────────────────────────────────
      // Step 4: Fetch O*NET tasks early (cached after first call)
      // This enables smarter tool selection with role-specific context
      // ─────────────────────────────────────────────────────────────
      const onetTasks = await this.getOnetTasksForJob(state);

      // ─────────────────────────────────────────────────────────────
      // Step 5: Ask LLM to select the best tool (with O*NET context)
      // ─────────────────────────────────────────────────────────────
      const prompt = buildToolSelectionPrompt(state, onetTasks);
      const llmSelection = await llmService.generateJSON<LLMToolSelection>(prompt);

      console.log("[Agent] LLM tool selection:", {
        turnCount: state.turnCount,
        taskCount: state.estimatedTaskCount,
        engagement: state.userEngagement,
        gwaCoverage: state.gwaCoverage,
        onetCoverage: llmSelection.onetCoverage,
        llmDecision: llmSelection,
      });

      // Store O*NET coverage assessment in state (for use by guardrails)
      if (llmSelection.onetCoverage) {
        state.onetCoverageAssessment = llmSelection.onetCoverage;
      }

      // Validate and apply guardrails
      const tool = this.validateToolSelection(llmSelection, state);

      // Build params based on selected tool
      const params: ToolSelection["params"] = {};

      // For custom_question, use the LLM-generated question and gapArea directly
      // The LLM has full conversation context + O*NET data, no need for separate gap analysis
      if (tool === "custom_question") {
        if (llmSelection.question) {
          params.question = llmSelection.question;
        }
        if (llmSelection.gapArea) {
          params.gapArea = llmSelection.gapArea;
        }
      }

      return { tool, params: Object.keys(params).length > 0 ? params : undefined };
    } catch (error) {
      console.error("LLM tool selection failed, using fallback:", error);
      return this.selectToolFallback(state);
    }
  }

  /**
   * Validate and apply guardrails to LLM tool selection
   * Prevents premature completion and ensures sensible choices
   */
  private validateToolSelection(
    llmSelection: LLMToolSelection,
    state: AgentState
  ): AgentTool {
    const { tool } = llmSelection;

    // ─────────────────────────────────────────────────────────────
    // HARD CUTOFFS: Force offer_to_proceed when we have enough
    // ─────────────────────────────────────────────────────────────

    // Hard rule 1: 15+ tasks is ALWAYS enough - stop probing
    if (state.estimatedTaskCount >= 15 && state.hasAskedClarifyingQuestion) {
      console.log("[Agent] HARD CUTOFF: 15+ tasks captured, forcing offer_to_proceed");
      return "offer_to_proceed";
    }

    // Hard rule 2: 10+ tasks AND 6+ turns - don't overstay welcome
    if (state.estimatedTaskCount >= 10 && state.turnCount >= 6 && state.hasAskedClarifyingQuestion) {
      console.log("[Agent] HARD CUTOFF: 10+ tasks and 6+ turns, forcing offer_to_proceed");
      return "offer_to_proceed";
    }

    // Hard rule 3: High O*NET coverage + 8+ tasks - early exit with good coverage
    if (state.onetCoverageAssessment === "high" && state.estimatedTaskCount >= 8 && state.hasAskedClarifyingQuestion) {
      console.log("[Agent] HARD CUTOFF: High O*NET coverage with 8+ tasks, forcing offer_to_proceed");
      return "offer_to_proceed";
    }

    // ─────────────────────────────────────────────────────────────
    // Regular guardrails below
    // ─────────────────────────────────────────────────────────────

    // Guardrail: Don't offer to proceed until we've asked at least one clarifying question
    if (tool === "offer_to_proceed") {
      // Must have asked at least one clarifying question
      if (!state.hasAskedClarifyingQuestion) {
        console.log("[Agent] Guardrail: Must ask clarifying question before offer_to_proceed, using custom_question");
        // Force a custom question to ask about potential gaps (O*NET grounding will handle gap detection)
        return "custom_question";
      }

      // Check GWA coverage - at least 3 categories should have medium+ coverage
      const coverage = Object.values(state.gwaCoverage);
      const goodCategories = coverage.filter(
        (l) => l === "medium" || l === "high"
      ).length;

      // With 10+ tasks AND clarifying question asked AND good coverage, can proceed earlier (turn 2+)
      if (state.estimatedTaskCount >= 10 && goodCategories >= 3 && state.turnCount >= 2) {
        console.log("[Agent] Allowing early offer_to_proceed: 10+ tasks, clarifying asked, good GWA coverage");
        return tool;
      }

      // Otherwise need 10+ tasks and turn 5+
      if (state.turnCount < 5 || state.estimatedTaskCount < 10) {
        console.log("[Agent] Guardrail: Too early to offer_to_proceed (need 10+ tasks and turn 5+), using encourage_more");
        return "encourage_more";
      }
    }

    // Guardrail: Don't show suggestions too often
    if (tool === "show_suggestions" && state.suggestionsShown >= 3) {
      console.log("[Agent] Guardrail: Max suggestions reached, using encourage_more");
      return "encourage_more";
    }

    return tool;
  }

  /**
   * Fallback tool selection when LLM is unavailable
   * Uses rule-based logic as backup
   */
  private selectToolFallback(state: AgentState): ToolSelection {
    console.log("[Agent] Using fallback tool selection (no LLM)");

    // Low engagement → suggestions
    if (state.userEngagement === "low" && state.suggestionsShown < 3) {
      return { tool: "show_suggestions" };
    }

    // Check for GWA gaps — use custom_question (O*NET grounding will handle gap detection)
    const lowestGwa = stateService.getLowestGwaCategory(state);
    if (lowestGwa && state.turnCount >= 2) {
      return { tool: "custom_question" };
    }

    // Enough tasks and turns → offer to proceed (need 10+ tasks)
    // But only if we've asked at least one clarifying question
    if (state.estimatedTaskCount >= 10 && state.turnCount >= 5 && state.hasAskedClarifyingQuestion) {
      return { tool: "offer_to_proceed" };
    }

    // If we have enough tasks but haven't asked a clarifying question, force one
    if (state.estimatedTaskCount >= 10 && !state.hasAskedClarifyingQuestion) {
      return { tool: "custom_question" };
    }

    // Default
    return { tool: "encourage_more" };
  }

  /**
   * Generate a natural response for the selected tool
   * This creates the actual message to send back to the user
   */
  async generateResponse(
    tool: AgentTool,
    state: AgentState,
    params?: {
      question?: string;
      gapArea?: string;
      initialTasks?: string;
    }
  ): Promise<string> {
    // Build acknowledgment prefix if user has new card selections
    let acknowledgmentPrefix = "";
    if (this.hasNewCardSelections(state)) {
      const newCount = this.getNewSelectionCount(state);
      const totalCount = state.selectedSuggestionIds.length;
      acknowledgmentPrefix = this.buildSelectionAcknowledgment(newCount, totalCount);
    }

    // For custom_question with a question already provided from tool selection
    // (includes O*NET-informed gap analysis), use it directly - no duplicate LLM call needed
    if (tool === "custom_question" && params?.question) {
      if (!llmService.isConfigured()) {
        return acknowledgmentPrefix + params.question;
      }
      // Generate a natural way to ask the question using the LLM
      const prompt = buildResponsePrompt(tool, state, params);
      try {
        const response = await llmService.generate(prompt, AGENT_SYSTEM_PROMPT);
        return acknowledgmentPrefix + response.trim();
      } catch (error) {
        console.error("[Agent] Failed to generate custom question response:", error);
        return acknowledgmentPrefix + params.question;
      }
    }

    // Use fallback responses if LLM not configured
    if (!llmService.isConfigured()) {
      // Special fallback for initial dump response
      if (params?.initialTasks) {
        return acknowledgmentPrefix + this.generateInitialDumpFallback(state);
      }
      return acknowledgmentPrefix + this.generateResponseFallback(tool, state);
    }

    // O*NET gap analysis for initial dump only
    // For custom_question, the gap analysis is now done in tool selection
    if (params?.initialTasks) {
      try {
        const onetTasks = await this.getOnetTasksForJob(state);
        if (onetTasks.length > 0) {
          const gapAnalysis = await llmService.generateJSON<{
            gapArea: string;
            suggestedQuestion: string;
          }>(
            buildONetGapAnalysisPrompt({
              state,
              onetTasks,
              initialInput: params?.initialTasks,
            })
          );

          console.log("[Agent] O*NET gap analysis (initial dump):", gapAnalysis);
          return acknowledgmentPrefix + gapAnalysis.suggestedQuestion;
        }
      } catch (error) {
        console.error("[Agent] O*NET gap analysis failed, falling back to standard prompt:", error);
      }
      // Fallback to existing prompt if O*NET gap analysis fails
    }

    try {
      const prompt = buildResponsePrompt(tool, state, params);
      const response = await llmService.generate(prompt, AGENT_SYSTEM_PROMPT);
      return acknowledgmentPrefix + response.trim();
    } catch (error) {
      console.error("Response generation failed:", error);
      return acknowledgmentPrefix + this.generateResponseFallback(tool, state);
    }
  }

  /**
   * Generate a streaming response for the selected tool
   * Yields text chunks as they arrive from the LLM
   */
  async *generateResponseStream(
    tool: AgentTool,
    state: AgentState,
    params?: {
      question?: string;
      gapArea?: string;
      initialTasks?: string;
    }
  ): AsyncGenerator<string, void, unknown> {
    // Build acknowledgment prefix if user has new card selections
    let acknowledgmentPrefix = "";
    if (this.hasNewCardSelections(state)) {
      const newCount = this.getNewSelectionCount(state);
      const totalCount = state.selectedSuggestionIds.length;
      acknowledgmentPrefix = this.buildSelectionAcknowledgment(newCount, totalCount);
    }

    // Yield the acknowledgment prefix first if present
    if (acknowledgmentPrefix) {
      yield acknowledgmentPrefix;
    }

    // For custom_question with a question already provided from tool selection
    // (includes O*NET-informed gap analysis), use it directly - no duplicate LLM call needed
    if (tool === "custom_question" && params?.question) {
      if (!llmService.isConfigured()) {
        yield params.question;
        return;
      }
      // Generate a natural way to ask the question using streaming LLM
      const prompt = buildResponsePrompt(tool, state, params);
      try {
        for await (const chunk of llmService.generateStream(prompt, AGENT_SYSTEM_PROMPT)) {
          yield chunk;
        }
        return;
      } catch (error) {
        console.error("[Agent] Failed to generate custom question response (stream):", error);
        yield params.question;
        return;
      }
    }

    // Use fallback responses if LLM not configured
    if (!llmService.isConfigured()) {
      if (params?.initialTasks) {
        yield this.generateInitialDumpFallback(state);
      } else {
        yield this.generateResponseFallback(tool, state);
      }
      return;
    }

    // O*NET gap analysis for initial dump only
    // For custom_question, the gap analysis is now done in tool selection
    if (params?.initialTasks) {
      try {
        const onetTasks = await this.getOnetTasksForJob(state);
        if (onetTasks.length > 0) {
          const gapAnalysis = await llmService.generateJSON<{
            gapArea: string;
            suggestedQuestion: string;
          }>(
            buildONetGapAnalysisPrompt({
              state,
              onetTasks,
              initialInput: params?.initialTasks,
            })
          );

          console.log("[Agent] O*NET gap analysis (initial dump, stream):", gapAnalysis);
          yield gapAnalysis.suggestedQuestion;
          return;
        }
      } catch (error) {
        console.error("[Agent] O*NET gap analysis failed (stream), falling back:", error);
      }
      // Fallback to existing prompt if O*NET gap analysis fails
    }

    try {
      const prompt = buildResponsePrompt(tool, state, params);
      for await (const chunk of llmService.generateStream(prompt, AGENT_SYSTEM_PROMPT)) {
        yield chunk;
      }
    } catch (error) {
      console.error("Streaming response generation failed:", error);
      yield this.generateResponseFallback(tool, state);
    }
  }

  /**
   * Build an acknowledgment message for card selections
   */
  private buildSelectionAcknowledgment(newCount: number, totalCount: number): string {
    if (totalCount >= 3) {
      return `Great, I see you've added ${totalCount} tasks from the suggestions! `;
    }
    if (newCount === 1) {
      return `Got it, I've noted that task! `;
    }
    return `Nice, ${newCount} more tasks added! `;
  }

  /**
   * Fallback response for initial dump (when LLM unavailable)
   */
  private generateInitialDumpFallback(state: AgentState): string {
    const taskCount = state.mentionedActivities.length;
    const lowestGwa = stateService.getLowestGwaCategory(state);

    // Basic acknowledgment with gap probe
    const gwaQuestions: Record<string, string> = {
      informationInput: "Do you spend time gathering information, researching, or monitoring things?",
      mentalProcesses: "What about the analytical side — do you analyze data or make decisions as part of your work?",
      workOutput: "Do you create deliverables like documents, reports, or other outputs?",
      interactingWithOthers: "How about working with others — do you collaborate with colleagues or coordinate with teams?",
    };

    const gapQuestion = lowestGwa
      ? gwaQuestions[lowestGwa]
      : "Are there any other aspects of your work you'd like to add?";

    if (taskCount >= 5) {
      return `Thanks for that detailed overview! ${gapQuestion}`;
    }
    return `Good start! ${gapQuestion}`;
  }

  /**
   * Fallback response generation without LLM
   * Provides static but reasonable responses for each tool
   */
  private generateResponseFallback(tool: AgentTool, state: AgentState): string {
    const { jobTitle, estimatedTaskCount } = state;

    switch (tool) {
      case "open_ended_prompt":
        return `I'd love to hear about what you actually do as a ${jobTitle}. What does a typical week look like for you? Tell me about the tasks and activities you spend your time on — the more detail, the better.`;

      case "custom_question":
        return `That's helpful context! Can you tell me about any other aspects of your work we haven't covered yet?`;

      case "show_suggestions":
        return `Here are some common tasks for ${jobTitle}s. Select any that apply to your work, and feel free to tell me about others we might have missed.`;

      case "encourage_more":
        return `That's really helpful! Are there any other tasks or responsibilities you regularly handle that we haven't covered yet?`;

      case "offer_to_proceed":
        return `Great, you've painted a good picture of your work! You've described about ${estimatedTaskCount} different tasks. If there's anything else you'd like to add, feel free. Otherwise, you can proceed to review your tasks.`;

      case "proceed":
        return `Thanks for sharing all of that! You've given us a great overview of your work. You can now proceed to review and add details to each task.`;

      default:
        return `Tell me more about what you do as a ${jobTitle}.`;
    }
  }
}

// Export singleton instance
export const agentService = new AgentService();
