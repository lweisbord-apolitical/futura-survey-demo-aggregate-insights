'use client';

import { useApp } from '@/context/AppContext';
import { StarRating } from './StarRating';

export function EvaluationModal() {
  const {
    showEvalModal,
    evalData,
    editorData,
    setEvalData,
    handleSaveRun,
    handleCancelEval
  } = useApp();

  if (!showEvalModal) return null;

  const objectives = editorData.learning_objectives.filter(o => o.trim());

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Evaluate This Run</h3>

        <div className="space-y-5">
          {/* Rating */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Overall Rating
            </label>
            <StarRating
              rating={evalData.rating}
              onChange={r => setEvalData({ ...evalData, rating: r })}
            />
          </div>

          {/* Objectives */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Learning Objectives Met
            </label>
            <div className="space-y-2">
              {objectives.map((obj, i) => (
                <label key={i} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={evalData.objectives_met[i] || false}
                    onChange={e => {
                      const updated = [...evalData.objectives_met];
                      updated[i] = e.target.checked;
                      setEvalData({ ...evalData, objectives_met: updated });
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-slate-800 focus:ring-slate-800"
                  />
                  <span className="text-sm text-slate-600">{obj}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Notes
            </label>
            <textarea
              value={evalData.notes}
              onChange={e => setEvalData({ ...evalData, notes: e.target.value })}
              placeholder="What worked? What needs improvement?"
              rows={3}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleCancelEval}
            className="flex-1 py-2 px-4 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveRun}
            className="flex-1 py-2 px-4 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            Save Run
          </button>
        </div>
      </div>
    </div>
  );
}
