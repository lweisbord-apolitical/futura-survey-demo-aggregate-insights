import type { ChatMessage, GWACategory, ProcessedTask } from "@/types/survey";

/**
 * Raw extracted task from chat
 */
export interface ExtractedTask {
  raw: string;
  sourceMessageId?: string;
}

/**
 * Task after normalization to O*NET style
 */
export interface NormalizedTask {
  original: string;
  normalized: string;
}

/**
 * Task after deduplication
 */
export interface DeduplicatedTask {
  finalStatement: string;
  mergedFrom: string[];
  reasoning?: string;
}

/**
 * O*NET match result
 */
export interface ONetMatch {
  onetTaskId: string;
  taskStatement: string;
  occupationCode: string;
  occupationTitle: string;
  gwaCategory: GWACategory;
  similarityScore: number;
}

/**
 * Task after O*NET matching
 */
export interface MatchedTask {
  id: string;
  userTask: string;
  normalizedTask: string;
  topMatches: ONetMatch[];
  bestMatch?: ONetMatch;
  confidence: "high" | "medium" | "low";
}

/**
 * Full processing result
 */
export interface TaskProcessingResult {
  extractedTasks: ExtractedTask[];
  normalizedTasks: NormalizedTask[];
  matchedTasks: MatchedTask[];
  processedTasks: ProcessedTask[];
}

/**
 * LLM extraction response
 */
export interface LLMExtractionResponse {
  extracted_tasks: string[];
}

/**
 * LLM normalization response
 */
export interface LLMNormalizationResponse {
  normalized_tasks: Array<{
    original: string;
    normalized: string;
  }>;
}

/**
 * LLM deduplication response
 */
export interface LLMDeduplicationResponse {
  deduplicated_tasks: Array<{
    final_statement: string;
    merged_from: number[];
    reasoning: string;
  }>;
}
