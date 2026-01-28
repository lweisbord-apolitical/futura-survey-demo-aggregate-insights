'use client';

import { useApp } from '@/context/AppContext';
import {
  Header,
  ScenarioLibrary,
  ScenarioEditor,
  TestRunner,
  RunsDashboard,
  EvaluationModal
} from '@/components';

function MainContent() {
  const { view } = useApp();

  return (
    <>
      <Header />
      <main className="max-w-6xl mx-auto p-6">
        {view === 'library' && <ScenarioLibrary />}
        {view === 'editor' && <ScenarioEditor />}
        {view === 'testing' && <TestRunner />}
        {view === 'runs' && <RunsDashboard />}
      </main>
      <EvaluationModal />
    </>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50">
      <MainContent />
    </div>
  );
}
