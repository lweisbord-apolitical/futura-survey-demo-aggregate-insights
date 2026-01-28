import { v4 as uuidv4 } from "uuid";
import type { ChatMessage } from "@/types/survey";
import { sessionStore } from "./session-store";
import {
  agentService,
  stateService,
  toolsService,
  createInitialAgentState,
  type AgentState,
  type AgentTool,
  type GWACoverage,
} from "./agent";
import type {
  ChatSessionState,
  ChatResponse,
  StartSessionResponse,
  ExtractedTask,
  TaskSuggestion,
} from "./types";

/**
 * Chat Service — The Orchestrator
 *
 * Ties everything together:
 * 1. State Service ("The Memory") - tracks conversation state
 * 2. Agent Service ("The Brain") - decides what to do next
 * 3. Tools Service ("The Hands") - executes actions
 *
 * Flow for each message:
 * ─────────────────────────────────────────────────────────────────
 * 1. REQUEST ARRIVES
 *    { sessionId, message, jobTitle }
 *
 * 2. STATE SERVICE ANALYZES MESSAGE
 *    → Extract tasks, update GWA coverage, detect engagement
 *    → Returns: Updated AgentState
 *
 * 3. AGENT SELECTS TOOL
 *    → Check completeness, identify gaps
 *    → Returns: ToolSelection (which tool + params)
 *
 * 4. TOOLS SERVICE EXECUTES
 *    → For show_suggestions: fetch O*NET tasks
 *    → For proceed: set exit flag
 *    → Returns: ToolExecutionResult
 *
 * 5. AGENT GENERATES RESPONSE
 *    → Create natural message for selected tool
 *    → Returns: string
 *
 * 6. RESPONSE RETURNED
 *    { reply, toolUsed, suggestions, updatedState, shouldProceed }
 * ─────────────────────────────────────────────────────────────────
 */
class ChatService {
  /**
   * Start a new chat session
   * If initialTasks provided, analyze them and respond with custom_question
   * Otherwise, generate the opening message (turn 1)
   */
  async startSession(
    jobTitle: string,
    occupationCode?: string,
    initialTasks?: string
  ): Promise<ChatResponse> {
    const sessionId = uuidv4();

    // Initialize agent state
    let agentState = createInitialAgentState(jobTitle);

    // Create session
    await sessionStore.create(sessionId, jobTitle, occupationCode);

    // If user provided initial tasks, analyze and respond to them
    if (initialTasks && initialTasks.trim()) {
      // Add to conversation history
      agentState.conversationHistory.push({
        role: "user",
        content: initialTasks,
      });

      // Analyze the initial dump to extract tasks and update state
      agentState = await stateService.analyzeAndUpdateState(
        initialTasks,
        agentState
      );
      agentState.turnCount = 1;

      // Check if initial dump is comprehensive enough to skip chat
      const completenessCheck = await agentService.checkInitialDumpCompleteness(
        agentState,
        initialTasks
      );

      if (completenessCheck.isComprehensive) {
        console.log("[Chat] Initial dump is comprehensive, skipping chat:", completenessCheck.reason);

        // Generate a brief closing message
        const closingMessage = await agentService.generateResponse("proceed", agentState);

        const assistantMessage: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: closingMessage,
          timestamp: new Date().toISOString(),
        };

        // Add assistant response to conversation history
        agentState.conversationHistory.push({
          role: "assistant",
          content: closingMessage,
        });

        // Update session
        await sessionStore.update(sessionId, {
          messages: [assistantMessage],
          turnCount: 1,
        });

        // Save agent state
        this.saveAgentState(sessionId, agentState);

        // Extract tasks from activities
        const extractedTasks = this.extractTasksFromActivities(
          agentState.mentionedActivities,
          []
        );

        return {
          sessionId,
          message: assistantMessage,
          suggestions: [],
          shouldShowSuggestions: false,
          isComplete: true,
          extractedTasks,
          toolUsed: "proceed",
          updatedState: {
            turnCount: agentState.turnCount,
            estimatedTaskCount: agentState.estimatedTaskCount,
            userEngagement: agentState.userEngagement,
            gwaCoverage: agentState.gwaCoverage,
          },
        };
      }

      // Otherwise continue with normal flow (ask clarifying questions)
      // Select tool based on what they provided (probably custom_question)
      const toolSelection = await agentService.selectTool(agentState);

      // Mark if this is a clarifying question tool
      if (stateService.isClarifyingQuestionTool(toolSelection.tool)) {
        agentState = stateService.markClarifyingQuestionAsked(agentState);
      }

      // Execute tool (may generate AI suggestions)
      const toolResult = await toolsService.execute(
        toolSelection.tool,
        agentState,
        {
          question: toolSelection.params?.question,
          gapArea: toolSelection.params?.gapArea,
        }
      );

      // Track shown AI-generated suggestions to avoid duplicates
      if (toolResult.suggestions) {
        agentState.shownSuggestionStatements = [
          ...agentState.shownSuggestionStatements,
          ...toolResult.suggestions.map((s) => s.statement),
        ];
      }

      // Generate response that acknowledges what they shared
      const responseContent = await agentService.generateResponse(
        toolSelection.tool,
        agentState,
        {
          ...toolSelection.params,
          initialTasks, // Pass for context in response generation
        }
      );

      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: responseContent,
        timestamp: new Date().toISOString(),
      };

      // Add assistant response to conversation history
      agentState.conversationHistory.push({
        role: "assistant",
        content: responseContent,
      });

      // Update session
      await sessionStore.update(sessionId, {
        messages: [assistantMessage],
        turnCount: 1,
      });

      // Update action history
      agentState.actionsTaken = [toolSelection.tool];

      // Extract tasks from activities
      const extractedTasks = this.extractTasksFromActivities(
        agentState.mentionedActivities,
        []
      );

      // Check if already complete
      const shouldProceed = stateService.checkExitConditions(agentState);

      // Save agent state
      this.saveAgentState(sessionId, agentState);

      return {
        sessionId,
        message: assistantMessage,
        suggestions: toolResult.suggestions,
        shouldShowSuggestions: toolSelection.tool === "show_suggestions",
        isComplete: shouldProceed,
        extractedTasks,
        toolUsed: toolSelection.tool,
        updatedState: {
          turnCount: agentState.turnCount,
          estimatedTaskCount: agentState.estimatedTaskCount,
          userEngagement: agentState.userEngagement,
          gwaCoverage: agentState.gwaCoverage,
        },
      };
    }

    // No initial tasks - generate standard opening message
    // Select tool for turn 1 (will always be open_ended_prompt)
    const toolSelection = await agentService.selectTool(agentState);

    // Generate opening message
    const responseContent = await agentService.generateResponse(
      toolSelection.tool,
      agentState
    );

    const openingMessage: ChatMessage = {
      id: uuidv4(),
      role: "assistant",
      content: responseContent,
      timestamp: new Date().toISOString(),
    };

    await sessionStore.update(sessionId, {
      messages: [openingMessage],
      turnCount: 1,
    });

    // Store agent state (turn 1 completed)
    const updatedAgentState: AgentState = {
      ...agentState,
      turnCount: 1,
      actionsTaken: [toolSelection.tool],
    };
    this.saveAgentState(sessionId, updatedAgentState);

    return {
      sessionId,
      message: openingMessage,
      suggestions: [],
      shouldShowSuggestions: false,
      isComplete: false,
      extractedTasks: [],
    };
  }

  /**
   * Start a new chat session with streaming response
   * If initialTasks provided, analyze them and stream the response
   */
  async *startSessionStream(
    jobTitle: string,
    occupationCode?: string,
    initialTasks?: string
  ): AsyncGenerator<{ type: "chunk" | "done"; content?: string; response?: ChatResponse }, void, unknown> {
    const sessionId = uuidv4();

    // Initialize agent state
    let agentState = createInitialAgentState(jobTitle);

    // Create session
    await sessionStore.create(sessionId, jobTitle, occupationCode);

    // If user provided initial tasks, analyze and respond to them
    if (initialTasks && initialTasks.trim()) {
      // Add to conversation history
      agentState.conversationHistory.push({
        role: "user",
        content: initialTasks,
      });

      // Analyze the initial dump to extract tasks and update state
      agentState = await stateService.analyzeAndUpdateState(
        initialTasks,
        agentState
      );
      agentState.turnCount = 1;

      // Check if initial dump is comprehensive enough to skip chat
      const completenessCheck = await agentService.checkInitialDumpCompleteness(
        agentState,
        initialTasks
      );

      if (completenessCheck.isComprehensive) {
        console.log("[Chat] Initial dump is comprehensive (stream), skipping chat:", completenessCheck.reason);

        // Generate a brief closing message (streaming)
        let closingMessage = "";
        for await (const chunk of agentService.generateResponseStream("proceed", agentState)) {
          closingMessage += chunk;
          yield { type: "chunk", content: chunk };
        }

        const assistantMessage: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: closingMessage.trim(),
          timestamp: new Date().toISOString(),
        };

        // Add assistant response to conversation history
        agentState.conversationHistory.push({
          role: "assistant",
          content: closingMessage.trim(),
        });

        // Update session
        await sessionStore.update(sessionId, {
          messages: [assistantMessage],
          turnCount: 1,
        });

        // Save agent state
        this.saveAgentState(sessionId, agentState);

        // Extract tasks from activities
        const extractedTasks = this.extractTasksFromActivities(
          agentState.mentionedActivities,
          []
        );

        // Yield final response with metadata
        yield {
          type: "done",
          response: {
            sessionId,
            message: assistantMessage,
            suggestions: [],
            shouldShowSuggestions: false,
            isComplete: true,
            extractedTasks,
            toolUsed: "proceed",
            updatedState: {
              turnCount: agentState.turnCount,
              estimatedTaskCount: agentState.estimatedTaskCount,
              userEngagement: agentState.userEngagement,
              gwaCoverage: agentState.gwaCoverage,
            },
          },
        };
        return;
      }

      // Otherwise continue with normal flow (ask clarifying questions)
      // Select tool based on what they provided
      const toolSelection = await agentService.selectTool(agentState);

      // Mark if this is a clarifying question tool
      if (stateService.isClarifyingQuestionTool(toolSelection.tool)) {
        agentState = stateService.markClarifyingQuestionAsked(agentState);
      }

      // Execute tool (may generate AI suggestions)
      const toolResult = await toolsService.execute(
        toolSelection.tool,
        agentState,
        {
          question: toolSelection.params?.question,
          gapArea: toolSelection.params?.gapArea,
        }
      );

      // Track shown AI-generated suggestions to avoid duplicates
      if (toolResult.suggestions) {
        agentState.shownSuggestionStatements = [
          ...agentState.shownSuggestionStatements,
          ...toolResult.suggestions.map((s) => s.statement),
        ];
      }

      // Generate streaming response
      let fullResponse = "";
      for await (const chunk of agentService.generateResponseStream(
        toolSelection.tool,
        agentState,
        {
          ...toolSelection.params,
          initialTasks,
        }
      )) {
        fullResponse += chunk;
        yield { type: "chunk", content: chunk };
      }

      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: fullResponse.trim(),
        timestamp: new Date().toISOString(),
      };

      // Add assistant response to conversation history
      agentState.conversationHistory.push({
        role: "assistant",
        content: fullResponse.trim(),
      });

      // Update session
      await sessionStore.update(sessionId, {
        messages: [assistantMessage],
        turnCount: 1,
      });

      // Update action history
      agentState.actionsTaken = [toolSelection.tool];

      // Extract tasks from activities
      const extractedTasks = this.extractTasksFromActivities(
        agentState.mentionedActivities,
        []
      );

      // Check if already complete
      const shouldProceed = stateService.checkExitConditions(agentState);

      // Save agent state
      this.saveAgentState(sessionId, agentState);

      // Yield final response with metadata
      yield {
        type: "done",
        response: {
          sessionId,
          message: assistantMessage,
          suggestions: toolResult.suggestions,
          shouldShowSuggestions: toolSelection.tool === "show_suggestions",
          isComplete: shouldProceed,
          extractedTasks,
          toolUsed: toolSelection.tool,
          updatedState: {
            turnCount: agentState.turnCount,
            estimatedTaskCount: agentState.estimatedTaskCount,
            userEngagement: agentState.userEngagement,
            gwaCoverage: agentState.gwaCoverage,
          },
        },
      };
      return;
    }

    // No initial tasks - generate standard opening message with streaming
    const toolSelection = await agentService.selectTool(agentState);

    // Generate streaming opening message
    let fullResponse = "";
    for await (const chunk of agentService.generateResponseStream(
      toolSelection.tool,
      agentState
    )) {
      fullResponse += chunk;
      yield { type: "chunk", content: chunk };
    }

    const openingMessage: ChatMessage = {
      id: uuidv4(),
      role: "assistant",
      content: fullResponse.trim(),
      timestamp: new Date().toISOString(),
    };

    await sessionStore.update(sessionId, {
      messages: [openingMessage],
      turnCount: 1,
    });

    // Store agent state
    const updatedAgentState: AgentState = {
      ...agentState,
      turnCount: 1,
      actionsTaken: [toolSelection.tool],
    };
    this.saveAgentState(sessionId, updatedAgentState);

    // Yield final response
    yield {
      type: "done",
      response: {
        sessionId,
        message: openingMessage,
        suggestions: [],
        shouldShowSuggestions: false,
        isComplete: false,
        extractedTasks: [],
      },
    };
  }

  /**
   * Process a user message and generate agent response
   * This is the main orchestration method
   */
  async processMessage(
    sessionId: string,
    userMessageContent: string
  ): Promise<ChatResponse> {
    const session = await sessionStore.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Get current agent state (or initialize if missing)
    let agentState =
      this.getAgentState(sessionId) ||
      createInitialAgentState(session.jobTitle);

    // Sync selected suggestions from session (updated via PATCH endpoint)
    agentState.selectedSuggestionIds = session.selectedSuggestionIds || [];

    // ─────────────────────────────────────────────────────────────
    // STEP 1: Create user message
    // ─────────────────────────────────────────────────────────────
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content: userMessageContent,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...session.messages, userMessage];

    // ─────────────────────────────────────────────────────────────
    // STEP 2: Add user message to conversation history
    // ─────────────────────────────────────────────────────────────
    agentState.conversationHistory.push({
      role: "user",
      content: userMessageContent,
    });

    // ─────────────────────────────────────────────────────────────
    // STEP 3: STATE SERVICE ANALYZES MESSAGE
    // Extract tasks, update GWA coverage, detect engagement
    // ─────────────────────────────────────────────────────────────
    agentState = await stateService.analyzeAndUpdateState(
      userMessageContent,
      agentState
    );

    // ─────────────────────────────────────────────────────────────
    // STEP 3: AGENT SELECTS TOOL
    // Check completeness, identify gaps, decide action
    // ─────────────────────────────────────────────────────────────
    const toolSelection = await agentService.selectTool(agentState);

    // Mark if this is a clarifying question tool
    if (stateService.isClarifyingQuestionTool(toolSelection.tool)) {
      agentState = stateService.markClarifyingQuestionAsked(agentState);
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 4: TOOLS SERVICE EXECUTES
    // Generate AI suggestions, set flags, etc.
    // ─────────────────────────────────────────────────────────────
    const toolResult = await toolsService.execute(
      toolSelection.tool,
      agentState,
      {
        question: toolSelection.params?.question,
        gapArea: toolSelection.params?.gapArea,
      }
    );

    // Track suggestions shown
    if (toolSelection.tool === "show_suggestions") {
      agentState.suggestionsShown += 1;
      // Track shown AI-generated suggestions to avoid duplicates
      if (toolResult.suggestions) {
        agentState.shownSuggestionStatements = [
          ...agentState.shownSuggestionStatements,
          ...toolResult.suggestions.map((s) => s.statement),
        ];
      }
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 5: AGENT GENERATES RESPONSE
    // Create natural message for selected tool
    // ─────────────────────────────────────────────────────────────
    const responseContent = await agentService.generateResponse(
      toolSelection.tool,
      agentState,
      toolSelection.params
    );

    const assistantMessage: ChatMessage = {
      id: uuidv4(),
      role: "assistant",
      content: responseContent,
      timestamp: new Date().toISOString(),
    };

    // Add assistant response to conversation history
    agentState.conversationHistory.push({
      role: "assistant",
      content: responseContent,
    });

    // ─────────────────────────────────────────────────────────────
    // STEP 7: UPDATE STATE AND PREPARE RESPONSE
    // ─────────────────────────────────────────────────────────────

    // Extract any task mentions from the response for potential text-based confirmation
    const pendingSuggestions = stateService.extractTaskMentionsFromResponse(responseContent);
    if (pendingSuggestions.length > 0) {
      console.log("[Chat] Pending suggestions from response:", pendingSuggestions);
      agentState.pendingSuggestions = pendingSuggestions;
    }

    // Update action history
    agentState.actionsTaken = [...agentState.actionsTaken, toolSelection.tool];

    // Mark card selections as acknowledged (prevent re-acknowledgment)
    if (agentState.selectedSuggestionIds.length > agentState.previouslyAcknowledgedSelections) {
      console.log("[Chat] Updating previouslyAcknowledgedSelections:", agentState.previouslyAcknowledgedSelections, "→", agentState.selectedSuggestionIds.length);
      agentState.previouslyAcknowledgedSelections = agentState.selectedSuggestionIds.length;
    }

    // Extract tasks from conversation
    const extractedTasks = this.extractTasksFromActivities(
      agentState.mentionedActivities,
      session.extractedTasks
    );

    // Check if conversation should end
    const shouldProceed =
      toolResult.shouldProceed || stateService.checkExitConditions(agentState);

    // Update session state
    await sessionStore.update(sessionId, {
      messages: [...updatedMessages, assistantMessage],
      extractedTasks,
      turnCount: agentState.turnCount,
    });

    // Save agent state
    this.saveAgentState(sessionId, agentState);

    // ─────────────────────────────────────────────────────────────
    // RETURN RESPONSE
    // ─────────────────────────────────────────────────────────────
    return {
      sessionId,
      message: assistantMessage,
      suggestions: toolResult.suggestions,
      shouldShowSuggestions: toolSelection.tool === "show_suggestions",
      isComplete: shouldProceed,
      extractedTasks,
      // Additional info for debugging/monitoring
      toolUsed: toolSelection.tool,
      updatedState: {
        turnCount: agentState.turnCount,
        estimatedTaskCount: agentState.estimatedTaskCount,
        userEngagement: agentState.userEngagement,
        gwaCoverage: agentState.gwaCoverage,
      },
    };
  }

  /**
   * Process a user message and generate a streaming agent response
   * Returns an async generator that yields text chunks
   */
  async *processMessageStream(
    sessionId: string,
    userMessageContent: string
  ): AsyncGenerator<{ type: "chunk" | "done"; content?: string; response?: ChatResponse }, void, unknown> {
    const session = await sessionStore.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    // Get current agent state (or initialize if missing)
    const existingState = this.getAgentState(sessionId);
    let agentState = existingState || createInitialAgentState(session.jobTitle);

    console.log("[Chat-Stream] Loaded agent state:", {
      wasExisting: !!existingState,
      previouslyAcknowledgedSelections: agentState.previouslyAcknowledgedSelections,
      turnCount: agentState.turnCount,
    });

    // Sync selected suggestions from session
    agentState.selectedSuggestionIds = session.selectedSuggestionIds || [];

    // Create user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content: userMessageContent,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...session.messages, userMessage];

    // Add user message to conversation history
    agentState.conversationHistory.push({
      role: "user",
      content: userMessageContent,
    });

    // Analyze message and update state
    agentState = await stateService.analyzeAndUpdateState(
      userMessageContent,
      agentState
    );

    // Select tool
    const toolSelection = await agentService.selectTool(agentState);

    // Mark if this is a clarifying question tool
    if (stateService.isClarifyingQuestionTool(toolSelection.tool)) {
      agentState = stateService.markClarifyingQuestionAsked(agentState);
    }

    // Execute tool
    const toolResult = await toolsService.execute(
      toolSelection.tool,
      agentState,
      {
        question: toolSelection.params?.question,
        gapArea: toolSelection.params?.gapArea,
      }
    );

    // Track suggestions shown
    if (toolSelection.tool === "show_suggestions") {
      agentState.suggestionsShown += 1;
      if (toolResult.suggestions) {
        agentState.shownSuggestionStatements = [
          ...agentState.shownSuggestionStatements,
          ...toolResult.suggestions.map((s) => s.statement),
        ];
      }
    }

    // Generate streaming response
    let fullResponse = "";
    for await (const chunk of agentService.generateResponseStream(
      toolSelection.tool,
      agentState,
      toolSelection.params
    )) {
      fullResponse += chunk;
      yield { type: "chunk", content: chunk };
    }

    // Create assistant message with full response
    const assistantMessage: ChatMessage = {
      id: uuidv4(),
      role: "assistant",
      content: fullResponse.trim(),
      timestamp: new Date().toISOString(),
    };

    // Add assistant response to conversation history
    agentState.conversationHistory.push({
      role: "assistant",
      content: fullResponse.trim(),
    });

    // Update state
    const pendingSuggestions = stateService.extractTaskMentionsFromResponse(fullResponse);
    if (pendingSuggestions.length > 0) {
      agentState.pendingSuggestions = pendingSuggestions;
    }

    agentState.actionsTaken = [...agentState.actionsTaken, toolSelection.tool];

    if (agentState.selectedSuggestionIds.length > agentState.previouslyAcknowledgedSelections) {
      console.log("[Chat-Stream] Updating previouslyAcknowledgedSelections:", agentState.previouslyAcknowledgedSelections, "→", agentState.selectedSuggestionIds.length);
      agentState.previouslyAcknowledgedSelections = agentState.selectedSuggestionIds.length;
    }

    // Extract tasks
    const extractedTasks = this.extractTasksFromActivities(
      agentState.mentionedActivities,
      session.extractedTasks
    );

    // Check if should proceed
    const shouldProceed =
      toolResult.shouldProceed || stateService.checkExitConditions(agentState);

    // Update session state
    await sessionStore.update(sessionId, {
      messages: [...updatedMessages, assistantMessage],
      extractedTasks,
      turnCount: agentState.turnCount,
    });

    // Save agent state
    console.log("[Chat-Stream] Saving agent state with previouslyAcknowledgedSelections:", agentState.previouslyAcknowledgedSelections);
    this.saveAgentState(sessionId, agentState);

    // Yield final response with metadata
    yield {
      type: "done",
      response: {
        sessionId,
        message: assistantMessage,
        suggestions: toolResult.suggestions,
        shouldShowSuggestions: toolSelection.tool === "show_suggestions",
        isComplete: shouldProceed,
        extractedTasks,
        toolUsed: toolSelection.tool,
        updatedState: {
          turnCount: agentState.turnCount,
          estimatedTaskCount: agentState.estimatedTaskCount,
          userEngagement: agentState.userEngagement,
          gwaCoverage: agentState.gwaCoverage,
        },
      },
    };
  }

  /**
   * Get current session state
   */
  async getSession(sessionId: string): Promise<ChatSessionState | undefined> {
    return sessionStore.get(sessionId);
  }

  /**
   * Add selected suggestions to session
   */
  async selectSuggestions(sessionId: string, suggestionIds: string[]): Promise<void> {
    const session = await sessionStore.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    await sessionStore.update(sessionId, {
      selectedSuggestionIds: suggestionIds,
    });
  }

  /**
   * Convert mentioned activities to extracted tasks
   */
  private extractTasksFromActivities(
    activities: string[],
    existing: ExtractedTask[]
  ): ExtractedTask[] {
    const existingDescriptions = new Set(
      existing.map((t) => t.description.toLowerCase())
    );

    const newTasks: ExtractedTask[] = [];
    for (const activity of activities) {
      const normalized = activity.toLowerCase();
      if (!existingDescriptions.has(normalized)) {
        existingDescriptions.add(normalized);
        newTasks.push({
          id: `task-${existing.length + newTasks.length + 1}`,
          description: activity,
          source: "chat",
        });
      }
    }

    return [...existing, ...newTasks];
  }

  /**
   * Save agent state to session (stored in separate map)
   */
  private saveAgentState(sessionId: string, state: AgentState): void {
    agentStateStore.set(sessionId, state);
  }

  /**
   * Get agent state from session
   */
  private getAgentState(sessionId: string): AgentState | undefined {
    return agentStateStore.get(sessionId);
  }
}

// Simple in-memory store for agent state (separate from session store)
// This keeps agent internals separate from session data
const agentStateStore = new Map<string, AgentState>();

// Export singleton instance
export const chatService = new ChatService();
