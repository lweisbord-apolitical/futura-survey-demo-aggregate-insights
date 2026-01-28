/**
 * O*NET Matching Service
 *
 * Two-stage matching pipeline:
 * 1. Pinecone retrieval: Get top-5 candidates using integrated embeddings
 * 2. LLM selection: Pick the single best match from candidates
 */

import OpenAI from "openai";
import { pineconeService, type PineconeSearchHit } from "./pinecone-service";

export type MatchConfidence = "high" | "medium" | "low" | "none";

export interface ONetMatch {
  taskId: string;
  taskStatement: string;
  occupationCode: string;
  occupationTitle: string;
  taskType: "Core" | "Supplemental";
  score: number;
  reasoning?: string;
}

export interface TaskMatchResult {
  userTask: string;
  bestMatch: ONetMatch | null;
  confidence: MatchConfidence;
}

interface LLMSelectionResponse {
  bestIndex: number;
  confidence: MatchConfidence;
  reasoning: string;
}

class MatchingService {
  private openai: OpenAI | null = null;

  private getOpenAI(): OpenAI {
    if (!this.openai) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    return this.openai;
  }

  /**
   * Match a user task to O*NET tasks
   */
  async matchTask(
    userTask: string,
    _occupationCode?: string // Not used - we search all tasks for best semantic match
  ): Promise<TaskMatchResult> {
    try {
      // Check if Pinecone is configured
      if (!pineconeService.isConfigured()) {
        console.warn("[Matching] Pinecone not configured, returning no match");
        return { userTask, bestMatch: null, confidence: "none" };
      }

      // Stage 1: Query Pinecone for top-5 candidates (search all tasks, no occupation filter)
      console.log("[Matching] Querying Pinecone for:", userTask.slice(0, 50));
      const candidates = await pineconeService.searchSimilar(userTask, 5);

      console.log("[Matching] Pinecone returned:", candidates.length, "candidates");
      if (candidates.length > 0) {
        console.log("[Matching] Top match:", candidates[0].fields.text.slice(0, 60), "score:", candidates[0]._score);
      }

      if (candidates.length === 0) {
        console.log("[Matching] No candidates found for:", userTask);
        return { userTask, bestMatch: null, confidence: "none" };
      }

      // Stage 2: LLM picks the best match
      const selection = await this.selectBestMatch(userTask, candidates);
      console.log("[Matching] LLM selection:", selection);

      if (!selection || selection.bestIndex < 0) {
        console.log("[Matching] No good match selected by LLM");
        return { userTask, bestMatch: null, confidence: "none" };
      }

      const best = candidates[selection.bestIndex];
      console.log("[Matching] Final match:", best.fields.text.slice(0, 60), "confidence:", selection.confidence);
      return {
        userTask,
        bestMatch: this.hitToMatch(best, selection.reasoning),
        confidence: selection.confidence,
      };
    } catch (error) {
      console.error("[Matching] Error:", error);
      return { userTask, bestMatch: null, confidence: "none" };
    }
  }

  /**
   * Match multiple tasks in batch
   */
  async matchTasksBatch(
    userTasks: string[],
    occupationCode?: string
  ): Promise<TaskMatchResult[]> {
    const results: TaskMatchResult[] = [];

    for (const task of userTasks) {
      const result = await this.matchTask(task, occupationCode);
      results.push(result);
    }

    return results;
  }

  /**
   * Convert Pinecone hit to ONetMatch
   */
  private hitToMatch(hit: PineconeSearchHit, reasoning?: string): ONetMatch {
    return {
      taskId: hit._id,
      taskStatement: hit.fields.text,
      occupationCode: hit.fields.occupation_code,
      occupationTitle: hit.fields.occupation_title,
      taskType: hit.fields.task_type as "Core" | "Supplemental",
      score: hit._score,
      reasoning,
    };
  }

  /**
   * LLM selects the single best match
   */
  private async selectBestMatch(
    userTask: string,
    candidates: PineconeSearchHit[]
  ): Promise<LLMSelectionResponse | null> {
    const systemPrompt = `You are matching a user's work task to standardized O*NET task statements.

Given the user's task description and a list of candidate O*NET tasks, pick the BEST match.

Guidelines:
- ALWAYS pick the candidate that most closely matches what the user described
- Consider the core activity - exact wording doesn't need to match
- A "policy analysis" task matches "evaluate policies" even if domains differ
- Only set bestIndex to -1 if the candidates are completely unrelated (e.g., user describes "cooking" but candidates are about "software engineering")

Respond in JSON format only:
{
  "bestIndex": 0,
  "confidence": "high",
  "reasoning": "Brief explanation of why this is the best match"
}

bestIndex: 0-based index of the best candidate (almost always 0-4), or -1 ONLY if truly unrelated
confidence: "high" (very close match), "medium" (related activity), "low" (loosely related)`;

    const candidateList = candidates
      .map((c, i) => `${i}. "${c.fields.text}" (${c.fields.occupation_title})`)
      .join("\n");

    const userPrompt = `User's task: "${userTask}"

Candidates:
${candidateList}

Pick the best match:`;

    try {
      const openai = this.getOpenAI();
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const content = response.choices[0]?.message?.content || "";

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn("[Matching] Failed to parse LLM response, using top result");
        return this.fallbackToTopCandidate(candidates);
      }

      const parsed: LLMSelectionResponse = JSON.parse(jsonMatch[0]);

      // Validate
      if (
        typeof parsed.bestIndex !== "number" ||
        !["high", "medium", "low", "none"].includes(parsed.confidence)
      ) {
        return this.fallbackToTopCandidate(candidates);
      }

      return parsed;
    } catch (error) {
      console.warn("[Matching] LLM selection failed:", error);
      return this.fallbackToTopCandidate(candidates);
    }
  }

  /**
   * Fallback when LLM fails
   */
  private fallbackToTopCandidate(
    candidates: PineconeSearchHit[]
  ): LLMSelectionResponse {
    if (candidates.length === 0) {
      return { bestIndex: -1, confidence: "none", reasoning: "No candidates" };
    }

    const topScore = candidates[0]._score;
    let confidence: MatchConfidence;
    if (topScore >= 0.6) confidence = "high";
    else if (topScore >= 0.45) confidence = "medium";
    else if (topScore >= 0.3) confidence = "low";
    else confidence = "none";

    // Always return the top match if we have candidates - Pinecone already filtered by relevance
    return {
      bestIndex: 0,
      confidence: confidence === "none" ? "low" : confidence,
      reasoning: `Selected by similarity score: ${topScore.toFixed(2)} (LLM fallback)`,
    };
  }
}

// Export singleton
export const matchingService = new MatchingService();
