'use client';

import { Send } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useRef, useEffect } from 'react';

export function TestRunner() {
  const {
    editorData,
    testMessages,
    testInput,
    isTyping,
    setTestInput,
    handleSendMessage,
    handleEndTest
  } = useApp();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [testMessages, isTyping]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-slate-800">{editorData.title}</h2>
          <p className="text-sm text-slate-500">Testing as learner</p>
        </div>
        <button
          onClick={handleEndTest}
          className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
        >
          End Test
        </button>
      </div>

      {/* Chat container */}
      <div className="bg-white rounded-xl border border-slate-200 h-96 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {testMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-slate-800 text-white rounded-br-md'
                    : 'bg-slate-100 text-slate-800 rounded-bl-md'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-slate-100 text-slate-500 px-4 py-2 rounded-2xl rounded-bl-md">
                <span className="animate-pulse">Typing...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={testInput}
              onChange={e => setTestInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type as the learner would..."
              className="flex-1 px-4 py-2 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent"
              disabled={isTyping}
            />
            <button
              onClick={handleSendMessage}
              disabled={!testInput.trim() || isTyping}
              className="p-2 bg-slate-800 text-white rounded-full hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Prompt preview */}
      <details className="mt-4 bg-slate-100 rounded-lg p-4">
        <summary className="text-sm font-medium text-slate-600 cursor-pointer">
          View prompts being used
        </summary>
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <span className="font-medium text-slate-700">System:</span>
            <p className="text-slate-500 font-mono text-xs mt-1">{editorData.system_prompt}</p>
          </div>
          <div>
            <span className="font-medium text-slate-700">Context:</span>
            <p className="text-slate-500 font-mono text-xs mt-1">{editorData.scenario_context}</p>
          </div>
        </div>
      </details>
    </div>
  );
}
