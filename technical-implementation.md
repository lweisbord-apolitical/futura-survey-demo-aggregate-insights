# Technical Implementation Plan

**Project:** Task Capture Survey Tool (Futura)
**Version:** 1.0
**Status:** V1 Implementation Plan

---

## Overview

This document outlines the technical implementation for the chat-based task capture survey tool, building on the existing **Futura** platform at apolitical.co.

### V1 Scope

V1 focuses on core task capture and O*NET matching without user confirmation flows. We'll validate with evals before adding user-facing review.

| Feature | V1 Status |
|---------|-----------|
| Chat-based task capture | ✅ In scope |
| Agentic LLM-driven conversation | ✅ In scope |
| O*NET task matching | ✅ In scope (LLM re-rank) |
| Time allocation input | ✅ In scope |
| AI usage input | ✅ In scope |
| User task review/editing | ❌ Deferred |
| User confirmation of O*NET match | ❌ Deferred |
| Occupation selection UI | ❌ Deferred (optional lookup) |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER FLOW (V1)                                 │
└─────────────────────────────────────────────────────────────────────────────┘

  Job Title Input          Chat Interface           Data Collection
  ───────────────          ──────────────           ───────────────
  [CSV lookup]       →     [Agentic chat]     →    [Time % + AI usage]
  (optional match)         [Voice support]          [Per task]
                           [Inline suggestions]
                                  │
                                  ▼
                          Task Processing
                          ───────────────
                          [LLM Extract]
                          [LLM Dedupe]
                          [Embed + LLM Re-rank]
                                  │
                                  ▼
                             Storage
                          ───────────────
                          [Supabase]
                          [Analytics]
```

---

## Codebase Context

| Item | Value |
|------|-------|
| **Frontend** | `frontend/v2/apps/futura-ui` (Next.js 14, App Router) |
| **Backend** | `backend/v2/apps/futura-api` (NestJS 11) |
| **Monorepo** | Nx |
| **Language** | TypeScript (strict) |
| **Styling** | Tailwind CSS 4 + Radix UI |
| **State** | React Context + TanStack Query |
| **Forms** | TanStack Form + Zod |
| **API Contracts** | ts-rest |
| **Database** | Supabase (PostgreSQL) |
| **Vector DB** | Pinecone |
| **LLM** | Langchain + OpenAI |
| **Embeddings** | OpenAI text-embedding-3-small |
| **i18n** | next-intl (18+ languages) |

---

## Epic Summary (V1)

| Epic | Doc | Description | V1 Estimate |
|------|-----|-------------|-------------|
| 1 | [epic-1-chat-interface.md](./epic-1-chat-interface.md) | Chat UI + Agentic conversation | ~14 days |
| 2 | [epic-2-onet-integration.md](./epic-2-onet-integration.md) | O*NET data ingestion + Pinecone | ~8 days |
| 3 | [epic-3-task-processing.md](./epic-3-task-processing.md) | LLM extract → dedupe → match (re-rank) | ~8 days |
| 4 | [epic-4-data-collection.md](./epic-4-data-collection.md) | Time % + AI usage (read-only tasks) | ~8 days |
| 5 | [epic-5-job-title-mapping.md](./epic-5-job-title-mapping.md) | Job title CSV lookup | ~3 days |
| **Total (V1)** | | | **~41 days (~8 weeks)** |

---

## Epic 1: Chat Interface & Agent

**Doc:** [epic-1-chat-interface.md](./epic-1-chat-interface.md)

Build the conversational UI and agentic chatbot for task capture.

### Key Components
- Chat UI with voice input
- Agent state management
- LLM-driven tool selection
- Inline O*NET task suggestions
- Completeness checking (LLM judges if tasks seem complete)

### Agent Logic (V1)
```
Turn 1 → open_ended_prompt

Each turn:
  1. Analyze user response (engagement, activities mentioned)
  2. Ask LLM: "Does this seem complete for a {job_title}?"
  3. If complete + high confidence → offer_to_proceed
  4. If gaps identified → use LLM's suggested question
  5. If low engagement → show_suggestions
  6. If user says "done" → proceed
```

### Key Endpoints
- `POST /api/futura-api/chat/message` — Send message, get agent response

---

## Epic 2: O*NET Integration & Matching

**Doc:** [epic-2-onet-integration.md](./epic-2-onet-integration.md)

O*NET data ingestion and semantic matching infrastructure.

### Key Components
- Pinecone indexes (tasks, occupations)
- OpenAI embeddings service
- GWA category mapping (41 → 4 categories)
- AI exposure scores (metadata)

### Data
| Index | Records | Content |
|-------|---------|---------|
| `onet-tasks` | ~18,000 | Task statements + metadata |
| `onet-occupations` | ~1,000 | Occupation titles + descriptions |

### Key Endpoints
- `GET /api/futura-api/onet/suggestions` — Get task suggestions for job title
- `POST /api/futura-api/onet/match` — Match user tasks to O*NET (internal)

---

## Epic 3: Task Processing Pipeline

**Doc:** [epic-3-task-processing.md](./epic-3-task-processing.md)

Backend pipeline: chat → structured tasks → O*NET matches.

### V1 Pipeline (Simplified)
```
Stage 1: EXTRACT (LLM)
    └── Pull discrete tasks from chat conversation

Stage 2: DEDUPE (LLM)
    └── Send all tasks to LLM, ask which IDs to remove

Stage 3: MATCH (Embedding + LLM Re-rank)
    └── Embed task → Top 10 from Pinecone → LLM picks best

Stage 4: CLASSIFY
    └── Use matched O*NET task's GWA category
```

### No User Confirmation in V1
- LLM makes the match decision
- We evaluate accuracy with evals
- User review UI deferred to V2

### Key Endpoints
- `POST /api/futura-api/tasks/process` — Process chat into task list

---

## Epic 4: Data Collection UI

**Doc:** [epic-4-data-collection.md](./epic-4-data-collection.md)

Collect time allocation and AI usage per task.

### V1 Scope
- Display processed tasks (read-only in V1)
- Time % input per task (slider)
- AI usage frequency (5-point scale)
- AI usage description (optional free text)
- Submit and store

### Deferred to V2
- Task editing
- Task reordering
- Add/remove tasks
- Confidence badges

### Key Endpoints
- `POST /api/futura-api/task-responses/submit` — Submit final data

---

## Epic 5: Job Title & Occupation Mapping

**Doc:** [epic-5-job-title-mapping.md](./epic-5-job-title-mapping.md)

Simple job title input with optional O*NET lookup.

### V1 Approach
- User types job title (free text)
- CSV lookup for common titles → O*NET code
- No occupation selection UI
- Proceed with or without match

### Job Titles CSV Format
```csv
common_title,onet_code,onet_title,confidence
"Policy Advisor",13-1199.02,"Policy Analysts",0.95
"Software Engineer",15-1252.00,"Software Developers",0.95
```

### Key Endpoints
- CSV loaded at build time or via simple lookup endpoint

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] O*NET data ingestion into Pinecone (Epic 2)
- [ ] Job titles CSV creation (Epic 5)
- [ ] Basic chat UI scaffolding (Epic 1)
- [ ] LLM service setup (shared)

### Phase 2: Chat Agent (Week 3-4)
- [ ] Agent state management (Epic 1)
- [ ] Completeness checking logic (Epic 1)
- [ ] Chat API endpoint (Epic 1)
- [ ] Voice input integration (Epic 1)
- [ ] Inline suggestions (Epic 1 + 2)

### Phase 3: Task Processing (Week 5-6)
- [ ] LLM extraction service (Epic 3)
- [ ] LLM deduplication (Epic 3)
- [ ] Embedding + LLM re-rank matching (Epic 3)
- [ ] GWA classification (Epic 3)

### Phase 4: Data Collection (Week 7)
- [ ] Task display UI (Epic 4)
- [ ] Time allocation input (Epic 4)
- [ ] AI usage input (Epic 4)
- [ ] Submission endpoint (Epic 4)

### Phase 5: Polish & Eval (Week 8)
- [ ] i18n for all new UI
- [ ] Error handling
- [ ] Analytics events (PostHog)
- [ ] Evaluation framework for matching accuracy
- [ ] End-to-end testing

---

## API Contract Summary

### New Contracts

| Contract File | Endpoints |
|---------------|-----------|
| `chat.contract.ts` | `POST /chat/message` |
| `onet.contract.ts` | `GET /onet/suggestions` |
| `task-processing.contract.ts` | `POST /tasks/process` |
| `task-responses.contract.ts` | `POST /task-responses/submit` |

### Contract Location
```
backend/v2/libs/contracts/src/apis/futura-api/
├── chat/
│   └── chat.contract.ts
├── onet/
│   └── onet.contract.ts
├── task-processing/
│   └── task-processing.contract.ts
└── task-responses/
    └── task-responses.contract.ts
```

---

## Database Schema (New Tables)

```sql
-- Task assessments (parent record)
CREATE TABLE task_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id TEXT,
  job_title TEXT NOT NULL,
  occupation_code TEXT,
  submitted_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task responses (per-task data)
CREATE TABLE task_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID REFERENCES task_assessments(id),
  user_description TEXT NOT NULL,
  normalized_description TEXT,
  gwa_category TEXT,
  time_percentage DECIMAL(5,2),
  ai_frequency TEXT,
  ai_description TEXT,
  onet_task_id TEXT,
  onet_similarity DECIMAL(4,3),
  ai_exposure_score DECIMAL(4,3),
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job titles lookup (from CSV)
CREATE TABLE job_titles_lookup (
  id SERIAL PRIMARY KEY,
  common_title TEXT NOT NULL,
  onet_code TEXT,
  onet_title TEXT,
  confidence DECIMAL(3,2),
  UNIQUE(common_title)
);
```

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Embedding model | OpenAI text-embedding-3-small | Good balance of quality/cost |
| Deduplication | LLM-based | Simpler than embedding threshold tuning |
| O*NET matching | Top 10 + LLM re-rank | Better accuracy than similarity alone |
| Exit logic | LLM completeness check | More flexible than rigid thresholds |
| Job title matching | CSV lookup | Simple, controllable, no UI needed |
| User confirmation | Deferred | Validate with evals first |

---

## Dependencies Between Epics

```
Epic 5 (Job Title)
    └── Provides: jobTitle, occupationCode (optional)
            │
            ▼
Epic 1 (Chat) ◄──────── Epic 2 (O*NET)
    └── Provides:        └── Provides:
        chatHistory,         task suggestions,
        selectedSuggestions  occupation lookup
            │
            ▼
Epic 3 (Processing) ◄─── Epic 2 (O*NET)
    └── Provides:         └── Provides:
        ProcessedTask[]       embedding service,
                              matching
            │
            ▼
Epic 4 (Data Collection)
    └── Provides:
        Final submission
```

---

## Evaluation Framework (V1)

Since we're not showing users the O*NET matches in V1, we need evals:

### Matching Accuracy Eval
```typescript
// eval/matching-accuracy.ts
interface EvalCase {
  userTask: string;
  expectedOnetId: string;  // Human-labeled ground truth
  acceptableAlternatives?: string[];
}

async function evalMatchingAccuracy(cases: EvalCase[]) {
  let correct = 0;

  for (const case of cases) {
    const result = await matchTask(case.userTask);
    const isCorrect = result.onetTaskId === case.expectedOnetId
      || case.acceptableAlternatives?.includes(result.onetTaskId);

    if (isCorrect) correct++;
  }

  return correct / cases.length;
}
```

### Completeness Eval
```typescript
// eval/completeness.ts
interface CompletenessCase {
  jobTitle: string;
  taskList: string[];
  expectedComplete: boolean;
  expectedGaps?: string[];
}

async function evalCompleteness(cases: CompletenessCase[]) {
  // Test if LLM correctly identifies complete vs incomplete task lists
}
```

---

## Open Questions

1. **Voice transcription** — Browser Web Speech API (free) or Whisper (better quality)?
2. **Chat persistence** — Store in Supabase or ephemeral?
3. **AI exposure data** — Do we have GPTs paper task-level scores?
4. **Eval dataset** — Who creates the ground truth for matching evals?

---

## Ticket: SETUP-001 - Project Setup & Integration

**Priority:** P0 (Blocker)
**Estimate:** 1-2 days
**Assignee:** [Engineer]

### Description

Set up the new Survey Tool feature within the existing Futura UI codebase. This ticket establishes the folder structure, routing, shared components, and backend modules needed for subsequent tickets.

### Acceptance Criteria

- [ ] New route group created at `futura-ui/src/app/[locale]/futura/survey/`
- [ ] Shared UI components created in `futura-ui/src/app/[locale]/futura/_components/survey/`
- [ ] Backend module created at `futura-api/src/survey/`
- [ ] API contracts created at `contracts/src/apis/futura-api/survey/`
- [ ] Database migrations created for new tables
- [ ] Environment variables documented
- [ ] Dev server runs without errors

### Implementation Details

#### Frontend Structure

Create the following folder structure in `frontend/v2/apps/futura-ui/src/app/[locale]/futura/`:

```
survey/
├── page.tsx                    # Landing/job title input
├── chat/
│   └── page.tsx               # Chat interface
├── tasks/
│   └── page.tsx               # Data collection (time % + AI usage)
├── complete/
│   └── page.tsx               # Completion screen
└── _components/
    ├── survey-header.tsx      # Shared header with progress
    ├── survey-layout.tsx      # Shared layout wrapper
    └── index.ts
```

#### Backend Structure

Create the following modules in `backend/v2/apps/futura-api/src/`:

```
survey/
├── survey.module.ts
├── chat/
│   ├── chat.module.ts
│   ├── chat.controller.ts
│   ├── chat.service.ts
│   └── agent/
│       ├── agent.service.ts
│       └── tools/
├── onet/
│   ├── onet.module.ts
│   ├── onet.service.ts
│   └── embedding.service.ts
├── task-processing/
│   ├── task-processing.module.ts
│   ├── task-processing.service.ts
│   ├── task-extractor.service.ts
│   ├── task-deduplicator.service.ts
│   ├── task-matcher.service.ts
│   └── task-classifier.service.ts
├── responses/
│   ├── responses.module.ts
│   ├── responses.controller.ts
│   └── responses.service.ts
└── job-titles/
    ├── job-titles.module.ts
    └── job-titles.service.ts
```

#### API Contracts

Create in `backend/v2/libs/contracts/src/apis/futura-api/survey/`:

```
survey/
├── index.ts
├── chat.contract.ts
├── onet.contract.ts
├── task-processing.contract.ts
├── responses.contract.ts
└── job-titles.contract.ts
```

#### Database Migrations

Create migration file `YYYYMMDDHHMMSS_create_survey_tables.sql`:

```sql
-- See Database Schema section in technical-implementation.md
```

#### Environment Variables

Add to `.env.local` / `.env.production`:

```env
# Pinecone (O*NET vectors)
PINECONE_API_KEY=
PINECONE_ENVIRONMENT=
PINECONE_INDEX_TASKS=onet-tasks
PINECONE_INDEX_OCCUPATIONS=onet-occupations

# OpenAI (LLM + Embeddings)
OPENAI_API_KEY=
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_CHAT_MODEL=gpt-4o

# Survey Feature Flags
SURVEY_ENABLED=true
SURVEY_VOICE_ENABLED=true
```

#### Shared Types

Create `frontend/v2/apps/futura-ui/src/types/survey.ts`:

```typescript
// See types defined in epic docs
export type GWACategory = 'informationInput' | 'mentalProcesses' | 'workOutput' | 'interactingWithOthers';
export interface ChatMessage { ... }
export interface ProcessedTask { ... }
export interface TaskWithData { ... }
// etc.
```

### Dependencies

- Access to Pinecone account (create indexes)
- Access to OpenAI API (embeddings + chat)
- O*NET data files (download from O*NET Resource Center)

### Testing

- [ ] `npm run dev` starts without errors
- [ ] Navigate to `/en/futura/survey` shows landing page
- [ ] Backend healthcheck passes

### Related Docs

- [technical-implementation.md](./technical-implementation.md)
- [epic-1-chat-interface.md](./epic-1-chat-interface.md)
- [epic-2-onet-integration.md](./epic-2-onet-integration.md)

---

## All Tickets by Epic

Complete ticket directory with links to detailed specifications in each epic document.

---

### Setup (Blocker)

| Ticket | Description | Estimate | Depends On |
|--------|-------------|----------|------------|
| **SETUP-001** | [Project Setup & Integration](#ticket-setup-001---project-setup--integration) | 1-2 days | — |

---

### Epic 1: Chat Interface — [Full Doc](./epic-1-chat-interface.md)

| Ticket | Description | Estimate | Depends On |
|--------|-------------|----------|------------|
| **CHAT-001** | [Chat UI Components](./epic-1-chat-interface.md#chat-001-chat-ui-components) | 3 days | SETUP-001 |
| **CHAT-002** | [Chat Context & State Management](./epic-1-chat-interface.md#chat-002-chat-context--state-management) | 2 days | CHAT-001 |
| **CHAT-003** | [Backend Chat Service & Controller](./epic-1-chat-interface.md#chat-003-backend-chat-service--controller) | 3 days | SETUP-001 |
| **CHAT-004** | [Agent Decision Logic](./epic-1-chat-interface.md#chat-004-agent-decision-logic) | 2 days | CHAT-003 |
| **CHAT-005** | [Chat Tools Service](./epic-1-chat-interface.md#chat-005-chat-tools-service) | 1 day | CHAT-004, ONET-003 |
| **CHAT-006** | [State Analysis Service](./epic-1-chat-interface.md#chat-006-state-analysis-service) | 2 days | CHAT-003 |
| **CHAT-007** | [Voice Input Integration](./epic-1-chat-interface.md#chat-007-voice-input-integration) | 1 day | CHAT-001 |
| **CHAT-008** | [Task Suggestion Cards](./epic-1-chat-interface.md#chat-008-task-suggestion-cards) | 1 day | CHAT-002, ONET-003 |

**Epic 1 Total: ~14 days**

---

### Epic 2: O*NET Integration — [Full Doc](./epic-2-onet-integration.md)

| Ticket | Description | Estimate | Depends On |
|--------|-------------|----------|------------|
| **ONET-001** | [O*NET Data Download & Preparation](./epic-2-onet-integration.md#onet-001-onet-data-download--preparation) | 1 day | SETUP-001 |
| **ONET-002** | [Pinecone Index Setup](./epic-2-onet-integration.md#onet-002-pinecone-index-setup) | 0.5 days | ONET-001 |
| **ONET-003** | [Data Ingestion Script](./epic-2-onet-integration.md#onet-003-data-ingestion-script) | 2 days | ONET-001, ONET-002 |
| **ONET-004** | [O*NET Service Implementation](./epic-2-onet-integration.md#onet-004-onet-service-implementation) | 2 days | ONET-003, SETUP-001 |
| **ONET-005** | [AI Exposure Score Integration](./epic-2-onet-integration.md#onet-005-ai-exposure-score-integration) | 1 day | ONET-001 |

**Epic 2 Total: ~8 days**

---

### Epic 3: Task Processing — [Full Doc](./epic-3-task-processing.md)

| Ticket | Description | Estimate | Depends On |
|--------|-------------|----------|------------|
| **PROC-001** | [Task Extractor Service](./epic-3-task-processing.md#proc-001-task-extractor-service) | 2 days | SETUP-001 |
| **PROC-002** | [Task Deduplicator Service (LLM)](./epic-3-task-processing.md#proc-002-task-deduplicator-service-llm) | 0.5 days | PROC-001 |
| **PROC-003** | [Task Matcher Service (Embed + LLM Re-rank)](./epic-3-task-processing.md#proc-003-task-matcher-service-embed--llm-re-rank) | 2 days | ONET-003, PROC-002 |
| **PROC-004** | [Task Classifier Service](./epic-3-task-processing.md#proc-004-task-classifier-service) | 0.5 days | PROC-003 |
| **PROC-005** | [Processing Orchestrator & Controller](./epic-3-task-processing.md#proc-005-processing-orchestrator--controller) | 1 day | PROC-001–004 |

**Epic 3 Total: ~8 days**

---

### Epic 4: Data Collection — [Full Doc](./epic-4-data-collection.md)

| Ticket | Description | Estimate | Depends On |
|--------|-------------|----------|------------|
| **DATA-001** | [Data Collection Container & Layout](./epic-4-data-collection.md#data-001-data-collection-container--layout) | 1 day | SETUP-001, PROC-005 |
| **DATA-002** | [Task Card Component (Read-only V1)](./epic-4-data-collection.md#data-002-task-card-component-read-only-v1) | 1 day | DATA-001 |
| **DATA-003** | [Time Allocation Input](./epic-4-data-collection.md#data-003-time-allocation-input) | 0.5 days | DATA-002 |
| **DATA-004** | [AI Usage Input & Time Balance Indicator](./epic-4-data-collection.md#data-004-ai-usage-input--time-balance-indicator) | 1.5 days | DATA-002 |
| **DATA-005** | [Backend Submit Endpoint & Database](./epic-4-data-collection.md#data-005-backend-submit-endpoint--database) | 1.5 days | SETUP-001 |

**Epic 4 Total: ~8 days**

---

### Epic 5: Job Title Mapping — [Full Doc](./epic-5-job-title-mapping.md)

| Ticket | Description | Estimate | Depends On |
|--------|-------------|----------|------------|
| **JOB-001** | [Job Titles CSV Creation](./epic-5-job-title-mapping.md#job-001-job-titles-csv-creation) | 1 day | — |
| **JOB-002** | [Job Title Lookup Service](./epic-5-job-title-mapping.md#job-002-job-title-lookup-service) | 0.5 days | JOB-001, SETUP-001 |
| **JOB-003** | [Job Title Input Page](./epic-5-job-title-mapping.md#job-003-job-title-input-page) | 1 day | JOB-002, SETUP-001 |

**Epic 5 Total: ~3 days**

---

## Ticket Summary

| Category | Ticket Count | Total Estimate |
|----------|--------------|----------------|
| Setup | 1 | 1-2 days |
| Epic 1: Chat | 8 | ~14 days |
| Epic 2: O*NET | 5 | ~8 days |
| Epic 3: Processing | 5 | ~8 days |
| Epic 4: Data Collection | 5 | ~8 days |
| Epic 5: Job Title | 3 | ~3 days |
| **Total** | **27 tickets** | **~42 days (~8 weeks)** |

---

## Suggested Implementation Order

Based on dependencies, here's the recommended sequence:

### Week 1-2: Foundation
```
SETUP-001 (blocker)
    ├── JOB-001 (can start in parallel, no deps)
    └── ONET-001 → ONET-002 → ONET-003
```

### Week 2-3: Core Services
```
JOB-002 → JOB-003
ONET-004, ONET-005
CHAT-001 → CHAT-002
```

### Week 3-4: Chat Agent
```
CHAT-003 → CHAT-004 → CHAT-005 → CHAT-006
CHAT-007, CHAT-008 (can parallelize)
```

### Week 5-6: Task Processing
```
PROC-001 → PROC-002 → PROC-003 → PROC-004 → PROC-005
```

### Week 7: Data Collection
```
DATA-001 → DATA-002 → DATA-003 → DATA-004
DATA-005 (can parallelize)
```

### Week 8: Polish
```
i18n, error handling, analytics, evals, testing
```

---

## Next Steps

1. ✅ Finalize epic docs (this update)
2. [ ] Complete SETUP-001 (project setup)
3. [ ] Start JOB-001 (job titles CSV) — can start immediately
4. [ ] Start ONET-001 (O*NET data download)
5. [ ] Set up Pinecone indexes (ONET-002)
6. [ ] Begin Chat UI scaffolding (CHAT-001)
