// GWA (Generalized Work Activities) categories
export type GWACategory =
  | "informationInput"
  | "mentalProcesses"
  | "workOutput"
  | "interactingWithOthers";

// AI usage frequency scale (1-5: never to always)
export type AIFrequency = number;

// Chat message in conversation
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  suggestions?: OnetTaskSuggestion[];
}

// O*NET task suggestion shown during chat
export interface OnetTaskSuggestion {
  id: string;
  taskId: string;
  description: string;
  gwaCategory: GWACategory;
  selected?: boolean;
}

// Processed task after LLM extraction and matching
export interface ProcessedTask {
  id: string;
  userDescription: string;
  normalizedDescription: string;
  gwaCategory: GWACategory;
  onetTaskId?: string;
  onetTaskDescription?: string;
  similarityScore?: number;
  source: "chat" | "suggestion";
}

// Task with user-provided data (time %, AI usage)
export interface TaskWithData extends ProcessedTask {
  timePercentage: number;
  aiFrequency: AIFrequency;
  aiDescription?: string;
}

// Survey session state
export interface SurveySession {
  id: string;
  jobTitle: string;
  occupationCode?: string;
  occupationTitle?: string;
  chatHistory: ChatMessage[];
  tasks: ProcessedTask[];
  taskData?: Record<string, TaskWithData>;
  createdAt: string;
  submittedAt?: string;
}

// API request/response types
export interface ChatMessageRequest {
  sessionId: string;
  message: string;
  jobTitle: string;
}

export interface ChatMessageResponse {
  message: ChatMessage;
  suggestions?: OnetTaskSuggestion[];
  isComplete?: boolean;
}

export interface ProcessTasksRequest {
  sessionId: string;
  chatHistory: ChatMessage[];
  selectedSuggestions: string[];
}

export interface ProcessTasksResponse {
  tasks: ProcessedTask[];
}

export interface SubmitTasksRequest {
  sessionId: string;
  jobTitle: string;
  occupationCode?: string;
  tasks: TaskWithData[];
}

export interface SubmitTasksResponse {
  success: boolean;
  assessmentId: string;
}

// Job title lookup result
export interface JobTitleMatch {
  commonTitle: string;
  onetCode: string;
  onetTitle: string;
  confidence: number;
}

// Task theme from analysis
export interface TaskTheme {
  name: string;
  tasks: string[];
  totalTimePercent: number;
  avgAiUsage: number;
}

// Task analysis insights
export interface TaskInsights {
  mostTimeTheme: string;
  mostAiUseTask: { id: string; description: string } | null;
  leastAiUseTask: { id: string; description: string } | null;
}

// Complete task analysis response
export interface TaskAnalysis {
  themes: TaskTheme[];
  insights: TaskInsights;
}

// Request for task analysis
export interface TaskAnalysisRequest {
  tasks: TaskWithData[];
  jobTitle: string;
}

// Response from task analysis
export interface TaskAnalysisResponse extends TaskAnalysis {}
