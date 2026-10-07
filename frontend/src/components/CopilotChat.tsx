import React, { useState } from 'react';
import { Bot, Send, User, Sparkles } from 'lucide-react';
import { apiService } from '../services/apiService';
import type { CopilotMessage } from '../types';

interface CopilotChatProps {
  incidentId?: string;
}

export const CopilotChat: React.FC<CopilotChatProps> = ({ incidentId }) => {
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: '1',
      sender: 'copilot',
      text: 'RoadGuardian Copilot online. Ask me questions about the current incident classification, severity metrics, SHAP feature attribution, or ChromaDB historical recall.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');

    const userMsg: CopilotMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await apiService.askCopilot(userText, incidentId);
      const botMsg: CopilotMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'copilot',
        text: res.answer,
        rag_context: res.rag_context,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const errorMsg: CopilotMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'copilot',
        text: 'Error connecting to RoadGuardian AI backend service.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] flex flex-col">
      
      {/* Editorial Header */}
      <div className="border-b border-[var(--border-color)] px-5 py-3 flex justify-between items-center font-mono text-xs">
        <div className="flex items-center gap-2 font-bold tracking-widest uppercase text-[var(--text-primary)]">
          <Bot className="w-4 h-4 text-[var(--text-primary)]" strokeWidth={1.5} />
          <span>ROADGUARDIAN AI / COPILOT</span>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] text-[var(--accent-success)] font-bold tracking-wider uppercase">
          <Sparkles className="w-3 h-3" /> RAG ACTIVE
        </span>
      </div>

      {/* Messages Stream */}
      <div className="p-4 flex-1 overflow-y-auto space-y-3 font-mono text-xs max-h-[300px]">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`p-3.5 border transition-all ${
              m.sender === 'user'
                ? 'bg-[var(--bg-subtle)] border-[var(--border-color)] text-[var(--text-primary)] ml-4'
                : 'bg-[var(--bg-surface)] border-l-2 border-l-[var(--text-primary)] border-[var(--border-color)] text-[var(--text-primary)] mr-4'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mb-1.5">
              <span className="font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
                {m.sender === 'user' ? <User className="w-3 h-3 text-[var(--text-muted)]" /> : <Bot className="w-3 h-3 text-[var(--text-primary)]" />}
                {m.sender === 'user' ? 'OPERATOR' : 'ROADGUARDIAN AI'}
              </span>
              <span>{m.timestamp}</span>
            </div>
            <p className="font-sans text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
              {m.text}
            </p>
          </div>
        ))}
        {loading && (
          <div className="p-3 bg-[var(--bg-subtle)] border border-[var(--border-color)] text-[var(--text-primary)] font-mono text-xs animate-pulse">
            Querying ChromaDB RAG vector index &amp; synthesis agents…
          </div>
        )}
      </div>

      {/* Quick Questions Strip */}
      <div className="px-4 py-2 bg-[var(--bg-subtle)] flex flex-wrap gap-1.5 border-t border-[var(--border-color)]">
        {[
          "What is the severity score?",
          "Explain SHAP attribution",
          "What emergency units are dispatched?",
          "Any similar historical collisions?"
        ].map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setInput(prompt)}
            className="text-[10px] font-mono px-2 py-1 bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition cursor-pointer"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 bg-[var(--bg-surface)] border-t border-[var(--border-color)] flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Copilot about incident, severity, evidence, SOPs…"
          className="flex-1 bg-[var(--bg-subtle)] border border-[var(--border-color)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-[var(--text-primary)] hover:bg-[var(--text-secondary)] text-[var(--bg-primary)] font-mono text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
          <span>SEND</span>
        </button>
      </form>

    </div>
  );
};
