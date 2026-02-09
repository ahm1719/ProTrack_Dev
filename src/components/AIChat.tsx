import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, X, Sparkles, AlertCircle, Bot, User, Plus, Trash2, Edit3, Image as ImageIcon } from 'lucide-react';
import { Task, DailyLog, ChatMessage, Observation, AppConfig } from '../types';
import { chatWithAI } from '../services/geminiService';
import { v4 as uuidv4 } from 'uuid';

interface ChatTab {
  id: string;
  title: string;
  messages: ChatMessage[];
}

interface AIChatProps {
  tasks: Task[];
  logs: DailyLog[];
  observations: Observation[];
  appConfig: AppConfig;
  onOpenSettings: () => void;
}

const AIChat: React.FC<AIChatProps> = ({ tasks, logs, observations, appConfig, onOpenSettings }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tabs, setTabs] = useState<ChatTab[]>(() => {
    const saved = localStorage.getItem('protrack_chat_tabs');
    if (saved) return JSON.parse(saved);
    return [{
      id: 'default',
      title: 'General Assistant',
      messages: [{
        id: 'welcome',
        role: 'model',
        text: 'Hello! I am your Project AI. I have access to your tasks, logs, and observations. Ask me anything!',
        timestamp: Date.now()
      }]
    }];
  });
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id);
  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  useEffect(() => {
    localStorage.setItem('protrack_chat_tabs', JSON.stringify(tabs));
  }, [tabs]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chatWindowRef.current && !chatWindowRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEsc);
        setTimeout(() => inputRef.current?.focus(), 100);
    }
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [activeTab.messages, isOpen, attachedImage]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !attachedImage) || isLoading) return;

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      text: input.trim(),
      image: attachedImage || undefined,
      timestamp: Date.now()
    };

    const updatedTabs = tabs.map(t => t.id === activeTabId ? { ...t, messages: [...t.messages, userMsg] } : t);
    setTabs(updatedTabs);
    
    const currentImage = attachedImage; 
    const currentInput = input.trim();

    setInput('');
    setAttachedImage(null);
    setIsLoading(true);

    try {
      const apiHistory = activeTab.messages.filter(m => m.id !== 'welcome');
      const responseText = await chatWithAI(apiHistory, currentInput, tasks, logs, observations, appConfig, currentImage || undefined);

      const botMsg: ChatMessage = {
        id: uuidv4(),
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      };
      
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, messages: [...t.messages, botMsg] } : t));
    } catch (error: any) {
      const errorMsg: ChatMessage = {
        id: uuidv4(),
        role: 'model',
        text: error.message || 'Sorry, I encountered an error.',
        timestamp: Date.now()
      };
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, messages: [...t.messages, errorMsg] } : t));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 p-4 rounded-full shadow-2xl transition-all duration-300 z-40 flex items-center justify-center ${
          isOpen ? 'bg-slate-200 text-slate-600 rotate-90 scale-0 opacity-0' : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:scale-110'
        }`}
      >
        <MessageSquare size={24} />
      </button>

      <div 
        ref={chatWindowRef}
        className={`fixed bottom-6 right-6 w-[450px] max-w-[calc(100vw-3rem)] bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 flex flex-col transition-all duration-300 origin-bottom-right overflow-hidden ${
          isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none translate-y-10'
        }`}
        style={{ height: '650px', maxHeight: '85vh' }}
      >
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-5 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md text-white"><Sparkles size={20} /></div>
               <div>
                  <h3 className="font-bold text-white text-sm tracking-tight">AI Assistant</h3>
               </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white transition-colors">
                <X size={20} />
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar custom-scrollbar">
              {tabs.map(tab => (
                  <div 
                    key={tab.id}
                    onClick={() => setActiveTabId(tab.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap group shrink-0 ${activeTabId === tab.id ? 'bg-white text-indigo-700 shadow-md' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  >
                      {editingTabId === tab.id ? (
                          <input 
                            autoFocus
                            className="bg-transparent border-none outline-none w-24 text-indigo-700"
                            defaultValue={tab.title}
                            onBlur={(e) => { setTabs(tabs.map(t => t.id === tab.id ? { ...t, title: e.target.value } : t)); setEditingTabId(null); }}
                            onKeyDown={(e) => e.key === 'Enter' && (setTabs(tabs.map(t => t.id === tab.id ? { ...t, title: e.currentTarget.value } : t)), setEditingTabId(null))}
                          />
                      ) : (
                          <span onDoubleClick={() => setEditingTabId(tab.id)}>{tab.title}</span>
                      )}
                      {tabs.length > 1 && (
                          <button onClick={(e) => { e.stopPropagation(); const nt = tabs.filter(t => t.id !== tab.id); setTabs(nt); if (activeTabId === tab.id) setActiveTabId(nt[0].id); }} className={`p-0.5 rounded-md hover:bg-slate-100 transition-colors ${activeTabId === tab.id ? 'text-slate-300 hover:text-red-500' : 'text-indigo-200 hover:text-white'}`}>
                              <X size={10} />
                          </button>
                      )}
                  </div>
              ))}
              <button onClick={() => { const id = uuidv4(); setTabs([...tabs, { id, title: `New Chat`, messages: [{ id: uuidv4(), role: 'model', text: 'How can I help you?', timestamp: Date.now() }] }]); setActiveTabId(id); }} className="bg-white/10 text-white p-2 rounded-xl hover:bg-white/20 transition-colors shrink-0">
                  <Plus size={14} />
              </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50 dark:bg-slate-900 custom-scrollbar">
          {activeTab.messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400'}`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`max-w-[85%] p-4 rounded-3xl text-xs leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-tl-none'}`}>
                 {msg.image && <img src={msg.image} className="mb-2 rounded-xl max-h-48 w-full object-cover" />}
                 <div className="whitespace-pre-wrap">{msg.text}</div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 animate-pulse">
               <div className="w-9 h-9 rounded-2xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center"><Bot size={16} /></div>
               <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-5 py-4 rounded-3xl rounded-tl-none shadow-sm flex gap-1.5 items-center">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]" />
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 relative">
          <div className="relative flex items-center gap-2">
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-400 hover:bg-slate-100 hover:text-indigo-500 transition-all"
            >
              <ImageIcon size={20} />
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => setAttachedImage(ev.target?.result as string); r.readAsDataURL(f); } }} />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="w-full bg-slate-50 dark:bg-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 rounded-2xl pl-5 pr-14 py-3.5 text-xs focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900 outline-none"
            />
            <button type="submit" disabled={isLoading} className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-30">
              <Send size={18} />
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default AIChat;