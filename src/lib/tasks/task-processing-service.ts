import { v4 as uuidv4 } from "uuid";
import type { ChatMessage, ProcessedTask, GWACategory } from "@/types/survey";
import { matchingService } from "@/lib/onet";
import { extractionService } from "./extraction-service";
import { normalizationService } from "./normalization-service";
import { deduplicationService } from "./deduplication-service";
import type {
  TaskProcessingResult,
  NormalizedTask,
  DeduplicatedTask,
  MatchedTask,
  ONetMatch,
} from "./types";

/**
 * Result from fast processing (Extract + Normalize + Deduplicate)
 */
export interface FastProcessingResult {
  extractedTasks: { raw: string }[];
  normalizedTasks: NormalizedTask[];
  deduplicatedTasks: DeduplicatedTask[];
  processedTasks: ProcessedTask[];
}

/**
 * Task Processing Service — The Orchestrator
 *
 * Pipeline:
 * 1. EXTRACT — LLM pulls discrete tasks from chat transcript
 * 2. NORMALIZE — LLM converts to O*NET-style statements
 * 3. DEDUPLICATE — LLM merges semantically similar tasks
 * 4. MATCH — Find similar O*NET tasks (can run in background)
 * 5. FORMAT — Convert to ProcessedTask format for UI
 *
 * ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
 * │   EXTRACT    │ → │  NORMALIZE   │ → │  DEDUPLICATE │ → │    MATCH     │ → │   FORMAT     │
 * │   (LLM)      │    │   (LLM)      │    │   (LLM)      │    │  (O*NET)     │    │   (UI)       │
 * └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
 *                  FAST (blocking)                              SLOW (background)
 */
class TaskProcessingService {
  /**
   * Fast processing: Extract + Normalize + Deduplicate (no O*NET matching)
   * Returns tasks immediately so user can start rating while matching runs in background
   */
  async processChatFast(
    messages: ChatMessage[],
    jobTitle: string
  ): Promise<FastProcessingResult> {
    console.log("[TaskProcessing] Starting FAST pipeline for:", jobTitle);
    console.log("[TaskProcessing] Messages to process:", messages.length);

    // ─────────────────────────────────────────────────────────────
    // Step 1: EXTRACT tasks from chat
    // ─────────────────────────────────────────────────────────────
    console.log("[TaskProcessing] Step 1: Extracting tasks...");
    const extractedTasks = await extractionService.extractFromChat(messages);
    console.log("[TaskProcessing] Extracted:", extractedTasks.length, "tasks");

    if (extractedTasks.length === 0) {
      console.log("[TaskProcessing] No tasks extracted, returning empty result");
      return {
        extractedTasks: [],
        normalizedTasks: [],
        deduplicatedTasks: [],
        processedTasks: [],
      };
    }

    // ─────────────────────────────────────────────────────────────
    // Step 2: NORMALIZE to O*NET style
    // ─────────────────────────────────────────────────────────────
    console.log("[TaskProcessing] Step 2: Normalizing tasks...");
    const normalizedTasks = await normalizationService.normalize(extractedTasks);
    console.log("[TaskProcessing] Normalized:", normalizedTasks.length, "tasks");

    // ─────────────────────────────────────────────────────────────
    // Step 3: DEDUPLICATE similar tasks
    // ─────────────────────────────────────────────────────────────
    console.log("[TaskProcessing] Step 3: Deduplicating tasks...");
    const deduplicatedTasks = await deduplicationService.deduplicate(normalizedTasks);
    console.log("[TaskProcessing] Deduplicated:", normalizedTasks.length, "→", deduplicatedTasks.length, "tasks");

    // Log deduplication reasoning for debugging
    for (const task of deduplicatedTasks) {
      if (task.mergedFrom.length > 1) {
        console.log("[TaskProcessing] Merged tasks:", task.mergedFrom, "→", task.finalStatement);
        if (task.reasoning) {
          console.log("[TaskProcessing] Reason:", task.reasoning);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // Step 4: FORMAT for UI (without O*NET match data)
    // ─────────────────────────────────────────────────────────────
    console.log("[TaskProcessing] Step 4: Formatting for UI (no O*NET match)...");
    const processedTasks = this.formatDeduplicatedTasks(deduplicatedTasks);
    console.log("[TaskProcessing] Fast pipeline complete:", processedTasks.length, "tasks");

    return {
      extractedTasks,
      normalizedTasks,
      deduplicatedTasks,
      processedTasks,
    };
  }

  /**
   * Match tasks to O*NET database (can run in background)
   * Takes already-processed tasks and enriches them with O*NET data
   */
  async matchTasks(
    tasks: ProcessedTask[],
    occupationCode?: string
  ): Promise<ProcessedTask[]> {
    console.log("[TaskProcessing] Starting O*NET matching for", tasks.length, "tasks");

    const enrichedTasks: ProcessedTask[] = [];

    for (const task of tasks) {
      try {
        const matchResult = await matchingService.matchTask(
          task.normalizedDescription,
          occupationCode
        );

        if (matchResult.bestMatch) {
          enrichedTasks.push({
            ...task,
            onetTaskId: matchResult.bestMatch.taskId,
            onetTaskDescription: matchResult.bestMatch.taskStatement,
            similarityScore: matchResult.bestMatch.score,
            gwaCategory: this.inferGwaCategoryFromTaskType(matchResult.bestMatch.taskType),
          });
        } else {
          enrichedTasks.push(task);
        }
      } catch (error) {
        console.error("[TaskProcessing] Match failed for task:", task.id, error);
        enrichedTasks.push(task);
      }
    }

    console.log("[TaskProcessing] O*NET matching complete");
    return enrichedTasks;
  }

  /**
   * Process chat transcript into structured tasks (full pipeline)
   * @deprecated Use processChatFast + matchTasks for better UX
   */
  async processChat(
    messages: ChatMessage[],
    jobTitle: string,
    occupationCode?: string
  ): Promise<TaskProcessingResult> {
    console.log("[TaskProcessing] Starting FULL pipeline for:", jobTitle);
    console.log("[TaskProcessing] Messages to process:", messages.length);

    // ─────────────────────────────────────────────────────────────
    // Step 1: EXTRACT tasks from chat
    // ─────────────────────────────────────────────────────────────
    console.log("[TaskProcessing] Step 1: Extracting tasks...");
    const extractedTasks = await extractionService.extractFromChat(messages);
    console.log("[TaskProcessing] Extracted:", extractedTasks.length, "tasks");

    if (extractedTasks.length === 0) {
      console.log("[TaskProcessing] No tasks extracted, returning empty result");
      return {
        extractedTasks: [],
        normalizedTasks: [],
        matchedTasks: [],
        processedTasks: [],
      };
    }

    // ─────────────────────────────────────────────────────────────
    // Step 2: NORMALIZE to O*NET style
    // ─────────────────────────────────────────────────────────────
    console.log("[TaskProcessing] Step 2: Normalizing tasks...");
    const normalizedTasks = await normalizationService.normalize(extractedTasks);
    console.log("[TaskProcessing] Normalized:", normalizedTasks.length, "tasks");

    // ─────────────────────────────────────────────────────────────
    // Step 3: MATCH to O*NET database
    // ─────────────────────────────────────────────────────────────
    console.log("[TaskProcessing] Step 3: Matching to O*NET...");
    const matchedTasks = await this.matchToONet(
      normalizedTasks,
      jobTitle,
      occupationCode
    );
    console.log("[TaskProcessing] Matched:", matchedTasks.length, "tasks");

    // ─────────────────────────────────────────────────────────────
    // Step 4: FORMAT for UI
    // ─────────────────────────────────────────────────────────────
    console.log("[TaskProcessing] Step 4: Formatting for UI...");
    const processedTasks = this.formatForUI(matchedTasks);
    console.log("[TaskProcessing] Final tasks:", processedTasks.length);

    return {
      extractedTasks,
      normalizedTasks,
      matchedTasks,
      processedTasks,
    };
  }

  /**
   * Format normalized tasks for UI without O*NET matching
   * @deprecated Use formatDeduplicatedTasks instead
   */
  private formatWithoutMatch(normalizedTasks: NormalizedTask[]): ProcessedTask[] {
    return normalizedTasks.map((task) => ({
      id: uuidv4(),
      userDescription: task.original,
      normalizedDescription: task.normalized,
      gwaCategory: this.inferGwaCategory(task.normalized),
      source: "chat" as const,
    }));
  }

  /**
   * Format deduplicated tasks for UI without O*NET matching
   * Uses the merged/deduplicated task statements
   */
  private formatDeduplicatedTasks(deduplicatedTasks: DeduplicatedTask[]): ProcessedTask[] {
    return deduplicatedTasks.map((task) => ({
      id: uuidv4(),
      // For merged tasks, use first original as userDescription
      userDescription: task.mergedFrom[0] || task.finalStatement,
      normalizedDescription: task.finalStatement,
      gwaCategory: this.inferGwaCategory(task.finalStatement),
      source: "chat" as const,
    }));
  }

  /**
   * Match normalized tasks to O*NET database using Pinecone vector search
   */
  private async matchToONet(
    tasks: NormalizedTask[],
    _jobTitle: string,
    occupationCode?: string
  ): Promise<MatchedTask[]> {
    const results: MatchedTask[] = [];

    for (const task of tasks) {
      try {
        // Use Pinecone-based matching service
        const matchResult = await matchingService.matchTask(
          task.normalized,
          occupationCode
        );

        if (matchResult.bestMatch) {
          results.push({
            id: uuidv4(),
            userTask: task.original,
            normalizedTask: task.normalized,
            topMatches: [this.convertToONetMatch(matchResult.bestMatch)],
            bestMatch: this.convertToONetMatch(matchResult.bestMatch),
            confidence: matchResult.confidence === "none" ? "low" : matchResult.confidence,
          });
        } else {
          // No match found
          results.push({
            id: uuidv4(),
            userTask: task.original,
            normalizedTask: task.normalized,
            topMatches: [],
            bestMatch: undefined,
            confidence: "low",
          });
        }
      } catch (error) {
        console.error("[TaskProcessing] Match failed for task:", task.normalized, error);
        // Add task without match on error
        results.push({
          id: uuidv4(),
          userTask: task.original,
          normalizedTask: task.normalized,
          topMatches: [],
          bestMatch: undefined,
          confidence: "low",
        });
      }
    }

    return results;
  }

  /**
   * Convert Pinecone match result to ONetMatch format
   */
  private convertToONetMatch(match: {
    taskId: string;
    taskStatement: string;
    occupationCode: string;
    occupationTitle: string;
    taskType: "Core" | "Supplemental";
    score: number;
    reasoning?: string;
  }): ONetMatch {
    return {
      onetTaskId: match.taskId,
      taskStatement: match.taskStatement,
      occupationCode: match.occupationCode,
      occupationTitle: match.occupationTitle,
      gwaCategory: this.inferGwaCategoryFromTaskType(match.taskType),
      similarityScore: match.score,
    };
  }

  /**
   * Infer GWA category from task type (fallback)
   */
  private inferGwaCategoryFromTaskType(taskType: "Core" | "Supplemental"): GWACategory {
    // Core tasks tend to be work output, supplemental can be anything
    // This is a rough heuristic - the actual GWA would come from O*NET data
    return taskType === "Core" ? "workOutput" : "mentalProcesses";
  }

  /**
   * Format matched tasks for UI consumption
   */
  private formatForUI(matchedTasks: MatchedTask[]): ProcessedTask[] {
    return matchedTasks.map((task) => ({
      id: task.id,
      userDescription: task.userTask,
      normalizedDescription: task.normalizedTask,
      gwaCategory: task.bestMatch?.gwaCategory || this.inferGwaCategory(task.normalizedTask),
      onetTaskId: task.bestMatch?.onetTaskId,
      onetTaskDescription: task.bestMatch?.taskStatement,
      similarityScore: task.bestMatch?.similarityScore,
      source: "chat" as const,
    }));
  }

  /**
   * Infer GWA category from task text when no O*NET match
   */
  private inferGwaCategory(taskText: string): GWACategory {
    const text = taskText.toLowerCase();

    // Information Input keywords
    if (/\b(read|research|gather|collect|monitor|observe|review data|analyze data|investigate|examine|inspect|survey|study)\b/.test(text)) {
      return "informationInput";
    }

    // Interacting with Others keywords
    if (/\b(meet|discuss|present|communicate|coordinate|collaborate|negotiate|train|supervise|consult|advise|interview|email|call|team)\b/.test(text)) {
      return "interactingWithOthers";
    }

    // Work Output keywords
    if (/\b(write|create|build|produce|develop|design|draft|prepare|generate|compile|assemble|construct|implement|code|program)\b/.test(text)) {
      return "workOutput";
    }

    // Mental Processes (default for analytical tasks)
    return "mentalProcesses";
  }
}

// Export singleton
export const taskProcessingService = new TaskProcessingService();
