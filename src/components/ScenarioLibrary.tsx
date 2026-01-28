'use client';

import { Plus, Play, Copy, Clock, FileText, Library } from 'lucide-react';
import { useApp } from '@/context/AppContext';

export function ScenarioLibrary() {
  const {
    scenarios,
    handleNewScenario,
    handleEditScenario,
    handleDuplicateScenario
  } = useApp();

  const activeScenarios = scenarios.filter(s => !s.archived);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-800">Scenario Library</h2>
        <button
          onClick={handleNewScenario}
          className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
        >
          <Plus size={18} />
          New Scenario
        </button>
      </div>

      <div className="space-y-3">
        {activeScenarios.map(scenario => (
          <div
            key={scenario.id}
            className="bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-slate-800 mb-1">{scenario.title}</h3>
                <p className="text-sm text-slate-500 line-clamp-2 mb-3">
                  {scenario.scenario_context}
                </p>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock size={14} />
                    Updated {scenario.updated_at}
                  </span>
                  <span className="flex items-center gap-1">
                    <Play size={14} />
                    {scenario.run_count} runs
                  </span>
                  <div className="flex gap-1">
                    {scenario.tags.map(tag => (
                      <span key={tag} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => handleEditScenario(scenario)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Edit"
                >
                  <FileText size={18} />
                </button>
                <button
                  onClick={() => handleDuplicateScenario(scenario)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Duplicate"
                >
                  <Copy size={18} />
                </button>
                <button
                  onClick={() => handleEditScenario(scenario)}
                  className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
                >
                  <Play size={16} />
                  Test
                </button>
              </div>
            </div>
          </div>
        ))}

        {activeScenarios.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Library size={48} className="mx-auto mb-4 opacity-50" />
            <p>No scenarios yet. Create your first one!</p>
          </div>
        )}
      </div>
    </div>
  );
}
