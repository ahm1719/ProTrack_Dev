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
    if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        // Auto focus input when opened
        setTimeout(() => inputRef.current?.focus(), 100);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [activeTab.messages, isOpen, attachedImage]); // Added attachedImage to ensure scroll when preview appears

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setAttachedImage(result);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  // Allow pasting images directly into the chat
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setAttachedImage(event.target?.result as string);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

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
    
    // Clear inputs immediately
    const currentImage = attachedImage; // Capture for API call
    setInput('');
    setAttachedImage(null);
    setIsLoading(true);

    try {
      const apiHistory = activeTab.messages.filter(m => m.id !== 'welcome');
      const responseText = await chatWithAI(apiHistory, userMsg.text, tasks, logs, observations, appConfig, currentImage || undefined);

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
        text: error.message || 'Unknown error',
        timestamp: Date.now()
      };
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, messages: [...t.messages, errorMsg] } : t));
    } finally {
      setIsLoading(false);
    }
  };

  const createNewTab = () => {
    const newId = uuidv4();
    const newTab: ChatTab = {
      id: newId,
      title: `Conversation ${tabs.length + 1}`,
      messages: [{
        id: uuidv4(),
        role: 'model',
        text: 'How can I help you in this new thread?',
        timestamp: Date.now()
      }]
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newId);
  };

  const deleteTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) setActiveTabId(newTabs[0].id);
  };

  const renameTab = (id: string, newTitle: string) => {
    setTabs(tabs.map(t => t.id === id ? { ...t, title: newTitle } : t));
    setEditingTabId(null);
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
        className={`fixed bottom-6 right-6 w-[450px] max-w-[calc(100vw-3rem)] bg-white rounded-3xl shadow-2xl border border-slate-200 z-50 flex flex-col transition-all duration-300 origin-bottom-right overflow-hidden ${
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
                  <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-indigo-100 text-[9px] uppercase tracking-widest font-black">Connected</span>
                  </div>
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
                            onBlur={(e) => renameTab(tab.id, e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && renameTab(tab.id, e.currentTarget.value)}
                          />
                      ) : (
                          <span onDoubleClick={() => setEditingTabId(tab.id)}>{tab.title}</span>
                      )}
                      {tabs.length > 1 && (
                          <button onClick={(e) => deleteTab(tab.id, e)} className={`p-0.5 rounded-md hover:bg-slate-100 transition-colors ${activeTabId === tab.id ? 'text-slate-300 hover:text-red-500' : 'text-indigo-200 hover:text-white'}`}>
                              <X size={10} />
                          </button>
                      )}
                  </div>
              ))}
              <button onClick={createNewTab} className="bg-white/10 text-white p-2 rounded-xl hover:bg-white/20 transition-colors shrink-0">
                  <Plus size={14} />
              </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50 custom-scrollbar">
          {activeTab.messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-purple-100 text-purple-600'}`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`max-w-[85%] p-4 rounded-3xl text-xs leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'}`}>
                 {msg.image && (
                   <div className="mb-2 rounded-xl overflow-hidden bg-black/10">
                     <img src={msg.image} alt="User upload" className="max-w-full max-h-48 object-cover" />
                   </div>
                 )}
                 <div className="whitespace-pre-wrap">
                   {msg.text.includes('API Key is missing') ? (
                      <div className="space-y-3">
                          <span className="text-red-500 font-bold flex items-center gap-1 uppercase tracking-tighter"><AlertCircle size={14} /> Configuration Error</span>
                          <p className="opacity-70">I need an API key to work correctly. Please set it up in the system configuration.</p>
                          <button onClick={onOpenSettings} className="bg-red-50 hover:bg-red-100 text-red-600 w-full py-2 rounded-xl text-[10px] font-bold transition-colors">Go to Settings →</button>
                      </div>
                   ) : msg.text}
                 </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 animate-pulse">
               <div className="w-9 h-9 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center"><Bot size={16} /></div>
               <div className="bg-white border border-slate-200 px-5 py-4 rounded-3xl rounded-tl-none shadow-sm flex gap-1.5 items-center">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]" />
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-100 relative">
          {attachedImage && (
            <div className="absolute bottom-full left-0 mb-0 ml-4 p-2 bg-white rounded-t-xl border border-b-0 border-slate-200 shadow-sm flex items-center gap-2 z-10">
              <div className="relative group">
                <img src={attachedImage} alt="Preview" className="h-10 w-10 object-cover rounded-lg border border-slate-200" />
                <button 
                  type="button" 
                  onClick={() => setAttachedImage(null)}
                  className="absolute -top-1.5 -right-1.5 bg-white text-red-500 rounded-full shadow-md hover:scale-110 transition-transform p-0.5"
                >
                  <X size={12} />
                </button>
              </div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Image Attached</span>
            </div>
          )}
          <div className="relative flex items-center gap-2">
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              className={`p-2.5 rounded-xl transition-all ${attachedImage ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-indigo-500'}`}
              title="Attach Image"
            >
              <ImageIcon size={20} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleImageSelect}
            />
            
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={handlePaste}
              placeholder={`Message ${activeTab.title}...`}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-5 pr-14 py-3.5 text-xs focus:ring-4 focus:ring-indigo-50 border-transparent focus:border-indigo-200 outline-none transition-all"
            />
            <button 
              type="submit" 
              disabled={(!input.trim() && !attachedImage) || isLoading} 
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-30 transition-all shadow-lg shadow-indigo-100"
            >
              <Send size={18} />
            </button>
          </div>
          <div className="flex justify-between items-center mt-3 px-1">
              <div className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">{activeTab.title}</div>
              <div className="text-[9px] text-slate-300 font-medium">Click outside to close</div>
          </div>
        </form>
      </div>
    </>
  );
};

export default AIChat;