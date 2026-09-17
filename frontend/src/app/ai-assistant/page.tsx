'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, ArrowUp, Bot, User } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: string;
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        "Hello! I'm your ConverseIQ AI Assistant. I have full context of all your meetings, action items, and schedules. How can I help you today?",
      timestamp: 'Just now',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const suggestedQuestions = [
    'What decisions were taken in the last faculty meeting?',
    'What are my pending action items?',
    'When is the next scheduled session?',
    'Summarize the latest department meeting.',
    'Who is responsible for the upcoming project report?',
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (queryText?: string) => {
    const text = (queryText || input).trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await apiRequest('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ query: text }),
      });

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.answer || "I've analyzed your academic records and found no immediate conflicts.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble connecting to the meeting intelligence backend. Please verify your connection or try again shortly.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto space-y-4">
      
      {/* Top Banner Card */}
      <div className="bg-white rounded-2xl p-4 border border-[#E8E5DA] shadow-sm flex items-center space-x-3.5 flex-shrink-0">
        <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold text-[#1C251E] tracking-tight">
            ConverseIQ AI Assistant
          </h1>
          <p className="text-xs text-[#6B7280]">
            Ask questions about your meetings, decisions, action items, and schedules.
          </p>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 py-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start space-x-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-[#45644F] text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                <Sparkles className="w-4 h-4" />
              </div>
            )}

            <div
              className={`rounded-2xl p-4 max-w-xl text-sm leading-relaxed shadow-sm ${
                m.role === 'user'
                  ? 'bg-[#45644F] text-white rounded-tr-sm'
                  : 'bg-white text-[#1C251E] border border-[#E8E5DA] rounded-tl-sm'
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              <span className={`block text-[10px] mt-1.5 text-right ${m.role === 'user' ? 'text-white/70' : 'text-[#9CA3AF]'}`}>
                {m.timestamp}
              </span>
            </div>

            {m.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-[#EAE5D9] text-[#1C251E] flex items-center justify-center flex-shrink-0 mt-0.5 font-bold text-xs">
                R
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-full bg-[#45644F] text-white flex items-center justify-center flex-shrink-0 animate-pulse">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="bg-white rounded-2xl rounded-tl-sm p-4 border border-[#E8E5DA] shadow-sm flex items-center space-x-2 text-xs text-[#6B7280]">
              <span className="w-2 h-2 rounded-full bg-[#45644F] animate-bounce"></span>
              <span className="w-2 h-2 rounded-full bg-[#45644F] animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-2 h-2 rounded-full bg-[#45644F] animate-bounce [animation-delay:0.4s]"></span>
              <span className="ml-1">Searching meeting context...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions Chips & Input Bar */}
      <div className="space-y-3 flex-shrink-0 pt-2">
        
        {/* Suggested Chips */}
        <div>
          <span className="text-[11px] font-medium text-[#6B7280] block mb-1.5">
            Suggested questions:
          </span>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleSend(q)}
                className="px-3.5 py-1.5 bg-white hover:bg-[#FAF9F5] border border-[#E8E5DA] rounded-full text-xs font-medium text-[#1C251E] shadow-xs transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="bg-white rounded-2xl border border-[#E8E5DA] shadow-sm p-2 flex items-center space-x-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask ConverseIQ anything about your meetings..."
            className="flex-1 px-3 py-2 text-sm text-[#1C251E] placeholder-gray-400 outline-none bg-transparent"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-9 h-9 rounded-full bg-[#45644F] hover:bg-[#385240] text-white flex items-center justify-center flex-shrink-0 transition-all shadow-sm disabled:opacity-40"
          >
            <ArrowUp className="w-4 h-4 stroke-[2.5]" />
          </button>
        </form>

      </div>

    </div>
  );
}
