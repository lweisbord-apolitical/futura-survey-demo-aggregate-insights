export interface Scenario {
  id: string;
  title: string;
  system_prompt: string;
  scenario_context: string;
  learning_objectives: string[];
  initial_message: string | null;
  tags: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  archived: boolean;
  run_count: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface PromptSnapshot {
  system_prompt: string;
  scenario_context: string;
  learning_objectives: string[];
}

export interface TestRun {
  id: string;
  scenario_id: string;
  scenario_title: string;
  run_by: string;
  started_at: string;
  ended_at: string | null;
  duration: string;
  messages: Message[];
  objectives_met: boolean[];
  rating: number;
  notes: string;
  prompt_snapshot: PromptSnapshot;
}

export interface EditorData {
  title: string;
  system_prompt: string;
  scenario_context: string;
  learning_objectives: string[];
  initial_message: string;
  tags: string[];
}

export interface EvalData {
  rating: number;
  objectives_met: boolean[];
  notes: string;
}

export type ViewType = 'library' | 'editor' | 'runs' | 'testing';
