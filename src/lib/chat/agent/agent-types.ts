import type { GWACategory } from "@/types/survey";

// Agent tools available for task elicitation
// See spec: each tool has a specific purpose in the conversation flow
export type AgentTool =
  | "open_ended_prompt"    // "Tell me everything about your work" (turn 1 only, rule-based)
  | "custom_question"      // LLM-generated question for specific gap, O*NET-grounded when available (LLM-selected)
  | "show_suggestions"     // Show O*NET tasks they can tap (LLM-selected, max 3)
  | "encourage_more"       // "Anything else?" (LLM-selected or fallback)
  | "offer_to_proceed"     // "Looks good — ready to continue?" (LLM-selected with guardrails)
  | "proceed";             // End the chat, move to next step (rule-based on "done")

// Tool selection result
export interface ToolSelection {
  tool: AgentTool;
  params?: {
    question?: string;
    gapArea?: string;
  };
}

// GWA coverage levels
export type GWACoverageLevel = "none" | "low" | "medium" | "high";

// GWA coverage tracking
export interface GWACoverage {
  informationInput: GWACoverageLevel;
  mentalProcesses: GWACoverageLevel;
  workOutput: GWACoverageLevel;
  interactingWithOthers: GWACoverageLevel;
}

// User engagement level
export type UserEngagement = "high" | "medium" | "low";

// Conversation message for history tracking
export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

// Agent state tracked across conversation
export interface AgentState {
  turnCount: number;
  estimatedTaskCount: number;
  mentionedActivities: string[];
  underexploredActivities: string[];
  gwaCoverage: GWACoverage;
  actionsTaken: AgentTool[];
  followUpsAsked: number;
  suggestionsShown: number;
  userEngagement: UserEngagement;
  userWantsToStop: boolean;
  jobTitle: string;
  // Card selection tracking
  selectedSuggestionIds: string[];
  previouslyAcknowledgedSelections: number;
  // Text-based suggestion tracking
  pendingSuggestions: string[];
  // Conversation history for context
  conversationHistory: ConversationMessage[];
  // Track AI-generated suggestion statements to avoid duplicates
  shownSuggestionStatements: string[];
  // Track whether we've asked at least one clarifying question (for initial dump flow)
  hasAskedClarifyingQuestion: boolean;
  // Cache O*NET tasks to avoid repeated Pinecone calls
  cachedOnetTasks?: string[];
  // LLM-assessed O*NET coverage (from tool selection)
  onetCoverageAssessment?: ONetCoverageLevel;
}

// Initial agent state factory
export function createInitialAgentState(jobTitle: string): AgentState {
  return {
    turnCount: 0,
    estimatedTaskCount: 0,
    mentionedActivities: [],
    underexploredActivities: [],
    gwaCoverage: {
      informationInput: "none",
      mentalProcesses: "none",
      workOutput: "none",
      interactingWithOthers: "none",
    },
    actionsTaken: [],
    followUpsAsked: 0,
    suggestionsShown: 0,
    userEngagement: "medium",
    userWantsToStop: false,
    jobTitle,
    // Card selection tracking
    selectedSuggestionIds: [],
    previouslyAcknowledgedSelections: 0,
    // Text-based suggestion tracking
    pendingSuggestions: [],
    // Conversation history for context
    conversationHistory: [],
    // Track AI-generated suggestion statements to avoid duplicates
    shownSuggestionStatements: [],
    // Track whether we've asked at least one clarifying question
    hasAskedClarifyingQuestion: false,
  };
}

// LLM completeness check response (backup)
export interface CompletenessCheck {
  seems_complete: boolean;
  confidence: "high" | "medium" | "low";
  gap_area: string | null;
  suggested_question: string | null;
}

// O*NET coverage assessment level (LLM-assessed)
export type ONetCoverageLevel = "high" | "medium" | "low";

// LLM tool selection response
export interface LLMToolSelection {
  tool: "custom_question" | "show_suggestions" | "encourage_more" | "offer_to_proceed";
  reason: string;
  question?: string;      // For custom_question
  gapArea?: string;       // For custom_question - the general area of work that's missing
  onetCoverage?: ONetCoverageLevel;  // LLM-assessed O*NET coverage
}

// LLM message analysis response
export interface MessageAnalysis {
  newTaskCount: number;
  newActivities: string[];
  underexploredActivities: string[];
  gwaUpdates: Partial<Record<keyof GWACoverage, GWACoverageLevel>>;
  engagement: UserEngagement;
  wantsToStop: boolean;
}

// Tool execution result
export interface ToolResult {
  suggestions?: Array<{
    id: string;
    statement: string;
    gwaCategory: GWACategory;
    occupationCode: string;
    occupationTitle: string;
    importance: number;
  }>;
  question?: string;
}
