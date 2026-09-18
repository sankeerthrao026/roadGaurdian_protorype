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
      text: 'Hello! I am the RoadGuardian AI Copilot. Ask me questions about the current incident, severity scores, SHAP feature attribution, or RAG historical recall.',
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
    <div className="bg-[#141517] border border-[#394047] rounded-md flex flex-col h-full">
      {/* Header */}
      <div className="bg-[#1B1D20] border-b border-[#394047] px-4 py-2.5 flex justify-between items-center font-mono text-xs font-bold text-[#C98255] uppercase">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-[#C98255]" />
          <span>ROADGUARDIAN AI COPILOT</span>
        </div>
        <span className="flex items-center gap-1 text-[10px] text-[#55C98A]">
          <Sparkles className="w-3 h-3" /> RAG ACTIVE
        </span>
      </div>

      {/* Messages */}
      <div className="p-3 flex-1 overflow-y-auto space-y-3 font-mono text-xs max-h-[300px]">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`p-3 rounded-md border ${
              m.sender === 'user'
                ? 'bg-[#1B1D20] border-[#394047] text-[#D4D9DF] ml-6'
                : 'bg-[#0D0E10] border-[#394047] border-l-2 border-l-[#C98255] text-[#D4D9DF] mr-6'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] text-[#798690] mb-1">
              <span className="font-bold uppercase text-[#C98255] flex items-center gap-1">
                {m.sender === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                {m.sender}
              </span>
              <span>{m.timestamp}</span>
            </div>
            <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
          </div>
        ))}
        {loading && (
          <div className="p-3 bg-[#0D0E10] border border-[#394047] rounded text-[#C98255] font-mono text-xs animate-pulse">
            Querying ChromaDB RAG and LLM context...
          </div>
        )}
      </div>

      {/* Quick Prompts */}
      <div className="px-3 pt-2 pb-1 bg-[#141517] flex flex-wrap gap-1.5 border-t border-[#394047]/50">
        {[
          "What is the severity score?",
          "Explain SHAP attribution",
          "What emergency units are dispatched?",
          "Any similar historical collisions?"
        ].map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setInput(prompt);
            }}
            className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0D0E10] border border-[#394047] text-[#999EA5] hover:border-[#C98255] hover:text-[#C98255] transition cursor-pointer"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 bg-[#141517] border-t border-[#394047] flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Copilot about incident, severity, evidence..."
          className="flex-1 bg-[#0D0E10] border border-[#394047] rounded px-3 py-1.5 font-mono text-xs text-[#D4D9DF] focus:outline-none focus:border-[#C98255]"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-3 py-1.5 bg-[#1F1B18] border border-[#C98255] text-[#C98255] hover:bg-[#C98255] hover:text-[#0D0E10] rounded font-mono text-xs font-bold transition flex items-center gap-1 cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
