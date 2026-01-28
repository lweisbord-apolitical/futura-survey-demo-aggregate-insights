import type { ChatMessage, GWACategory } from "@/types/survey";
import type { AgentTool, GWACoverage, UserEngagement } from "./agent/agent-types";

// Request DTOs
export interface SendMessageRequest {
  sessionId: string;
  message: string;
  jobTitle: string;
  occupationCode?: string;
}

export interface StartSessionRequest {
  jobTitle: string;
  occupationCode?: string;
  initialTasks?: string; // User's initial task dump from prompt screen
}

// Response DTOs
export interface ChatResponse {
  sessionId: string;
  message: ChatMessage;
  suggestions?: TaskSuggestion[];
  shouldShowSuggestions: boolean;
  isComplete: boolean;
  extractedTasks: ExtractedTask[];
  /** Which tool was used to generate this response */
  toolUsed?: AgentTool;
  /** Updated state for debugging/monitoring */
  updatedState?: {
    turnCount: number;
    estimatedTaskCount: number;
    userEngagement: UserEngagement;
    gwaCoverage: GWACoverage;
  };
}

export interface StartSessionResponse {
  sessionId: string;
  message: ChatMessage;
}

// Internal types
export interface TaskSuggestion {
  id: string;
  statement: string;
  gwaCategory: GWACategory;
  occupationCode: string;
  occupationTitle: string;
  importance: number;
}

export interface ExtractedTask {
  id: string;
  description: string;
  source: "chat" | "suggestion";
}

// Session state
export interface ChatSessionState {
  sessionId: string;
  jobTitle: string;
  occupationCode?: string;
  messages: ChatMessage[];
  extractedTasks: ExtractedTask[];
  selectedSuggestionIds: string[];
  turnCount: number;
  createdAt: string;
  updatedAt: string;
}

// Agent analysis result
export interface AgentAnalysis {
  responseMessage: string;
  extractedTasks: ExtractedTask[];
  shouldShowSuggestions: boolean;
  isComplete: boolean;
  confidence: number;
}
