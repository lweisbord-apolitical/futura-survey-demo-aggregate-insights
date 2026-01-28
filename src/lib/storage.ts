import { Scenario, TestRun } from '@/types';

const SCENARIOS_KEY = 'scenario-testing-suite-scenarios';
const RUNS_KEY = 'scenario-testing-suite-runs';

export function getScenarios(): Scenario[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(SCENARIOS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveScenarios(scenarios: Scenario[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SCENARIOS_KEY, JSON.stringify(scenarios));
}

export function getRuns(): TestRun[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(RUNS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveRuns(runs: TestRun[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(RUNS_KEY, JSON.stringify(runs));
}
