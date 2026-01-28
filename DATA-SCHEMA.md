# Futura Survey Data Schema

This document describes all data collected from survey respondents and the database schema used to store it.

---

## Overview

The survey collects:
1. **Role information** - Job title and matched O*NET occupation
2. **Task inventory** - 10-20 discrete work tasks extracted from conversation
3. **Time allocation** - Hours per month spent on each task
4. **AI usage** - Whether they use AI, which tools, how often per task, and free-text description

---

## Database Tables

### `task_assessments`

One row per survey submission. Contains respondent-level data.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key |
| `session_id` | `text` | Client session ID (for deduplication) |
| `job_title` | `text` | User-entered job title (free text) |
| `occupation_code` | `text` | O*NET-SOC code (e.g., "13-1111.00") |
| `total_tasks` | `integer` | Number of tasks captured |
| `uses_ai` | `boolean` | Whether respondent uses AI tools at work |
| `ai_tools` | `text[]` | Array of selected AI tool IDs |
| `created_at` | `timestamp` | When assessment was created |

#### AI Tools (enum values for `ai_tools`)

| ID | Label |
|----|-------|
| `chatgpt` | ChatGPT |
| `claude` | Claude |
| `copilot` | Microsoft Copilot |
| `gemini` | Google Gemini |
| `grok` | Grok |
| `perplexity` | Perplexity |
| `org-internal` | Internal AI (org-specific tools) |
| `other` | Other |

---

### `task_responses`

One row per task. Contains task-level data with ratings.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key |
| `assessment_id` | `uuid` | Foreign key to `task_assessments` |
| `task_id` | `text` | Client-generated task ID |
| `user_description` | `text` | Original task description from user |
| `normalized_description` | `text` | LLM-normalized O*NET-style statement |
| `gwa_category` | `text` | Generalized Work Activity category |
| `onet_task_id` | `text` | Matched O*NET task ID (if found) |
| `onet_task_description` | `text` | O*NET task statement (if matched) |
| `similarity_score` | `float` | Semantic similarity to O*NET task (0-1) |
| `task_source` | `text` | How task was captured: `chat` or `suggestion` |
| `time_percentage` | `integer` | Time allocation (1-5 scale, see below) |
| `ai_frequency` | `integer` | AI usage frequency (1-5 scale) |
| `ai_description` | `text` | Free-text AI usage description |
| `created_at` | `timestamp` | When task was recorded |

---

## Enums & Scales

### GWA Categories (`gwa_category`)

Based on O*NET's Generalized Work Activities taxonomy.

| Value | Label | Description |
|-------|-------|-------------|
| `informationInput` | Gathering info | Reading, researching, observing, monitoring |
| `mentalProcesses` | Making decisions | Analyzing, deciding, planning, problem-solving |
| `workOutput` | Getting things done | Producing documents, code, designs, outputs |
| `interactingWithOthers` | Working with people | Communicating, coordinating, presenting |

### Time Scale (`time_percentage`)

Hours per month spent on task. Stored as 1-5 integer.

| Value | Label | Midpoint (for calculations) |
|-------|-------|----------------------------|
| 1 | < 1 hour | 0.5 hours |
| 2 | 1–5 hours | 3 hours |
| 3 | 5–10 hours | 7.5 hours |
| 4 | 10–20 hours | 15 hours |
| 5 | 20+ hours | 25 hours |

### AI Frequency Scale (`ai_frequency`)

How often AI is used for this task.

| Value | Label |
|-------|-------|
| 1 | Never |
| 2 | Rarely |
| 3 | Sometimes |
| 4 | Often |
| 5 | Always |

### Task Source (`task_source`)

| Value | Description |
|-------|-------------|
| `chat` | Extracted from user's chat messages |
| `suggestion` | Selected from AI-generated suggestion cards |

---

## Data Flow

```
User Input                    Processing                      Storage
─────────────────────────────────────────────────────────────────────────

Job title (free text)    →    O*NET lookup (Pinecone)    →    job_title
                                                              occupation_code

Chat conversation        →    LLM extraction             →    user_description
                         →    LLM normalization          →    normalized_description
                         →    LLM deduplication          →    (merged tasks)
                         →    Pinecone + LLM matching    →    onet_task_id
                                                              onet_task_description
                                                              similarity_score

GWA classification       →    LLM categorization         →    gwa_category

"Do you use AI?"         →    Boolean                    →    uses_ai
AI tool selection        →    Multi-select array         →    ai_tools
AI usage description     →    Free text                  →    ai_description (assessment)

Time rating (per task)   →    5-point scale              →    time_percentage
AI frequency (per task)  →    5-point scale              →    ai_frequency
```

---

## Sample Data

### Assessment Record

```json
{
  "id": "a1b2c3d4-...",
  "session_id": "sess_abc123",
  "job_title": "Policy Analyst",
  "occupation_code": "19-3094.00",
  "total_tasks": 12,
  "uses_ai": true,
  "ai_tools": ["chatgpt", "perplexity", "copilot"],
  "created_at": "2025-01-28T10:30:00Z"
}
```

### Task Record

```json
{
  "id": "t1a2b3c4-...",
  "assessment_id": "a1b2c3d4-...",
  "task_id": "task-001",
  "user_description": "I research policy documents and summarize them for briefings",
  "normalized_description": "Research and analyze policy documents to prepare executive briefings",
  "gwa_category": "informationInput",
  "onet_task_id": "19-3094.00_T1",
  "onet_task_description": "Collect data on political issues and analyze findings",
  "similarity_score": 0.847,
  "task_source": "chat",
  "time_percentage": 4,
  "ai_frequency": 4,
  "ai_description": null,
  "created_at": "2025-01-28T10:35:00Z"
}
```

---

## Aggregate Analysis Extensions

For population-level analysis, each task can be enriched with external AI impact scores.

### Elondou Exposure Scores

From [Eloundou et al. (2023)](https://arxiv.org/abs/2303.10130) "GPTs are GPTs" paper. Measures exposure of O*NET tasks to large language models.

| Field | Description |
|-------|-------------|
| `elondou_alpha` | Direct exposure (0-1): Task can be done 50%+ faster with LLM |
| `elondou_beta` | Exposure with tools (0-1): Task exposed when LLM has tools/plugins |
| `elondou_zeta` | Overall exposure score |

### Anthropic Economic Index

Anthropic's task-level AI capability assessments (when available).

| Field | Description |
|-------|-------------|
| `anthropic_capability_score` | How capable current AI is at performing this task |
| `anthropic_adoption_likelihood` | Predicted adoption rate |

### Enrichment Process

```
task_responses.onet_task_id  →  JOIN  →  elondou_scores table
                             →  JOIN  →  anthropic_index table
```

This enables analysis like:
- "What % of time do workers spend on high-exposure tasks?"
- "Are workers using AI more on tasks where AI is most capable?"
- "How does self-reported AI usage correlate with predicted exposure?"

---

## Free-Text AI Usage Parsing

The `ai_description` field contains unstructured text describing how respondents use AI. Examples:

> "ChatGPT helps me draft tricky emails"
> "I use Perplexity to research topics I'm unfamiliar with"
> "Copilot suggests text while I write in Word"

### Potential LLM Extraction

An LLM could parse these descriptions to extract structured data:

```json
{
  "tools_mentioned": ["ChatGPT", "Perplexity", "Copilot"],
  "use_cases": [
    { "tool": "ChatGPT", "activity": "drafting", "domain": "emails" },
    { "tool": "Perplexity", "activity": "research", "domain": "general" },
    { "tool": "Copilot", "activity": "writing assistance", "domain": "documents" }
  ],
  "automation_level": "augmentation",  // vs "automation"
  "sentiment": "positive"
}
```

### Analysis Opportunities

- **Tool-task mapping**: Which AI tools are used for which GWA categories?
- **Use case taxonomy**: Build a bottom-up taxonomy of how AI is being used
- **Augmentation vs automation**: Is AI doing the task or helping the human?
- **Adoption patterns**: How do usage patterns vary by role/industry?

---

## Data Privacy Notes

- No PII is collected (no names, emails, etc.)
- Job titles are free text and may be identifying in small orgs
- Session IDs are random and not linked to user accounts
- AI descriptions may contain sensitive workflow details

---

## TypeScript Types Reference

```typescript
// Core types from src/types/survey.ts

type GWACategory =
  | "informationInput"
  | "mentalProcesses"
  | "workOutput"
  | "interactingWithOthers";

type AIFrequency = number; // 1-5

interface ProcessedTask {
  id: string;
  userDescription: string;
  normalizedDescription: string;
  gwaCategory: GWACategory;
  onetTaskId?: string;
  onetTaskDescription?: string;
  similarityScore?: number;
  source: "chat" | "suggestion";
}

interface TaskWithData extends ProcessedTask {
  timePercentage: number;    // 1-5 scale
  aiFrequency: AIFrequency;  // 1-5 scale
  aiDescription?: string;
}
```
