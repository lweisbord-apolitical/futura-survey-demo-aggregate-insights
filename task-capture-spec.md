# Task Capture & O*NET Matching Tool
## High-Level Product Spec (v0.5)

---

### Overview

A conversational survey tool that captures what workers actually do, matches their tasks to the O*NET database, and collects data on time allocation and AI usage.

---

### Core Flow (Summary)

| Step | What happens | User sees |
|------|--------------|-----------|
| 1. Job Title | Enter/confirm job title | Simple input |
| 2. Task Capture | Conversational chat with GWA-aligned probing | Chat interface |
| 3. Task Generation | AI processes raw input → task list | Loading state |
| 4. Task Review | User reviews, edits, adds tasks | Editable task list |
| 5. Time & AI Input | User adds time % and AI usage per task | Same screen, more fields |
| 6. O*NET Matching | System matches tasks → O*NET + scores | Loading state (brief) |
| 7. Complete | Data captured, session ends | Thank you / summary |

---

### Key Design Decisions

| Decision | Approach |
|----------|----------|
| Task capture method | Conversational (not form-based) |
| Input modality | Voice + text (voice encouraged) |
| Task matching | Semantic match to real O*NET tasks |
| AI exposure scoring | Pre-computed from O*NET database |
| AI usage question | 5-point frequency scale (survey best practice) |
| Time collection | Relative (not absolute hours) |
| Scope | Framework works across all job roles |

---

### GWA-Aligned Probing Framework (Task Capture)

Based on O*NET's validated **Generalized Work Activities (GWA)** methodology. The chatbot tracks coverage across 4 categories and probes gaps — without revealing the framework to the user.

| GWA Category | What it covers | Example probes |
|--------------|----------------|----------------|
| **Information Input** | How you get information — research, monitoring, observing | "How do you find out what you need to know for your work?" |
| **Mental Processes** | Analysis, decisions, planning, problem-solving | "What kinds of decisions do you make? What do you analyze or figure out?" |
| **Work Output** | Creating, writing, physical work, using tools/computers | "What do you actually produce or create? Documents, code, products?" |
| **Interacting with Others** | Communication, coordination, teaching, supervising | "Who do you work with? How do you communicate or coordinate?" |

**Additional probes (Critical Incident Technique):**
- "What's the most challenging part of your job?"
- "Think of a recent problem you had to solve — what did you do?"

These surface edge-case tasks that routine probing might miss.

**Coverage rules:**
- Must have at least 1 task in each GWA category before concluding
- Aim for 10-20 total tasks
- If user seems done but coverage is thin, probe the weakest category
- Track confidence per category (low/medium/high)

---

### Inline Example Task Suggestions

When the user isn't providing much detail or seems stuck, the chatbot shows **clickable task suggestions** inline — not as a separate screen, but as part of the natural chat flow.

**When to show:**
- User gives a short/vague response
- User says "that's about it" or similar but coverage is thin
- Any GWA category has no coverage yet
- Total tasks < 5

**How it appears in chat:**

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  🤖  Got it! People in Policy Advisor roles often          │
│      also do things like:                                  │
│                                                            │
│      ┌─────────────────────────────────────┐               │
│      │  📋 Analyze policy issues           │  ← tap to add │
│      └─────────────────────────────────────┘               │
│      ┌─────────────────────────────────────┐               │
│      │  📋 Review legislation for impacts  │  ← tap to add │
│      └─────────────────────────────────────┘               │
│      ┌─────────────────────────────────────┐               │
│      │  📋 Prepare briefing documents      │  ← tap to add │
│      └─────────────────────────────────────┘               │
│                                                            │
│      Tap any that apply, or tell me more about what you do.│
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Tapping a card instantly adds it (card shows ✓ and grays out)
- User can keep chatting normally — suggestions don't block flow
- Selected tasks marked as `source: suggested` in data
- Suggestions refresh based on what's already been captured

**How it works:**
1. Map user's job title → closest O*NET occupation(s)
2. Pull top tasks for that occupation (by importance/frequency)
3. Filter out tasks semantically similar to what user already mentioned
4. Show 3-4 as tappable cards, prioritizing uncovered GWA categories
5. Tapped tasks added to `raw_inputs[]` with `source: suggested`

**Benefits:**
- Feels like a helpful prompt, not a forced step
- Reduces friction — one tap vs. typing
- Ensures coverage even with quiet users
- Uses validated O*NET tasks (not AI-generated)
- We can track organic vs. suggested task ratio

---

### Chatbot Logic (Detailed)

The chatbot operates as a **goal-driven agent** with access to conversational tools. Rather than following a rigid phase sequence, it continuously assesses the state and chooses the best action to reach comprehensive task coverage.

---

#### Agent Goals (Priority Order)

```
PRIMARY GOAL: Capture 10-20 distinct tasks covering all 4 GWA categories

Exit conditions (ready to proceed when ALL are true):
  ✓ estimated_task_count >= 8
  ✓ all GWA categories have at least LOW coverage
  ✓ user has had chance to add more (offered at least once)

Hard stop (proceed even if goals not met):
  - turn_count >= 12
  - user explicitly wants to stop (said "done" twice)
  - user clicked "Done" button
```

---

#### Agent State (Updated After Every Turn)

```
state: {
  turn_count: number,

  // Task tracking
  estimated_task_count: number,        // rough count from parsing
  mentioned_activities: string[],      // things user mentioned
  underexplored_activities: string[],  // mentioned but not detailed

  // GWA coverage (updated by classifier after each response)
  gwa_coverage: {
    information_input: "none" | "low" | "medium" | "high",
    mental_processes: "none" | "low" | "medium" | "high",
    work_output: "none" | "low" | "medium" | "high",
    interacting_with_others: "none" | "low" | "medium" | "high"
  },

  // Tracking what we've tried
  actions_taken: string[],             // which tools we've used
  follow_ups_asked: number,            // how many deep-dive questions
  suggestions_shown: number,           // how many times shown task cards

  // User signals
  user_engagement: "high" | "medium" | "low",  // based on response length/detail
  user_wants_to_stop: boolean          // said "that's it" or similar
}
```

---

#### Agent Tools (Actions It Can Take)

The chatbot chooses ONE action per turn based on state assessment:

| Tool | When to use | What it does |
|------|-------------|--------------|
| **`open_ended_prompt`** | Turn 1 only | "Tell me everything about your job" — let them dump |
| **`follow_up`** | Have underexplored activities | "You mentioned X — what does that involve?" |
| **`custom_question`** | Gaps compared to typical work for this role | O*NET-grounded question about underexplored area |
| **`critical_incident`** | Haven't used yet, need variety | "What's the hardest part?" / "Recent problem?" |
| **`show_suggestions`** | User engagement low OR stuck OR coverage gaps | Show tappable O*NET task cards |
| **`encourage_more`** | Good progress but could use more | "Anything else?" without pressure |
| **`offer_to_proceed`** | Exit conditions nearly met | "I think I've got a good picture — ready to continue?" |
| **`proceed`** | Exit conditions met OR hard stop | Move to task generation |

---

#### Decision Logic (Each Turn)

```python
def choose_action(state):

    # Turn 1: Always start open-ended
    if state.turn_count == 0:
        return open_ended_prompt()

    # Hard stop conditions
    if state.turn_count >= 12 or state.user_wants_to_stop:
        return proceed()

    # Check if ready to proceed
    if is_ready_to_proceed(state):
        if not state.actions_taken.includes("offer_to_proceed"):
            return offer_to_proceed()
        return proceed()

    # Low engagement → show suggestions to help them along
    if state.user_engagement == "low" and state.suggestions_shown < 2:
        return show_suggestions(prioritize_uncovered_gwas=True)

    # Have unexplored things they mentioned → follow up
    if len(state.underexplored_activities) > 0 and state.follow_ups_asked < 3:
        activity = pick_most_interesting(state.underexplored_activities)
        return follow_up(activity)

    # GWA gaps → ask O*NET-grounded question about missing areas
    missing_gwas = get_gwas_with_no_coverage(state)
    if len(missing_gwas) > 0:
        return custom_question()  # O*NET grounding detects gaps automatically

    # Haven't tried critical incident yet → good for variety
    if "critical_incident" not in state.actions_taken:
        return critical_incident()

    # Low GWA coverage but already probed → try suggestions
    low_gwas = get_gwas_with_low_coverage(state)
    if len(low_gwas) > 0 and state.suggestions_shown < 3:
        return show_suggestions(target_gwas=low_gwas)

    # Default: encourage more or offer to proceed
    if state.estimated_task_count < 8:
        return encourage_more()
    else:
        return offer_to_proceed()


def is_ready_to_proceed(state):
    return (
        state.estimated_task_count >= 8 and
        all_gwas_have_coverage(state) and
        "encourage_more" in state.actions_taken or "offer_to_proceed" in state.actions_taken
    )
```

---

#### Tool Implementations

**`open_ended_prompt()`**
> "What do you actually do as a [Job Title]? Tell me everything — your typical tasks, responsibilities, what you spend your time on. The more detail the better."
>
> 💡 *Tip: Try the mic to talk through it — most people find it easier.*

---

**`follow_up(activity)`**

Pick from templates based on activity type:

| Activity type | Template |
|---------------|----------|
| Vague noun ("reports", "meetings") | "What kind of [X]? What's your role in them?" |
| Process ("handle X", "manage Y") | "Walk me through what that actually involves." |
| Output ("write X", "create Y") | "What does the final [X] look like? Who's it for?" |
| People ("work with X", "coordinate") | "Who specifically? What does that coordination involve?" |

---

**`critical_incident()`**

Pick one:
- "What's the most challenging part of your job?"
- "Think of a recent problem or unexpected situation — what did you have to do?"
- "What takes up more time than people might expect?"

---

**`show_suggestions(target_gwas=None)`**

```
Got it! People in similar [Job Title] roles often also do things like:

┌─────────────────────────────────────┐
│  📋 [O*NET task for target GWA]    │  ← tap to add
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  📋 [O*NET task for target GWA]    │  ← tap to add
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  📋 [O*NET task]                   │  ← tap to add
└─────────────────────────────────────┘

Tap any that apply, or tell me more about what you do!
```

Suggestions are:
- Pulled from O*NET tasks for matched occupation
- Filtered to exclude things similar to what user already said
- Prioritized by target GWAs if specified

When user taps a card:
1. Mark it as added (✓)
2. Follow up: "Added! What does that actually involve for you?"

---

**`encourage_more()`**

Pick one (don't repeat):
- "Anything else that takes up a decent chunk of your time?"
- "Any other responsibilities I should know about?"
- "What about things that come up less often but are still part of your job?"

---

**`offer_to_proceed()`**

> "Great, I think I've got a good picture of your work! Before we move on — anything else you want to add?"
>
> [Continue →] [Add more]

---

#### Engagement Assessment

After each user response, assess engagement:

| Signal | Engagement level |
|--------|------------------|
| 50+ words, multiple activities, detail | **High** |
| 20-50 words, some activities, moderate detail | **Medium** |
| < 20 words, single phrase, vague | **Low** |
| "that's it", "not really", "I think that's everything" | **Wants to stop** |

---

#### GWA Classification

After each user response, a classifier updates GWA coverage by analyzing what was said:

| Coverage level | Meaning |
|----------------|---------|
| **None** | No tasks mentioned for this category |
| **Low** | 1 task, or vague mention |
| **Medium** | 2-3 tasks with some detail |
| **High** | 4+ tasks or rich detail in this area |

Example classification:
> "I research policy topics, write briefing papers, and coordinate with stakeholders"

- Information Input: **Low** (research mentioned but not detailed)
- Mental Processes: **None** (no analysis/decisions mentioned)
- Work Output: **Medium** (briefing papers = clear output)
- Interacting with Others: **Low** (coordination mentioned but vague)

---

#### Tone & Style Guidelines

- **Conversational, not robotic** — vary phrasing, don't repeat same structure
- **Acknowledge what they said** — "Got it", "Makes sense", "Interesting"
- **Don't over-explain** — keep prompts short after the opening
- **Don't be pushy** — if they want to move on, let them (but offer suggestions)
- **Match their energy** — if they're giving a lot, ask more; if they're brief, don't force it

**Avoid:**
- ❌ "Now let's talk about Information Input activities"
- ❌ "Question 3 of 5: What do you analyze?"
- ❌ Repeating the same question format multiple times

**Good:**
- ✅ "You mentioned reports — what kind?"
- ✅ "What about the research side? Where does that info come from?"
- ✅ "Anything else that takes up a chunk of your time?"

---

### Processing Pipeline (Detailed)

This section describes the data flow and processing logic in detail.

#### Stage 1: Raw Input Collection (Chat Phase)

**Trigger:** User completes chat (clicks "Done" or chatbot determines sufficient coverage)

**Input:**
- All user messages from the conversation (text + voice transcripts)
- Job title
- GWA coverage state

**Output:**
- `raw_inputs[]` — array of user statements, preserved verbatim

```
Example raw_inputs:
- "I write briefing papers for ministers"
- "coordinate with stakeholders"
- "review legislation drafts"
- "A final brief that goes to the minister, plus a summary for the comms team"
- "I research the topic, synthesize evidence, draft recommendations..."
```

---

#### Stage 2: Task Generation (AI Processing)

**Trigger:** User exits chat phase

**What happens:**
1. AI receives all `raw_inputs[]` + job title
2. AI extracts distinct tasks from the raw input
3. AI rewrites each as an **O*NET-style task statement**:
   - Action verb + object + context/purpose
   - Clear, specific, standalone
   - De-duplicated and normalized

**Prompt guidance for AI:**
- "Convert these user statements into distinct task statements"
- "Use O*NET task format: action verb + what + why/how"
- "Each task should be a single, specific activity"
- "Aim for 10-20 tasks; split compound statements"
- "Remove duplicates; keep the most specific version"

**Output:**
- `generated_tasks[]` — AI-generated task statements (not yet matched to O*NET)

```
Example generated_tasks:
1. "Research policy topics by reviewing academic literature and government reports"
2. "Synthesize evidence from multiple sources to support policy recommendations"
3. "Draft ministerial briefing papers summarizing policy options"
4. "Coordinate consultations with external stakeholders"
5. "Review draft legislation for policy implications"
6. "Prepare summary documents for communications team"
...
```

---

#### Stage 3: Task Review (User Validation)

**Trigger:** Task generation complete

**What user sees:**
- List of AI-generated tasks
- Ability to:
  - ✏️ Edit task wording
  - ❌ Delete tasks that are wrong
  - ➕ Add tasks that were missed
  - 🔀 Merge tasks that are duplicates

**Why this matters:**
- AI won't be perfect — user is the authority on their own job
- Catches hallucinations or misinterpretations
- Allows adding tasks the chat didn't surface
- User feels ownership of the final list

**Output:**
- `validated_tasks[]` — user-approved task list

---

#### Stage 4: Time & AI Usage Input

**Trigger:** User confirms task list (or happens on same screen)

**What user sees:**
For each task:
- **Time slider:** "What % of your time does this take?" (should sum to ~100%)
- **AI usage scale:** "How often do you use AI for this?" (1-5: Never → Always)
- **AI detail field:** "Tell us how you use AI" (optional free text, shown when 2-5 selected)

**Validation:**
- Time percentages should sum to approximately 100% (allow 90-110% with warning)
- All tasks must have AI usage rating before proceeding

**Output:**
- `validated_tasks[]` now includes:
  - `relative_time` (%)
  - `ai_usage_frequency` (1-5)
  - `ai_usage_detail` (string, optional)

---

#### Stage 5: O*NET Matching (Background Processing)

**Trigger:** User submits completed task list

**What happens:**
1. For each `validated_task`:
   - Generate embedding (or keyword extraction)
   - Compare against all 18,000 O*NET task embeddings
   - Find best match(es) above confidence threshold
2. Pull **AI exposure score** for matched O*NET task
3. Calculate aggregate metrics

**Matching approach: OpenAI Embeddings**

Using OpenAI's `text-embedding-3-small` or `text-embedding-3-large` for semantic matching:

1. **Pre-compute:** Generate embeddings for all 18,000 O*NET task statements (one-time, store in vector DB)
2. **At runtime:** Generate embedding for each user task
3. **Match:** Cosine similarity against O*NET embeddings
4. **Return:** Top match(es) above confidence threshold

**Why OpenAI embeddings over SBERT:**
- Higher quality representations for nuanced task language
- Better handling of paraphrases and synonyms
- No need to host/fine-tune models
- `text-embedding-3-small` is fast and cheap (~$0.02 per 1M tokens)

**Output per task:**
```
{
  user_task: "Draft ministerial briefing papers...",
  matched_onet_task: {
    id: "4.A.2.b.1.I.1.A",
    statement: "Prepare reports summarizing information or trends",
    occupation: "Policy Analyst"
  },
  match_confidence: 0.87,
  ai_exposure_score: 0.72  // from pre-computed O*NET mapping
}
```

**Handling low-confidence matches:**
- If confidence < threshold (e.g., 0.5): flag as "no strong O*NET match"
- Still capture the task — it's valid work even if O*NET doesn't have it
- May indicate emerging tasks or job-specific work

---

#### Stage 6: Final Output

**What we now have for each task:**

| Field | Source | Description |
|-------|--------|-------------|
| `user_task_statement` | User (validated) | The task in user's words (O*NET style) |
| `relative_time` | User input | % of time spent on this task |
| `ai_usage_frequency` | User input | 1-5 scale |
| `ai_usage_detail` | User input | Free text (optional) |
| `matched_onet_task_id` | System | Best matching O*NET task ID |
| `matched_onet_statement` | System | O*NET task wording |
| `match_confidence` | System | How confident the match is (0-1) |
| `ai_exposure_score` | System | Pre-computed exposure for O*NET task (0-1) |

**Aggregate metrics we can calculate:**
- **Weighted AI exposure:** Σ(time% × ai_exposure_score) across all tasks
- **Actual AI usage:** Σ(time% × ai_usage_frequency) across all tasks
- **Exposure vs. Usage gap:** Where predicted exposure differs from actual usage
- **Coverage quality:** % of tasks with high-confidence O*NET matches

---

### AI Usage Question Design

Following survey methodology best practices:

**Question:** "How often do you use AI tools (like ChatGPT, Copilot, etc.) for this task?"

| Value | Label | Meaning |
|-------|-------|---------|
| 1 | Never | I don't use AI for this |
| 2 | Rarely | Occasionally, for specific situations |
| 3 | Sometimes | Maybe half the time |
| 4 | Often | More often than not |
| 5 | Always | I use AI every time I do this |

**Follow-up (optional, encouraged):** "Want to share how you're using AI for this?" → free text

---

### Data Model

```
Session
├── id (uuid)
├── job_title (string)
├── job_title_standardized (string, mapped to DB)
├── created_at (timestamp)
├── completed_at (timestamp)
│
├── chat_phase
│   ├── raw_inputs[] (user's original statements)
│   │   ├── content (string)
│   │   ├── input_type (text | voice | suggested)
│   │   ├── suggested_from_onet (boolean, if from example tasks)
│   │   └── timestamp
│   └── gwa_coverage  // aligned with O*NET GWA categories
│       ├── information_input (low | medium | high)
│       ├── mental_processes (low | medium | high)
│       ├── work_output (low | medium | high)
│       └── interacting_with_others (low | medium | high)
│
├── generated_tasks[] (AI output, pre-validation)
│   ├── statement (string)
│   └── source_inputs[] (which raw_inputs contributed)
│
├── validated_tasks[] (user-approved final list)
│   ├── id (uuid)
│   ├── statement (string, possibly edited by user)
│   ├── source (organic | suggested | manual)  // how task originated
│   ├── was_edited (boolean)
│   ├── was_deleted (boolean, for tracking)
│   │
│   ├── relative_time (0-100, %)
│   ├── ai_usage_frequency (1-5)
│   ├── ai_usage_detail (string, optional)
│   │
│   ├── onet_match
│   │   ├── task_id (string)
│   │   ├── task_statement (string)
│   │   ├── occupation_code (string)
│   │   ├── occupation_title (string)
│   │   └── confidence (0-1)
│   │
│   └── ai_exposure_score (0-1, from O*NET mapping)
│
└── aggregate_metrics
    ├── weighted_ai_exposure (float)
    ├── weighted_ai_usage (float)
    ├── exposure_usage_gap (float)
    ├── avg_match_confidence (float)
    └── pct_high_confidence_matches (float)
```

---

### Open Questions

- How to handle tasks that don't match O*NET well?
- What's the minimum viable task count? (Currently 10)
- Should we show users the O*NET match or just use it internally?
- Voice: transcription service? Real-time vs. after recording?

---

*Next: Wireframe walkthrough*
