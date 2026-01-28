# Epic 3: Task Processing Pipeline

**Project:** Task Capture Survey Tool (Futura)
**Epic:** Task Extraction, Deduplication, and O*NET Matching Pipeline
**Status:** V1 Implementation Spec

**Related Docs:**
- [Technical Implementation Plan](./technical-implementation.md)
- [Epic 1: Chat Interface](./epic-1-chat-interface.md) — provides chat history
- [Epic 2: O*NET Integration](./epic-2-onet-integration.md) — provides Pinecone index
- [Epic 4: Data Collection](./epic-4-data-collection.md) — consumes processed tasks

---

## Overview

This epic covers the backend pipeline that transforms raw chat conversation into a structured task list matched to O*NET. The pipeline runs after the chat phase completes.

### V1 Simplifications

| Original Plan | V1 Approach |
|---------------|-------------|
| Embedding-based dedup | LLM dedup (simpler) |
| Similarity-only matching | Top 10 + LLM re-rank (better accuracy) |
| User confirmation | No confirmation — LLM decides, we eval |
| Confidence scoring for UI | Internal only (for evals) |

### Goals

1. Extract discrete tasks from conversational input
2. Deduplicate using LLM (not embeddings)
3. Match each task to O*NET using embedding + LLM re-rank
4. Classify tasks by GWA category (from O*NET match)

### Pipeline Flow (V1)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       TASK PROCESSING PIPELINE (V1)                         │
└─────────────────────────────────────────────────────────────────────────────┘

  Chat History          Selected              Job Title
  (messages[])          Suggestions           (string)
       │                (onetTaskIds[])            │
       │                     │                     │
       ▼                     ▼                     │
┌──────────────────────────────────────┐          │
│           STAGE 1: EXTRACT           │          │
│              (LLM)                   │          │
│  Pull discrete tasks from chat       │          │
└──────────────────┬───────────────────┘          │
                   │                              │
                   │  raw_tasks[]                 │
                   ▼                              │
┌──────────────────────────────────────┐          │
│           STAGE 2: DEDUPE            │          │
│              (LLM)                   │          │
│  Send all to LLM, get IDs to remove  │          │
└──────────────────┬───────────────────┘          │
                   │                              │
                   │  unique_tasks[]              │
                   ▼                              │
┌──────────────────────────────────────┐          │
│           STAGE 3: MATCH             │◄─────────┘
│     (Embedding + LLM Re-rank)        │
│  Embed → Top 10 from Pinecone →      │
│  LLM picks best match                │
└──────────────────┬───────────────────┘
                   │
                   │  matched_tasks[]
                   ▼
┌──────────────────────────────────────┐
│          STAGE 4: CLASSIFY           │
│   Use O*NET match's GWA category     │
└──────────────────┬───────────────────┘
                   │
                   ▼
              ProcessedTaskList
```

---

## Data Structures

### Input

```typescript
interface ProcessTasksRequest {
  sessionId: string;
  chatHistory: ChatMessage[];
  jobTitle: string;
  occupationCode?: string;
  selectedSuggestions: string[];  // O*NET task IDs user tapped
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}
```

### Output

```typescript
interface ProcessTasksResponse {
  sessionId: string;
  tasks: ProcessedTask[];
  stats: ProcessingStats;
  needsReview: boolean;
}

interface ProcessedTask {
  id: string;                      // Generated UUID
  userDescription: string;         // Original user text
  normalizedDescription: string;   // Cleaned/standardized
  source: 'extracted' | 'suggestion';
  confidence: number;              // 0-1
  confidenceReasons: string[];     // Why this score
  gwaCategory: GWACategory;
  onetMatches: ONetMatch[];        // Top 3 matches
  extractedFrom?: string;          // Message ID if extracted
}

interface ONetMatch {
  taskId: string;
  statement: string;
  similarity: number;
  occupationCode: string;
  aiExposureScore: number;
}

interface ProcessingStats {
  rawExtracted: number;
  afterDedup: number;
  fromSuggestions: number;
  totalProcessed: number;
  lowConfidenceCount: number;
}
```

---

## File Structure (V1)

```
backend/v2/apps/futura-api/src/
├── task-processing/
│   ├── task-processing.module.ts
│   ├── task-processing.controller.ts
│   ├── task-processing.service.ts        # Orchestrator
│   ├── task-extractor.service.ts         # Stage 1: Extract (LLM)
│   ├── task-deduplicator.service.ts      # Stage 2: Dedupe (LLM)
│   ├── task-matcher.service.ts           # Stage 3: Match (Embed + LLM re-rank)
│   ├── task-classifier.service.ts        # Stage 4: Classify (from O*NET)
│   └── dto/
│       ├── process-tasks.dto.ts
│       └── processed-task.dto.ts
```

---

## Stage 1: Task Extraction

### Purpose

Extract discrete tasks from free-form conversational text using LLM.

### Implementation

```typescript
// task-extractor.service.ts
import { Injectable } from '@nestjs/common';
import { FuturaLLMService } from '../langchain/futura-llm.service';

interface RawExtractedTask {
  description: string;
  sourceMessageId: string;
  context: string;  // Surrounding text for disambiguation
}

@Injectable()
export class TaskExtractorService {
  constructor(private readonly llm: FuturaLLMService) {}

  async extract(
    chatHistory: ChatMessage[],
    jobTitle: string,
  ): Promise<RawExtractedTask[]> {
    // Filter to user messages only
    const userMessages = chatHistory.filter(m => m.role === 'user');

    if (userMessages.length === 0) {
      return [];
    }

    // Combine messages for context
    const conversationText = userMessages
      .map(m => m.content)
      .join('\n\n---\n\n');

    const prompt = this.buildExtractionPrompt(conversationText, jobTitle);
    const result = await this.llm.generateJSON<ExtractionResult>(prompt);

    return result.tasks.map(task => ({
      description: task.description,
      sourceMessageId: this.findSourceMessage(task.description, userMessages),
      context: task.context || '',
    }));
  }

  private buildExtractionPrompt(text: string, jobTitle: string): string {
    return `You are extracting work tasks from a conversation about someone's job.

Job title: ${jobTitle}

Conversation:
"""
${text}
"""

Extract ALL distinct work tasks mentioned. A task is a specific activity the person does as part of their job.

Rules:
1. Extract each task as a separate item
2. Use the person's own words where possible
3. Keep tasks atomic (one activity per task)
4. Include both explicit tasks ("I write reports") and implied tasks ("coordinating with the team" implies task: "Coordinate with team members")
5. Don't include personal opinions or feelings
6. Don't include things they DON'T do
7. Preserve important context (e.g., "quarterly" reports, not just "reports")

Output JSON format:
{
  "tasks": [
    {
      "description": "task description here",
      "context": "brief context if helpful for disambiguation"
    }
  ]
}

Extract all tasks now:`;
  }

  private findSourceMessage(
    taskDescription: string,
    messages: ChatMessage[],
  ): string {
    // Find which message most likely contains this task
    const taskWords = new Set(
      taskDescription.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    );

    let bestMatch = messages[0]?.id || '';
    let bestScore = 0;

    for (const message of messages) {
      const messageWords = message.content.toLowerCase().split(/\s+/);
      let matchCount = 0;

      for (const word of messageWords) {
        if (taskWords.has(word)) matchCount++;
      }

      if (matchCount > bestScore) {
        bestScore = matchCount;
        bestMatch = message.id;
      }
    }

    return bestMatch;
  }
}

interface ExtractionResult {
  tasks: Array<{
    description: string;
    context?: string;
  }>;
}
```

### Example

**Input:**
```
User: "I research policy topics, write briefing papers for ministers,
and coordinate with stakeholders across different agencies.
Lots of meetings and email chains to align everyone."

User: "Sometimes I have to quickly come up with alternatives when
ministers reject our advice, or redo impact assessments overnight."
```

**Output:**
```json
{
  "tasks": [
    { "description": "Research policy topics" },
    { "description": "Write briefing papers for ministers" },
    { "description": "Coordinate with stakeholders across different agencies" },
    { "description": "Attend meetings to align stakeholders" },
    { "description": "Manage email chains for stakeholder alignment" },
    { "description": "Develop alternative policy recommendations when initial advice is rejected" },
    { "description": "Conduct impact assessments", "context": "sometimes overnight on short notice" }
  ]
}
```

---

## Stage 2: Deduplication (LLM-based)

### Purpose

Remove duplicate or highly similar tasks using LLM judgment (simpler than embedding threshold tuning).

### V1 Approach

Instead of computing embeddings and comparing pairwise similarity, we send all tasks to an LLM in one call and ask it to identify duplicates to remove.

### Implementation

```typescript
// task-deduplicator.service.ts
import { Injectable } from '@nestjs/common';
import { FuturaLLMService } from '../langchain/futura-llm.service';

interface DeduplicatedTask {
  description: string;
  sourceMessageId: string;
}

@Injectable()
export class TaskDeduplicatorService {
  constructor(private readonly llm: FuturaLLMService) {}

  async deduplicate(tasks: RawExtractedTask[]): Promise<DeduplicatedTask[]> {
    if (tasks.length <= 1) {
      return tasks.map(t => ({
        description: t.description,
        sourceMessageId: t.sourceMessageId,
      }));
    }

    // Build numbered list for LLM
    const taskList = tasks
      .map((t, i) => `${i + 1}. "${t.description}"`)
      .join('\n');

    const prompt = `Here are extracted work tasks:
${taskList}

Which tasks are duplicates or near-duplicates of each other?
For each duplicate pair, return the NUMBER to REMOVE (keep the better-worded version).

Rules:
- "Write reports" and "Writing reports" are duplicates → remove the less clear one
- "Research policy" and "Research policy topics" are duplicates → keep the more specific one
- Tasks that are genuinely different should both be kept

Return ONLY a JSON array of numbers to remove, e.g. [2, 5, 7]
If no duplicates, return []`;

    const result = await this.llm.generateJSON<number[]>(prompt);
    const removeSet = new Set(result);

    // Filter out the duplicates
    return tasks
      .filter((_, i) => !removeSet.has(i + 1))
      .map(t => ({
        description: t.description,
        sourceMessageId: t.sourceMessageId,
      }));
  }
}
```

### Example

**Input:**
```
[
  "Write briefing papers for ministers",
  "Write policy briefs for ministerial review",  // Similar to #1
  "Coordinate with stakeholders",
  "Research policy topics",
  "Researching policy issues"  // Similar to #4
]
```

**LLM Response:**
```json
[2, 5]
```

**Reasoning:** Task 2 is similar to task 1 (keep 1, more specific). Task 5 is similar to task 4 (keep 4, better worded).

**Output:**
```
[
  "Write briefing papers for ministers",  // Kept (merged #2)
  "Coordinate with stakeholders",
  "Research policy topics"  // Kept (merged #5)
]
```

---

## Stage 3: O*NET Matching (Embedding + LLM Re-rank)

### Purpose

Match user tasks to O*NET task statements using a two-step process:
1. Embedding similarity to get top 10 candidates
2. LLM re-ranking to pick the best match

### V1 Approach

Instead of relying solely on embedding similarity (which can miss nuanced matches), we use LLM judgment to make the final selection from the top candidates.

### Implementation

```typescript
// task-matcher.service.ts
import { Injectable } from '@nestjs/common';
import { Pinecone } from '@pinecone-database/pinecone';
import { FuturaLLMService } from '../langchain/futura-llm.service';
import { ONetEmbeddingService } from '../onet/onet-embedding.service';

interface MatchedTask {
  description: string;
  sourceMessageId: string;
  onetMatch: ONetMatch | null;
}

interface ONetMatch {
  taskId: string;
  statement: string;
  gwaCategory: string;
  aiExposureScore: number;
  similarity: number;
}

@Injectable()
export class TaskMatcherService {
  private tasksIndex: ReturnType<Pinecone['index']>;

  constructor(
    private readonly llm: FuturaLLMService,
    private readonly embedding: ONetEmbeddingService,
    private readonly pinecone: Pinecone,
  ) {
    this.tasksIndex = this.pinecone.index('onet-tasks');
  }

  async matchTasks(tasks: DeduplicatedTask[]): Promise<MatchedTask[]> {
    return Promise.all(
      tasks.map(task => this.matchSingleTask(task))
    );
  }

  private async matchSingleTask(task: DeduplicatedTask): Promise<MatchedTask> {
    // Step 1: Embed the user task
    const taskEmbedding = await this.embedding.embed(task.description);

    // Step 2: Get top 10 candidates from Pinecone
    const candidates = await this.tasksIndex.query({
      vector: taskEmbedding,
      topK: 10,
      includeMetadata: true,
    });

    if (candidates.matches.length === 0) {
      return {
        description: task.description,
        sourceMessageId: task.sourceMessageId,
        onetMatch: null,
      };
    }

    // Step 3: LLM re-rank to pick best match
    const bestMatch = await this.rerankWithLLM(task.description, candidates.matches);

    return {
      description: task.description,
      sourceMessageId: task.sourceMessageId,
      onetMatch: bestMatch,
    };
  }

  private async rerankWithLLM(
    userTask: string,
    candidates: PineconeMatch[],
  ): Promise<ONetMatch | null> {
    // Build numbered list of candidates
    const candidateList = candidates
      .map((m, i) => `${i + 1}. "${m.metadata?.taskStatement}"`)
      .join('\n');

    const prompt = `User's work task: "${userTask}"

Which O*NET task from this list is the BEST match?

${candidateList}

Rules:
- Pick the task that most closely matches what the user actually does
- Consider the specific activities, not just general topic
- If none fit well, respond with 0

Respond with ONLY the number (1-10) of the best match, or 0 if none fit:`;

    const response = await this.llm.generate(prompt);
    const selectedIndex = parseInt(response.trim()) - 1;

    // Validate selection
    if (selectedIndex < 0 || selectedIndex >= candidates.length) {
      // LLM said "none fit" or invalid response
      // Fall back to top similarity match
      const topCandidate = candidates[0];
      if (topCandidate.score && topCandidate.score >= 0.7) {
        return this.candidateToMatch(topCandidate);
      }
      return null;
    }

    return this.candidateToMatch(candidates[selectedIndex]);
  }

  private candidateToMatch(candidate: PineconeMatch): ONetMatch {
    return {
      taskId: candidate.id,
      statement: candidate.metadata?.taskStatement as string,
      gwaCategory: candidate.metadata?.gwaCategory as string,
      aiExposureScore: candidate.metadata?.aiExposureScore as number,
      similarity: candidate.score || 0,
    };
  }
}
```

### Example

**User Task:** "Write briefing papers for ministers"

**Top 10 from Pinecone:**
```
1. "Prepare reports and presentations for board meetings" (0.82)
2. "Write policy briefs summarizing research findings" (0.79)
3. "Draft correspondence and official documents" (0.77)
4. "Develop written materials for public distribution" (0.75)
5. "Create executive summaries of complex reports" (0.74)
... (5 more)
```

**LLM Selection:** `2` (Write policy briefs)

**Reasoning:** While #1 has higher similarity, #2 is more semantically aligned with writing policy content for government officials.

---

## Stage 4: GWA Classification

### Purpose

Assign GWA category to each task based on its O*NET match.

### V1 Approach

Simply use the GWA category from the matched O*NET task. No separate classification needed.

### Implementation

```typescript
// task-classifier.service.ts
import { Injectable } from '@nestjs/common';

type GWACategory = 'informationInput' | 'mentalProcesses' | 'workOutput' | 'interactingWithOthers';

interface ClassifiedTask extends MatchedTask {
  gwaCategory: GWACategory;
}

@Injectable()
export class TaskClassifierService {
  classify(tasks: MatchedTask[]): ClassifiedTask[] {
    return tasks.map(task => ({
      ...task,
      gwaCategory: this.getCategory(task),
    }));
  }

  private getCategory(task: MatchedTask): GWACategory {
    // Use O*NET match's category if available
    if (task.onetMatch?.gwaCategory) {
      return task.onetMatch.gwaCategory as GWACategory;
    }

    // Default fallback for unmatched tasks
    return 'workOutput';
  }
}
```

---

## Orchestrator Service (V1 Simplified)

The V1 orchestrator is simplified — it runs 4 stages and relies on the O*NET match's GWA category (no separate normalization or confidence scoring for user review).

```typescript
// task-processing.service.ts
import { Injectable } from '@nestjs/common';
import { TaskExtractorService } from './task-extractor.service';
import { TaskDeduplicatorService } from './task-deduplicator.service';
import { TaskMatcherService } from './task-matcher.service';
import { TaskClassifierService } from './task-classifier.service';
import type { ProcessTasksRequest, ProcessTasksResponse, ProcessedTask } from './dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TaskProcessingService {
  constructor(
    private readonly extractor: TaskExtractorService,
    private readonly deduplicator: TaskDeduplicatorService,
    private readonly matcher: TaskMatcherService,
    private readonly classifier: TaskClassifierService,
  ) {}

  async process(request: ProcessTasksRequest): Promise<ProcessTasksResponse> {
    const { sessionId, chatHistory, jobTitle, selectedSuggestions } = request;

    // Stage 1: Extract tasks from chat (LLM)
    const rawExtracted = await this.extractor.extract(chatHistory, jobTitle);

    // Stage 2: Deduplicate (LLM)
    const deduped = await this.deduplicator.deduplicate(rawExtracted);

    // Add selected suggestions
    const withSuggestions = this.addSelectedSuggestions(deduped, selectedSuggestions);

    // Stage 3: Match to O*NET (Embedding + LLM re-rank)
    const matched = await this.matcher.matchTasks(withSuggestions);

    // Stage 4: Classify by GWA (from O*NET match)
    const classified = this.classifier.classify(matched);

    // Build final output
    const tasks: ProcessedTask[] = classified.map(task => ({
      id: uuidv4(),
      userDescription: task.description,
      normalizedDescription: task.description,
      source: task.source || 'extracted',
      gwaCategory: task.gwaCategory,
      onetMatch: task.onetMatch,
      extractedFrom: task.sourceMessageId,
    }));

    const stats = {
      rawExtracted: rawExtracted.length,
      afterDedup: deduped.length,
      fromSuggestions: selectedSuggestions.length,
      totalProcessed: tasks.length,
    };

    return {
      sessionId,
      tasks,
      stats,
    };
  }

  private addSelectedSuggestions(
    tasks: DeduplicatedTask[],
    suggestionIds: string[],
  ): Array<DeduplicatedTask & { source: 'extracted' | 'suggestion' }> {
    const fromChat = tasks.map(t => ({ ...t, source: 'extracted' as const }));

    // Suggestions are O*NET task IDs the user tapped during chat
    // In V1, we simply mark them — they already have O*NET matches
    const fromSuggestions = suggestionIds.map(id => ({
      description: id, // Would be actual statement from cache
      sourceMessageId: 'suggestion',
      source: 'suggestion' as const,
    }));

    return [...fromChat, ...fromSuggestions];
  }
}
```

---

## API Contract

```typescript
// backend/v2/libs/contracts/src/apis/futura-api/task-processing/task-processing.contract.ts
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.string(),
});

const onetMatchSchema = z.object({
  taskId: z.string(),
  statement: z.string(),
  similarity: z.number(),
  occupationCode: z.string(),
  aiExposureScore: z.number(),
});

// V1: Simplified schema without confidence scoring
const processedTaskSchema = z.object({
  id: z.string(),
  userDescription: z.string(),
  normalizedDescription: z.string(),
  source: z.enum(['extracted', 'suggestion']),
  gwaCategory: z.enum([
    'informationInput',
    'mentalProcesses',
    'workOutput',
    'interactingWithOthers',
  ]),
  onetMatch: onetMatchSchema.nullable(),  // Single best match from LLM re-rank
  extractedFrom: z.string().optional(),
});

const processingStatsSchema = z.object({
  rawExtracted: z.number(),
  afterDedup: z.number(),
  fromSuggestions: z.number(),
  totalProcessed: z.number(),
});

export const taskProcessing = c.router({
  processTasks: {
    method: 'POST',
    path: '/tasks/process',
    body: z.object({
      sessionId: z.string(),
      chatHistory: z.array(chatMessageSchema),
      jobTitle: z.string(),
      selectedSuggestions: z.array(z.string()),
    }),
    responses: {
      200: z.object({
        sessionId: z.string(),
        tasks: z.array(processedTaskSchema),
        stats: processingStatsSchema,
      }),
      400: z.object({ message: z.string() }),
    },
    summary: 'Process chat history into structured task list',
  },
});
```

---

## Controller

```typescript
// task-processing.controller.ts
import { Controller } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { taskProcessing } from '@apolitical/contracts';
import { TaskProcessingService } from './task-processing.service';

@Controller()
export class TaskProcessingController {
  constructor(private readonly service: TaskProcessingService) {}

  @TsRestHandler(taskProcessing.processTasks)
  async processTasks() {
    return tsRestHandler(taskProcessing.processTasks, async ({ body }) => {
      const result = await this.service.process(body);
      return { status: 200, body: result };
    });
  }
}
```

---

## Module (V1 Simplified)

```typescript
// task-processing.module.ts
import { Module } from '@nestjs/common';
import { TaskProcessingController } from './task-processing.controller';
import { TaskProcessingService } from './task-processing.service';
import { TaskExtractorService } from './task-extractor.service';
import { TaskDeduplicatorService } from './task-deduplicator.service';
import { TaskMatcherService } from './task-matcher.service';
import { TaskClassifierService } from './task-classifier.service';
import { ONetModule } from '../onet/onet.module';
import { LangchainModule } from '../langchain/langchain.module';

@Module({
  imports: [ONetModule, LangchainModule],
  controllers: [TaskProcessingController],
  providers: [
    TaskProcessingService,
    TaskExtractorService,
    TaskDeduplicatorService,
    TaskMatcherService,
    TaskClassifierService,
  ],
  exports: [TaskProcessingService],
})
export class TaskProcessingModule {}
```

---

## Testing

### Unit Tests

```typescript
// task-extractor.service.spec.ts
describe('TaskExtractorService', () => {
  it('extracts multiple tasks from single message', async () => {
    mockLLM.generateJSON.mockResolvedValue({
      tasks: [
        { description: 'Research policy topics' },
        { description: 'Write briefing papers' },
      ],
    });

    const result = await service.extract(
      [{ id: '1', role: 'user', content: 'I research policy and write briefings', timestamp: '' }],
      'Policy Advisor',
    );

    expect(result).toHaveLength(2);
    expect(result[0].description).toBe('Research policy topics');
  });
});

// task-deduplicator.service.spec.ts
describe('TaskDeduplicatorService', () => {
  it('merges similar tasks', async () => {
    mockEmbedding.embedBatch.mockResolvedValue([
      [0.9, 0.1],
      [0.91, 0.09],  // Very similar to first
      [0.1, 0.9],   // Different
    ]);

    const result = await service.deduplicate([
      { description: 'Write reports', sourceMessageId: '1' },
      { description: 'Writing reports', sourceMessageId: '2' },
      { description: 'Attend meetings', sourceMessageId: '3' },
    ]);

    expect(result).toHaveLength(2);
  });
});

// task-scorer.service.spec.ts
describe('TaskScorerService', () => {
  it('gives high score to well-matched tasks', () => {
    const task = {
      normalized: 'Write quarterly reports for management',
      source: 'extracted',
      onetMatches: [
        { taskId: '1', similarity: 0.85, gwaCategory: 'workOutput' },
      ],
      gwaCategory: 'workOutput',
    };

    const result = service.scoreTask(task);

    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.confidenceReasons).toContain('Strong O*NET match (85%)');
  });

  it('flags short descriptions', () => {
    const task = {
      normalized: 'Do stuff',
      source: 'extracted',
      onetMatches: [],
      gwaCategory: 'workOutput',
    };

    const result = service.scoreTask(task);

    expect(result.confidence).toBeLessThan(0.5);
    expect(result.confidenceReasons).toContain('Task description too short');
  });
});
```

### Integration Test

```typescript
// task-processing.e2e-spec.ts
describe('Task Processing API (e2e)', () => {
  it('processes chat into structured tasks', async () => {
    const response = await request(app.getHttpServer())
      .post('/tasks/process')
      .send({
        sessionId: 'test-123',
        chatHistory: [
          {
            id: '1',
            role: 'user',
            content: 'I write policy briefs and coordinate with stakeholders',
            timestamp: new Date().toISOString(),
          },
        ],
        jobTitle: 'Policy Advisor',
        selectedSuggestions: [],
      })
      .expect(200);

    expect(response.body.tasks.length).toBeGreaterThan(0);
    expect(response.body.tasks[0]).toHaveProperty('normalizedDescription');
    expect(response.body.tasks[0]).toHaveProperty('confidence');
    expect(response.body.tasks[0]).toHaveProperty('gwaCategory');
    expect(response.body.stats.rawExtracted).toBeGreaterThan(0);
  });
});
```

---

## Error Handling

```typescript
// task-processing.service.ts
async process(request: ProcessTasksRequest): Promise<ProcessTasksResponse> {
  try {
    // ... pipeline stages

  } catch (error) {
    // Log detailed error
    this.logger.error('Task processing failed', {
      sessionId: request.sessionId,
      error: error.message,
      stack: error.stack,
    });

    // Return graceful degradation
    if (error instanceof LLMError) {
      // LLM failed - return raw extracted tasks without normalization
      return this.fallbackProcess(request);
    }

    if (error instanceof EmbeddingError) {
      // Embeddings failed - skip dedup and matching
      return this.fallbackProcessNoEmbeddings(request);
    }

    throw new InternalServerErrorException('Task processing failed');
  }
}

private async fallbackProcess(request: ProcessTasksRequest): Promise<ProcessTasksResponse> {
  // Minimal processing without LLM
  const tasks = this.extractBasicTasks(request.chatHistory);

  return {
    sessionId: request.sessionId,
    tasks: tasks.map(t => ({
      id: uuidv4(),
      userDescription: t,
      normalizedDescription: t,
      source: 'extracted',
      confidence: 0.3,
      confidenceReasons: ['Processed with fallback (LLM unavailable)'],
      gwaCategory: 'workOutput',
      onetMatches: [],
    })),
    stats: {
      rawExtracted: tasks.length,
      afterDedup: tasks.length,
      fromSuggestions: 0,
      totalProcessed: tasks.length,
      lowConfidenceCount: tasks.length,
    },
    needsReview: true,
  };
}
```

---

## Performance Considerations

### Parallelization

```typescript
// Run independent stages in parallel where possible
async process(request: ProcessTasksRequest): Promise<ProcessTasksResponse> {
  // Stage 1: Extract (must be first)
  const rawExtracted = await this.extractor.extract(chatHistory, jobTitle);

  // Stage 2 & prep for 3 can run in parallel
  const [deduped, suggestionDetails] = await Promise.all([
    this.deduplicator.deduplicate(rawExtracted),
    this.fetchSuggestionDetails(selectedSuggestions),
  ]);

  // Continue with rest of pipeline...
}
```

### Caching

```typescript
// Cache O*NET matches for common tasks
@Injectable()
export class TaskMatchCache {
  private cache = new LRUCache<string, ONetMatch[]>({
    max: 500,
    ttl: 1000 * 60 * 60, // 1 hour
  });

  async getOrMatch(
    description: string,
    onetService: ONetService,
  ): Promise<ONetMatch[]> {
    const key = description.toLowerCase().trim();

    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const matches = await onetService.matchTasks({
      userTasks: [{ id: '0', description }],
    });

    const result = matches.matches[0]?.onetMatches || [];
    this.cache.set(key, result);

    return result;
  }
}
```

---

## Open Questions

1. **Splitting long tasks:** Should we split tasks that seem to contain multiple activities?
2. **Minimum tasks:** What if extraction yields < 3 tasks? Force user back to chat?
3. **Eval dataset:** Who creates the ground truth for matching evals?
4. **Caching strategy:** How long to cache O*NET matches?
5. **LLM re-rank threshold:** If LLM says "none fit" (returns 0), should we use top similarity as fallback?

---

## Dependencies

- **Epic 2:** O*NET Pinecone index + embedding service
- **Langchain:** LLM service for extraction, deduplication, and re-ranking
- **OpenAI:** Embeddings for task matching (text-embedding-3-small)

---

## Estimated Effort

### V1 (Simplified Pipeline)

| Task | Estimate |
|------|----------|
| Task extractor service (LLM) | 2 days |
| Deduplicator service (LLM) | 0.5 days |
| Matcher service (Embed + LLM re-rank) | 2 days |
| Classifier service (from O*NET) | 0.5 days |
| Orchestrator & controller | 1 day |
| API contract | 0.5 days |
| Testing | 1.5 days |
| **Total (V1)** | **~8 days (~1.5 weeks)** |

### V2 (User Confirmation) - Deferred

| Task | Estimate |
|------|----------|
| Confidence scoring service | 1 day |
| User review UI integration | 1.5 days |
| Match confirmation flow | 1 day |
| **Total (V2 additional)** | **~3.5 days** |

---

## Implementation Tickets

### PROC-001: Task Extractor Service

**Priority:** P0
**Estimate:** 2 days
**Depends on:** SETUP-001

#### Description

Implement the LLM-based service that extracts discrete tasks from chat conversation history.

#### Acceptance Criteria

- [ ] `task-extractor.service.ts` implements `extract()` method
- [ ] Takes chat history + job title as input
- [ ] Returns array of extracted tasks with source message IDs
- [ ] Uses structured JSON output from LLM
- [ ] Handles edge cases (empty chat, no tasks mentioned)

#### Files to Create

```
futura-api/src/survey/task-processing/
├── task-extractor.service.ts
└── prompts/
    └── task-extraction.prompt.ts
```

#### Reference Implementation

See `TaskExtractorService` code block in this document.

#### LLM Prompt

See `buildExtractionPrompt()` in the "Stage 1: Task Extraction" section.

#### Testing

- [ ] Extracts multiple tasks from single message
- [ ] Preserves user wording
- [ ] Keeps tasks atomic (splits compound tasks)
- [ ] Returns empty array for non-task messages

---

### PROC-002: Task Deduplicator Service (LLM)

**Priority:** P0
**Estimate:** 0.5 days
**Depends on:** PROC-001

#### Description

Implement LLM-based deduplication that identifies and removes duplicate/similar tasks.

#### Acceptance Criteria

- [ ] `task-deduplicator.service.ts` implements `deduplicate()` method
- [ ] Sends all tasks to LLM in single call
- [ ] LLM returns array of task indices to remove
- [ ] Keeps better-worded version of duplicates
- [ ] Handles empty/single task lists

#### Files to Create

```
futura-api/src/survey/task-processing/
└── task-deduplicator.service.ts
```

#### Reference Implementation

See `TaskDeduplicatorService` code block in this document.

#### LLM Prompt

```
Here are extracted work tasks:
1. "Write reports"
2. "Writing reports"
3. "Attend meetings"

Which are duplicates? Return JSON array of numbers to remove: [2]
```

#### Testing

- [ ] Removes obvious duplicates ("Write reports" / "Writing reports")
- [ ] Keeps genuinely different tasks
- [ ] Returns original list if no duplicates

---

### PROC-003: Task Matcher Service (Embed + LLM Re-rank)

**Priority:** P0
**Estimate:** 2 days
**Depends on:** ONET-003, PROC-002

#### Description

Implement two-stage matching: embedding similarity for top 10 candidates, then LLM re-rank to pick best match.

#### Acceptance Criteria

- [ ] `task-matcher.service.ts` implements `matchTasks()` method
- [ ] Step 1: Embed user task, query Pinecone for top 10
- [ ] Step 2: LLM picks best match from candidates
- [ ] Returns O*NET task ID, statement, similarity, GWA category, AI exposure
- [ ] Handles no-match case (LLM returns 0)
- [ ] Fallback to top similarity if LLM fails

#### Files to Create

```
futura-api/src/survey/task-processing/
├── task-matcher.service.ts
└── prompts/
    └── match-rerank.prompt.ts
```

#### Reference Implementation

See `TaskMatcherService` and `rerankWithLLM()` code blocks in this document.

#### Key Logic

```typescript
// 1. Embed user task
const embedding = await this.embedding.embed(task.description);

// 2. Get top 10 from Pinecone
const candidates = await this.tasksIndex.query({ vector: embedding, topK: 10 });

// 3. LLM picks best
const bestMatch = await this.rerankWithLLM(task.description, candidates);
```

#### Testing

- [ ] Returns O*NET match for valid task description
- [ ] LLM re-rank improves on pure similarity
- [ ] Handles "none fit" response from LLM
- [ ] Batch matching works for multiple tasks

---

### PROC-004: Task Classifier Service

**Priority:** P1
**Estimate:** 0.5 days
**Depends on:** PROC-003

#### Description

Classify tasks by GWA category using the matched O*NET task's category.

#### Acceptance Criteria

- [ ] `task-classifier.service.ts` implements `classify()` method
- [ ] Uses O*NET match's GWA category if available
- [ ] Defaults to 'workOutput' for unmatched tasks
- [ ] Returns classified task array

#### Files to Create

```
futura-api/src/survey/task-processing/
└── task-classifier.service.ts
```

#### Reference Implementation

See `TaskClassifierService` code block in this document.

#### Note

V1 is simple — just use O*NET match category. V2 could add LLM fallback for unmatched tasks.

---

### PROC-005: Processing Orchestrator & Controller

**Priority:** P0
**Estimate:** 1 day
**Depends on:** PROC-001, PROC-002, PROC-003, PROC-004

#### Description

Build the orchestrator service that chains all pipeline stages and the controller that exposes the API.

#### Acceptance Criteria

- [ ] `task-processing.service.ts` orchestrates Extract → Dedupe → Match → Classify
- [ ] `task-processing.controller.ts` exposes `POST /api/futura-api/survey/tasks/process`
- [ ] Request/response matches ts-rest contract
- [ ] Returns processing stats (counts at each stage)
- [ ] Error handling with graceful degradation

#### Files to Create

```
futura-api/src/survey/task-processing/
├── task-processing.module.ts
├── task-processing.controller.ts
├── task-processing.service.ts
└── dto/
    ├── process-tasks.dto.ts
    └── processed-task.dto.ts
```

#### API Contract

```
backend/v2/libs/contracts/src/apis/futura-api/survey/task-processing.contract.ts
```

#### Reference Implementation

See `TaskProcessingService` (V1 Simplified) code block in this document.

#### Testing

- [ ] Full pipeline processes chat into task list
- [ ] Stats accurately reflect each stage
- [ ] Handles empty chat gracefully
- [ ] Returns within reasonable time (~5s for typical input)
