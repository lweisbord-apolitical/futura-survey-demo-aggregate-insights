'use client';

import { ArrowLeft, Plus, X, Play } from 'lucide-react';
import { useApp } from '@/context/AppContext';

export function ScenarioEditor() {
  const {
    currentScenario,
    editorData,
    setEditorData,
    runs,
    setView,
    handleSaveScenario,
    handleStartTest,
    handleAddObjective,
    handleRemoveObjective,
    handleObjectiveChange
  } = useApp();

  const isValid = editorData.title.trim() && editorData.system_prompt.trim();
  const scenarioRuns = currentScenario
    ? runs.filter(r => r.scenario_id === currentScenario.id).length
    : 0;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => setView('library')}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-lg font-semibold text-slate-800">
          {currentScenario ? 'Edit Scenario' : 'New Scenario'}
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main form */}
        <div className="col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Scenario Title
            </label>
            <input
              type="text"
              value={editorData.title}
              onChange={e => setEditorData({ ...editorData, title: e.target.value })}
              placeholder="e.g., AI Task Automation Discovery"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent"
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              System Prompt
              <span className="font-normal text-slate-400 ml-2">AI persona & behavior</span>
            </label>
            <textarea
              value={editorData.system_prompt}
              onChange={e => setEditorData({ ...editorData, system_prompt: e.target.value })}
              placeholder="You are a friendly coach helping employees... Be encouraging, ask probing questions..."
              rows={4}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent resize-none font-mono text-sm"
            />
            <div className="text-xs text-slate-400 mt-2 text-right">
              {editorData.system_prompt.length} characters
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Scenario Context
              <span className="font-normal text-slate-400 ml-2">Learning situation & goals</span>
            </label>
            <textarea
              value={editorData.scenario_context}
              onChange={e => setEditorData({ ...editorData, scenario_context: e.target.value })}
              placeholder="The learner is a government employee exploring... Guide them through..."
              rows={4}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent resize-none font-mono text-sm"
            />
            <div className="text-xs text-slate-400 mt-2 text-right">
              {editorData.scenario_context.length} characters
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Initial Message
              <span className="font-normal text-slate-400 ml-2">Optional opening from AI</span>
            </label>
            <textarea
              value={editorData.initial_message}
              onChange={e => setEditorData({ ...editorData, initial_message: e.target.value })}
              placeholder="Hi! I'm here to help you explore..."
              rows={2}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Learning Objectives
            </label>
            <div className="space-y-2">
              {editorData.learning_objectives.map((obj, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={obj}
                    onChange={e => handleObjectiveChange(index, e.target.value)}
                    placeholder={`Objective ${index + 1}`}
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent"
                  />
                  {editorData.learning_objectives.length > 1 && (
                    <button
                      onClick={() => handleRemoveObjective(index)}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {editorData.learning_objectives.length < 5 && (
              <button
                onClick={handleAddObjective}
                className="mt-3 text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
              >
                <Plus size={14} />
                Add objective
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <button
              onClick={handleSaveScenario}
              disabled={!isValid}
              className="w-full py-2 px-4 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Save Draft
            </button>
            <button
              onClick={() => { handleSaveScenario(); handleStartTest(); }}
              disabled={!isValid}
              className="w-full py-2 px-4 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
            >
              <Play size={18} />
              Run Test
            </button>
          </div>

          {currentScenario && scenarioRuns > 0 && (
            <div className="text-xs text-slate-400 text-center">
              {scenarioRuns} previous runs
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
