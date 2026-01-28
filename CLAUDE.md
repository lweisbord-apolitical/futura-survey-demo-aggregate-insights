# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Futura Survey is a conversational task capture tool that collects work tasks from users via chat, matches them to O*NET database tasks, and gathers time allocation and AI usage data. Built with Next.js 14 (App Router).

## Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
```

## Architecture

### User Flow
```
Job Title Input → Chat Interface → Task Processing → Data Collection → Submit
     /survey    →  /survey/chat  →   (background)  →  /survey/tasks  → /survey/complete
```

### Key Services

**Chat System** (`src/lib/chat/`)
- `chat-service.ts` — Orchestrator: coordinates state, agent, and tools; handles both sync and streaming
- `agent/agent-service.ts` — "The Brain": selects which tool to use each turn, generates responses
- `agent/state-service.ts` — "The Memory": tracks GWA coverage, task count, engagement, stop intent
- `agent/tools-service.ts` — "The Hands": executes actions (generate suggestions, set proceed flag)
- `agent/llm-service.ts` — OpenAI GPT-4o wrapper (generate, stream, JSON with json_object mode)
- `agent/suggestion-generator-service.ts` — LLM-generated contextual task suggestions (O*NET style)
- `agent/prompts.ts` — All LLM prompt templates for tool selection, response generation, gap analysis
- `session-store.ts` — Supabase-based session storage (1-hour TTL)

**Task Processing** (`src/lib/tasks/`)
- `task-processing-service.ts` — Pipeline orchestrator (fast mode + background matching)
- `extraction-service.ts` — LLM extracts discrete tasks from full chat transcript
- `normalization-service.ts` — LLM converts raw descriptions to O*NET-style statements
- `deduplication-service.ts` — LLM merges semantically similar tasks (Jaccard fallback)

**O*NET Integration** (`src/lib/onet/`)
- `pinecone-service.ts` — Queries Pinecone with integrated embeddings (18k tasks, 1000 jobs)
- `matching-service.ts` — Two-stage: Pinecone retrieval (top-5) → GPT-4o-mini selection

---

## Chat Agent Architecture

### How Task Information Is Gathered

The chat agent uses a multi-turn conversation to elicit a comprehensive list of work tasks. It combines:
1. **Open-ended initial prompt** — asks user to describe their work broadly
2. **O*NET gap analysis** — compares what user said against typical tasks for their role (from Pinecone)
3. **GWA coverage tracking** — ensures all 4 work activity categories are covered
4. **AI-generated suggestions** — shows contextual task cards the user can select
5. **Confirmation detection** — picks up when users confirm suggested tasks verbally

### Agent Tools (6 available)

| Tool | Purpose | Selection | Notes |
|------|---------|-----------|-------|
| `open_ended_prompt` | "Tell me about your work" | **Rule-based** | Turn 0 only |
| `custom_question` | O*NET-grounded question about a gap | **LLM** (preferred) | Uses Pinecone O*NET data when available; falls back to LLM-generated question |
| `show_suggestions` | Display AI-generated task cards | **LLM** | Max 3 times; for stuck/low-engagement users |
| `encourage_more` | "Anything else?" with context | **LLM/fallback** | Default; context-aware follow-up |
| `offer_to_proceed` | "Ready to continue?" | **LLM** | 10+ tasks + turn 5+ + clarifying Q asked |
| `proceed` | End conversation | **Rule-based** | User says "done"/"finished"/etc. |

### Tool Selection Flow

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

### Question Strategy

The agent asks different types of questions depending on conversation state:

| Situation | Question Type | How It Works |
|-----------|---------------|--------------|
| **Turn 0** (no user input yet) | Open-ended prompt | LLM generates "tell me about your work" for the job title |
| **Initial task dump** (user provides tasks upfront) | O*NET gap analysis | Uses unified `buildONetGapAnalysisPrompt` with `initialInput` parameter. Compares user's tasks against Pinecone O*NET tasks for role, identifies missing GENERAL area, asks broad question. Falls back to `buildInitialDumpResponsePrompt` if Pinecone unavailable. |
| **Gap vs. typical work** | Custom question (O*NET-grounded) | Uses same unified `buildONetGapAnalysisPrompt` (without `initialInput`). Fetches O*NET tasks from Pinecone, compares to mentioned activities, identifies underexplored general area (validated for job title relevance), asks broad question. Falls back to LLM-generated question if Pinecone unavailable. |
| **User stuck/vague** | Show suggestions | Generates 5 AI task cards (O*NET style) targeting GWA gaps; user taps to select |
| **After card selections** | Context-aware encourage | Acknowledges selections, uses LLM gap analysis to find what's still missing |
| **Good coverage** | Encourage more | Brief acknowledgment + "anything else?" |
| **10+ tasks, ready** | Offer to proceed | Summarizes progress, offers option to continue or move on |

### Initial Task Dump Flow

When the user provides tasks in the initial input (before chat starts):

```
User submits initial tasks on /survey/chat
         ↓
ChatService.startSessionStream()
         ↓
StateService.analyzeAndUpdateState()  ← LLM extracts tasks/GWA from dump
         ↓
AgentService.selectTool()             ← Usually picks custom_question
         ↓
AgentService.generateResponse()
         ↓
  ┌─ O*NET tasks available? (Pinecone lookup by job title)
  │   YES → buildONetGapAnalysisPrompt({ initialInput })
  │          LLM compares user tasks vs O*NET tasks
  │          Returns: { gapArea, suggestedQuestion }
  │   NO  → buildInitialDumpResponsePrompt()
  │          Uses GWA coverage gaps as fallback
  └─────────────────────────────────────────────
         ↓
Streams response acknowledging tasks + asking about gap
```

### State Management

State is tracked in `AgentState` (in-memory map, keyed by sessionId):

| Field | What It Tracks | Updated By |
|-------|---------------|------------|
| `turnCount` | Conversation turns | Rule (increment each message) |
| `estimatedTaskCount` | Cumulative tasks mentioned | **LLM** extracts per message |
| `mentionedActivities` | List of extracted activity strings | **LLM** extracts per message |
| `underexploredActivities` | Activities needing more detail | **LLM** identifies per message |
| `gwaCoverage` | 4 categories (none→low→medium→high) | **LLM** classifies per message (only increases) |
| `userEngagement` | high/medium/low | **LLM** judges response quality (not length) |
| `userWantsToStop` | User said "done" | **Rule-based** (regex patterns) |
| `hasAskedClarifyingQuestion` | Guardrail flag for offer_to_proceed | Set when custom_question used |
| `suggestionsShown` | Count (max 3) | Rule (increment on show_suggestions) |
| `selectedSuggestionIds` | Card selections from UI | Synced from session (PATCH endpoint) |
| `previouslyAcknowledgedSelections` | Prevents re-acknowledging same selections | Updated after response generated |
| `pendingSuggestions` | Tasks mentioned in agent response text | Extracted by regex from response |
| `conversationHistory` | Full message history (role + content) | Appended each turn |
| `shownSuggestionStatements` | Previously shown suggestion texts | Prevents duplicate suggestions |
| `cachedOnetTasks` | O*NET tasks for this job (from Pinecone) | Cached on first lookup |
| `actionsTaken` | History of tools used | Appended each turn |

### Message Processing Flow

```
User message → /api/chat/stream (SSE)
         ↓
ChatService.processMessageStream()
         ↓
1. StateService.analyzeAndUpdateState()
   └─ LLM call: extract new tasks, GWA updates, engagement, stop intent
   └─ Also detects confirmation intent (regex) for pending suggestions
         ↓
2. AgentService.selectTool()
   └─ Rule checks → LLM tool selection → Guardrail validation
   └─ Marks clarifying question flag if custom_question
         ↓
3. ToolsService.execute()
   └─ show_suggestions → SuggestionGenerator (LLM generates 5 contextual cards)
   └─ proceed → sets shouldProceed flag
   └─ Others → no side effects (just prompt templates)
         ↓
4. AgentService.generateResponseStream()
   └─ Builds acknowledgment prefix if new card selections
   └─ Initial dump OR custom_question? → Unified O*NET gap analysis (Pinecone + LLM)
   └─ Otherwise → LLM streams response using tool-specific prompt
         ↓
5. Response streamed as SSE chunks, final event includes:
   { sessionId, message, suggestions, shouldShowSuggestions,
     isComplete, extractedTasks, toolUsed, updatedState }
```

### Suggestion Generation (show_suggestions tool)

When the LLM selects `show_suggestions`, the SuggestionGeneratorService:

1. Builds a prompt with: job title, recent conversation, GWA coverage gaps, mentioned activities, previously shown suggestions
2. LLM generates 5 task suggestions in O*NET format ("Verb + object + context")
3. Suggestions target GWA gaps and avoid semantic duplicates of mentioned activities
4. Each suggestion gets a unique `ai-*` ID, mapped to TaskSuggestion type
5. Shown suggestions are tracked in `shownSuggestionStatements` to avoid repeats

### Exit Conditions

The conversation ends (`isComplete: true`) when ANY of:
- User explicitly says "done"/"finished"/"that's all" (regex detection)
- 10+ tasks AND 3+ GWA categories at medium/high coverage
- 10+ turns AND 8+ tasks (don't trap user forever)
- `proceed` tool is selected (user confirmed done)

### LLM Calls Per Turn (typical)

| Step | Model | Temperature | Purpose |
|------|-------|-------------|---------|
| State analysis | GPT-4o | 0.3 (JSON) | Extract tasks, GWA, engagement from message |
| Tool selection | GPT-4o | 0.3 (JSON) | Choose next conversational action |
| Response generation | GPT-4o | 0.7 (stream) | Generate natural reply |
| *Optional:* Suggestion generation | GPT-4o | 0.3 (JSON) | Generate 5 task cards (if show_suggestions) |
| *Optional:* O*NET gap analysis | GPT-4o | 0.3 (JSON) | Compare vs role tasks (initial dump or custom_question) |

---

## Task Processing Pipeline

After chat ends, the transcript is processed into structured tasks:

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   EXTRACT    │ → │  NORMALIZE   │ → │  DEDUPLICATE │ → │    MATCH     │
│   (GPT-4o)   │    │   (GPT-4o)   │    │   (GPT-4o)   │    │ (Pinecone +  │
│              │    │              │    │              │    │  GPT-4o-mini)│
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
├────────────── FAST (blocking) ────────────────────────┤   ├── BACKGROUND ─┤
        /api/tasks/process                                    /api/tasks/match
```

### Step 1: Extract (LLM)
- Input: Full chat transcript (both user and assistant messages)
- Uses assistant messages for context (e.g., "do you do X?" → user: "yes" → extract X)
- Separates compound statements ("I write and review" → two tasks)
- Ignores meta-conversation, feelings, vague categories
- Output: `ExtractedTask[]` (raw strings with source message IDs)

### Step 2: Normalize (LLM)
- Input: Raw extracted task strings
- Converts to O*NET format: "Verb + object + context" (present tense, no first person)
- Processed in batches of 10 to avoid token limits
- Output: `NormalizedTask[]` (original + normalized pairs)

### Step 3: Deduplicate (LLM)
- Input: Normalized task statements
- LLM identifies semantically similar tasks and merges them
- Picks the most complete/professional statement as representative
- Won't over-merge: "Write emails" vs "Respond to customer inquiries" stay separate
- Fallback: Jaccard similarity on keywords (>0.5 overlap = similar)
- Output: `DeduplicatedTask[]` (final statement + merged-from list + reasoning)

### Step 4: Match to O*NET (Background)
- Input: ProcessedTask[] (from fast pipeline)
- For each task: Pinecone semantic search → top-5 candidates
- GPT-4o-mini picks best match from candidates (with confidence: high/medium/low/none)
- Enriches tasks with: onetTaskId, onetTaskDescription, similarityScore, gwaCategory
- Runs in background while user starts rating tasks
- Output: Enriched `ProcessedTask[]`

### API Routes

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
| `/api/transcribe` | POST | Transcribe voice input (if voice enabled) |

### Data Flow

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

Client-side state flows through `sessionStorage`:
- `surveyJobTitle`, `surveyOccupationCode`, `surveyOccupationTitle` — Job info
- `surveyExampleTasks` — Pre-fetched LLM-generated example tasks
- `surveyChatHistory` — Chat transcript for processing
- `surveyTasks` — Processed tasks for data collection

## Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX_HOST=https://your-index.svc.pinecone.io
PINECONE_NAMESPACE=__default__

# Feature flags
SURVEY_ENABLED=true
SURVEY_VOICE_ENABLED=false
```

## Key Types (`src/types/survey.ts`)

- `GWACategory` — `informationInput | mentalProcesses | workOutput | interactingWithOthers`
- `ChatMessage` — Chat message with role, content, timestamp
- `ProcessedTask` — Task after LLM extraction with O*NET match
- `TaskWithData` — ProcessedTask + user's time % and AI usage data

## Data Files

- `src/data/onet/gwa-categories.json` — GWA category definitions (4 categories)

---

## Prompts (Verbatim)

All prompt templates from `src/lib/chat/agent/prompts.ts`, copied word-for-word. Dynamic values shown as `${variable}`.

### AGENT_SYSTEM_PROMPT

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

### buildOpeningPrompt(jobTitle)

```
You are a friendly assistant helping to understand what someone does at work.

The user's job title is: ${jobTitle}

Generate a warm opening that:
1. Acknowledges their job title naturally
2. Asks them to tell you everything about what they do
3. Encourages detail and specificity

Keep it to 2-3 sentences. Don't include greetings like "Hi!" or "Hello!" - start directly with the substance.
```

### buildToolSelectionPrompt(state)

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

### buildCustomQuestionPrompt(question, state)

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

### buildEncourageMorePrompt(state)

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

### buildShowSuggestionsPrompt(state)

```
You're helping someone describe their work tasks and want to show them some suggestions.

Job title: ${state.jobTitle}

Generate a brief message to introduce task suggestions.
DO NOT preview or list any specific tasks — the cards will speak for themselves.
Just say something like "Here are some common tasks that might apply to your work — select any that fit."

Keep it to 1-2 sentences. Be brief and conversational.
```

### buildOfferToProceedPrompt(state)

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

### buildProceedPrompt(state)

```
You're ending a conversation about someone's work tasks.

Job title: ${state.jobTitle}
Estimated tasks captured: ${state.estimatedTaskCount}

Generate a brief closing message confirming we have enough information.
Thank them and let them know they can proceed to review their tasks.

Keep it to 1-2 sentences. Be warm and appreciative.
```

### buildInitialDumpResponsePrompt(initialTasks, state)

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

### buildONetGapAnalysisPrompt({ state, onetTasks, initialInput? })

This unified prompt handles BOTH initial dump responses AND mid-conversation custom_question tool.

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

### buildSuggestionGenerationPrompt(params)

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

### buildCompletenessCheckPrompt(tasks, jobTitle)

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

### State Analysis Prompt (in state-service.ts)

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
