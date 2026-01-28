'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Scenario, TestRun, EditorData, EvalData, ViewType, Message } from '@/types';
import { getScenarios, saveScenarios, getRuns, saveRuns } from '@/lib/storage';

// Sample data for initial state
const sampleScenarios: Scenario[] = [
  {
    id: '1',
    title: 'AI Task Automation Discovery',
    system_prompt: 'You are a friendly AI career coach helping government employees identify tasks they could automate. Be encouraging, ask probing questions, and help them think through practical first steps. Keep responses concise (2-3 sentences max).',
    scenario_context: 'The learner is a government employee exploring how AI might help with their daily work. Guide them through identifying repetitive tasks, evaluating automation potential, and planning a small pilot project.',
    learning_objectives: [
      'Identify at least 3 repetitive tasks in their role',
      'Evaluate one task for automation feasibility',
      'Create a simple action plan for a pilot'
    ],
    initial_message: "Hi! I'm here to help you explore how AI might assist with your work. Let's start simple — can you walk me through what a typical day looks like for you?",
    tags: ['ai-education', 'onboarding'],
    created_by: 'system',
    created_at: '2025-01-25',
    updated_at: '2025-01-27',
    archived: false,
    run_count: 3
  },
  {
    id: '2',
    title: 'Data Privacy Scenario',
    system_prompt: 'You are a data privacy expert helping employees understand when and how to handle sensitive information. Present realistic scenarios and guide them to correct decisions.',
    scenario_context: 'Test the learner on various data handling situations they might encounter, including PII, FOUO documents, and public records requests.',
    learning_objectives: [
      'Correctly identify PII in sample documents',
      'Apply appropriate handling procedures',
      'Know when to escalate to privacy officer'
    ],
    initial_message: "Welcome to the data privacy training scenario. I'll present you with some situations you might encounter. Ready to begin?",
    tags: ['compliance', 'privacy'],
    created_by: 'system',
    created_at: '2025-01-20',
    updated_at: '2025-01-22',
    archived: false,
    run_count: 5
  }
];

const sampleRuns: TestRun[] = [
  {
    id: 'r1',
    scenario_id: '1',
    scenario_title: 'AI Task Automation Discovery',
    run_by: 'Sarah Chen',
    started_at: '2025-01-27 10:30',
    ended_at: '2025-01-27 10:45',
    duration: '15 min',
    messages: [
      { id: 'm1', role: 'assistant', content: "Hi! I'm here to help you explore how AI might assist with your work. Let's start simple — can you walk me through what a typical day looks like for you?", timestamp: '2025-01-27T10:30:00Z' },
      { id: 'm2', role: 'user', content: "I spend a lot of time processing permit applications. Reviewing documents, entering data into our system, sending status updates to applicants.", timestamp: '2025-01-27T10:32:00Z' },
      { id: 'm3', role: 'assistant', content: "That's really helpful! It sounds like you have several distinct tasks there. Which of those three — document review, data entry, or status updates — feels most repetitive to you?", timestamp: '2025-01-27T10:33:00Z' },
      { id: 'm4', role: 'user', content: "Definitely the status updates. I send almost the same email 20 times a day with just small changes.", timestamp: '2025-01-27T10:35:00Z' },
      { id: 'm5', role: 'assistant', content: "Perfect example! Templated communications are often great candidates for automation. What information changes between each status update email?", timestamp: '2025-01-27T10:36:00Z' }
    ],
    objectives_met: [true, true, false],
    rating: 4,
    notes: 'Good flow for identifying tasks. Need to add more guidance on creating action plans — learner got stuck at the end.',
    prompt_snapshot: {
      system_prompt: 'You are a friendly AI career coach helping government employees identify tasks they could automate...',
      scenario_context: 'The learner is a government employee exploring how AI might help with their daily work...',
      learning_objectives: ['Identify at least 3 repetitive tasks in their role', 'Evaluate one task for automation feasibility', 'Create a simple action plan for a pilot']
    }
  },
  {
    id: 'r2',
    scenario_id: '1',
    scenario_title: 'AI Task Automation Discovery',
    run_by: 'Sarah Chen',
    started_at: '2025-01-26 14:00',
    ended_at: '2025-01-26 14:20',
    duration: '20 min',
    messages: [
      { id: 'm6', role: 'assistant', content: "Hi! I'm here to help you explore how AI might assist with your work. Let's start simple — can you walk me through what a typical day looks like for you?", timestamp: '2025-01-26T14:00:00Z' },
      { id: 'm7', role: 'user', content: "I don't really know what AI can do.", timestamp: '2025-01-26T14:02:00Z' },
      { id: 'm8', role: 'assistant', content: "That's totally okay — that's exactly what we're here to figure out together! Let's not worry about AI for a moment. Instead, tell me: what's one task you do regularly that feels tedious or repetitive?", timestamp: '2025-01-26T14:03:00Z' }
    ],
    objectives_met: [false, false, false],
    rating: 2,
    notes: 'AI handled the confused learner well, but scenario needs a better on-ramp for people with no AI context.',
    prompt_snapshot: {
      system_prompt: 'You are a friendly AI career coach helping government employees identify tasks they could automate...',
      scenario_context: 'The learner is a government employee exploring how AI might help with their daily work...',
      learning_objectives: ['Identify at least 3 repetitive tasks in their role', 'Evaluate one task for automation feasibility', 'Create a simple action plan for a pilot']
    }
  }
];

interface CurrentRun {
  scenario_id: string;
  scenario_title: string;
  started_at: string;
  thread_id: string; // LangGraph thread for conversation memory
  prompt_snapshot: {
    system_prompt: string;
    scenario_context: string;
    learning_objectives: string[];
  };
}

interface AppContextType {
  // State
  view: ViewType;
  scenarios: Scenario[];
  runs: TestRun[];
  currentScenario: Scenario | null;
  currentRun: CurrentRun | null;
  expandedRun: string | null;
  editorData: EditorData;
  testMessages: Message[];
  testInput: string;
  isTyping: boolean;
  showEvalModal: boolean;
  evalData: EvalData;
  filterScenario: string;

  // Actions
  setView: (view: ViewType) => void;
  setExpandedRun: (id: string | null) => void;
  setEditorData: (data: EditorData) => void;
  setTestInput: (input: string) => void;
  setEvalData: (data: EvalData) => void;
  setFilterScenario: (id: string) => void;
  handleNewScenario: () => void;
  handleEditScenario: (scenario: Scenario) => void;
  handleSaveScenario: () => void;
  handleDuplicateScenario: (scenario: Scenario) => void;
  handleArchiveScenario: (scenario: Scenario) => void;
  handleStartTest: () => void;
  handleSendMessage: () => Promise<void>;
  handleEndTest: () => void;
  handleSaveRun: () => void;
  handleCancelEval: () => void;
  handleAddObjective: () => void;
  handleRemoveObjective: (index: number) => void;
  handleObjectiveChange: (index: number, value: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<ViewType>('library');
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [currentRun, setCurrentRun] = useState<CurrentRun | null>(null);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [filterScenario, setFilterScenario] = useState<string>('all');
  const [isLoaded, setIsLoaded] = useState(false);

  const [editorData, setEditorData] = useState<EditorData>({
    title: '',
    system_prompt: '',
    scenario_context: '',
    learning_objectives: [''],
    initial_message: '',
    tags: []
  });

  const [testMessages, setTestMessages] = useState<Message[]>([]);
  const [testInput, setTestInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const [showEvalModal, setShowEvalModal] = useState(false);
  const [evalData, setEvalData] = useState<EvalData>({
    rating: 0,
    objectives_met: [],
    notes: ''
  });

  // Load data from localStorage on mount
  useEffect(() => {
    const storedScenarios = getScenarios();
    const storedRuns = getRuns();

    if (storedScenarios.length === 0) {
      setScenarios(sampleScenarios);
      saveScenarios(sampleScenarios);
    } else {
      setScenarios(storedScenarios);
    }

    if (storedRuns.length === 0) {
      setRuns(sampleRuns);
      saveRuns(sampleRuns);
    } else {
      setRuns(storedRuns);
    }

    setIsLoaded(true);
  }, []);

  // Save to localStorage when data changes
  useEffect(() => {
    if (isLoaded) {
      saveScenarios(scenarios);
    }
  }, [scenarios, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      saveRuns(runs);
    }
  }, [runs, isLoaded]);

  const handleNewScenario = () => {
    setEditorData({
      title: '',
      system_prompt: '',
      scenario_context: '',
      learning_objectives: [''],
      initial_message: '',
      tags: []
    });
    setCurrentScenario(null);
    setView('editor');
  };

  const handleEditScenario = (scenario: Scenario) => {
    setEditorData({
      title: scenario.title,
      system_prompt: scenario.system_prompt,
      scenario_context: scenario.scenario_context,
      learning_objectives: [...scenario.learning_objectives],
      initial_message: scenario.initial_message || '',
      tags: [...scenario.tags]
    });
    setCurrentScenario(scenario);
    setView('editor');
  };

  const handleSaveScenario = () => {
    const now = new Date().toISOString().split('T')[0];

    if (currentScenario) {
      const updated = scenarios.map(s =>
        s.id === currentScenario.id
          ? { ...s, ...editorData, updated_at: now }
          : s
      );
      setScenarios(updated);
      setCurrentScenario({ ...currentScenario, ...editorData, updated_at: now });
    } else {
      const newScenario: Scenario = {
        id: uuidv4(),
        ...editorData,
        initial_message: editorData.initial_message || null,
        created_by: 'user',
        created_at: now,
        updated_at: now,
        archived: false,
        run_count: 0
      };
      setScenarios([newScenario, ...scenarios]);
      setCurrentScenario(newScenario);
    }
  };

  const handleDuplicateScenario = (scenario: Scenario) => {
    const now = new Date().toISOString().split('T')[0];
    const duplicate: Scenario = {
      ...scenario,
      id: uuidv4(),
      title: `${scenario.title} (Copy)`,
      created_at: now,
      updated_at: now,
      run_count: 0
    };
    setScenarios([duplicate, ...scenarios]);
  };

  const handleArchiveScenario = (scenario: Scenario) => {
    const updated = scenarios.map(s =>
      s.id === scenario.id ? { ...s, archived: !s.archived } : s
    );
    setScenarios(updated);
  };

  const handleStartTest = () => {
    const initialMessages: Message[] = editorData.initial_message
      ? [{
          id: uuidv4(),
          role: 'assistant',
          content: editorData.initial_message,
          timestamp: new Date().toISOString()
        }]
      : [];

    // Generate a unique thread_id for LangGraph conversation memory
    const threadId = `test-${currentScenario?.id || 'new'}-${Date.now()}`;

    setTestMessages(initialMessages);
    setCurrentRun({
      scenario_id: currentScenario?.id || 'new',
      scenario_title: editorData.title,
      started_at: new Date().toLocaleString(),
      thread_id: threadId,
      prompt_snapshot: {
        system_prompt: editorData.system_prompt,
        scenario_context: editorData.scenario_context,
        learning_objectives: [...editorData.learning_objectives.filter(o => o.trim())]
      }
    });
    setView('testing');
  };

  const handleSendMessage = async () => {
    if (!testInput.trim() || !currentRun) return;

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: testInput,
      timestamp: new Date().toISOString()
    };

    const updatedMessages = [...testMessages, userMessage];
    setTestMessages(updatedMessages);
    setTestInput('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({
            role: m.role,
            content: m.content
          })),
          system_prompt: currentRun.prompt_snapshot.system_prompt,
          scenario_context: currentRun.prompt_snapshot.scenario_context,
          thread_id: currentRun.thread_id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const aiMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: data.content,
        timestamp: new Date().toISOString()
      };

      setTestMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      // Fallback to simulated response if API fails
      const fallbackResponses = [
        "That's a great point! Can you tell me more about how that affects your daily workflow?",
        "Interesting — it sounds like there might be an opportunity to streamline that process. What would an ideal solution look like for you?",
        "I appreciate you sharing that. Let's dig a bit deeper — what's the most time-consuming part of that task?"
      ];
      const aiMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)],
        timestamp: new Date().toISOString()
      };
      setTestMessages(prev => [...prev, aiMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleEndTest = () => {
    const objectives = editorData.learning_objectives.filter(o => o.trim());
    setEvalData({
      rating: 0,
      objectives_met: objectives.map(() => false),
      notes: ''
    });
    setShowEvalModal(true);
  };

  const handleSaveRun = () => {
    if (!currentRun) return;

    const startTime = new Date(currentRun.started_at);
    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMin = Math.round(durationMs / 60000);

    const newRun: TestRun = {
      id: uuidv4(),
      scenario_id: currentRun.scenario_id,
      scenario_title: currentRun.scenario_title,
      run_by: 'You',
      started_at: currentRun.started_at,
      ended_at: endTime.toLocaleString(),
      duration: `${durationMin} min`,
      messages: [...testMessages],
      objectives_met: evalData.objectives_met,
      rating: evalData.rating,
      notes: evalData.notes,
      prompt_snapshot: currentRun.prompt_snapshot
    };

    setRuns([newRun, ...runs]);

    // Update scenario run count
    if (currentScenario) {
      setScenarios(scenarios.map(s =>
        s.id === currentScenario.id
          ? { ...s, run_count: s.run_count + 1 }
          : s
      ));
    }

    setShowEvalModal(false);
    setView('runs');
    setExpandedRun(newRun.id);
  };

  const handleCancelEval = () => {
    setShowEvalModal(false);
    setView('editor');
  };

  const handleAddObjective = () => {
    if (editorData.learning_objectives.length < 5) {
      setEditorData({
        ...editorData,
        learning_objectives: [...editorData.learning_objectives, '']
      });
    }
  };

  const handleRemoveObjective = (index: number) => {
    if (editorData.learning_objectives.length > 1) {
      setEditorData({
        ...editorData,
        learning_objectives: editorData.learning_objectives.filter((_, i) => i !== index)
      });
    }
  };

  const handleObjectiveChange = (index: number, value: string) => {
    const updated = [...editorData.learning_objectives];
    updated[index] = value;
    setEditorData({ ...editorData, learning_objectives: updated });
  };

  return (
    <AppContext.Provider
      value={{
        view,
        scenarios,
        runs,
        currentScenario,
        currentRun,
        expandedRun,
        editorData,
        testMessages,
        testInput,
        isTyping,
        showEvalModal,
        evalData,
        filterScenario,
        setView,
        setExpandedRun,
        setEditorData,
        setTestInput,
        setEvalData,
        setFilterScenario,
        handleNewScenario,
        handleEditScenario,
        handleSaveScenario,
        handleDuplicateScenario,
        handleArchiveScenario,
        handleStartTest,
        handleSendMessage,
        handleEndTest,
        handleSaveRun,
        handleCancelEval,
        handleAddObjective,
        handleRemoveObjective,
        handleObjectiveChange
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
