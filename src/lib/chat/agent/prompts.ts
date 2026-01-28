import type { AgentState, AgentTool, GWACoverage } from "./agent-types";

/**
 * System prompt for the task elicitation agent
 * This guides all response generation
 */
export const AGENT_SYSTEM_PROMPT = `You are a friendly assistant helping someone describe their work tasks.

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
- Encourage specificity without being demanding`;

/**
 * Opening prompt — used for turn 1
 * Spec: "Tell me everything about your work"
 */
export function buildOpeningPrompt(jobTitle: string): string {
  return `You are a friendly assistant helping to understand what someone does at work.

The user's job title is: ${jobTitle}

Generate a warm opening that:
1. Acknowledges their job title naturally
2. Asks them to tell you everything about what they do
3. Encourages detail and specificity

Keep it to 2-3 sentences. Don't include greetings like "Hi!" or "Hello!" - start directly with the substance.`;
}

/**
 * Tool selection prompt
 * The LLM decides which conversational tool to use based on context
 * Now includes O*NET tasks for smarter gap detection and coverage assessment
 */
export function buildToolSelectionPrompt(
  state: AgentState,
  onetTasks: string[] = []
): string {
  const taskList =
    state.mentionedActivities.length > 0
      ? state.mentionedActivities.map((t, i) => `${i + 1}. ${t}`).join("\n")
      : "(no tasks mentioned yet)";

  const gwaSummary = Object.entries(state.gwaCoverage)
    .map(([category, level]) => {
      const labels: Record<string, string> = {
        informationInput: "Information gathering (reading, researching, monitoring)",
        mentalProcesses: "Analysis & decisions (analyzing, planning, problem-solving)",
        workOutput: "Producing outputs (writing, creating, building)",
        interactingWithOthers: "Working with people (communicating, coordinating, presenting)",
      };
      return `- ${labels[category]}: ${level}`;
    })
    .join("\n");

  // Format recent conversation history (last 6 messages)
  const recentHistory = state.conversationHistory.slice(-6)
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join("\n\n");

  // Format O*NET tasks if available
  const onetTaskList = onetTasks.length > 0
    ? onetTasks.slice(0, 15).map((t, i) => `${i + 1}. ${t}`).join("\n")
    : "(O*NET data not available)";

  // Build O*NET section only if tasks are available
  const onetSection = onetTasks.length > 0 ? `
REFERENCE — Typical tasks for a SIMILAR role (from O*NET database):
${onetTaskList}

CRITICAL — O*NET MATCH MAY NOT BE EXACT:
The reference tasks above are from an O*NET occupation that matched "${state.jobTitle}", but the match is often IMPRECISE.
- Example: "policy analyst" might match to "climate policy analyst" — IGNORE climate-specific tasks
- Example: "software engineer" might match to "mining software engineer" — IGNORE mining-specific tasks
- ONLY consider work that a GENERAL "${state.jobTitle}" would realistically do
- When assessing coverage, focus on BROAD work categories (communication, analysis, planning, documentation) not niche specializations
- If an O*NET task seems too domain-specific for a general ${state.jobTitle}, ignore it when assessing coverage

USE O*NET TO INFORM YOUR DECISION:
- Compare what the user has mentioned to the GENERAL work areas in the O*NET reference
- If user has covered 70%+ of GENERAL work areas → consider offer_to_proceed
- If there's an obvious gap in GENERAL areas → use custom_question with a specific gapArea
- Ask about broad categories, NOT specific O*NET task statements
  - Good: "Do you do any data analysis or reporting?"
  - Bad: "Do you prepare technical reports for regulatory compliance?" (too specific)

COVERAGE ASSESSMENT:
Compare what the user has mentioned against the GENERAL work areas in the O*NET reference.
Remember: O*NET tasks may be too niche — only count coverage of areas that apply to a GENERAL ${state.jobTitle}.

- "high": User has covered 70%+ of GENERAL work areas that apply to this role
- "medium": User has covered 40-70% of applicable work areas
- "low": User has covered less than 40% of applicable work areas

Domain-specific O*NET tasks (e.g., "climate policy" for a general "policy analyst") should NOT count against coverage.

If onetCoverage is "high" and user has 8+ tasks → strongly prefer offer_to_proceed
` : "";

  return `You're helping capture work tasks for a "${state.jobTitle}". Your goal is to get a COMPLETE picture of their job.

CURRENT STATE:
- Turn: ${state.turnCount}
- Tasks captured: ~${state.estimatedTaskCount}
- User engagement: ${state.userEngagement} (${state.userEngagement === "high" ? "detailed responses" : state.userEngagement === "medium" ? "moderate responses" : "short/vague responses"})

RECENT CONVERSATION:
${recentHistory || "(conversation just started)"}

Activities mentioned so far:
${taskList}

Coverage by work category:
${gwaSummary}
${onetSection}
AVAILABLE TOOLS - Pick the BEST one for this situation:

1. "custom_question" - Ask about an area that seems underexplored for this role (PREFERRED)
   USE WHEN: User is engaged and there are gaps compared to typical work for this job
   PROVIDE: A natural, conversational question about what's missing + the gapArea

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
  "gapArea": "the general area of work that's missing (only for custom_question)",
  "question": "the follow-up question to ask (only for custom_question)"${onetTasks.length > 0 ? `,
  "onetCoverage": "high" | "medium" | "low"` : ""}
}`;
}

/**
 * Completeness check prompt (simplified, used as backup)
 */
export function buildCompletenessCheckPrompt(
  tasks: string[],
  jobTitle: string
): string {
  const taskList =
    tasks.length > 0
      ? tasks.map((t, i) => `${i + 1}. ${t}`).join("\n")
      : "(no tasks mentioned yet)";

  return `You're helping capture the work tasks of a "${jobTitle}".

Tasks described so far:
${taskList}

Does this seem like a reasonably complete picture? Are there obvious gaps?

Respond in JSON:
{
  "seems_complete": true or false,
  "confidence": "high" | "medium" | "low",
  "gap_area": "brief description of what's missing, or null if complete",
  "suggested_question": "a natural follow-up question to ask, or null if complete"
}`;
}

/**
 * Custom question prompt — when LLM identified a specific gap
 */
export function buildCustomQuestionPrompt(
  question: string,
  state: AgentState
): string {
  // Get last user message and recent history
  const lastUserMsg = state.conversationHistory.filter(m => m.role === "user").slice(-1)[0];
  const recentHistory = state.conversationHistory.slice(-4)
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join("\n\n");

  return `Generate a natural, conversational way to ask this follow-up question:
"${question}"

Job title: ${state.jobTitle}
Turn count: ${state.turnCount}

Recent conversation:
${recentHistory || "(none yet)"}

${lastUserMsg ? `They just said: "${lastUserMsg.content}"` : ""}

1. First, briefly acknowledge what they just shared
2. Then ask the question in a natural way

Keep it brief (1-2 sentences). NEVER repeat something you already asked above.`;
}

/**
 * Encourage more prompt — context-aware follow-up question
 * Uses gap analysis when suggestions were confirmed, generic otherwise
 */
export function buildEncourageMorePrompt(state: AgentState): string {
  // Get the last user message for context
  const lastUserMsg = state.conversationHistory.filter(m => m.role === "user").slice(-1)[0];
  const recentHistory = state.conversationHistory.slice(-4)
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join("\n\n");

  // If user just confirmed suggestions, use LLM gap analysis for smarter follow-up
  if (state.selectedSuggestionIds.length > 0) {
    const taskList = state.mentionedActivities.length > 0
      ? state.mentionedActivities.map((t, i) => `${i + 1}. ${t}`).join("\n")
      : "(no tasks yet)";

    return `You're helping a "${state.jobTitle}" describe their work tasks.
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

Keep it to 2 sentences. Be conversational, not interrogative.`;
  }

  // Standard encourage more prompt
  return `You're helping someone describe their work tasks.

Job title: ${state.jobTitle}
Estimated tasks captured: ${state.estimatedTaskCount}

Recent conversation:
${recentHistory || "(none yet)"}

${lastUserMsg ? `They just said: "${lastUserMsg.content}"` : ""}

Generate an encouraging message to get them to share more about their work.
- First, briefly acknowledge what they JUST shared (be specific, reference their words)
- Then ask if there's anything else they do regularly

Keep it brief (1-2 sentences) and warm. NEVER repeat a question you already asked in the conversation above.`;
}

/**
 * Show suggestions prompt — introducing O*NET task suggestions
 */
export function buildShowSuggestionsPrompt(state: AgentState): string {
  return `You're helping someone describe their work tasks and want to show them some suggestions.

Job title: ${state.jobTitle}

Generate a brief message to introduce task suggestions.
DO NOT preview or list any specific tasks — the cards will speak for themselves.
Just say something like "Here are some common tasks that might apply to your work — select any that fit."

Keep it to 1-2 sentences. Be brief and conversational.`;
}

/**
 * Offer to proceed prompt — we think we have enough, but user can add more
 */
export function buildOfferToProceedPrompt(state: AgentState): string {
  return `You're helping someone describe their work tasks and they've shared a good amount.

Job title: ${state.jobTitle}
Estimated tasks captured: ${state.estimatedTaskCount}
Turn count: ${state.turnCount}

Generate a message that:
1. Acknowledges they've shared good detail about their work
2. Offers to continue if they have more to add
3. Gives them the option to proceed to the next step

Keep it brief (2-3 sentences). Sound satisfied with what they've shared but not pushy about ending.`;
}

/**
 * Proceed prompt — ending the conversation
 */
export function buildProceedPrompt(state: AgentState): string {
  return `You're ending a conversation about someone's work tasks.

Job title: ${state.jobTitle}
Estimated tasks captured: ${state.estimatedTaskCount}

Generate a brief closing message confirming we have enough information.
Thank them and let them know they can proceed to review their tasks.

Keep it to 1-2 sentences. Be warm and appreciative.`;
}

/**
 * Initial dump response prompt — when user provides initial tasks upfront
 * Acknowledges what they shared and ALWAYS asks a clarifying question about potential gaps
 */
export function buildInitialDumpResponsePrompt(
  initialTasks: string,
  state: AgentState
): string {
  const taskList =
    state.mentionedActivities.length > 0
      ? state.mentionedActivities.map((t, i) => `${i + 1}. ${t}`).join("\n")
      : "(parsing in progress)";

  const gwaSummary = Object.entries(state.gwaCoverage)
    .map(([category, level]) => {
      const labels: Record<string, string> = {
        informationInput: "Information gathering (reading, researching, monitoring)",
        mentalProcesses: "Analysis & decisions (analyzing, planning, problem-solving)",
        workOutput: "Producing outputs (writing, creating, building)",
        interactingWithOthers: "Working with people (communicating, coordinating, presenting)",
      };
      return `- ${labels[category]}: ${level}`;
    })
    .join("\n");

  // Find gaps (categories with "none" or "low" coverage)
  const gaps = Object.entries(state.gwaCoverage)
    .filter(([_, level]) => level === "none" || level === "low")
    .map(([category]) => {
      const labels: Record<string, string> = {
        informationInput: "gathering information or researching",
        mentalProcesses: "analyzing data or making decisions",
        workOutput: "creating deliverables or outputs",
        interactingWithOthers: "working with or coordinating with others",
      };
      return labels[category];
    });

  // Even if coverage seems good, suggest areas to probe
  const potentialGapAreas = [
    "occasional or periodic tasks (monthly reports, quarterly reviews, annual planning)",
    "problem-solving or troubleshooting activities",
    "administrative tasks (scheduling, expense reports, documentation)",
    "learning or staying current in your field",
  ];

  // Pick a random potential gap area for variety
  const randomGapSuggestion = potentialGapAreas[state.turnCount % potentialGapAreas.length];

  return `You're helping a "${state.jobTitle}" describe their work tasks.

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
   ${gaps.length > 0
     ? `- A gap area like ${gaps[0]} (PREFERRED - this area wasn't well covered)
   - OR tasks they might have missed (periodic responsibilities, less common tasks)`
     : `- Tasks they might have missed: ${randomGapSuggestion}
   - OR variations/details of their core tasks they didn't fully explain`}
3. Sound curious and conversational, not like you're checking boxes

Keep it to 2-3 sentences total. Don't list back what they said - show you understood and probe for what's missing.

Example good responses:
- "Sounds like you spend a lot of time on sprint planning and stakeholder communication. What about the more analytical side — do you dig into data or metrics as part of your role?"
- "That's a great overview of your day-to-day! Are there any periodic tasks you handle — like monthly reports, quarterly reviews, or annual planning activities?"
- "Great detail on the core work! Do you handle any troubleshooting or problem-solving when things don't go as planned?"

Example bad response: "Thank you for sharing! You mentioned meetings, specs, and feedback review. Now let me ask about information gathering activities."`;
}

/**
 * Unified O*NET gap analysis prompt — handles both initial dump and mid-conversation contexts
 * Identifies gaps compared to O*NET reference tasks and generates role-relevant questions
 */
export interface ONetGapAnalysisParams {
  state: AgentState;
  onetTasks: string[];
  initialInput?: string; // Only for initial dump context
}

export function buildONetGapAnalysisPrompt(params: ONetGapAnalysisParams): string {
  const { state, onetTasks, initialInput } = params;
  const isInitialDump = !!initialInput;

  const onetTaskList = onetTasks
    .slice(0, 15)
    .map((t, i) => `${i + 1}. ${t}`)
    .join("\n");

  // Adapt context section based on initial dump vs mid-conversation
  let contextSection: string;

  if (isInitialDump) {
    contextSection = `WHAT THE USER JUST SHARED:
---
${initialInput}
---

Read this carefully and note EVERYTHING they mentioned.`;
  } else {
    const recentHistory = state.conversationHistory
      .slice(-8)
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join("\n\n");

    const mentionedList =
      state.mentionedActivities.length > 0
        ? state.mentionedActivities.map((t, i) => `${i + 1}. ${t}`).join("\n")
        : "(none yet)";

    contextSection = `CONVERSATION SO FAR:
${recentHistory || "(conversation just started)"}

ACTIVITIES ALREADY MENTIONED:
${mentionedList}`;
  }

  return `You're helping a "${state.jobTitle}" describe their work tasks.

${contextSection}

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
  "suggestedQuestion": "broad, natural question (1-2 sentences${isInitialDump ? ", acknowledge what they shared first" : ""})"
}`;
}

/**
 * Completeness assessment prompt for initial dump
 * Used to determine if user provided comprehensive enough info to skip chat
 */
export interface CompletenessAssessmentParams {
  jobTitle: string;
  userInput: string;
  mentionedActivities: string[];
  onetTasks: string[];
}

export function buildCompletenessAssessmentPrompt(params: CompletenessAssessmentParams): string {
  const { jobTitle, userInput, mentionedActivities, onetTasks } = params;

  const activitiesList = mentionedActivities.length > 0
    ? mentionedActivities.map((a, i) => `${i + 1}. ${a}`).join("\n")
    : "(none extracted)";

  const onetTaskList = onetTasks.slice(0, 15).map((t, i) => `${i + 1}. ${t}`).join("\n");

  return `Assess whether this initial task dump is comprehensive enough to skip follow-up questions.

JOB TITLE: ${jobTitle}

USER'S INPUT:
${userInput}

ACTIVITIES EXTRACTED:
${activitiesList}

TYPICAL TASKS FOR A SIMILAR ROLE (O*NET reference):
${onetTaskList}

CRITICAL — O*NET MATCH MAY NOT BE EXACT:
The reference tasks above are from an O*NET occupation that matched "${jobTitle}", but the match is often IMPRECISE.
- Example: "policy analyst" might match to "climate policy analyst" — IGNORE climate-specific tasks
- Example: "software engineer" might match to "mining software engineer" — IGNORE mining-specific tasks
- ONLY consider work that a GENERAL "${jobTitle}" would realistically do
- When assessing coverage, focus on BROAD work categories (communication, analysis, planning, documentation)
- If an O*NET task seems too domain-specific for a general ${jobTitle}, ignore it when assessing coverage

ASSESSMENT CRITERIA:
- "high" coverage: User has covered 70%+ of the GENERAL work areas that apply to a ${jobTitle}
- "medium" coverage: User has covered 40-70% of applicable work areas
- "low" coverage: User has covered less than 40% of applicable work areas

The user doesn't need to mention every O*NET task — just cover the main GENERAL areas of work.
Niche or domain-specific O*NET tasks should NOT count against coverage.

Respond in JSON:
{
  "isComprehensive": true/false,
  "coverage": "high" | "medium" | "low",
  "missingAreas": ["area1", "area2"],
  "reason": "Brief explanation"
}

Set isComprehensive to true ONLY if coverage is "high" AND there are no critical missing areas.`;
}

/**
 * Build response prompt based on tool selection
 * This is the main entry point for response generation
 */
export function buildResponsePrompt(
  tool: AgentTool,
  state: AgentState,
  params?: {
    question?: string;
    gapArea?: string;
    activity?: string;
    initialTasks?: string;
  }
): string {
  // Special case: responding to initial task dump
  // But skip this if show_suggestions was selected — use the suggestions prompt instead
  if (params?.initialTasks && tool !== "show_suggestions") {
    return buildInitialDumpResponsePrompt(params.initialTasks, state);
  }

  switch (tool) {
    case "open_ended_prompt":
      return buildOpeningPrompt(state.jobTitle);

    case "custom_question":
      if (params?.question) {
        return buildCustomQuestionPrompt(params.question, state);
      }
      return buildEncourageMorePrompt(state);

    case "show_suggestions":
      return buildShowSuggestionsPrompt(state);

    case "encourage_more":
      return buildEncourageMorePrompt(state);

    case "offer_to_proceed":
      return buildOfferToProceedPrompt(state);

    case "proceed":
      return buildProceedPrompt(state);

    default:
      return buildEncourageMorePrompt(state);
  }
}

/**
 * Suggestion generation prompt — generates contextual O*NET-style task suggestions
 */
export function buildSuggestionGenerationPrompt(params: {
  jobTitle: string;
  conversationHistory: Array<{ role: string; content: string }>;
  gwaCoverage: GWACoverage;
  mentionedActivities: string[];
  excludeStatements: string[];
  count: number;
}): string {
  const {
    jobTitle,
    conversationHistory,
    gwaCoverage,
    mentionedActivities,
    excludeStatements,
    count,
  } = params;

  // Format conversation history (last 6 messages for context)
  const recentHistory = conversationHistory
    .slice(-6)
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join("\n\n");

  // Format GWA coverage with priority indicator
  const gwaLevels = ["none", "low", "medium", "high"];
  const gwaSummary = Object.entries(gwaCoverage)
    .map(([category, level]) => {
      const labels: Record<string, string> = {
        informationInput: "Information Input (researching, monitoring, gathering data)",
        mentalProcesses: "Mental Processes (analyzing, deciding, planning)",
        workOutput: "Work Output (creating, producing, documenting)",
        interactingWithOthers: "Interacting with Others (communicating, coordinating, presenting)",
      };
      const levelIndex = gwaLevels.indexOf(level);
      const priority = levelIndex < 2 ? " ← PRIORITIZE" : "";
      return `- ${labels[category]}: ${level}${priority}`;
    })
    .join("\n");

  // Format mentioned activities
  const activitiesList =
    mentionedActivities.length > 0
      ? mentionedActivities.join(", ")
      : "(none mentioned yet)";

  // Format exclusions
  const exclusions =
    excludeStatements.length > 0
      ? excludeStatements.map((s) => `- ${s}`).join("\n")
      : "(none)";

  return `You are generating task suggestions for a "${jobTitle}".

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
}`;
}

