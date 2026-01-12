
import React, { useRef, useState, useEffect } from 'react';
import { Download, Upload, Cloud, Check, Wifi, WifiOff, AlertTriangle, Key, Eye, EyeOff, Copy, Smartphone, Sparkles, FileText, RotateCcw, Database, HardDrive, PieChart, List, Plus, X } from 'lucide-react';
import { Task, DailyLog, Observation, FirebaseConfig, AppConfig } from '../types';
import { initFirebase } from '../services/firebaseService';

interface SettingsProps {
  tasks: Task[];
  logs: DailyLog[];
  observations: Observation[];
  onImportData: (data: { tasks: Task[]; logs: DailyLog[]; observations: Observation[] }) => void;
  onSyncConfigUpdate: (config: FirebaseConfig | null) => void;
  isSyncEnabled: boolean;
  appConfig: AppConfig;
  onUpdateConfig: (config: AppConfig) => void;
}

const getSizeInBytes = (obj: any) => {
    try { return new Blob([JSON.stringify(obj)]).size; } 
    catch (e) { return 0; }
};

const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const ListEditor = ({ title, items, onUpdate, placeholder }: { title: string, items: string[], onUpdate: (items: string[]) => void, placeholder: string }) => {
    const [newItem, setNewItem] = useState('');
    const handleAdd = () => {
        if (newItem.trim() && !items.includes(newItem.trim())) {
            onUpdate([...items, newItem.trim()]);
            setNewItem('');
        }
    };
    return (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 h-full">
            <h4 className="font-bold text-slate-700 text-[10px] uppercase mb-3 tracking-widest">{title}</h4>
            <div className="flex flex-wrap gap-2 mb-4 min-h-[40px]">
                {items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-600 shadow-sm group">
                        <span>{item}</span>
                        <button onClick={() => onUpdate(items.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <X size={10} />
                        </button>
                    </div>
                ))}
            </div>
            <div className="flex gap-2">
                <input type="text" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} placeholder={placeholder} className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-indigo-500 bg-white" />
                <button onClick={handleAdd} className="bg-indigo-600 text-white p-1.5 rounded-lg hover:bg-indigo-700"><Plus size={14} /></button>
            </div>
        </div>
    );
};

const Settings: React.FC<SettingsProps> = ({ tasks, logs, observations, onImportData, onSyncConfigUpdate, isSyncEnabled, appConfig, onUpdateConfig }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [geminiKey, setGeminiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [configJson, setConfigJson] = useState('');
  const [reportInstruction, setReportInstruction] = useState('');

  useEffect(() => {
    const savedKey = localStorage.getItem('protrack_gemini_key');
    if (savedKey) setGeminiKey(savedKey);
    const savedInstruction = localStorage.getItem('protrack_report_instruction');
    if (savedInstruction) setReportInstruction(savedInstruction);
    const savedConfig = localStorage.getItem('protrack_firebase_config');
    if (savedConfig) setConfigJson(JSON.stringify(JSON.parse(savedConfig), null, 2));
  }, []);

  const storageStats = { total: getSizeInBytes({ tasks, logs, observations }) };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">System Settings</h1>
        <p className="text-slate-500 text-sm">Manage classifications, AI keys, and cloud synchronization.</p>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b bg-indigo-50 flex items-center gap-3">
              <List className="text-indigo-600" />
              <div>
                  <h2 className="text-lg font-bold text-slate-800">Classifications & Lists</h2>
                  <p className="text-xs text-slate-500">Configure status and priority options globally.</p>
              </div>
          </div>
          <div className="p-6 grid md:grid-cols-3 gap-6">
              <ListEditor title="Task Statuses" items={appConfig.taskStatuses} onUpdate={items => onUpdateConfig({...appConfig, taskStatuses: items})} placeholder="Add status..." />
              <ListEditor title="Priorities" items={appConfig.taskPriorities} onUpdate={items => onUpdateConfig({...appConfig, taskPriorities: items})} placeholder="Add priority..." />
              <ListEditor title="Observation Groups" items={appConfig.observationStatuses} onUpdate={items => onUpdateConfig({...appConfig, observationStatuses: items})} placeholder="Add group..." />
          </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b bg-purple-50 flex items-center gap-3">
              <Key size={24} className="text-purple-600" />
              <div>
                  <h2 className="text-lg font-bold text-slate-800">AI Report Config</h2>
                  <p className="text-xs text-slate-500">Gemini Pro credentials and prompt engineering.</p>
              </div>
          </div>
          <div className="p-6 space-y-6">
              <div className="flex gap-2">
                  <div className="relative flex-1">
                      <input type={showKey ? "text" : "password"} value={geminiKey} onChange={e => setGeminiKey(e.target.value)} placeholder="Gemini API Key..." className="w-full pl-4 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-200" />
                      <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showKey ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
                  </div>
                  <button onClick={() => { localStorage.setItem('protrack_gemini_key', geminiKey); alert('Saved!'); }} className="px-6 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold shadow-md">Save</button>
              </div>
              <textarea value={reportInstruction} onChange={e => setReportInstruction(e.target.value)} placeholder="Custom instructions for AI summary..." className="w-full h-32 p-4 text-sm border border-slate-300 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-purple-200 resize-none" />
          </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b bg-emerald-50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                  <Cloud className="text-emerald-600" />
                  <h2 className="text-lg font-bold text-slate-800">Cloud Sync</h2>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${isSyncEnabled ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                  {isSyncEnabled ? 'CONNECTED' : 'OFFLINE'}
              </span>
          </div>
          <div className="p-6">
              <textarea value={configJson} onChange={e => setConfigJson(e.target.value)} placeholder='Paste Firebase Config JSON here...' className="w-full h-40 p-4 font-mono text-[10px] bg-slate-900 text-emerald-400 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
              <div className="mt-4 flex gap-3">
                  <button onClick={() => { try { const c = JSON.parse(configJson); initFirebase(c); localStorage.setItem('protrack_firebase_config', JSON.stringify(c)); onSyncConfigUpdate(c); alert('Connected!'); } catch (e: any) { alert(e.message); } }} className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-bold text-sm shadow-lg">Connect Sync</button>
                  <button onClick={() => { localStorage.removeItem('protrack_firebase_config'); onSyncConfigUpdate(null); setConfigJson(''); }} className="px-6 py-3 border border-slate-200 text-slate-400 font-bold text-sm rounded-xl hover:bg-slate-50 transition-colors">Disconnect</button>
              </div>
          </div>
      </section>

      <div className="grid grid-cols-2 gap-4">
          <button onClick={() => { const data = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ tasks, logs, observations }, null, 2)); const link = document.createElement('a'); link.setAttribute("href", data); link.setAttribute("download", `protrack_backup_${new Date().toISOString().split('T')[0]}.json`); link.click(); }} className="flex flex-col items-center gap-2 p-6 bg-slate-50 rounded-2xl border border-slate-200 hover:bg-white transition-all group">
              <Download className="text-slate-400 group-hover:text-indigo-600" />
              <span className="text-xs font-bold text-slate-600">Download Backup</span>
          </button>
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center justify-center gap-2">
              <HardDrive className="text-slate-400" />
              {/* Fix: Property 'totalSize' does not exist on type '{ total: number; }'. Changed to 'total'. */}
              <span className="text-xs font-bold text-slate-600">Storage Used: {formatBytes(storageStats.total)}</span>
          </div>
      </div>
    </div>
  );
};

export default Settings;
