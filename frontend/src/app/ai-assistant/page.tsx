'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, ArrowUp, Bot, User, Trash2, BookOpen } from 'lucide-react';
import { apiRequest, getCurrentStoredUser } from '@/lib/api';

interface MessageSource {
  type: string;
  id?: number | string;
  title: string;
}

interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: string;
  sources?: MessageSource[];
}

export default function AIAssistantPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const u = getCurrentStoredUser();
    if (u) {
      setCurrentUser(u);
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: `Hello ${u.name || 'there'}! I'm your ConverseIQ Query Assistant. I have full context of all recorded department meetings, decisions, action items, and schedules. What would you like to know today?`,
          timestamp: 'Just now',
        },
      ]);
    } else {
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content:
            "Hello! I'm your ConverseIQ Query Assistant. I have full context of all your recorded meetings, action items, and schedules. How can I help you today?",
          timestamp: 'Just now',
        },
      ]);
    }
  }, []);

  const isHod = currentUser?.role === 'HOD';

  const suggestedQuestions = isHod
    ? [
        'What are the pending action items across the department?',
        'Summarize the latest department meeting.',
        'What key decisions were taken recently?',
        'When is the next scheduled department meeting?',
        'Which tasks are marked high priority?',
      ]
    : [
        'What decisions were taken in the last meeting?',
        'What are my pending action items?',
        'Summarize the latest meeting discussion.',
        'When is the next scheduled session?',
        'Who is responsible for the upcoming deliverables?',
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
      const res = await apiRequest<{ answer: string; sources?: MessageSource[] }>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ query: text }),
      });

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.answer || "I've analyzed your academic records and found no matching details.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: res.sources,
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

  const handleClearChat = () => {
    setMessages([
      {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Chat cleared. Ask me anything about your department's meetings, decisions, or action items!`,
        timestamp: 'Just now',
      },
    ]);
  };

  const userInitial = currentUser?.name?.charAt(0).toUpperCase() || 'U';

  // Format markdown helper (bold, lists, headers)
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      // Header 3
      if (line.startsWith('### ')) {
        return (
          <h3 key={idx} className="font-bold text-sm text-[#173A2C] mt-2 mb-1">
            {line.replace('### ', '')}
          </h3>
        );
      }
      // Header 2
      if (line.startsWith('## ')) {
        return (
          <h2 key={idx} className="font-bold text-base text-[#173A2C] mt-2.5 mb-1.5">
            {line.replace('## ', '')}
          </h2>
        );
      }
      // Bullet item
      if (line.startsWith('• ') || line.startsWith('- ') || line.startsWith('* ')) {
        const bulletText = line.replace(/^[•\-\*]\s+/, '');
        return (
          <div key={idx} className="flex items-start space-x-2 my-1 pl-1">
            <span className="text-[#3F795F] font-bold text-xs mt-0.5">•</span>
            <span className="flex-1" dangerouslySetInnerHTML={{ __html: formatInline(bulletText) }} />
          </div>
        );
      }
      // Empty line
      if (!line.trim()) {
        return <div key={idx} className="h-2" />;
      }
      // Normal paragraph
      return (
        <p key={idx} className="my-1" dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
      );
    });
  };

  const formatInline = (text: string) => {
    // Replace **bold** with <strong>
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Replace *italic* with <em>
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    return formatted;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto space-y-4 animate-fade-in">
      
      {/* Top Banner Card */}
      <div className="bg-white rounded-2xl p-4 border border-[#DCE7E2] shadow-sm flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#E4F2F4] text-[#367C88] flex items-center justify-center flex-shrink-0 shadow-2xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#173A2C] tracking-tight">
              ConverseIQ Query Assistant
            </h1>
            <p className="text-xs text-[#667875]">
              Instant answers grounded strictly in your department meetings, MoM, decisions, and action items.
            </p>
          </div>
        </div>

        {messages.length > 1 && (
          <button
            onClick={handleClearChat}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs text-[#667875] hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-200 cursor-pointer"
            title="Clear Chat History"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Chat</span>
          </button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 py-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start space-x-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}
          >
            {m.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-[#367C88] text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-2xs">
                <Sparkles className="w-4 h-4" />
              </div>
            )}

            <div
              className={`rounded-2xl p-4 max-w-xl text-sm leading-relaxed shadow-2xs ${
                m.role === 'user'
                  ? 'bg-[#3F795F] text-white rounded-tr-sm'
                  : 'bg-[#E4F2F4]/40 text-[#173A2C] border border-[#B9DDE3] rounded-tl-sm'
              }`}
            >
              <div className="leading-relaxed">
                {m.role === 'assistant' ? renderFormattedContent(m.content) : <p className="whitespace-pre-wrap">{m.content}</p>}
              </div>

              {/* Source pills if available */}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-[#B9DDE3]/60 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-[#667875] font-medium flex items-center space-x-1 mr-1">
                    <BookOpen className="w-3 h-3" />
                    <span>Sources:</span>
                  </span>
                  {m.sources.map((src, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-white text-[#3F795F] text-[10px] font-semibold rounded-md border border-[#DCE7E2] shadow-2xs"
                    >
                      {src.title}
                    </span>
                  ))}
                </div>
              )}

              <span className={`block text-[10px] mt-1.5 text-right ${m.role === 'user' ? 'text-white/70' : 'text-[#667875]'}`}>
                {m.timestamp}
              </span>
            </div>

            {m.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-[#3F795F] text-white flex items-center justify-center flex-shrink-0 mt-0.5 font-bold text-xs shadow-2xs">
                {userInitial}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start space-x-3 animate-fade-in">
            <div className="w-8 h-8 rounded-full bg-[#367C88] text-white flex items-center justify-center flex-shrink-0 animate-pulse">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="bg-[#E4F2F4]/40 rounded-2xl rounded-tl-sm p-4 border border-[#B9DDE3] shadow-2xs flex items-center space-x-2 text-xs text-[#667875]">
              <span className="w-2 h-2 rounded-full bg-[#367C88] animate-bounce"></span>
              <span className="w-2 h-2 rounded-full bg-[#367C88] animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-2 h-2 rounded-full bg-[#367C88] animate-bounce [animation-delay:0.4s]"></span>
              <span className="ml-1 text-[#367C88] font-medium">Searching meeting context &amp; analyzing with Gemini...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions Chips & Input Bar */}
      <div className="space-y-3 flex-shrink-0 pt-2">
        
        {/* Suggested Chips */}
        <div>
          <span className="text-[11px] font-semibold text-[#667875] block mb-1.5">
            Suggested questions:
          </span>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleSend(q)}
                className="px-3.5 py-1.5 bg-white hover:bg-[#E4F2F4]/60 border border-[#DCE7E2] hover:border-[#78A98F] rounded-full text-xs font-medium text-[#173A2C] hover:text-[#367C88] shadow-2xs transition-all cursor-pointer transform hover:-translate-y-0.5"
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
          className="bg-white rounded-2xl border border-[#DCE7E2] shadow-sm p-2 flex items-center space-x-2 focus-within:border-[#78A98F] focus-within:ring-2 focus-within:ring-[#78A98F]/20 transition-all"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask ConverseIQ anything about your meetings, decisions, or action items..."
            className="flex-1 px-3 py-2 text-sm text-[#173A2C] placeholder:text-[#667875]/60 outline-none bg-transparent"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-9 h-9 rounded-full bg-[#3F795F] hover:bg-[#34654F] text-white flex items-center justify-center flex-shrink-0 transition-all shadow-sm disabled:opacity-40 cursor-pointer transform hover:scale-105 active:scale-95"
          >
            <ArrowUp className="w-4 h-4 stroke-[2.5]" />
          </button>
        </form>

      </div>

    </div>
  );
}
