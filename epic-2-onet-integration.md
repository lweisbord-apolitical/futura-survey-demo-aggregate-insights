# Epic 2: O*NET Integration & Matching

**Project:** Task Capture Survey Tool (Futura)
**Epic:** O*NET Data Integration & Semantic Task Matching
**Status:** V1 Implementation Spec

**Related Docs:**
- [Technical Implementation Plan](./technical-implementation.md)
- [Epic 1: Chat Interface](./epic-1-chat-interface.md) — uses task suggestions
- [Epic 3: Task Processing](./epic-3-task-processing.md) — uses embedding + LLM re-rank matching
- [Epic 5: Job Title Mapping](./epic-5-job-title-mapping.md) — uses occupation lookup

---

## Overview

This epic covers integrating O*NET data into the platform, including data ingestion, vector embeddings, and semantic matching APIs. This powers both the inline task suggestions in chat and the final task-to-O*NET matching.

### Goals

1. Ingest O*NET task statements (~18,000) into Pinecone with embeddings
2. Ingest O*NET occupations (~1,000) for job title matching
3. Store AI exposure scores as metadata for instant lookup
4. Provide fast semantic search for task suggestions
5. Provide batch matching for user tasks → O*NET tasks

### Data Sources

| Dataset | Records | Source |
|---------|---------|--------|
| Task Statements | ~19,265 | `Task Statements.xlsx` from O*NET |
| Occupations | ~1,016 | `Occupation Data.xlsx` from O*NET |
| GWA Mapping | ~41 | `Generalized Work Activities.xlsx` |
| AI Exposure | ~19,265 | Eloundou et al. "GPTs are GPTs" paper |
| Task-to-DWA | ~19,265 | `Tasks to DWAs.xlsx` (links tasks → activities) |

---

## Data Model

### O*NET Task Record (Pinecone)

```typescript
interface ONetTaskVector {
  id: string;                    // e.g., "11-1011.00_T1"
  values: number[];              // 1536-dim embedding (text-embedding-3-small)
  metadata: {
    taskId: string;              // Original task ID
    occupationCode: string;      // SOC code (e.g., "11-1011.00")
    occupationTitle: string;     // e.g., "Chief Executives"
    taskStatement: string;       // Full task text
    gwaId: string;               // GWA category ID
    gwaCategory: string;         // Our 4-category mapping
    gwaTitle: string;            // Full GWA title
    aiExposureScore: number;     // 0-1 from GPTs paper
    aiExposureLabel: string;     // "low" | "medium" | "high"
    importance: number;          // O*NET importance rating
    frequency: number;           // O*NET frequency rating (if available)
  };
}
```

### O*NET Occupation Record (Pinecone)

```typescript
interface ONetOccupationVector {
  id: string;                    // SOC code (e.g., "11-1011.00")
  values: number[];              // 1536-dim embedding
  metadata: {
    code: string;                // SOC code
    title: string;               // Occupation title
    description: string;         // Full description
    jobFamily: string;           // Job family code
    jobFamilyName: string;       // Job family name
    alternativeTitles: string[]; // Alternative job titles
  };
}
```

### GWA Category Mapping

O*NET has 41 Generalized Work Activities. We map them to 4 high-level categories:

```typescript
const GWA_CATEGORY_MAPPING: Record<string, string> = {
  // Information Input (GWA IDs 4.A.1.*)
  '4.A.1.a.1': 'informationInput',  // Getting Information
  '4.A.1.a.2': 'informationInput',  // Monitor Processes, Materials, or Surroundings
  '4.A.1.b.1': 'informationInput',  // Identifying Objects, Actions, and Events
  '4.A.1.b.2': 'informationInput',  // Inspecting Equipment, Structures, or Materials
  '4.A.1.c.1': 'informationInput',  // Estimating the Quantifiable Characteristics

  // Mental Processes (GWA IDs 4.A.2.*)
  '4.A.2.a.1': 'mentalProcesses',   // Judging the Qualities of Objects, Services, or People
  '4.A.2.a.2': 'mentalProcesses',   // Processing Information
  '4.A.2.a.3': 'mentalProcesses',   // Evaluating Information to Determine Compliance
  '4.A.2.a.4': 'mentalProcesses',   // Analyzing Data or Information
  '4.A.2.b.1': 'mentalProcesses',   // Making Decisions and Solving Problems
  '4.A.2.b.2': 'mentalProcesses',   // Thinking Creatively
  '4.A.2.b.3': 'mentalProcesses',   // Updating and Using Relevant Knowledge
  '4.A.2.b.4': 'mentalProcesses',   // Developing Objectives and Strategies
  '4.A.2.b.5': 'mentalProcesses',   // Scheduling Work and Activities
  '4.A.2.b.6': 'mentalProcesses',   // Organizing, Planning, and Prioritizing Work

  // Work Output (GWA IDs 4.A.3.*)
  '4.A.3.a.1': 'workOutput',        // Performing General Physical Activities
  '4.A.3.a.2': 'workOutput',        // Handling and Moving Objects
  '4.A.3.a.3': 'workOutput',        // Controlling Machines and Processes
  '4.A.3.a.4': 'workOutput',        // Operating Vehicles, Mechanized Devices
  '4.A.3.b.1': 'workOutput',        // Interacting With Computers
  '4.A.3.b.2': 'workOutput',        // Drafting, Laying Out, Specifying Technical Devices
  '4.A.3.b.4': 'workOutput',        // Repairing and Maintaining Mechanical Equipment
  '4.A.3.b.5': 'workOutput',        // Repairing and Maintaining Electronic Equipment
  '4.A.3.b.6': 'workOutput',        // Documenting/Recording Information

  // Interacting with Others (GWA IDs 4.A.4.*)
  '4.A.4.a.1': 'interactingWithOthers', // Interpreting the Meaning of Information for Others
  '4.A.4.a.2': 'interactingWithOthers', // Communicating with Supervisors, Peers, or Subordinates
  '4.A.4.a.3': 'interactingWithOthers', // Communicating with People Outside the Organization
  '4.A.4.a.4': 'interactingWithOthers', // Establishing and Maintaining Interpersonal Relationships
  '4.A.4.a.5': 'interactingWithOthers', // Assisting and Caring for Others
  '4.A.4.a.6': 'interactingWithOthers', // Selling or Influencing Others
  '4.A.4.a.7': 'interactingWithOthers', // Resolving Conflicts and Negotiating with Others
  '4.A.4.a.8': 'interactingWithOthers', // Performing for or Working Directly with the Public
  '4.A.4.b.1': 'interactingWithOthers', // Coordinating the Work and Activities of Others
  '4.A.4.b.2': 'interactingWithOthers', // Developing and Building Teams
  '4.A.4.b.3': 'interactingWithOthers', // Training and Teaching Others
  '4.A.4.b.4': 'interactingWithOthers', // Guiding, Directing, and Motivating Subordinates
  '4.A.4.b.5': 'interactingWithOthers', // Coaching and Developing Others
  '4.A.4.b.6': 'interactingWithOthers', // Provide Consultation and Advice to Others
  '4.A.4.c.1': 'interactingWithOthers', // Performing Administrative Activities
  '4.A.4.c.2': 'interactingWithOthers', // Staffing Organizational Units
  '4.A.4.c.3': 'interactingWithOthers', // Monitoring and Controlling Resources
};

export type GWACategory =
  | 'informationInput'
  | 'mentalProcesses'
  | 'workOutput'
  | 'interactingWithOthers';
```

---

## Data Ingestion Pipeline

### File Structure

```
backend/v2/apps/futura-api/src/
├── onet/
│   ├── onet.module.ts
│   ├── onet.controller.ts
│   ├── onet.service.ts
│   ├── onet-data.service.ts         # Data access layer
│   ├── onet-embedding.service.ts    # Embedding generation
│   ├── onet-ingestion.service.ts    # Data ingestion
│   └── dto/
│       ├── onet-task.dto.ts
│       ├── onet-occupation.dto.ts
│       └── onet-suggestion.dto.ts
├── scripts/
│   └── ingest-onet-data.ts          # One-time ingestion script
```

### Ingestion Script

```typescript
// scripts/ingest-onet-data.ts
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const BATCH_SIZE = 100;
const EMBEDDING_MODEL = 'text-embedding-3-small';

interface TaskRow {
  'O*NET-SOC Code': string;
  'Title': string;
  'Task ID': number;
  'Task': string;
  'Task Type': string;
  'Incumbents Responding': number;
  'Date': string;
  'Domain Source': string;
}

interface OccupationRow {
  'O*NET-SOC Code': string;
  'Title': string;
  'Description': string;
}

interface TaskToDWARow {
  'O*NET-SOC Code': string;
  'Task ID': number;
  'DWA ID': string;
  'DWA Title': string;
  'Date': string;
  'Domain Source': string;
}

interface AIExposureRow {
  occupation_code: string;
  task_id: string;
  exposure_score: number;
}

async function main() {
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  // Load data files
  console.log('Loading O*NET data files...');

  const tasksWorkbook = XLSX.readFile('data/onet/Task Statements.xlsx');
  const tasksSheet = tasksWorkbook.Sheets[tasksWorkbook.SheetNames[0]];
  const tasks: TaskRow[] = XLSX.utils.sheet_to_json(tasksSheet);

  const occupationsWorkbook = XLSX.readFile('data/onet/Occupation Data.xlsx');
  const occupationsSheet = occupationsWorkbook.Sheets[occupationsWorkbook.SheetNames[0]];
  const occupations: OccupationRow[] = XLSX.utils.sheet_to_json(occupationsSheet);

  const taskToDWAWorkbook = XLSX.readFile('data/onet/Tasks to DWAs.xlsx');
  const taskToDWASheet = taskToDWAWorkbook.Sheets[taskToDWAWorkbook.SheetNames[0]];
  const taskToDWAs: TaskToDWARow[] = XLSX.utils.sheet_to_json(taskToDWASheet);

  // Load AI exposure scores (from GPTs paper - need to obtain/create this mapping)
  const aiExposure: Map<string, number> = loadAIExposureScores();

  // Build lookup maps
  const occupationMap = new Map(
    occupations.map(o => [o['O*NET-SOC Code'], o])
  );

  const taskToDWAMap = new Map<string, string>();
  for (const mapping of taskToDWAs) {
    const key = `${mapping['O*NET-SOC Code']}_${mapping['Task ID']}`;
    // Use first DWA for the task (most relevant)
    if (!taskToDWAMap.has(key)) {
      taskToDWAMap.set(key, mapping['DWA ID']);
    }
  }

  // Create Pinecone indexes if they don't exist
  const tasksIndex = pinecone.index('onet-tasks');
  const occupationsIndex = pinecone.index('onet-occupations');

  // Ingest tasks
  console.log(`Ingesting ${tasks.length} tasks...`);

  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const batch = tasks.slice(i, i + BATCH_SIZE);

    // Generate embeddings
    const embeddings = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch.map(t => t.Task),
    });

    // Prepare vectors
    const vectors = batch.map((task, idx) => {
      const occCode = task['O*NET-SOC Code'];
      const taskKey = `${occCode}_${task['Task ID']}`;
      const dwaId = taskToDWAMap.get(taskKey) || '';
      const gwaCategory = mapDWAToGWACategory(dwaId);
      const occupation = occupationMap.get(occCode);
      const exposureScore = aiExposure.get(taskKey) || 0.5;

      return {
        id: `${occCode}_T${task['Task ID']}`,
        values: embeddings.data[idx].embedding,
        metadata: {
          taskId: String(task['Task ID']),
          occupationCode: occCode,
          occupationTitle: occupation?.Title || task.Title,
          taskStatement: task.Task,
          gwaId: dwaId,
          gwaCategory,
          gwaTitle: getGWATitle(dwaId),
          aiExposureScore: exposureScore,
          aiExposureLabel: getExposureLabel(exposureScore),
          importance: 3.0, // Default; would come from Importance ratings file
        },
      };
    });

    // Upsert to Pinecone
    await tasksIndex.upsert(vectors);

    console.log(`Ingested ${Math.min(i + BATCH_SIZE, tasks.length)}/${tasks.length} tasks`);
  }

  // Ingest occupations
  console.log(`Ingesting ${occupations.length} occupations...`);

  for (let i = 0; i < occupations.length; i += BATCH_SIZE) {
    const batch = occupations.slice(i, i + BATCH_SIZE);

    // Combine title and description for embedding
    const texts = batch.map(o => `${o.Title}. ${o.Description}`);

    const embeddings = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
    });

    const vectors = batch.map((occ, idx) => ({
      id: occ['O*NET-SOC Code'],
      values: embeddings.data[idx].embedding,
      metadata: {
        code: occ['O*NET-SOC Code'],
        title: occ.Title,
        description: occ.Description,
        jobFamily: occ['O*NET-SOC Code'].split('-')[0],
        jobFamilyName: getJobFamilyName(occ['O*NET-SOC Code']),
        alternativeTitles: [], // Would come from Alternate Titles file
      },
    }));

    await occupationsIndex.upsert(vectors);

    console.log(`Ingested ${Math.min(i + BATCH_SIZE, occupations.length)}/${occupations.length} occupations`);
  }

  console.log('Ingestion complete!');
}

function mapDWAToGWACategory(dwaId: string): GWACategory {
  // DWA IDs start with GWA prefix (e.g., "4.A.1.a.1" → informationInput)
  const gwaPrefix = dwaId.split('.').slice(0, 3).join('.');

  if (gwaPrefix === '4.A.1') return 'informationInput';
  if (gwaPrefix === '4.A.2') return 'mentalProcesses';
  if (gwaPrefix === '4.A.3') return 'workOutput';
  if (gwaPrefix === '4.A.4') return 'interactingWithOthers';

  return 'workOutput'; // Default fallback
}

function getExposureLabel(score: number): string {
  if (score < 0.33) return 'low';
  if (score < 0.66) return 'medium';
  return 'high';
}

function loadAIExposureScores(): Map<string, number> {
  // Load from preprocessed CSV of GPTs paper data
  // This would need to be created from the paper's supplementary materials
  const map = new Map<string, number>();

  try {
    const data = fs.readFileSync('data/ai-exposure-scores.csv', 'utf-8');
    const lines = data.split('\n').slice(1); // Skip header

    for (const line of lines) {
      const [occCode, taskId, score] = line.split(',');
      if (occCode && taskId && score) {
        map.set(`${occCode}_${taskId}`, parseFloat(score));
      }
    }
  } catch (e) {
    console.warn('AI exposure scores file not found, using defaults');
  }

  return map;
}

main().catch(console.error);
```

### Run Ingestion

```bash
# From backend/v2
pnpm ts-node apps/futura-api/src/scripts/ingest-onet-data.ts
```

---

## API Implementation

### O*NET Service

```typescript
// onet.service.ts
import { Injectable } from '@nestjs/common';
import { Pinecone } from '@pinecone-database/pinecone';
import { ConfigService } from '@nestjs/config';
import { ONetEmbeddingService } from './onet-embedding.service';
import type {
  ONetSuggestionRequest,
  ONetSuggestionResponse,
  ONetMatchRequest,
  ONetMatchResponse,
  ONetOccupationSearchRequest,
  ONetOccupationSearchResponse,
} from './dto';

@Injectable()
export class ONetService {
  private pinecone: Pinecone;
  private tasksIndex: ReturnType<Pinecone['index']>;
  private occupationsIndex: ReturnType<Pinecone['index']>;

  constructor(
    private readonly config: ConfigService,
    private readonly embedding: ONetEmbeddingService,
  ) {
    this.pinecone = new Pinecone({
      apiKey: this.config.get('PINECONE_API_KEY'),
    });
    this.tasksIndex = this.pinecone.index('onet-tasks');
    this.occupationsIndex = this.pinecone.index('onet-occupations');
  }

  /**
   * Get task suggestions for a job title, optionally filtered by GWA category
   */
  async getSuggestions(request: ONetSuggestionRequest): Promise<ONetSuggestionResponse> {
    const { jobTitle, occupationCode, gwaCategoryFilter, excludeIds = [], limit = 6 } = request;

    // If we have an occupation code, fetch tasks for that occupation
    if (occupationCode) {
      return this.getSuggestionsForOccupation(occupationCode, gwaCategoryFilter, excludeIds, limit);
    }

    // Otherwise, search by job title embedding
    const queryEmbedding = await this.embedding.embed(jobTitle);

    // First, find the closest occupation
    const occupationResults = await this.occupationsIndex.query({
      vector: queryEmbedding,
      topK: 1,
      includeMetadata: true,
    });

    if (occupationResults.matches.length === 0) {
      return { tasks: [] };
    }

    const matchedOccupation = occupationResults.matches[0];
    const occCode = matchedOccupation.metadata?.code as string;

    return this.getSuggestionsForOccupation(occCode, gwaCategoryFilter, excludeIds, limit);
  }

  private async getSuggestionsForOccupation(
    occupationCode: string,
    gwaCategoryFilter?: string,
    excludeIds: string[] = [],
    limit: number = 6,
  ): Promise<ONetSuggestionResponse> {
    // Build filter
    const filter: Record<string, any> = {
      occupationCode: { $eq: occupationCode },
    };

    if (gwaCategoryFilter) {
      filter.gwaCategory = { $eq: gwaCategoryFilter };
    }

    if (excludeIds.length > 0) {
      filter.taskId = { $nin: excludeIds };
    }

    // Query tasks for this occupation
    // Use a zero vector query with filter to get by metadata
    const results = await this.tasksIndex.query({
      vector: new Array(1536).fill(0), // Dummy vector
      topK: limit * 2, // Get more to allow filtering
      includeMetadata: true,
      filter,
    });

    // Sort by importance and take top N
    const tasks = results.matches
      .map(match => ({
        id: match.id,
        statement: match.metadata?.taskStatement as string,
        gwaCategory: match.metadata?.gwaCategory as string,
        occupationCode: match.metadata?.occupationCode as string,
        importance: match.metadata?.importance as number,
      }))
      .sort((a, b) => (b.importance || 0) - (a.importance || 0))
      .slice(0, limit);

    return { tasks };
  }

  /**
   * Match user-described tasks to O*NET tasks
   */
  async matchTasks(request: ONetMatchRequest): Promise<ONetMatchResponse> {
    const { userTasks, topK = 3 } = request;

    const matches = await Promise.all(
      userTasks.map(async (userTask) => {
        const embedding = await this.embedding.embed(userTask.description);

        const results = await this.tasksIndex.query({
          vector: embedding,
          topK,
          includeMetadata: true,
        });

        return {
          userTaskId: userTask.id,
          onetMatches: results.matches.map(match => ({
            taskId: match.id,
            statement: match.metadata?.taskStatement as string,
            similarity: match.score || 0,
            occupationCode: match.metadata?.occupationCode as string,
            occupationTitle: match.metadata?.occupationTitle as string,
            gwaCategory: match.metadata?.gwaCategory as string,
            aiExposureScore: match.metadata?.aiExposureScore as number,
            aiExposureLabel: match.metadata?.aiExposureLabel as string,
          })),
        };
      }),
    );

    return { matches };
  }

  /**
   * Search occupations by job title
   */
  async searchOccupations(request: ONetOccupationSearchRequest): Promise<ONetOccupationSearchResponse> {
    const { query, limit = 10 } = request;

    const embedding = await this.embedding.embed(query);

    const results = await this.occupationsIndex.query({
      vector: embedding,
      topK: limit,
      includeMetadata: true,
    });

    const occupations = results.matches.map(match => ({
      code: match.metadata?.code as string,
      title: match.metadata?.title as string,
      description: match.metadata?.description as string,
      similarity: match.score || 0,
    }));

    return { occupations };
  }
}
```

### Embedding Service

```typescript
// onet-embedding.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class ONetEmbeddingService {
  private openai: OpenAI;
  private model = 'text-embedding-3-small';

  // Simple in-memory cache for repeated queries
  private cache = new Map<string, number[]>();
  private cacheMaxSize = 1000;

  constructor(private readonly config: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.config.get('OPENAI_API_KEY'),
    });
  }

  async embed(text: string): Promise<number[]> {
    // Check cache
    const cacheKey = text.toLowerCase().trim();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Generate embedding
    const response = await this.openai.embeddings.create({
      model: this.model,
      input: text,
    });

    const embedding = response.data[0].embedding;

    // Add to cache (with size limit)
    if (this.cache.size >= this.cacheMaxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(cacheKey, embedding);

    return embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await this.openai.embeddings.create({
      model: this.model,
      input: texts,
    });

    return response.data.map(d => d.embedding);
  }
}
```

### Controller

```typescript
// onet.controller.ts
import { Controller } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { onet } from '@apolitical/contracts';
import { ONetService } from './onet.service';

@Controller()
export class ONetController {
  constructor(private readonly onetService: ONetService) {}

  @TsRestHandler(onet.getSuggestions)
  async getSuggestions() {
    return tsRestHandler(onet.getSuggestions, async ({ query }) => {
      const result = await this.onetService.getSuggestions({
        jobTitle: query.jobTitle,
        occupationCode: query.occupationCode,
        gwaCategoryFilter: query.gwaCategoryFilter,
        excludeIds: query.excludeIds?.split(',') || [],
        limit: query.limit ? parseInt(query.limit) : 6,
      });

      return { status: 200, body: result };
    });
  }

  @TsRestHandler(onet.matchTasks)
  async matchTasks() {
    return tsRestHandler(onet.matchTasks, async ({ body }) => {
      const result = await this.onetService.matchTasks(body);
      return { status: 200, body: result };
    });
  }

  @TsRestHandler(onet.searchOccupations)
  async searchOccupations() {
    return tsRestHandler(onet.searchOccupations, async ({ query }) => {
      const result = await this.onetService.searchOccupations({
        query: query.query,
        limit: query.limit ? parseInt(query.limit) : 10,
      });

      return { status: 200, body: result };
    });
  }
}
```

### Module

```typescript
// onet.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ONetController } from './onet.controller';
import { ONetService } from './onet.service';
import { ONetEmbeddingService } from './onet-embedding.service';

@Module({
  imports: [ConfigModule],
  controllers: [ONetController],
  providers: [ONetService, ONetEmbeddingService],
  exports: [ONetService],
})
export class ONetModule {}
```

---

## API Contract

```typescript
// backend/v2/libs/contracts/src/apis/futura-api/onet/onet.contract.ts
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

const onetTaskSuggestionSchema = z.object({
  id: z.string(),
  statement: z.string(),
  gwaCategory: z.string(),
  occupationCode: z.string(),
  importance: z.number().optional(),
});

const onetMatchSchema = z.object({
  taskId: z.string(),
  statement: z.string(),
  similarity: z.number(),
  occupationCode: z.string(),
  occupationTitle: z.string(),
  gwaCategory: z.string(),
  aiExposureScore: z.number(),
  aiExposureLabel: z.string(),
});

const occupationSchema = z.object({
  code: z.string(),
  title: z.string(),
  description: z.string(),
  similarity: z.number().optional(),
});

export const onet = c.router({
  getSuggestions: {
    method: 'GET',
    path: '/onet/suggestions',
    query: z.object({
      jobTitle: z.string(),
      occupationCode: z.string().optional(),
      gwaCategoryFilter: z.string().optional(),
      excludeIds: z.string().optional(), // Comma-separated
      limit: z.string().optional(),
    }),
    responses: {
      200: z.object({
        tasks: z.array(onetTaskSuggestionSchema),
      }),
    },
    summary: 'Get O*NET task suggestions for a job title',
  },

  matchTasks: {
    method: 'POST',
    path: '/onet/match',
    body: z.object({
      userTasks: z.array(z.object({
        id: z.string(),
        description: z.string(),
      })),
      topK: z.number().optional(),
    }),
    responses: {
      200: z.object({
        matches: z.array(z.object({
          userTaskId: z.string(),
          onetMatches: z.array(onetMatchSchema),
        })),
      }),
    },
    summary: 'Match user tasks to O*NET tasks',
  },

  searchOccupations: {
    method: 'GET',
    path: '/onet/occupations/search',
    query: z.object({
      query: z.string(),
      limit: z.string().optional(),
    }),
    responses: {
      200: z.object({
        occupations: z.array(occupationSchema),
      }),
    },
    summary: 'Search O*NET occupations by job title',
  },
});
```

---

## Pinecone Index Configuration

### Create Indexes (One-time setup)

```bash
# Using Pinecone CLI or dashboard

# Tasks index
pinecone create-index onet-tasks \
  --dimension 1536 \
  --metric cosine \
  --spec '{"serverless":{"cloud":"aws","region":"us-east-1"}}'

# Occupations index
pinecone create-index onet-occupations \
  --dimension 1536 \
  --metric cosine \
  --spec '{"serverless":{"cloud":"aws","region":"us-east-1"}}'
```

### Index Metadata Schema

For efficient filtering, define metadata field types:

```typescript
// Tasks index metadata
{
  taskId: 'string',
  occupationCode: 'string',
  occupationTitle: 'string',
  taskStatement: 'string',
  gwaId: 'string',
  gwaCategory: 'string',        // Filter field
  gwaTitle: 'string',
  aiExposureScore: 'number',
  aiExposureLabel: 'string',
  importance: 'number',
}

// Occupations index metadata
{
  code: 'string',
  title: 'string',
  description: 'string',
  jobFamily: 'string',
  jobFamilyName: 'string',
  alternativeTitles: 'string[]',
}
```

---

## AI Exposure Scores

The AI exposure scores come from the "GPTs are GPTs" paper (Eloundou et al., 2023). The paper provides task-level exposure scores.

### Data Mapping

```typescript
// Map paper's exposure scores to our format
interface AIExposureMapping {
  onetTaskId: string;
  alphaScore: number;      // Direct LLM exposure (0-1)
  betaScore: number;       // LLM + tool exposure (0-1)
  zetaScore: number;       // Combined exposure (0-1)
}

// We use zetaScore as our primary aiExposureScore
// Labels:
// - low: < 0.33
// - medium: 0.33 - 0.66
// - high: > 0.66
```

### If Scores Not Available

If we can't obtain the exact task-level scores from the paper, we can:

1. **Use occupation-level averages** from the paper's published data
2. **Estimate based on GWA category** (rough heuristic):

```typescript
const GWA_DEFAULT_EXPOSURE: Record<string, number> = {
  informationInput: 0.55,      // Moderate - reading/research can be AI-assisted
  mentalProcesses: 0.45,       // Lower - judgment still requires humans
  workOutput: 0.60,            // Higher - writing/documentation highly automatable
  interactingWithOthers: 0.35, // Lowest - interpersonal tasks resist automation
};
```

---

## Testing

### Unit Tests

```typescript
// onet.service.spec.ts
describe('ONetService', () => {
  let service: ONetService;
  let mockPinecone: jest.Mocked<Pinecone>;
  let mockEmbedding: jest.Mocked<ONetEmbeddingService>;

  beforeEach(() => {
    mockPinecone = createMockPinecone();
    mockEmbedding = createMockEmbeddingService();
    service = new ONetService(mockConfig, mockEmbedding);
  });

  describe('getSuggestions', () => {
    it('returns tasks for occupation code', async () => {
      mockPinecone.index('onet-tasks').query.mockResolvedValue({
        matches: [
          {
            id: '11-1011.00_T1',
            score: 1.0,
            metadata: {
              taskStatement: 'Direct and coordinate activities',
              gwaCategory: 'interactingWithOthers',
              occupationCode: '11-1011.00',
              importance: 4.5,
            },
          },
        ],
      });

      const result = await service.getSuggestions({
        jobTitle: 'CEO',
        occupationCode: '11-1011.00',
      });

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].statement).toBe('Direct and coordinate activities');
    });

    it('filters by GWA category', async () => {
      await service.getSuggestions({
        jobTitle: 'CEO',
        occupationCode: '11-1011.00',
        gwaCategoryFilter: 'mentalProcesses',
      });

      expect(mockPinecone.index('onet-tasks').query).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({
            gwaCategory: { $eq: 'mentalProcesses' },
          }),
        }),
      );
    });
  });

  describe('matchTasks', () => {
    it('returns top matches with scores', async () => {
      mockEmbedding.embed.mockResolvedValue(new Array(1536).fill(0.1));
      mockPinecone.index('onet-tasks').query.mockResolvedValue({
        matches: [
          {
            id: '11-1011.00_T1',
            score: 0.92,
            metadata: {
              taskStatement: 'Direct and coordinate activities',
              occupationCode: '11-1011.00',
              occupationTitle: 'Chief Executives',
              gwaCategory: 'interactingWithOthers',
              aiExposureScore: 0.35,
              aiExposureLabel: 'medium',
            },
          },
        ],
      });

      const result = await service.matchTasks({
        userTasks: [{ id: '1', description: 'I manage the company' }],
      });

      expect(result.matches[0].onetMatches[0].similarity).toBe(0.92);
      expect(result.matches[0].onetMatches[0].aiExposureScore).toBe(0.35);
    });
  });
});
```

### Integration Tests

```typescript
// onet.e2e-spec.ts
describe('O*NET API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('GET /onet/suggestions returns tasks', async () => {
    const response = await request(app.getHttpServer())
      .get('/onet/suggestions')
      .query({ jobTitle: 'Software Developer' })
      .expect(200);

    expect(response.body.tasks).toBeDefined();
    expect(response.body.tasks.length).toBeGreaterThan(0);
  });

  it('POST /onet/match returns matches with scores', async () => {
    const response = await request(app.getHttpServer())
      .post('/onet/match')
      .send({
        userTasks: [
          { id: '1', description: 'Write code and fix bugs' },
          { id: '2', description: 'Review pull requests' },
        ],
      })
      .expect(200);

    expect(response.body.matches).toHaveLength(2);
    expect(response.body.matches[0].onetMatches[0]).toHaveProperty('similarity');
    expect(response.body.matches[0].onetMatches[0]).toHaveProperty('aiExposureScore');
  });
});
```

---

## Performance Considerations

### Caching Strategy

```typescript
// Implement Redis cache for production
@Injectable()
export class ONetCacheService {
  constructor(private readonly redis: RedisService) {}

  async getCachedSuggestions(key: string): Promise<ONetTask[] | null> {
    const cached = await this.redis.get(`onet:suggestions:${key}`);
    return cached ? JSON.parse(cached) : null;
  }

  async cacheSuggestions(key: string, tasks: ONetTask[]): Promise<void> {
    await this.redis.set(
      `onet:suggestions:${key}`,
      JSON.stringify(tasks),
      'EX',
      3600, // 1 hour TTL
    );
  }
}
```

### Batch Embedding

For matching multiple tasks, use batch embedding to reduce API calls:

```typescript
async matchTasks(request: ONetMatchRequest): Promise<ONetMatchResponse> {
  const { userTasks } = request;

  // Batch embed all user tasks at once
  const embeddings = await this.embedding.embedBatch(
    userTasks.map(t => t.description),
  );

  // Then query Pinecone for each (can parallelize)
  const matches = await Promise.all(
    userTasks.map((task, idx) =>
      this.queryTaskMatches(task.id, embeddings[idx]),
    ),
  );

  return { matches };
}
```

---

## O*NET Data Licensing

O*NET data is in the public domain and free to use:

> "O*NET data and samples are available for download and are free to use. The O*NET database and samples are in the public domain."
> — [O*NET Resource Center](https://www.onetcenter.org/database.html)

**Requirements:**
- Must cite O*NET as source
- Should use current version (update quarterly)

**Citation:**
> O*NET 28.2 Database by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the O*NET Database License.

---

## Open Questions

1. **AI exposure scores:** Need to obtain/recreate task-level scores from GPTs paper
2. **Update frequency:** O*NET updates quarterly — automate ingestion?
3. **Occupation matching confidence:** What threshold to require user confirmation?
4. **Alternative titles:** Include in embedding or separate search?

---

## Dependencies

- **Pinecone:** Vector database (already in stack)
- **OpenAI:** Embeddings API
- **O*NET data files:** Download from onetcenter.org

---

## Estimated Effort

| Task | Estimate |
|------|----------|
| Data download & preparation | 1 day |
| Ingestion script | 2 days |
| Pinecone setup & config | 0.5 days |
| ONet service implementation | 2 days |
| API contracts | 0.5 days |
| Testing | 1.5 days |
| AI exposure score mapping | 1 day |
| **Total** | **~8.5 days (2 weeks)** |

---

## Implementation Tickets

### ONET-001: O*NET Data Download & Preparation

**Priority:** P0
**Estimate:** 1 day
**Depends on:** SETUP-001

#### Description

Download O*NET database files and prepare them for ingestion into Pinecone.

#### Acceptance Criteria

- [ ] Download O*NET 28.x database from onetcenter.org
- [ ] Extract relevant files: Task Statements, DWA Reference, Occupation Data
- [ ] Create Python/Node script to parse and transform data
- [ ] Output JSON files ready for embedding: `tasks.json`, `occupations.json`
- [ ] Map GWA categories to 4 simplified categories
- [ ] Document data schema and transformations

#### Files to Create

```
scripts/onet/
├── download-onet.sh           # Download script
├── parse-onet-data.py         # Parser script
├── gwa-category-mapping.json  # 41 → 4 category mapping
└── README.md                  # Instructions
```

#### Output Files

```
data/onet/
├── tasks.json                 # ~18,000 task statements
├── occupations.json           # ~1,000 occupations
└── gwa-categories.json        # Category reference
```

#### Data Schema

```typescript
// tasks.json entry
{
  "taskId": "T1.A.1.a.1",
  "statement": "Analyze...",
  "occupationCode": "11-1011.00",
  "occupationTitle": "Chief Executives",
  "dwaId": "4.A.1.a.1",
  "gwaCategory": "informationInput", // Simplified
  "gwaId": "1.A"
}
```

#### Reference Implementation

See "O*NET Data Model" and "GWA Category Mapping" sections in this document.

---

### ONET-002: Pinecone Index Setup

**Priority:** P0
**Estimate:** 0.5 days
**Depends on:** ONET-001

#### Description

Create and configure Pinecone indexes for O*NET tasks and occupations.

#### Acceptance Criteria

- [ ] Create `onet-tasks` index (dimension: 1536 for text-embedding-3-small)
- [ ] Create `onet-occupations` index (dimension: 1536)
- [ ] Configure metadata fields for filtering
- [ ] Document index configuration
- [ ] Set up environment variables

#### Pinecone Configuration

```typescript
// onet-tasks index
{
  name: 'onet-tasks',
  dimension: 1536,
  metric: 'cosine',
  metadata_config: {
    indexed: ['occupationCode', 'gwaCategory', 'aiExposureScore']
  }
}

// onet-occupations index
{
  name: 'onet-occupations',
  dimension: 1536,
  metric: 'cosine'
}
```

#### Environment Variables

```env
PINECONE_API_KEY=xxx
PINECONE_ENVIRONMENT=us-east1-gcp
PINECONE_INDEX_TASKS=onet-tasks
PINECONE_INDEX_OCCUPATIONS=onet-occupations
```

---

### ONET-003: Data Ingestion Script

**Priority:** P0
**Estimate:** 2 days
**Depends on:** ONET-001, ONET-002

#### Description

Create script to embed O*NET data and upload to Pinecone indexes.

#### Acceptance Criteria

- [ ] Script embeds all task statements using OpenAI
- [ ] Script uploads embeddings to `onet-tasks` index with metadata
- [ ] Script embeds occupation descriptions
- [ ] Script uploads to `onet-occupations` index
- [ ] Progress logging and error handling
- [ ] Resumable on failure (tracks progress)
- [ ] Batch processing to respect rate limits

#### Files to Create

```
scripts/onet/
├── ingest-to-pinecone.ts      # Main ingestion script
├── embed-batch.ts             # Batch embedding helper
└── upload-progress.json       # Resume state
```

#### Reference Implementation

See "Data Ingestion Script" section in this document.

#### Running

```bash
# Full ingestion
npm run ingest-onet

# Resume from checkpoint
npm run ingest-onet -- --resume
```

---

### ONET-004: O*NET Service Implementation

**Priority:** P0
**Estimate:** 2 days
**Depends on:** ONET-003, SETUP-001

#### Description

Implement the NestJS service that provides O*NET suggestions and matching capabilities.

#### Acceptance Criteria

- [ ] `onet.module.ts` exports `ONetService`
- [ ] `onet.service.ts` implements `getSuggestions()` method
- [ ] `onet.service.ts` implements `matchTasks()` method (for Epic 3)
- [ ] `onet-embedding.service.ts` wraps OpenAI embeddings
- [ ] Results include GWA category and AI exposure score
- [ ] Caching layer for common queries

#### Files to Create

```
futura-api/src/survey/onet/
├── onet.module.ts
├── onet.service.ts
├── onet-embedding.service.ts
├── onet-cache.service.ts
└── dto/
    ├── onet-suggestion.dto.ts
    └── onet-match.dto.ts
```

#### API Contract

```
backend/v2/libs/contracts/src/apis/futura-api/survey/onet.contract.ts
```

#### Reference Implementation

See `ONetService`, `ONetEmbeddingService` code blocks in this document.

#### Testing

- [ ] `getSuggestions()` returns tasks for valid occupation code
- [ ] `matchTasks()` returns O*NET matches with similarity scores
- [ ] GWA category filter works
- [ ] Results include AI exposure scores

---

### ONET-005: AI Exposure Score Integration

**Priority:** P1
**Estimate:** 1 day
**Depends on:** ONET-001

#### Description

Map AI exposure scores from GPTs paper to O*NET tasks and include in Pinecone metadata.

#### Acceptance Criteria

- [ ] Obtain or recreate GPTs paper task-level exposure scores
- [ ] Map scores to O*NET task IDs
- [ ] Include `aiExposureScore` in Pinecone metadata
- [ ] Document methodology and source
- [ ] Handle tasks without mapped scores (default value)

#### Files to Create

```
data/onet/
└── ai-exposure-scores.json    # TaskID → score mapping

scripts/onet/
└── map-ai-exposure.py         # Mapping script
```

#### Data Source

Eloundou et al. (2023) "GPTs are GPTs: An Early Look at the Labor Market Impact Potential of Large Language Models"

#### Note

If exact task-level scores unavailable, may need to:
1. Use occupation-level scores
2. Estimate based on task characteristics
3. Defer to V2
