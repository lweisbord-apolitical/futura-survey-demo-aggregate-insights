'use client';

import { Library, LayoutDashboard } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { ViewType } from '@/types';

interface NavTabProps {
  id: ViewType;
  icon: React.ElementType;
  label: string;
}

function NavTab({ id, icon: Icon, label }: NavTabProps) {
  const { view, setView } = useApp();

  return (
    <button
      onClick={() => setView(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
        view === id
          ? 'bg-slate-800 text-white'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon size={18} />
      <span className="font-medium">{label}</span>
    </button>
  );
}

export function Header() {
  const { view } = useApp();

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Scenario Testing Suite</h1>
          <p className="text-sm text-slate-500">Prototype and iterate on AI learning scenarios</p>
        </div>
        {view !== 'testing' && (
          <nav className="flex gap-2">
            <NavTab id="library" icon={Library} label="Scenarios" />
            <NavTab id="runs" icon={LayoutDashboard} label="Runs" />
          </nav>
        )}
      </div>
    </header>
  );
}
