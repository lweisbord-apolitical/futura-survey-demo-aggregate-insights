'use client';

import {
  ChevronDown, ChevronRight, MessageSquare,
  CheckCircle2, Circle, LayoutDashboard
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { StarRating } from './StarRating';

export function RunsDashboard() {
  const {
    scenarios,
    runs,
    expandedRun,
    filterScenario,
    setExpandedRun,
    setFilterScenario,
    handleEditScenario
  } = useApp();

  const filteredRuns = filterScenario === 'all'
    ? runs
    : runs.filter(r => r.scenario_id === filterScenario);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-800">Test Runs</h2>
        <div className="flex gap-2">
          <select
            value={filterScenario}
            onChange={e => setFilterScenario(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
          >
            <option value="all">All scenarios</option>
            {scenarios.map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {filteredRuns.map(run => (
          <div
            key={run.id}
            className="bg-white rounded-xl border border-slate-200 overflow-hidden"
          >
            {/* Run header */}
            <button
              onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
              className="w-full p-5 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                {expandedRun === run.id ? (
                  <ChevronDown size={20} className="text-slate-400" />
                ) : (
                  <ChevronRight size={20} className="text-slate-400" />
                )}
                <div className="text-left">
                  <h3 className="font-medium text-slate-800">{run.scenario_title}</h3>
                  <p className="text-sm text-slate-500">
                    {run.run_by} &middot; {run.started_at} &middot; {run.duration}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  {run.objectives_met.map((met, i) => (
                    met
                      ? <CheckCircle2 key={i} size={16} className="text-green-500" />
                      : <Circle key={i} size={16} className="text-slate-300" />
                  ))}
                </div>
                <StarRating rating={run.rating} readonly />
              </div>
            </button>

            {/* Expanded content */}
            {expandedRun === run.id && (
              <div className="border-t border-slate-200 p-5 space-y-5">
                {/* Messages */}
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                    <MessageSquare size={16} />
                    Transcript
                  </h4>
                  <div className="bg-slate-50 rounded-lg p-4 max-h-64 overflow-y-auto space-y-3">
                    {run.messages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-md px-3 py-2 rounded-lg text-sm ${
                          msg.role === 'user'
                            ? 'bg-slate-200 text-slate-800'
                            : 'bg-white border border-slate-200 text-slate-700'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Objectives */}
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-3">Learning Objectives</h4>
                  <div className="space-y-2">
                    {run.prompt_snapshot.learning_objectives.map((obj, i) => (
                      <div key={i} className="flex items-center gap-3">
                        {run.objectives_met[i]
                          ? <CheckCircle2 size={18} className="text-green-500" />
                          : <Circle size={18} className="text-slate-300" />
                        }
                        <span className={`text-sm ${run.objectives_met[i] ? 'text-slate-700' : 'text-slate-400'}`}>
                          {obj}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                {run.notes && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-2">Notes</h4>
                    <p className="text-sm text-slate-600 bg-amber-50 border border-amber-100 rounded-lg p-3">
                      {run.notes}
                    </p>
                  </div>
                )}

                {/* Prompts used */}
                <details className="bg-slate-50 rounded-lg p-4">
                  <summary className="text-sm font-medium text-slate-600 cursor-pointer">
                    Prompts used in this run
                  </summary>
                  <div className="mt-3 space-y-3 text-xs font-mono text-slate-500">
                    <div>
                      <span className="font-sans font-medium text-slate-700">System:</span>
                      <p className="mt-1">{run.prompt_snapshot.system_prompt}</p>
                    </div>
                    <div>
                      <span className="font-sans font-medium text-slate-700">Context:</span>
                      <p className="mt-1">{run.prompt_snapshot.scenario_context}</p>
                    </div>
                  </div>
                </details>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      const scenario = scenarios.find(s => s.id === run.scenario_id);
                      if (scenario) handleEditScenario(scenario);
                    }}
                    className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Open Scenario
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {filteredRuns.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <LayoutDashboard size={48} className="mx-auto mb-4 opacity-50" />
            <p>No test runs yet. Create a scenario and run a test!</p>
          </div>
        )}
      </div>
    </div>
  );
}
