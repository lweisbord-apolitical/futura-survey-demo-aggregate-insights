# Task Capture System Documentation

This document explains the complete agentic logic, prompts, and task processing pipeline used in the Futura Survey chat system.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Chat Agent Architecture](#chat-agent-architecture)
3. [Agent Services](#agent-services)
4. [Tool Selection Logic](#tool-selection-logic)
5. [State Management](#state-management)
6. [All Prompts (Verbatim)](#all-prompts-verbatim)
7. [Task Processing Pipeline](#task-processing-pipeline)
8. [O*NET Matching](#onet-matching)
9. [Data Flow Summary](#data-flow-summary)

---

## System Overview

The task capture system uses a conversational AI agent to elicit work tasks from users. The system:

1. **Collects tasks through chat** - A multi-turn conversation gathers comprehensive task information
2. **Processes raw input** - Extracts, normalizes, and deduplicates tasks
3. **Matches to O*NET** - Links user tasks to standardized O*NET task database
4. **Collects ratings** - Users rate time allocation and AI usage per task

### User Flow

```
Job Title Input → Chat Interface → Task Processing → Data Collection → Submit
     /survey    →  /survey/chat  →   (background)  →  /survey/tasks  → /survey/complete
```

---

## Chat Agent Architecture

The agent uses a **tool-based architecture** where each conversation turn selects and executes a "tool" (conversational action).

### Core Services

| Service | Role | File |
|---------|------|------|
| **AgentService** | "The Brain" - Decides which tool to use | `agent-service.ts` |
| **StateService** | "The Memory" - Tracks conversation state | `state-service.ts` |
| **ToolsService** | "The Hands" - Executes tool actions | `tools-service.ts` |
| **LLMService** | OpenAI GPT-4o wrapper | `llm-service.ts` |
| **SuggestionGeneratorService** | Generates AI task suggestions | `suggestion-generator-service.ts` |

### Available Tools (6 total)

| Tool | Purpose | When Selected | Side Effects |
|------|---------|---------------|--------------|
| `open_ended_prompt` | "Tell me about your work" | **Rule-based**: Turn 0 only | None |
| `custom_question` | O*NET-grounded question about a gap | **LLM** (preferred) | Marks `hasAskedClarifyingQuestion` |
| `show_suggestions` | Display AI-generated task cards | **LLM** | Generates 5 suggestions, increments `suggestionsShown` |
| `encourage_more` | "Anything else?" with context | **LLM/fallback** | None |
| `offer_to_proceed` | "Ready to continue?" | **LLM** | None |
| `proceed` | End conversation | **Rule-based**: User says "done" | Sets `shouldProceed: true` |

---

## Agent Services

### AgentService — "The Brain"

Located in `src/lib/chat/agent/agent-service.ts`

**Responsibilities:**
- Select which tool to use based on conversation state
- Generate natural language responses
- Apply guardrails to prevent premature completion
- Coordinate O*NET gap analysis

### StateService — "The Memory"

Located in `src/lib/chat/agent/state-service.ts`

**Responsibilities:**
- Analyze user messages to extract tasks
- Track GWA (Generalized Work Activities) coverage
- Detect stop intent ("I'm done")
- Detect confirmation of suggestions


### ToolsService — "The Hands"

Located in `src/lib/chat/agent/tools-service.ts`

**Responsibilities:**
- Execute tool actions
- Generate suggestions when `show_suggestions` is selected
- Set proceed flag when `proceed` is selected

**Most tools are just prompt templates with no side effects.**

---

## Tool Selection Logic

### Complete Decision Flow

```
User message arrives
         ↓
┌──────────────────────────────────────────────────┐
│ RULE-BASED CHECKS (no LLM call)                  │
├──────────────────────────────────────────────────┤
│ 1. Turn 0? → open_ended_prompt                   │
│ 2. User said "done"/"finished"/etc? → proceed    │
│ 3. New card selections since last turn?           │
│    - 3+ cards AND 10+ tasks → offer_to_proceed   │
│    - Otherwise → encourage_more                  │
└──────────────────────────────────────────────────┘
         ↓ (if none match)
┌──────────────────────────────────────────────────┐
│ LLM TOOL SELECTION (GPT-4o, JSON mode)           │
├──────────────────────────────────────────────────┤
│ Receives: turn count, task count, engagement,    │
│           recent conversation (last 6 msgs),     │
│           mentioned activities, GWA coverage     │
│                                                  │
│ LLM picks from:                                  │
│   custom_question (preferred — O*NET grounded)   │
│   show_suggestions (for stuck users)             │
│   encourage_more (good coverage, checking more)  │
│   offer_to_proceed (10+ tasks, seems done)       │
└──────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────┐
│ GUARDRAILS (override LLM decision)               │
├──────────────────────────────────────────────────┤
│ HARD CUTOFFS (both require clarifying Q asked):  │
│ • 15+ tasks → force offer_to_proceed             │
│ • 10+ tasks & 6+ turns → force offer_to_proceed  │
│                                                  │
│ SOFT GUARDRAILS:                                 │
│ • offer_to_proceed requires:                     │
│   - hasAskedClarifyingQuestion = true             │
│   - turn 5+ AND 10+ tasks (standard path)        │
│   - OR 10+ tasks + 3+ GWA categories covered     │
│     + turn 2+ (early exit with good coverage)    │
│ • show_suggestions capped at 3 per session       │
│ • If offer_to_proceed denied (no clarifying Q)   │
│   → fallback to custom_question                  │
└──────────────────────────────────────────────────┘
```

### Exit Conditions

The conversation ends (`isComplete: true`) when ANY of:
- User explicitly says "done"/"finished"/"that's all" (regex detection)
- 10+ tasks AND 3+ GWA categories at medium/high coverage
- 10+ turns AND 8+ tasks (don't trap user forever)
- `proceed` tool is selected (user confirmed done)

---

## State Management

### AgentState Interface

```typescript
interface AgentState {
  sessionId: string;
  jobTitle: string;
  turnCount: number;
  estimatedTaskCount: number;
  mentionedActivities: string[];
  underexploredActivities: string[];
  gwaCoverage: GWACoverage;
  userEngagement: "high" | "medium" | "low";
  userWantsToStop: boolean;
  hasAskedClarifyingQuestion: boolean;
  suggestionsShown: number;
  selectedSuggestionIds: string[];
  previouslyAcknowledgedSelections: number;
  pendingSuggestions: string[];
  conversationHistory: Array<{ role: string; content: string }>;
  shownSuggestionStatements: string[];
  cachedOnetTasks?: string[];
  actionsTaken: string[];
}
```

### GWA Coverage Categories

```typescript
interface GWACoverage {
  informationInput: "none" | "low" | "medium" | "high";      // gathering data, researching
  mentalProcesses: "none" | "low" | "medium" | "high";       // analyzing, deciding, planning
  workOutput: "none" | "low" | "medium" | "high";            // producing documents, code
  interactingWithOthers: "none" | "low" | "medium" | "high"; // communicating, coordinating
}
```

### State Update Flow

1. **User sends message**
2. **StateService.analyzeAndUpdateState()** called:
   - Detects stop intent (regex)
   - Detects confirmation of suggestions (regex)
   - LLM extracts: new tasks, GWA updates, engagement level
3. **State updated** with new values
4. **Tool selected** based on updated state
5. **Response generated** and streamed back

---

## All Prompts (Verbatim)

### AGENT_SYSTEM_PROMPT

Used as the system message for all response generation.

```
You are a friendly assistant helping someone describe their work tasks.

Your role is to:
1. Understand what they actually do day-to-day in their job
2. Get specific, actionable task descriptions (not just general responsibilities)
3. Cover different aspects of their work (information gathering, analysis/decisions, outputs/deliverables, collaboration)
4. Be warm and encouraging, not interrogative

Guidelines:
- Keep responses brief (2-3 sentences max)
- Ask ONE question at a time
- Reference what they've shared to show you're listening
- Don't be overly formal or corporate-sounding
- Encourage specificity without being demanding
```

---

### Opening Prompt (Turn 0)

**Function:** `buildOpeningPrompt(jobTitle)`

```
You are a friendly assistant helping to understand what someone does at work.

The user's job title is: ${jobTitle}

Generate a warm opening that:
1. Acknowledges their job title naturally
2. Asks them to tell you everything about what they do
3. Encourages detail and specificity

Keep it to 2-3 sentences. Don't include greetings like "Hi!" or "Hello!" - start directly with the substance.
```

---

### Tool Selection Prompt

**Function:** `buildToolSelectionPrompt(state)`

This prompt asks the LLM to choose the next conversational action.

```
You're helping capture work tasks for a "${state.jobTitle}". Your goal is to get a COMPLETE picture of their job.

CURRENT STATE:
- Turn: ${state.turnCount}
- Tasks captured: ~${state.estimatedTaskCount}
- User engagement: ${state.userEngagement} (detailed responses | moderate responses | short/vague responses)

RECENT CONVERSATION:
${recentHistory || "(conversation just started)"}

Activities mentioned so far:
${taskList}

Coverage by work category:
${gwaSummary}

AVAILABLE TOOLS - Pick the BEST one for this situation:

1. "custom_question" - Ask about an area that seems underexplored for this role (PREFERRED)
   USE WHEN: User is engaged and there are gaps compared to typical work for this job
   PROVIDE: A natural, conversational question about what's missing

2. "show_suggestions" - Show O*NET task suggestions they can select
   USE WHEN: User seems STUCK (vague responses like "some stuff", "not sure", or has said very little after multiple turns)
   DO NOT USE: Just because a response is short - a clear short answer means they're engaged
   PROVIDE: null (suggestions are fetched automatically)

3. "encourage_more" - Generic "anything else?" prompt
   USE WHEN: Good coverage so far, just checking if there's more
   PROVIDE: null

4. "offer_to_proceed" - Offer to wrap up the conversation
   USE WHEN: 10+ tasks, good coverage of typical work for this role, user seems done
   PROVIDE: null

DECISION GUIDELINES:
- CRITICAL: Look at the RECENT CONVERSATION above and NEVER repeat a question you already asked
- **HARD RULE**: If 15+ tasks captured → MUST use offer_to_proceed (we have enough!)
- **HARD RULE**: If 10+ tasks AND turn >= 6 → MUST use offer_to_proceed (don't overstay)
- If user is engaged AND <15 tasks → prefer custom_question
- If user seems STUCK (vague responses, "not sure", minimal info after 3+ turns) → prefer show_suggestions
- Short but clear answers are NOT a reason to show suggestions
- Always build on what the user just said - acknowledge their response before asking something new

Respond in JSON:
{
  "tool": "custom_question" | "show_suggestions" | "encourage_more" | "offer_to_proceed",
  "reason": "brief explanation of why this tool",
  "question": "the follow-up question to ask (only for custom_question)"
}
```

---

### Custom Question Prompt

**Function:** `buildCustomQuestionPrompt(question, state)`

```
Generate a natural, conversational way to ask this follow-up question:
"${question}"

Job title: ${state.jobTitle}
Turn count: ${state.turnCount}

Recent conversation:
${recentHistory || "(none yet)"}

${lastUserMsg ? `They just said: "${lastUserMsg.content}"` : ""}

1. First, briefly acknowledge what they just shared
2. Then ask the question in a natural way

Keep it brief (1-2 sentences). NEVER repeat something you already asked above.
```

---

### Encourage More Prompt

**Function:** `buildEncourageMorePrompt(state)`

**When user has card selections:**

```
You're helping a "${state.jobTitle}" describe their work tasks.
They just confirmed some task suggestions.

TASKS CAPTURED SO FAR:
${taskList}

Recent conversation:
${recentHistory || "(none yet)"}

Analyze what's been captured and identify gaps. Consider:
- Are there major aspects of a ${state.jobTitle}'s work that seem missing?
- Common activities for this role we haven't touched on?
- Things they likely do but haven't mentioned (admin, meetings, reporting, etc.)?

Generate a natural follow-up question that:
1. Briefly acknowledges what they've shared
2. Identifies a GAP AREA that seems underexplored
3. Asks BROADLY: "Do you do any tasks related to [gap area] or anything similar?"

The question should be open-ended, giving them room to interpret and respond freely.

Example: "You've covered a lot of the research and analysis side. Do you do any tasks related to presenting findings or stakeholder communication — or anything along those lines?"

Keep it to 2 sentences. Be conversational, not interrogative.
```

**Standard (no card selections):**

```
You're helping someone describe their work tasks.

Job title: ${state.jobTitle}
Estimated tasks captured: ${state.estimatedTaskCount}

Recent conversation:
${recentHistory || "(none yet)"}

${lastUserMsg ? `They just said: "${lastUserMsg.content}"` : ""}

Generate an encouraging message to get them to share more about their work.
- First, briefly acknowledge what they JUST shared (be specific, reference their words)
- Then ask if there's anything else they do regularly

Keep it brief (1-2 sentences) and warm. NEVER repeat a question you already asked in the conversation above.
```

---

### Show Suggestions Prompt

**Function:** `buildShowSuggestionsPrompt(state)`

```
You're helping someone describe their work tasks and want to show them some suggestions.

Job title: ${state.jobTitle}

Generate a brief message to introduce task suggestions.
DO NOT preview or list any specific tasks — the cards will speak for themselves.
Just say something like "Here are some common tasks that might apply to your work — select any that fit."

Keep it to 1-2 sentences. Be brief and conversational.
```

---

### Offer to Proceed Prompt

**Function:** `buildOfferToProceedPrompt(state)`

```
You're helping someone describe their work tasks and they've shared a good amount.

Job title: ${state.jobTitle}
Estimated tasks captured: ${state.estimatedTaskCount}
Turn count: ${state.turnCount}

Generate a message that:
1. Acknowledges they've shared good detail about their work
2. Offers to continue if they have more to add
3. Gives them the option to proceed to the next step

Keep it brief (2-3 sentences). Sound satisfied with what they've shared but not pushy about ending.
```

---

### Proceed Prompt (End Conversation)

**Function:** `buildProceedPrompt(state)`

```
You're ending a conversation about someone's work tasks.

Job title: ${state.jobTitle}
Estimated tasks captured: ${state.estimatedTaskCount}

Generate a brief closing message confirming we have enough information.
Thank them and let them know they can proceed to review their tasks.

Keep it to 1-2 sentences. Be warm and appreciative.
```

---

### Initial Dump Response Prompt

**Function:** `buildInitialDumpResponsePrompt(initialTasks, state)`

Used when user provides tasks upfront in the initial input.

```
You're helping a "${state.jobTitle}" describe their work tasks.

They just provided an initial dump of their work activities:
---
${initialTasks}
---

Activities I extracted:
${taskList}

Coverage by work category:
${gwaSummary}

${gaps.length > 0 ? `Areas not well covered yet: ${gaps.join(", ")}` : "Coverage looks good across main categories."}

CRITICAL REQUIREMENT: You MUST ask a clarifying question, even if their response was thorough. This ensures we capture the complete picture of their work.

Generate a response that:
1. Briefly acknowledges what they shared (1 sentence max, be specific about something they mentioned)
2. ALWAYS ask a clarifying question about one of these:
   - A gap area like ${gaps[0]} (PREFERRED - this area wasn't well covered)
   - OR tasks they might have missed (periodic responsibilities, less common tasks)
3. Sound curious and conversational, not like you're checking boxes

Keep it to 2-3 sentences total. Don't list back what they said - show you understood and probe for what's missing.

Example good responses:
- "Sounds like you spend a lot of time on sprint planning and stakeholder communication. What about the more analytical side — do you dig into data or metrics as part of your role?"
- "That's a great overview of your day-to-day! Are there any periodic tasks you handle — like monthly reports, quarterly reviews, or annual planning activities?"
- "Great detail on the core work! Do you handle any troubleshooting or problem-solving when things don't go as planned?"

Example bad response: "Thank you for sharing! You mentioned meetings, specs, and feedback review. Now let me ask about information gathering activities."
```

---

### O*NET Gap Analysis Prompt (Unified)

**Function:** `buildONetGapAnalysisPrompt({ state, onetTasks, initialInput? })`

Handles BOTH initial dump responses AND mid-conversation `custom_question` tool.

```
You're helping a "${state.jobTitle}" describe their work tasks.

// CONTEXT SECTION — adapts based on whether this is initial dump or mid-conversation

// For initial dump (initialInput provided):
WHAT THE USER JUST SHARED:
---
${initialInput}
---

Read this carefully and note EVERYTHING they mentioned.

// For mid-conversation (no initialInput):
CONVERSATION SO FAR:
${recentHistory}

ACTIVITIES ALREADY MENTIONED:
${mentionedList}

REFERENCE — Typical tasks for a SIMILAR role (from O*NET database):
${onetTaskList}

CRITICAL — O*NET MATCH MAY NOT BE EXACT:
The reference tasks above are from an O*NET occupation that matched "${state.jobTitle}", but the match is often imprecise.
- Example: "policy analyst" might match to "climate policy analyst" — IGNORE climate-specific tasks
- Example: "software engineer" might match to "mining software engineer" — IGNORE mining-specific tasks
- ONLY ask about work that a GENERAL "${state.jobTitle}" would realistically do
- When in doubt, ask about broader categories (communication, analysis, planning) rather than niche specializations

YOUR TASK:
1. Note what the user has ALREADY mentioned
2. Scan the O*NET reference tasks for GENERAL AREAS of work (not specific tasks)
3. Find an area that seems underexplored AND is relevant to a typical "${state.jobTitle}"
4. Ask a BROAD question about that area

RULES FOR YOUR QUESTION:
- Ask about general categories, NOT specific O*NET task statements
- Good: "Do you do any data analysis or reporting as part of your role?"
- Good: "Does your role involve coordinating with other teams?"
- Bad: "Do you prepare technical reports for regulatory compliance?" (too specific)
- Bad: "Do you review climate-related studies?" (niche specialization)
- DO NOT ask about areas they've already covered
- DO NOT repeat any question from the conversation

AVOID DUPLICATES — Do NOT ask about anything they already mentioned, even if worded differently:
- If they said "troubleshoot problems" → do NOT ask about problem-solving
- If they said "meetings with stakeholders" → do NOT ask about collaboration
- If they said "documentation" → do NOT ask about writing docs

Respond in JSON:
{
  "gapArea": "the general area of work",
  "suggestedQuestion": "broad, natural question (1-2 sentences, acknowledge what they shared first if initial dump)"
}
```

---

### Suggestion Generation Prompt

**Function:** `buildSuggestionGenerationPrompt(params)`

Generates AI-powered task suggestions (O*NET style).

```
You are generating task suggestions for a "${jobTitle}".

Your goal is to suggest tasks this person LIKELY does but HASN'T mentioned yet in the conversation.
Think about the full scope of work for this role and offer a RANGE of different types of activities.

TASK FORMAT (O*NET style):
Tasks MUST follow this exact format: "Verb + object + context/purpose"
Examples:
- "Analyze market trends and competitor data to inform product strategy"
- "Coordinate with engineering teams to prioritize feature development"
- "Review customer feedback and usage metrics to identify improvement opportunities"
- "Prepare presentation materials and reports for stakeholder meetings"

CONVERSATION CONTEXT:
${recentHistory || "(conversation just started)"}

CRITICAL - AVOID SEMANTIC DUPLICATES:
The following activities have ALREADY been mentioned by the user:
${activitiesList}

DO NOT suggest tasks that are semantically similar to these, even if worded differently.

Examples of duplicates to AVOID:
- User said "analyze financial reports" → DON'T suggest "Review financial data for trends"
- User said "coordinate with teams" → DON'T suggest "Collaborate with cross-functional groups"
- User said "write documentation" → DON'T suggest "Prepare technical documents"

Your suggestions should cover DIFFERENT aspects of work, not rephrase what's already captured.

GWA COVERAGE STATUS (these are the types of work activities):
${gwaSummary}

DO NOT generate suggestions similar to these (already shown):
${exclusions}

REQUIREMENTS:
1. Generate exactly ${count} task suggestions
2. Suggest tasks the user HASN'T mentioned yet — offer DIFFERENT types of work
3. Ensure VARIETY: each suggestion should be a different kind of activity
   - If user discussed lots of collaboration, suggest research/analysis or planning tasks instead
   - Spread across: information gathering, analysis/decisions, creating outputs, and communication
4. Base suggestions on what's typical for a ${jobTitle}, but that the user hasn't covered yet
5. Each suggestion must be a complete, actionable task statement
6. Use varied verbs (analyze, coordinate, develop, prepare, review, monitor, etc.)

Respond with JSON only:
{
  "suggestions": [
    {
      "statement": "the task statement in O*NET format",
      "gwaCategory": "informationInput" | "mentalProcesses" | "workOutput" | "interactingWithOthers"
    }
  ]
}
```

---

### State Analysis Prompt

Used in `state-service.ts` to analyze each user message.

```
Analyze this message from someone describing their work as a "${state.jobTitle}".

Their message: "${message}"

Previously mentioned activities: ${state.mentionedActivities.join(", ") || "none yet"}
Current estimated task count: ${state.estimatedTaskCount}

Extract the following information and respond in JSON:
{
  "newTaskCount": <number of NEW distinct tasks/activities mentioned in this message>,
  "newActivities": [<list of new specific activities/tasks mentioned>],
  "underexploredActivities": [<activities mentioned but not detailed enough>],
  "gwaUpdates": {
    "informationInput": "none" | "low" | "medium" | "high" | null,
    "mentalProcesses": "none" | "low" | "medium" | "high" | null,
    "workOutput": "none" | "low" | "medium" | "high" | null,
    "interactingWithOthers": "none" | "low" | "medium" | "high" | null
  },
  "engagement": "high" | "medium" | "low",
  "wantsToStop": <true if they say "done", "that's all", "finished", etc.>
}

GWA category definitions:
- informationInput: gathering data, reading, researching, observing, monitoring
- mentalProcesses: analyzing, deciding, planning, problem-solving, evaluating
- workOutput: producing documents, code, designs, reports, physical outputs
- interactingWithOthers: communicating, coordinating, supervising, presenting, collaborating

Set gwaUpdates values to null if not mentioned, or to the coverage level based on detail provided.

Engagement levels (based on RESPONSE QUALITY, not just word count):
- high: Provides multiple activities with specific detail, regardless of length
- medium: Answers the question clearly with at least one task or activity
- low: Vague, deflecting, or doesn't answer the question (e.g., "not really", "some stuff", "I don't know")

IMPORTANT: A SHORT but CLEAR answer is NOT low engagement.
- "Yes, I review financial reports weekly" = MEDIUM (clear answer with specific activity)
- "Yeah, some data stuff" = LOW (vague, no specific activity)
- "No, I don't do that" = MEDIUM (clear direct answer)
```

---

### Completeness Check Prompt (Backup)

**Function:** `buildCompletenessCheckPrompt(tasks, jobTitle)`

```
You're helping capture the work tasks of a "${jobTitle}".

Tasks described so far:
${taskList}

Does this seem like a reasonably complete picture? Are there obvious gaps?

Respond in JSON:
{
  "seems_complete": true or false,
  "confidence": "high" | "medium" | "low",
  "gap_area": "brief description of what's missing, or null if complete",
  "suggested_question": "a natural follow-up question to ask, or null if complete"
}
```

---

## Task Processing Pipeline

After chat ends, the transcript is processed through a multi-stage pipeline.

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   EXTRACT    │ → │  NORMALIZE   │ → │  DEDUPLICATE │ → │    MATCH     │
│   (GPT-4o)   │    │   (GPT-4o)   │    │   (GPT-4o)   │    │ (Pinecone +  │
│              │    │              │    │              │    │  GPT-4o-mini)│
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
├────────────── FAST (blocking) ────────────────────────┤   ├── BACKGROUND ─┤
        /api/tasks/process                                    /api/tasks/match
```

### Step 1: Extract Tasks

**Service:** `extraction-service.ts`

**Extraction Prompt:**

```
Extract all discrete work tasks from this chat transcript.

TRANSCRIPT:
${transcript}

RULES:
1. Extract each distinct task/activity the USER confirms or describes
2. Use ASSISTANT messages for context (e.g., if assistant asks "do you do X or Y?" and user says "both", extract X and Y)
3. Keep the user's language where possible (we'll normalize later)
4. Include tasks mentioned in passing or confirmed implicitly
5. Separate compound statements ("I write and review" → two tasks)
6. Ignore meta-conversation ("as I mentioned earlier")
7. Focus on WHAT they do, not HOW they feel about it
8. Each task should be a specific activity, not a general category

EXAMPLES of good extraction:
- "spending time in meetings coordinating with different teams" ✓
- "write up quarterly summaries for leadership" ✓
- "review what other departments send over" ✓
- If assistant asks "do you gather market research or customer insights?" and user says "I do both" → extract BOTH tasks ✓

EXAMPLES of what to avoid:
- "I enjoy my job" ✗ (not a task)
- "administrative stuff" ✗ (too vague - ask for specifics in chat)
- "as I said before" ✗ (meta-conversation)

Return as JSON:
{
  "extracted_tasks": [
    "task description 1",
    "task description 2",
    ...
  ]
}
```

---

### Step 2: Normalize Tasks

**Service:** `normalization-service.ts`

Converts raw user descriptions to O*NET-style task statements.

**Normalization Prompt:**

```
Convert these raw task descriptions into O*NET-style task statements.

RAW TASKS:
${taskList}

O*NET TASK FORMAT RULES:
- Start with action verb (present tense): "Prepare", "Coordinate", "Review", "Analyze"
- Be specific and concrete
- No first person (I, my, we, our)
- Professional language
- 5-20 words
- Focus on the WHAT, not the WHY

EXAMPLES:
Raw: "spending time in meetings coordinating with different teams"
Normalized: "Coordinate activities and schedules with cross-functional teams"

Raw: "write up quarterly summaries for leadership"
Normalized: "Prepare quarterly summary reports for senior leadership"

Raw: "review what other departments send over"
Normalized: "Review documents and materials submitted by other departments"

Raw: "make sure it aligns with our policies"
Normalized: "Evaluate materials for compliance with organizational policies"

Raw: "handle onboarding when new people join"
Normalized: "Conduct onboarding activities for new team members"

Return as JSON:
{
  "normalized_tasks": [
    {
      "original": "raw task text",
      "normalized": "O*NET style statement"
    },
    ...
  ]
}
```

---

### Step 3: Deduplicate Tasks

**Service:** `deduplication-service.ts`

Merges semantically similar tasks.

**Deduplication Prompt:**

```
Analyze these normalized task statements and identify any that are semantically similar or duplicates. Merge similar tasks into a single representative statement.

TASKS:
${taskList}

RULES:
- Two tasks are "similar" if they describe essentially the same work activity
- When merging, pick the most complete and professional-sounding statement
- Keep tasks separate if they represent genuinely different activities
- Report writing and document preparation are similar; coordinating meetings is different
- Don't over-merge: "Write emails" and "Respond to customer inquiries" should stay separate

EXAMPLES OF SIMILAR TASKS (should merge):
- "Prepare quarterly reports" + "Create quarterly summary documents" → "Prepare quarterly reports for leadership"
- "Schedule team meetings" + "Organize meetings with colleagues" → "Schedule and organize team meetings"
- "Review financial data" + "Analyze financial reports" → "Review and analyze financial data and reports"

EXAMPLES OF DIFFERENT TASKS (should NOT merge):
- "Write technical documentation" vs "Write marketing copy" (different purposes)
- "Coordinate with clients" vs "Coordinate with team members" (different audiences)
- "Review code" vs "Write code" (different activities)

Return as JSON:
{
  "deduplicated_tasks": [
    {
      "final_statement": "The best representative task statement",
      "merged_from": [1, 3],
      "reasoning": "Brief explanation of why these were merged or kept separate"
    },
    ...
  ]
}

Use 1-based indices for merged_from. Include all tasks - unique tasks should have merged_from containing just their own index.
```

---

## O*NET Matching

**Service:** `matching-service.ts`

Two-stage matching pipeline that runs in the background.

### Stage 1: Pinecone Retrieval

- Query Pinecone with user task (semantic search)
- Get top-5 candidates using integrated embeddings
- ~18,000 O*NET tasks indexed

### Stage 2: LLM Selection

**LLM Selection Prompts:**

**System:**
```
You are matching a user's work task to standardized O*NET task statements.

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
confidence: "high" (very close match), "medium" (related activity), "low" (loosely related)
```

**User:**
```
User's task: "${userTask}"

Candidates:
${candidateList}

Pick the best match:
```

---

## Data Flow Summary

### Complete Flow

```
Chat transcript
    ↓
/api/tasks/process (FAST - blocks page transition)
    ├─ extractionService.extractFromChat()     ← LLM reads full transcript
    ├─ normalizationService.normalize()        ← LLM converts to O*NET style
    └─ deduplicationService.deduplicate()      ← LLM merges similar tasks
    ↓
ProcessedTask[] (shown to user immediately)
    ↓
/api/tasks/match (BACKGROUND - runs while user rates)
    └─ matchingService.matchTask() per task    ← Pinecone + GPT-4o-mini
    ↓
Enriched ProcessedTask[] (with O*NET data)
    ↓
/api/tasks/analyze (after user rates tasks)
    └─ LLM groups into themes + computes insights
    ↓
/api/tasks/submit (final submission)
    └─ TaskWithData[] (task + time % + AI frequency)
```

### LLM Calls Per Turn (typical chat)

| Step | Model | Temperature | Purpose |
|------|-------|-------------|---------|
| State analysis | GPT-4o | 0.3 (JSON) | Extract tasks, GWA, engagement from message |
| Tool selection | GPT-4o | 0.3 (JSON) | Choose next conversational action |
| Response generation | GPT-4o | 0.7 (stream) | Generate natural reply |
| *Optional:* Suggestion generation | GPT-4o | 0.3 (JSON) | Generate 5 task cards (if show_suggestions) |
| *Optional:* O*NET gap analysis | GPT-4o | 0.3 (JSON) | Compare vs role tasks (initial dump or custom_question) |

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/chat` | POST | Start session or send message (sync) |
| `/api/chat` | GET | Get session state by sessionId |
| `/api/chat` | PATCH | Update selected suggestion IDs |
| `/api/chat/stream` | POST | Start session or send message (SSE streaming) |
| `/api/example-tasks` | POST | Generate 3 role-specific example tasks (LLM) |
| `/api/tasks/process` | POST | Fast pipeline: Extract → Normalize → Deduplicate |
| `/api/tasks/match` | POST | Background: Enrich tasks with O*NET matches |
| `/api/tasks/analyze` | POST | Group tasks into themes + compute AI usage insights |
| `/api/tasks/submit` | POST | Submit final task data with time % and AI frequency |
| `/api/onet/suggestions` | GET | Get O*NET task suggestions for job title (Pinecone) |
| `/api/job-titles/search` | GET | Autocomplete job titles |
| `/api/job-titles/lookup` | GET | Lookup O*NET occupation code for job title |

---

## Key Types

```typescript
// GWA categories
type GWACategory = "informationInput" | "mentalProcesses" | "workOutput" | "interactingWithOthers";

// Chat message
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// Processed task (after extraction pipeline)
interface ProcessedTask {
  id: string;
  userDescription: string;
  normalizedDescription: string;
  onetTaskId?: string;
  onetTaskDescription?: string;
  similarityScore?: number;
  gwaCategory?: GWACategory;
}

// Task with user ratings
interface TaskWithData extends ProcessedTask {
  timePercentage: number;
  aiFrequency: 1 | 2 | 3 | 4 | 5;
  aiDescription?: string;
}
```
