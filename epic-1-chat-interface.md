# Epic 1: Chat Interface & Agent

**Project:** Task Capture Survey Tool (Futura)
**Epic:** Chat Interface & Agentic Task Elicitation
**Status:** V1 Implementation Spec

**Related Docs:**
- [Technical Implementation Plan](./technical-implementation.md)
- [Epic 2: O*NET Integration](./epic-2-onet-integration.md) — provides task suggestions
- [Epic 3: Task Processing](./epic-3-task-processing.md) — processes chat output
- [Epic 5: Job Title Mapping](./epic-5-job-title-mapping.md) — provides job title input

---

## Overview

This epic covers the conversational chat UI and the agentic backend that drives task elicitation. The chat replaces the existing form-based task input with a natural conversation that intelligently probes for comprehensive task coverage.

### Goals

1. Natural conversational interface for task input
2. Voice input support (mic button)
3. Agentic backend that dynamically selects prompting strategies
4. Inline O*NET task suggestions when user needs help
5. LLM-driven completeness checking (not rigid thresholds)

### User Flow

```
[Job Title entered]
    → Chat opens with opening prompt
    → User types/speaks about their work
    → Agent follows up, probes gaps, shows suggestions
    → User says "done" or agent determines sufficient coverage
    → [Proceed to Task Processing]
```

---

## Frontend Implementation

### File Structure

```
futura-ui/src/app/[locale]/futura/
├── chat/
│   └── page.tsx                          # /futura/chat route
├── _components/
│   └── chat/
│       ├── index.ts                      # Barrel export
│       ├── chat-container.tsx            # Main chat wrapper
│       ├── chat-header.tsx               # Title + progress indicator
│       ├── chat-messages.tsx             # Message list with auto-scroll
│       ├── chat-message.tsx              # Single message bubble
│       ├── chat-input.tsx                # Input bar + send + mic
│       ├── voice-input-button.tsx        # Mic with recording state
│       ├── task-suggestion-cards.tsx     # Tappable O*NET suggestions
│       ├── typing-indicator.tsx          # "..." animation
│       ├── gwa-progress-indicator.tsx    # Optional: visual coverage
│       └── context/
│           ├── chat-context.tsx          # Main context provider
│           ├── chat-types.ts             # TypeScript types
│           ├── chat-schemas.ts           # Zod schemas
│           ├── useChatMessages.ts        # Message state hook
│           ├── useChatAgent.ts           # Agent interaction hook
│           ├── useVoiceInput.ts          # Voice recording hook
│           └── useChatNavigation.ts      # Navigation (back, proceed)
```

---

### Component Specifications

#### `chat-container.tsx`

Main wrapper that provides layout and context.

```typescript
'use client';

import { useEffect, useRef } from 'react';
import { ChatProvider } from './context/chat-context';
import { ChatHeader } from './chat-header';
import { ChatMessages } from './chat-messages';
import { ChatInput } from './chat-input';

interface ChatContainerProps {
  jobTitle: string;
  occupationCode?: string;
  onComplete: (sessionId: string) => void;
}

export function ChatContainer({
  jobTitle,
  occupationCode,
  onComplete
}: ChatContainerProps) {
  return (
    <ChatProvider jobTitle={jobTitle} occupationCode={occupationCode}>
      <div className="flex flex-col h-[calc(100vh-4rem)] max-w-2xl mx-auto">
        <ChatHeader />
        <ChatMessages className="flex-1 overflow-y-auto" />
        <ChatInput onComplete={onComplete} />
      </div>
    </ChatProvider>
  );
}
```

#### `chat-message.tsx`

Individual message bubble with support for text, suggestions, and system messages.

```typescript
'use client';

import { cn } from '@apolitical/futura/lib/utils/utils';
import { TaskSuggestionCards } from './task-suggestion-cards';
import type { ChatMessage as ChatMessageType } from './context/chat-types';

interface ChatMessageProps {
  message: ChatMessageType;
  onSuggestionSelect?: (taskId: string) => void;
}

export function ChatMessage({ message, onSuggestionSelect }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-sm text-n-500 bg-n-100 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={cn(
      'flex mb-4',
      isUser ? 'justify-end' : 'justify-start'
    )}>
      <div className={cn(
        'max-w-[80%] rounded-2xl px-4 py-3',
        isUser
          ? 'bg-primary text-white rounded-br-md'
          : 'bg-n-100 text-n-900 rounded-bl-md'
      )}>
        <p className="whitespace-pre-wrap">{message.content}</p>

        {/* Inline suggestions */}
        {message.suggestions && message.suggestions.length > 0 && (
          <TaskSuggestionCards
            suggestions={message.suggestions}
            onSelect={onSuggestionSelect}
            className="mt-3"
          />
        )}
      </div>
    </div>
  );
}
```

#### `chat-input.tsx`

Input bar with text field, send button, and voice input.

```typescript
'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Button } from '@apolitical/futura/lib/elements/ui/button';
import { VoiceInputButton } from './voice-input-button';
import { useChatContext } from './context/chat-context';
import { SendIcon } from '@apolitical/futura/lib/elements/icons';

interface ChatInputProps {
  onComplete: (sessionId: string) => void;
}

export function ChatInput({ onComplete }: ChatInputProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, isLoading, canProceed, sessionId } = useChatContext();

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const message = inputValue.trim();
    setInputValue('');
    await sendMessage(message);

    // Auto-resize textarea back to default
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceResult = (transcript: string) => {
    setInputValue(prev => prev + transcript);
  };

  const handleProceed = () => {
    if (sessionId) {
      onComplete(sessionId);
    }
  };

  return (
    <div className="border-t border-n-200 p-4 bg-white">
      {/* Proceed button when ready */}
      {canProceed && (
        <div className="mb-3 flex justify-center">
          <Button onClick={handleProceed} variant="default">
            Continue to review tasks →
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              // Auto-resize
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder="Tell me about your work..."
            className="w-full resize-none rounded-2xl border border-n-300 px-4 py-3 pr-12
                       focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                       max-h-32 min-h-[48px]"
            rows={1}
            disabled={isLoading}
          />
        </div>

        <VoiceInputButton
          onResult={handleVoiceResult}
          disabled={isLoading}
        />

        <Button
          onClick={handleSend}
          disabled={!inputValue.trim() || isLoading}
          size="icon"
          className="rounded-full h-12 w-12"
        >
          <SendIcon className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
```

#### `voice-input-button.tsx`

Mic button with recording state and transcription.

```typescript
'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@apolitical/futura/lib/elements/ui/button';
import { MicIcon, StopIcon } from '@apolitical/futura/lib/elements/icons';
import { cn } from '@apolitical/futura/lib/utils/utils';

interface VoiceInputButtonProps {
  onResult: (transcript: string) => void;
  disabled?: boolean;
}

export function VoiceInputButton({ onResult, disabled }: VoiceInputButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });

        // Send to transcription endpoint
        const formData = new FormData();
        formData.append('audio', audioBlob);

        try {
          const response = await fetch('/api/futura-api/transcribe', {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            const { transcript } = await response.json();
            onResult(transcript);
          }
        } catch (error) {
          console.error('Transcription failed:', error);
        } finally {
          setIsProcessing(false);
        }

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, [onResult]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  return (
    <Button
      onClick={isRecording ? stopRecording : startRecording}
      disabled={disabled || isProcessing}
      size="icon"
      variant={isRecording ? 'destructive' : 'outline'}
      className={cn(
        'rounded-full h-12 w-12 transition-all',
        isRecording && 'animate-pulse'
      )}
    >
      {isProcessing ? (
        <span className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : isRecording ? (
        <StopIcon className="h-5 w-5" />
      ) : (
        <MicIcon className="h-5 w-5" />
      )}
    </Button>
  );
}
```

#### `task-suggestion-cards.tsx`

Inline tappable O*NET task suggestions.

```typescript
'use client';

import { useState } from 'react';
import { cn } from '@apolitical/futura/lib/utils/utils';
import { CheckIcon } from '@apolitical/futura/lib/elements/icons';
import type { ONetTaskSuggestion } from './context/chat-types';

interface TaskSuggestionCardsProps {
  suggestions: ONetTaskSuggestion[];
  onSelect: (taskId: string) => void;
  className?: string;
}

export function TaskSuggestionCards({
  suggestions,
  onSelect,
  className
}: TaskSuggestionCardsProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSelect = (taskId: string) => {
    if (selectedIds.has(taskId)) return;

    setSelectedIds(prev => new Set(prev).add(taskId));
    onSelect(taskId);
  };

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {suggestions.map((suggestion) => {
        const isSelected = selectedIds.has(suggestion.id);

        return (
          <button
            key={suggestion.id}
            onClick={() => handleSelect(suggestion.id)}
            disabled={isSelected}
            className={cn(
              'px-3 py-2 rounded-lg text-sm text-left transition-all',
              'border hover:border-primary hover:bg-primary/5',
              isSelected
                ? 'bg-green-50 border-green-300 text-green-800'
                : 'bg-white border-n-200 text-n-700'
            )}
          >
            <span className="flex items-center gap-2">
              {isSelected && <CheckIcon className="h-4 w-4 text-green-600" />}
              {suggestion.statement}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

---

### Context & State Management

#### `chat-types.ts`

```typescript
export type MessageRole = 'user' | 'assistant' | 'system';

export interface ONetTaskSuggestion {
  id: string;
  statement: string;
  gwaCategory: string;
  occupationCode: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  toolUsed?: string;
  suggestions?: ONetTaskSuggestion[];
}

export type GWACoverageLevel = 'none' | 'low' | 'medium' | 'high';

export interface GWACoverage {
  informationInput: GWACoverageLevel;
  mentalProcesses: GWACoverageLevel;
  workOutput: GWACoverageLevel;
  interactingWithOthers: GWACoverageLevel;
}

export type UserEngagement = 'high' | 'medium' | 'low';

export interface AgentState {
  turnCount: number;
  estimatedTaskCount: number;
  mentionedActivities: string[];
  underexploredActivities: string[];
  gwaCoverage: GWACoverage;
  actionsTaken: string[];
  followUpsAsked: number;
  suggestionsShown: number;
  gwaProbesAsked: string[];
  userEngagement: UserEngagement;
  userWantsToStop: boolean;
}

export interface ChatContextType {
  // State
  sessionId: string;
  messages: ChatMessage[];
  agentState: AgentState;
  isLoading: boolean;
  canProceed: boolean;

  // Actions
  sendMessage: (content: string) => Promise<void>;
  selectSuggestion: (taskId: string) => void;

  // Derived
  jobTitle: string;
  occupationCode?: string;
}
```

#### `chat-schemas.ts`

```typescript
import { z } from 'zod';

export const gwaCoverageLevelSchema = z.enum(['none', 'low', 'medium', 'high']);

export const gwaCoverageSchema = z.object({
  informationInput: gwaCoverageLevelSchema,
  mentalProcesses: gwaCoverageLevelSchema,
  workOutput: gwaCoverageLevelSchema,
  interactingWithOthers: gwaCoverageLevelSchema,
});

export const userEngagementSchema = z.enum(['high', 'medium', 'low']);

export const agentStateSchema = z.object({
  turnCount: z.number(),
  estimatedTaskCount: z.number(),
  mentionedActivities: z.array(z.string()),
  underexploredActivities: z.array(z.string()),
  gwaCoverage: gwaCoverageSchema,
  actionsTaken: z.array(z.string()),
  followUpsAsked: z.number(),
  suggestionsShown: z.number(),
  gwaProbesAsked: z.array(z.string()),
  userEngagement: userEngagementSchema,
  userWantsToStop: z.boolean(),
});

export const onetTaskSuggestionSchema = z.object({
  id: z.string(),
  statement: z.string(),
  gwaCategory: z.string(),
  occupationCode: z.string(),
});

export const chatMessageRequestSchema = z.object({
  sessionId: z.string(),
  message: z.string(),
  state: agentStateSchema,
  jobTitle: z.string(),
  occupationCode: z.string().optional(),
  selectedSuggestionIds: z.array(z.string()),
});

export const chatMessageResponseSchema = z.object({
  reply: z.string(),
  toolUsed: z.string(),
  suggestions: z.array(onetTaskSuggestionSchema).optional(),
  updatedState: agentStateSchema,
  shouldProceed: z.boolean(),
});

export type ChatMessageRequest = z.infer<typeof chatMessageRequestSchema>;
export type ChatMessageResponse = z.infer<typeof chatMessageResponseSchema>;
```

#### `chat-context.tsx`

```typescript
'use client';

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  ChatContextType,
  ChatMessage,
  AgentState,
  ONetTaskSuggestion
} from './chat-types';
import type { ChatMessageResponse } from './chat-schemas';

const initialAgentState: AgentState = {
  turnCount: 0,
  estimatedTaskCount: 0,
  mentionedActivities: [],
  underexploredActivities: [],
  gwaCoverage: {
    informationInput: 'none',
    mentalProcesses: 'none',
    workOutput: 'none',
    interactingWithOthers: 'none',
  },
  actionsTaken: [],
  followUpsAsked: 0,
  suggestionsShown: 0,
  gwaProbesAsked: [],
  userEngagement: 'medium',
  userWantsToStop: false,
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

interface ChatProviderProps {
  children: React.ReactNode;
  jobTitle: string;
  occupationCode?: string;
}

export function ChatProvider({ children, jobTitle, occupationCode }: ChatProviderProps) {
  const [sessionId] = useState(() => uuidv4());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentState, setAgentState] = useState<AgentState>(initialAgentState);
  const [isLoading, setIsLoading] = useState(false);
  const [canProceed, setCanProceed] = useState(false);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>([]);

  // Send opening message on mount
  useEffect(() => {
    const sendOpeningMessage = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/futura-api/chat/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            message: '', // Empty for opening
            state: initialAgentState,
            jobTitle,
            occupationCode,
            selectedSuggestionIds: [],
          }),
        });

        if (response.ok) {
          const data: ChatMessageResponse = await response.json();

          const assistantMessage: ChatMessage = {
            id: uuidv4(),
            role: 'assistant',
            content: data.reply,
            timestamp: new Date(),
            toolUsed: data.toolUsed,
            suggestions: data.suggestions,
          };

          setMessages([assistantMessage]);
          setAgentState(data.updatedState);
        }
      } catch (error) {
        console.error('Failed to get opening message:', error);
      } finally {
        setIsLoading(false);
      }
    };

    sendOpeningMessage();
  }, [sessionId, jobTitle, occupationCode]);

  const sendMessage = useCallback(async (content: string) => {
    // Add user message immediately
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/futura-api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: content,
          state: agentState,
          jobTitle,
          occupationCode,
          selectedSuggestionIds,
        }),
      });

      if (response.ok) {
        const data: ChatMessageResponse = await response.json();

        const assistantMessage: ChatMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: data.reply,
          timestamp: new Date(),
          toolUsed: data.toolUsed,
          suggestions: data.suggestions,
        };

        setMessages(prev => [...prev, assistantMessage]);
        setAgentState(data.updatedState);
        setCanProceed(data.shouldProceed);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Add error message
      setMessages(prev => [...prev, {
        id: uuidv4(),
        role: 'system',
        content: 'Something went wrong. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, agentState, jobTitle, occupationCode, selectedSuggestionIds]);

  const selectSuggestion = useCallback((taskId: string) => {
    setSelectedSuggestionIds(prev => [...prev, taskId]);

    // Add system message about selection
    setMessages(prev => [...prev, {
      id: uuidv4(),
      role: 'system',
      content: 'Task added',
      timestamp: new Date(),
    }]);
  }, []);

  const value = useMemo<ChatContextType>(() => ({
    sessionId,
    messages,
    agentState,
    isLoading,
    canProceed,
    sendMessage,
    selectSuggestion,
    jobTitle,
    occupationCode,
  }), [
    sessionId,
    messages,
    agentState,
    isLoading,
    canProceed,
    sendMessage,
    selectSuggestion,
    jobTitle,
    occupationCode,
  ]);

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider');
  }
  return context;
}
```

---

## Backend Implementation

### File Structure

```
backend/v2/apps/futura-api/src/
├── chat/
│   ├── chat.module.ts
│   ├── chat.controller.ts
│   ├── chat.service.ts
│   ├── chat-agent.service.ts         # Agent decision logic
│   ├── chat-tools.service.ts         # Tool implementations
│   ├── chat-state.service.ts         # State analysis
│   └── dto/
│       ├── chat-message.dto.ts
│       └── chat-response.dto.ts
├── transcribe/
│   ├── transcribe.module.ts
│   ├── transcribe.controller.ts
│   └── transcribe.service.ts         # Whisper integration
```

### API Contract

**Location:** `backend/v2/libs/contracts/src/apis/futura-api/chat/`

```typescript
// chat.contract.ts
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  chatMessageRequestSchema,
  chatMessageResponseSchema
} from './chat.schemas';

const c = initContract();

export const chat = c.router({
  sendMessage: {
    method: 'POST',
    path: '/chat/message',
    body: chatMessageRequestSchema,
    responses: {
      200: chatMessageResponseSchema,
      400: z.object({ message: z.string() }),
    },
    summary: 'Send a message to the chat agent',
  },
});
```

### Chat Service

```typescript
// chat.service.ts
import { Injectable } from '@nestjs/common';
import { ChatAgentService } from './chat-agent.service';
import { ChatToolsService } from './chat-tools.service';
import { ChatStateService } from './chat-state.service';
import type { ChatMessageRequest, ChatMessageResponse } from './dto';

@Injectable()
export class ChatService {
  constructor(
    private readonly agent: ChatAgentService,
    private readonly tools: ChatToolsService,
    private readonly stateService: ChatStateService,
  ) {}

  async processMessage(request: ChatMessageRequest): Promise<ChatMessageResponse> {
    const { sessionId, message, state, jobTitle, occupationCode, selectedSuggestionIds } = request;

    // 1. Analyze user message and update state
    const analyzedState = await this.stateService.analyzeAndUpdateState(
      message,
      state,
      selectedSuggestionIds,
    );

    // 2. Determine which tool to use
    const toolSelection = await this.agent.selectTool(analyzedState);

    // 3. Execute the tool
    const toolResult = await this.tools.execute(toolSelection.tool, {
      state: analyzedState,
      jobTitle,
      occupationCode,
      message,
    });

    // 4. Generate response
    const reply = await this.agent.generateResponse(
      toolSelection.tool,
      toolResult,
      analyzedState,
      jobTitle,
    );

    // 5. Check if should proceed
    const shouldProceed = this.stateService.checkExitConditions(analyzedState);

    return {
      reply,
      toolUsed: toolSelection.tool,
      suggestions: toolResult.suggestions,
      updatedState: {
        ...analyzedState,
        actionsTaken: [...analyzedState.actionsTaken, toolSelection.tool],
      },
      shouldProceed,
    };
  }
}
```

### Agent Decision Logic

```typescript
// chat-agent.service.ts
import { Injectable } from '@nestjs/common';
import { FuturaLLMService } from '../langchain/futura-llm.service';
import type { AgentState, ToolSelection } from './types';

type AgentTool =
  | 'open_ended_prompt'
  | 'follow_up'
  | 'gwa_probe'
  | 'critical_incident'
  | 'show_suggestions'
  | 'encourage_more'
  | 'offer_to_proceed'
  | 'proceed';

@Injectable()
export class ChatAgentService {
  constructor(private readonly llm: FuturaLLMService) {}

  /**
   * V1 AGENT LOGIC
   *
   * Instead of rigid thresholds (10 tasks, GWA coverage), we use LLM judgment
   * to determine if the task list seems complete for the given job title.
   */

  async selectTool(state: AgentState): Promise<ToolSelection> {
    // Turn 1: Always open with big dump prompt
    if (state.turnCount === 0) {
      return { tool: 'open_ended_prompt' };
    }

    // User explicitly wants to stop → proceed
    if (state.userWantsToStop) {
      return { tool: 'proceed' };
    }

    // Ask LLM if task list seems complete
    const completenessCheck = await this.checkCompleteness(
      state.mentionedActivities,
      state.jobTitle,
    );

    // Complete with high confidence → offer to proceed
    if (completenessCheck.seems_complete && completenessCheck.confidence === 'high') {
      return { tool: 'offer_to_proceed' };
    }

    // LLM identified a gap and suggested a question → use it
    if (completenessCheck.suggested_question) {
      return {
        tool: 'custom_question',
        params: { question: completenessCheck.suggested_question }
      };
    }

    // Low engagement → show suggestions
    if (state.userEngagement === 'low' && state.suggestionsShown < 3) {
      return { tool: 'show_suggestions' };
    }

    // Default: encourage more
    return { tool: 'encourage_more' };
  }

  /**
   * LLM-based completeness check
   *
   * Asks the LLM: "Does this task list seem complete for a {jobTitle}?"
   * Returns whether it seems complete, confidence level, and suggested follow-up.
   */
  async checkCompleteness(
    tasks: string[],
    jobTitle: string,
  ): Promise<CompletenessCheck> {
    const taskList = tasks.map((t, i) => `${i + 1}. ${t}`).join('\n');

    const prompt = `You're helping capture the work tasks of a "${jobTitle}".

Tasks described so far:
${taskList || '(none yet)'}

Questions:
1. Does this seem like a reasonably complete picture of a ${jobTitle}'s typical work?
2. Are there obvious gaps (major responsibilities not mentioned)?
3. If there are gaps, what's ONE natural follow-up question to ask?

Respond in JSON:
{
  "seems_complete": true/false,
  "confidence": "high" | "medium" | "low",
  "gap_area": "string describing gap, or null",
  "suggested_question": "follow-up question, or null"
}`;

    return this.llm.generateJSON<CompletenessCheck>(prompt);
  }

  async generateResponse(
    tool: AgentTool,
    toolResult: any,
    state: AgentState,
    jobTitle: string,
  ): Promise<string> {
    // For custom_question, return the question directly
    if (tool === 'custom_question' && toolResult.question) {
      return toolResult.question;
    }

    // Use LLM to generate natural response based on tool
    const prompt = this.buildPrompt(tool, toolResult, state, jobTitle);
    const response = await this.llm.generate(prompt);
    return response;
  }

  private buildPrompt(
    tool: AgentTool,
    toolResult: any,
    state: AgentState,
    jobTitle: string,
  ): string {
    // Build prompt for LLM based on tool type
    // See prompts section below
    return '';
  }
}
```

### Tool Implementations

```typescript
// chat-tools.service.ts
import { Injectable } from '@nestjs/common';
import { ONetService } from '../onet/onet.service';
import type { AgentState, ToolParams, ToolResult } from './types';

@Injectable()
export class ChatToolsService {
  constructor(private readonly onetService: ONetService) {}

  async execute(
    tool: string,
    context: {
      state: AgentState;
      jobTitle: string;
      occupationCode?: string;
      message: string;
    },
  ): Promise<ToolResult> {
    switch (tool) {
      case 'show_suggestions':
        return this.showSuggestions(context);

      case 'follow_up':
      case 'gwa_probe':
      case 'critical_incident':
      case 'encourage_more':
      case 'offer_to_proceed':
      case 'open_ended_prompt':
      case 'proceed':
        // These tools just inform the response generation
        return { suggestions: undefined };

      default:
        return { suggestions: undefined };
    }
  }

  private async showSuggestions(context: {
    state: AgentState;
    jobTitle: string;
    occupationCode?: string;
  }): Promise<ToolResult> {
    const { jobTitle, occupationCode, state } = context;

    // Get lowest GWA category to prioritize
    const gwaFilter = this.getLowestGwaCategory(state);

    // Fetch suggestions from O*NET service
    const suggestions = await this.onetService.getSuggestions({
      jobTitle,
      occupationCode,
      gwaCategoryFilter: gwaFilter,
      excludeIds: [], // Could track shown suggestions
      limit: 4,
    });

    return { suggestions };
  }

  private getLowestGwaCategory(state: AgentState): string | undefined {
    const { gwaCoverage } = state;
    const priority = ['none', 'low', 'medium', 'high'];

    let lowest: string | undefined;
    let lowestLevel = 4;

    for (const [category, level] of Object.entries(gwaCoverage)) {
      const levelIndex = priority.indexOf(level);
      if (levelIndex < lowestLevel) {
        lowestLevel = levelIndex;
        lowest = category;
      }
    }

    return lowest;
  }
}
```

### State Analysis Service

```typescript
// chat-state.service.ts
import { Injectable } from '@nestjs/common';
import { FuturaLLMService } from '../langchain/futura-llm.service';
import type { AgentState, GWACoverage, UserEngagement } from './types';

@Injectable()
export class ChatStateService {
  constructor(private readonly llm: FuturaLLMService) {}

  async analyzeAndUpdateState(
    message: string,
    currentState: AgentState,
    selectedSuggestionIds: string[],
  ): Promise<AgentState> {
    if (!message) {
      // Opening message - return initial state with turn incremented
      return {
        ...currentState,
        turnCount: currentState.turnCount + 1,
      };
    }

    // Use LLM to analyze message
    const analysis = await this.analyzeMessage(message, currentState);

    return {
      ...currentState,
      turnCount: currentState.turnCount + 1,
      estimatedTaskCount: currentState.estimatedTaskCount + analysis.newTaskCount + selectedSuggestionIds.length,
      mentionedActivities: [
        ...currentState.mentionedActivities,
        ...analysis.newActivities,
      ],
      underexploredActivities: analysis.underexploredActivities,
      gwaCoverage: this.updateGwaCoverage(currentState.gwaCoverage, analysis.gwaUpdates),
      userEngagement: analysis.engagement,
      userWantsToStop: analysis.wantsToStop,
    };
  }

  private async analyzeMessage(
    message: string,
    state: AgentState,
  ): Promise<{
    newTaskCount: number;
    newActivities: string[];
    underexploredActivities: string[];
    gwaUpdates: Partial<GWACoverage>;
    engagement: UserEngagement;
    wantsToStop: boolean;
  }> {
    const prompt = `Analyze this user message about their work tasks.

User message: "${message}"

Current estimated task count: ${state.estimatedTaskCount}
Already mentioned activities: ${state.mentionedActivities.join(', ')}

Respond in JSON format:
{
  "newTaskCount": <number of new distinct tasks mentioned>,
  "newActivities": [<list of new activities/topics mentioned>],
  "underexploredActivities": [<activities mentioned but not detailed>],
  "gwaUpdates": {
    "informationInput": "none" | "low" | "medium" | "high" | null,
    "mentalProcesses": "none" | "low" | "medium" | "high" | null,
    "workOutput": "none" | "low" | "medium" | "high" | null,
    "interactingWithOthers": "none" | "low" | "medium" | "high" | null
  },
  "engagement": "high" | "medium" | "low",
  "wantsToStop": <true if user says "that's it", "done", etc.>
}

GWA categories:
- informationInput: gathering data, reading, observing, monitoring
- mentalProcesses: analyzing, deciding, planning, problem-solving
- workOutput: producing documents, physical outputs, code, designs
- interactingWithOthers: communicating, coordinating, supervising, serving

Engagement levels:
- high: 50+ words, multiple activities, good detail
- medium: 20-50 words, some activities, moderate detail
- low: < 20 words, single phrase, vague`;

    const response = await this.llm.generateJSON(prompt);
    return response;
  }

  private updateGwaCoverage(
    current: GWACoverage,
    updates: Partial<GWACoverage>,
  ): GWACoverage {
    const levels = ['none', 'low', 'medium', 'high'];
    const result = { ...current };

    for (const [key, value] of Object.entries(updates)) {
      if (value && key in result) {
        const currentLevel = levels.indexOf(result[key as keyof GWACoverage]);
        const newLevel = levels.indexOf(value);
        // Only increase, never decrease
        if (newLevel > currentLevel) {
          result[key as keyof GWACoverage] = value;
        }
      }
    }

    return result;
  }

  checkExitConditions(state: AgentState): boolean {
    // Same logic as agent service
    if (state.estimatedTaskCount >= 10) {
      const coverage = Object.values(state.gwaCoverage);
      const goodCategories = coverage.filter(l => l === 'medium' || l === 'high').length;
      if (goodCategories >= 3) return true;
    }

    if (state.turnCount >= 8) {
      const coverage = Object.values(state.gwaCoverage);
      const anyCategories = coverage.filter(l => l !== 'none').length;
      if (anyCategories >= 2) return true;
    }

    return false;
  }
}
```

---

## LLM Prompts

### Opening Prompt Template

```typescript
const OPENING_PROMPT = `You are a friendly assistant helping to understand what someone does at work.

The user's job title is: {{jobTitle}}

Generate a warm, conversational opening that:
1. Acknowledges their job title
2. Asks them to tell you everything about what they actually do
3. Encourages detail and specificity
4. Mentions they can use the mic button to talk through it

Keep it to 2-3 sentences. Be warm but not overly effusive.

Example tone: "What do you actually do as a {{jobTitle}}? Tell me everything — your typical tasks, responsibilities, what you spend your time on. The more detail, the better!"`;
```

### Follow-up Prompt Template

```typescript
const FOLLOW_UP_PROMPT = `You're having a conversation about someone's work tasks.

Job title: {{jobTitle}}
Activity to explore: {{activity}}
What they've said so far: {{context}}

Generate a natural follow-up question that:
1. References what they mentioned ({{activity}})
2. Asks for more specific detail
3. Feels conversational, not interrogative

Keep it to 1-2 sentences. Examples:
- "You mentioned {{activity}} — what does that actually involve day-to-day?"
- "Tell me more about {{activity}}. What's the process like?"`;
```

### GWA Probe Prompt Template

```typescript
const GWA_PROBE_PROMPTS = {
  informationInput: `Ask about how they gather information, data, or inputs for their work.
Examples: "Where does the information you work with come from?" or "What do you have to read, review, or monitor?"`,

  mentalProcesses: `Ask about analysis, decisions, or problem-solving they do.
Examples: "What kinds of decisions or judgment calls do you have to make?" or "What's the most complex thing you have to figure out?"`,

  workOutput: `Ask about what they produce or create.
Examples: "What do you actually produce or deliver?" or "What does the finished work look like?"`,

  interactingWithOthers: `Ask about communication, coordination, or working with people.
Examples: "Who do you work with most?" or "What does the collaboration or communication look like?"`,
};
```

---

## Voice Transcription

### Option A: Browser Web Speech API (Simpler, Free)

```typescript
// Alternative implementation using Web Speech API
export function useWebSpeechInput() {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognitionRef.current = recognition;
    }
  }, []);

  const startListening = (onResult: (text: string) => void) => {
    if (!recognitionRef.current) return;

    recognitionRef.current.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      onResult(transcript);
    };

    recognitionRef.current.start();
    setIsListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  return { isListening, startListening, stopListening };
}
```

### Option B: Server-side Whisper (Better quality, costs $)

```typescript
// transcribe.service.ts
import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class TranscribeService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async transcribe(audioBuffer: Buffer): Promise<string> {
    const response = await this.openai.audio.transcriptions.create({
      file: audioBuffer,
      model: 'whisper-1',
      language: 'en',
    });

    return response.text;
  }
}
```

**Recommendation:** Start with Web Speech API for MVP (free, works offline), add Whisper as optional enhancement for better accuracy.

---

## Testing

### Component Tests

```typescript
// chat-message.spec.tsx
import { render, screen } from '@testing-library/react';
import { ChatMessage } from './chat-message';

describe('ChatMessage', () => {
  it('renders user message with correct styling', () => {
    render(
      <ChatMessage
        message={{
          id: '1',
          role: 'user',
          content: 'I write reports',
          timestamp: new Date(),
        }}
      />
    );

    expect(screen.getByText('I write reports')).toBeInTheDocument();
    // Check for user message styling
    expect(screen.getByText('I write reports').closest('div')).toHaveClass('bg-primary');
  });

  it('renders suggestions when present', () => {
    render(
      <ChatMessage
        message={{
          id: '1',
          role: 'assistant',
          content: 'Here are some suggestions:',
          timestamp: new Date(),
          suggestions: [
            { id: 't1', statement: 'Write quarterly reports', gwaCategory: 'workOutput', occupationCode: '11-1011' },
          ],
        }}
        onSuggestionSelect={jest.fn()}
      />
    );

    expect(screen.getByText('Write quarterly reports')).toBeInTheDocument();
  });
});
```

### Integration Tests

```typescript
// chat.service.spec.ts
describe('ChatService', () => {
  it('sends opening message on first turn', async () => {
    const service = new ChatService(mockAgent, mockTools, mockState);

    const response = await service.processMessage({
      sessionId: 'test-session',
      message: '',
      state: initialAgentState,
      jobTitle: 'Policy Advisor',
      selectedSuggestionIds: [],
    });

    expect(response.toolUsed).toBe('open_ended_prompt');
    expect(response.reply).toContain('Policy Advisor');
  });

  it('shows suggestions when engagement is low', async () => {
    const lowEngagementState = {
      ...initialAgentState,
      turnCount: 2,
      userEngagement: 'low',
    };

    const response = await service.processMessage({
      sessionId: 'test-session',
      message: 'stuff',
      state: lowEngagementState,
      jobTitle: 'Policy Advisor',
      selectedSuggestionIds: [],
    });

    expect(response.toolUsed).toBe('show_suggestions');
    expect(response.suggestions).toBeDefined();
  });
});
```

---

## Translation Keys

```json
// messages/en.json
{
  "client": {
    "futura": {
      "chat": {
        "header": {
          "title": "Tell us about your work",
          "subtitle": "The more detail you share, the better we can help"
        },
        "input": {
          "placeholder": "Tell me about your work...",
          "voice-tooltip": "Click to speak",
          "send": "Send"
        },
        "proceed-button": "Continue to review tasks",
        "system": {
          "task-added": "Task added",
          "error": "Something went wrong. Please try again."
        },
        "suggestions": {
          "intro": "Do any of these apply?",
          "selected": "Added"
        }
      }
    }
  }
}
```

---

## Open Questions for This Epic

1. **Chat persistence:** Store messages in Supabase for recovery, or ephemeral (lost on refresh)?
2. **Voice quality:** Web Speech API vs Whisper? Or make configurable?
3. **Suggestion limit:** How many suggestions per batch? Currently set to 4.
4. **Exit flexibility:** Let user force-proceed even with low coverage, or require minimum?

---

## Dependencies

- **Epic 2:** O*NET suggestions endpoint (`GET /onet/suggestions`)
- **Shared libs:** `@apolitical/components`, `@apolitical/contracts`
- **LLM:** `FuturaLLMService` from existing Langchain integration

---

## Estimated Effort

| Task | Estimate |
|------|----------|
| Chat UI components | 3 days |
| Chat context & hooks | 2 days |
| Backend chat service | 3 days |
| Agent decision logic | 2 days |
| State analysis service | 2 days |
| Voice input | 1 day |
| Testing | 2 days |
| i18n | 1 day |
| **Total** | **~16 days (3 weeks)** |

---

## Implementation Tickets

### CHAT-001: Chat UI Components

**Priority:** P0
**Estimate:** 3 days
**Depends on:** SETUP-001

#### Description

Build the core chat UI components: message list, message bubbles, input bar, and layout wrapper.

#### Acceptance Criteria

- [ ] `chat-container.tsx` renders full-height chat layout
- [ ] `chat-messages.tsx` displays messages with auto-scroll to bottom
- [ ] `chat-message.tsx` renders user/assistant bubbles with proper styling
- [ ] `chat-input.tsx` has text input, send button, loading state
- [ ] `typing-indicator.tsx` shows animated dots when agent is responding
- [ ] Responsive design (mobile-first)
- [ ] Accessible (keyboard navigation, ARIA labels)

#### Files to Create

```
futura-ui/src/app/[locale]/futura/survey/chat/page.tsx
futura-ui/src/app/[locale]/futura/survey/_components/chat/
├── chat-container.tsx
├── chat-header.tsx
├── chat-messages.tsx
├── chat-message.tsx
├── chat-input.tsx
├── typing-indicator.tsx
└── index.ts
```

#### Reference Implementation

See `chat-container.tsx`, `chat-message.tsx`, `chat-input.tsx` code blocks in this document.

#### Testing

- [ ] Messages render correctly for both roles
- [ ] Auto-scroll works on new message
- [ ] Input clears after send
- [ ] Loading state disables input

---

### CHAT-002: Chat Context & State Management

**Priority:** P0
**Estimate:** 2 days
**Depends on:** CHAT-001

#### Description

Implement React context and hooks for chat state management, including messages, agent state, and API calls.

#### Acceptance Criteria

- [ ] `ChatProvider` provides context to all chat components
- [ ] `useChatMessages` manages message array state
- [ ] `useChatAgent` handles API calls to backend
- [ ] Optimistic UI updates (show user message immediately)
- [ ] Error handling with retry option
- [ ] Session ID generation and tracking

#### Files to Create

```
futura-ui/src/app/[locale]/futura/survey/_components/chat/context/
├── chat-context.tsx
├── chat-types.ts
├── chat-schemas.ts
├── useChatMessages.ts
├── useChatAgent.ts
└── useChatNavigation.ts
```

#### Reference Implementation

See `ChatProvider`, `useChatAgent` code blocks in this document.

#### Testing

- [ ] Context provides all required values
- [ ] Messages update correctly on send/receive
- [ ] Error state is set on API failure
- [ ] Session persists across component remounts

---

### CHAT-003: Backend Chat Service & Controller

**Priority:** P0
**Estimate:** 3 days
**Depends on:** SETUP-001

#### Description

Build the NestJS backend service that processes chat messages and orchestrates the agent.

#### Acceptance Criteria

- [ ] `chat.controller.ts` exposes `POST /api/futura-api/survey/chat/message`
- [ ] `chat.service.ts` orchestrates agent + tools + state
- [ ] Request/response matches ts-rest contract
- [ ] Session state managed (in-memory for V1, or Redis)
- [ ] Error handling with appropriate HTTP codes

#### Files to Create

```
futura-api/src/survey/chat/
├── chat.module.ts
├── chat.controller.ts
├── chat.service.ts
└── dto/
    ├── chat-message.dto.ts
    └── chat-response.dto.ts
```

#### API Contract

```
backend/v2/libs/contracts/src/apis/futura-api/survey/chat.contract.ts
```

See API Contract section in this document for schema.

#### Testing

- [ ] Endpoint returns 200 with valid request
- [ ] Returns opening message on empty first turn
- [ ] Agent state updates correctly between turns

---

### CHAT-004: Agent Decision Logic

**Priority:** P0
**Estimate:** 2 days
**Depends on:** CHAT-003

#### Description

Implement the LLM-driven agent that decides which tool to use each turn and generates responses.

#### Acceptance Criteria

- [ ] `agent.service.ts` implements `selectTool()` method
- [ ] Turn 1 always uses `open_ended_prompt`
- [ ] User saying "done"/"finished" triggers `proceed`
- [ ] LLM completeness check determines follow-up strategy
- [ ] `generateResponse()` creates natural responses for each tool

#### Files to Create

```
futura-api/src/survey/chat/agent/
├── agent.service.ts
├── agent-types.ts
└── prompts/
    ├── completeness-check.prompt.ts
    ├── open-ended.prompt.ts
    ├── follow-up.prompt.ts
    └── index.ts
```

#### Reference Implementation

See `ChatAgentService.selectTool()` and `checkCompleteness()` code blocks.

#### Key Logic

```typescript
// Turn 1 → open_ended_prompt
// User says done → proceed
// LLM says complete + high confidence → offer_to_proceed
// LLM identifies gap → custom_question with suggested question
// Low engagement → show_suggestions
// Default → encourage_more
```

#### Testing

- [ ] Turn 1 always returns `open_ended_prompt`
- [ ] "I'm done" triggers `proceed`
- [ ] Completeness check returns valid JSON
- [ ] Suggested questions are contextually appropriate

---

### CHAT-005: Chat Tools Service

**Priority:** P1
**Estimate:** 1 day
**Depends on:** CHAT-004, ONET-003

#### Description

Implement tool execution, particularly the `show_suggestions` tool that fetches O*NET tasks.

#### Acceptance Criteria

- [ ] `chat-tools.service.ts` implements `execute()` method
- [ ] `show_suggestions` fetches from O*NET service
- [ ] Suggestions prioritize lowest GWA category
- [ ] Other tools return no-op results (just inform response generation)

#### Files to Create

```
futura-api/src/survey/chat/agent/
└── chat-tools.service.ts
```

#### Reference Implementation

See `ChatToolsService` code block in this document.

#### Testing

- [ ] `show_suggestions` returns array of O*NET tasks
- [ ] GWA filtering works correctly

---

### CHAT-006: State Analysis Service

**Priority:** P1
**Estimate:** 2 days
**Depends on:** CHAT-003

#### Description

Implement the service that analyzes user messages to track mentioned activities, engagement level, and GWA coverage.

#### Acceptance Criteria

- [ ] `chat-state.service.ts` implements `analyzeMessage()` method
- [ ] Extracts activities/tasks from user message (LLM)
- [ ] Calculates engagement level (low/medium/high)
- [ ] Tracks GWA category coverage (approximate)
- [ ] Detects user intent to stop ("done", "finished", etc.)

#### Files to Create

```
futura-api/src/survey/chat/
├── chat-state.service.ts
└── types/
    └── agent-state.types.ts
```

#### Reference Implementation

See `ChatStateService` code block in this document.

#### Testing

- [ ] "I'm done" sets `userWantsToStop: true`
- [ ] Long detailed message → `high` engagement
- [ ] Short vague message → `low` engagement
- [ ] Activities extracted match user description

---

### CHAT-007: Voice Input Integration

**Priority:** P2
**Estimate:** 1 day
**Depends on:** CHAT-001

#### Description

Add voice input button using Web Speech API for hands-free task description.

#### Acceptance Criteria

- [ ] `voice-input-button.tsx` renders mic icon
- [ ] Clicking starts speech recognition
- [ ] Visual indicator shows recording state
- [ ] Transcript populates input field
- [ ] Works on supported browsers (Chrome, Safari)
- [ ] Graceful fallback on unsupported browsers (hide button)

#### Files to Create

```
futura-ui/src/app/[locale]/futura/survey/_components/chat/
├── voice-input-button.tsx
└── context/
    └── useVoiceInput.ts
```

#### Reference Implementation

See `useVoiceInput` hook code block in this document.

#### Testing

- [ ] Button shows on supported browsers
- [ ] Recording state UI works
- [ ] Transcript appears in input
- [ ] Errors handled gracefully

---

### CHAT-008: Task Suggestion 2Cards

**Priority:** P1
**Estimate:** 1 day
**Depends on:** CHAT-002, ONET-003

#### Description

Build the tappable suggestion cards that appear when the agent shows O*NET task suggestions.

#### Acceptance Criteria

- [ ] `task-suggestion-cards.tsx` renders grid of suggestion cards
- [ ] Each card shows O*NET task statement (truncated)
- [ ] Tapping adds task to selected list
- [ ] Visual feedback on selection (checkmark, opacity change)
- [ ] "Add" button confirms selection
- [ ] Cards animate in

#### Files to Create

```
futura-ui/src/app/[locale]/futura/survey/_components/chat/
└── task-suggestion-cards.tsx
```

#### Reference Implementation

See `TaskSuggestionCards` code block in this document.

#### Testing

- [ ] Cards render from suggestions array
- [ ] Selection state toggles correctly
- [ ] Selected IDs passed to parent on confirm
