import React, { useRef, useState, useEffect } from 'react';
import { Download, HardDrive, List, Plus, X, Trash2, Edit2, Key, Eye, EyeOff, Cloud, AlertTriangle, Palette } from 'lucide-react';
import { Task, DailyLog, Observation, FirebaseConfig, AppConfig, Status } from '../types';
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
  onPurgeData: (tasks: Task[], logs: DailyLog[]) => void;
}

const RESOURCE_LIMIT_BYTES = 1048576; // 1MB limit

const getSizeInBytes = (obj: any) => {
    try { return new Blob([JSON.stringify(obj)]).size; } 
    catch (e) { return 0; }
};

const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const ListEditor = ({ title, color, items, onUpdate, onRenameTitle, onUpdateColor, placeholder }: { 
    title: string, 
    color?: string,
    items: string[], 
    onUpdate: (items: string[]) => void, 
    onRenameTitle?: (newTitle: string) => void, 
    onUpdateColor?: (newColor: string) => void,
    placeholder: string 
}) => {
    const [newItem, setNewItem] = useState('');
    const [editingIdx, setEditingIdx] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');
    const [isRenamingTitle, setIsRenamingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState(title);

    const handleAdd = () => {
        if (newItem.trim() && !items.includes(newItem.trim())) {
            onUpdate([...items, newItem.trim()]);
            setNewItem('');
        }
    };

    const handleEditSave = (idx: number) => {
        if (editValue.trim()) {
            const newItems = [...items];
            newItems[idx] = editValue.trim();
            onUpdate(newItems);
        }
        setEditingIdx(null);
    };

    const handleTitleSave = () => {
        if (tempTitle.trim() && onRenameTitle) {
            onRenameTitle(tempTitle.trim());
        }
        setIsRenamingTitle(false);
    };

    return (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 h-full">
            <div className="mb-3 flex items-center justify-between">
                <div className="flex-1 flex items-center gap-2">
                    {onUpdateColor && (
                        <div className="relative group/picker">
                            <div 
                                className="w-4 h-4 rounded-full border border-white shadow-sm cursor-pointer"
                                style={{ backgroundColor: color || '#6366f1' }}
                            />
                            <input 
                                type="color" 
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                value={color || '#6366f1'}
                                onChange={(e) => onUpdateColor(e.target.value)}
                            />
                        </div>
                    )}
                    {isRenamingTitle ? (
                        <input 
                            autoFocus
                            className="bg-white border border-indigo-300 rounded px-2 py-0.5 outline-none font-bold text-slate-700 text-[10px] uppercase tracking-widest w-full"
                            value={tempTitle}
                            onChange={e => setTempTitle(e.target.value)}
                            onBlur={handleTitleSave}
                            onKeyDown={e => e.key === 'Enter' && handleTitleSave()}
                        />
                    ) : (
                        <h4 
                            onDoubleClick={() => setIsRenamingTitle(true)}
                            className="font-bold text-slate-700 text-[10px] uppercase tracking-widest cursor-pointer hover:text-indigo-600 flex items-center gap-2 group/title"
                        >
                            {title}
                            <Edit2 size={10} className="opacity-0 group-hover/title:opacity-100" />
                        </h4>
                    )}
                </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-4 min-h-[40px]">
                {items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-600 shadow-sm group">
                        {editingIdx === idx ? (
                            <input 
                                autoFocus
                                className="bg-transparent border-none outline-none w-20 text-indigo-600"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={() => handleEditSave(idx)}
                                onKeyDown={e => e.key === 'Enter' && handleEditSave(idx)}
                            />
                        ) : (
                            <>
                                <span onDoubleClick={() => { setEditingIdx(idx); setEditValue(item); }}>{item}</span>
                                <button onClick={() => { setEditingIdx(idx); setEditValue(item); }} className="text-slate-300 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Edit2 size={10} />
                                </button>
                                <button onClick={() => onUpdate(items.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <X size={10} />
                                </button>
                            </>
                        )}
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

const ResourceBar = ({ label, current, limit }: { label: string, current: number, limit: number }) => {
    const percentage = Math.min(100, (current / limit) * 100);
    const isCritical = percentage > 85;
    return (
        <div className="space-y-1">
            <div className="flex justify-between items-end">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
                <span className={`text-[10px] font-mono ${isCritical ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                    {formatBytes(current)} / {formatBytes(limit)}
                </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                    className={`h-full transition-all duration-500 rounded-full ${isCritical ? 'bg-red-500' : 'bg-indigo-500'}`} 
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};

const Settings: React.FC<SettingsProps> = ({ tasks, logs, observations, onImportData, onSyncConfigUpdate, isSyncEnabled, appConfig, onUpdateConfig, onPurgeData }) => {
  const [geminiKey, setGeminiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [configJson, setConfigJson] = useState('');

  useEffect(() => {
    const savedKey = localStorage.getItem('protrack_gemini_key');
    if (savedKey) setGeminiKey(savedKey);
    const savedConfig = localStorage.getItem('protrack_firebase_config');
    if (savedConfig) setConfigJson(JSON.stringify(JSON.parse(savedConfig), null, 2));
  }, []);

  const storageStats = { 
    total: getSizeInBytes({ tasks, logs, observations }),
    tasks: getSizeInBytes(tasks),
    logs: getSizeInBytes(logs),
    obs: getSizeInBytes(observations)
  };

  const handlePurge = () => {
    if (confirm("This will permanently delete ALL Done and Archived tasks and their associated logs. Continue?")) {
        const activeTasks = tasks.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED);
        const activeTaskIds = new Set(activeTasks.map(t => t.id));
        const activeLogs = logs.filter(l => activeTaskIds.has(l.taskId));
        onPurgeData(activeTasks, activeLogs);
        alert("Resources freed.");
    }
  };

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
                  <p className="text-xs text-slate-500">Double-click headers to rename. Use the color dot to customize themes.</p>
              </div>
          </div>
          <div className="p-6 grid md:grid-cols-3 gap-6">
              <ListEditor 
                title={appConfig.groupLabels?.statuses || "Task Statuses"} 
                color={appConfig.groupColors?.statuses}
                items={appConfig.taskStatuses} 
                onUpdate={items => onUpdateConfig({...appConfig, taskStatuses: items})} 
                onRenameTitle={newTitle => onUpdateConfig({...appConfig, groupLabels: { ...appConfig.groupLabels!, statuses: newTitle }})}
                onUpdateColor={newColor => onUpdateConfig({...appConfig, groupColors: { ...appConfig.groupColors!, statuses: newColor }})}
                placeholder="Add status..." 
              />
              <ListEditor 
                title={appConfig.groupLabels?.priorities || "Priorities"} 
                color={appConfig.groupColors?.priorities}
                items={appConfig.taskPriorities} 
                onUpdate={items => onUpdateConfig({...appConfig, taskPriorities: items})} 
                onRenameTitle={newTitle => onUpdateConfig({...appConfig, groupLabels: { ...appConfig.groupLabels!, priorities: newTitle }})}
                onUpdateColor={newColor => onUpdateConfig({...appConfig, groupColors: { ...appConfig.groupColors!, priorities: newColor }})}
                placeholder="Add priority..." 
              />
              <ListEditor 
                title={appConfig.groupLabels?.observations || "Observation Groups"} 
                color={appConfig.groupColors?.observations}
                items={appConfig.observationStatuses} 
                onUpdate={items => onUpdateConfig({...appConfig, observationStatuses: items})} 
                onRenameTitle={newTitle => onUpdateConfig({...appConfig, groupLabels: { ...appConfig.groupLabels!, observations: newTitle }})}
                onUpdateColor={newColor => onUpdateConfig({...appConfig, groupColors: { ...appConfig.groupColors!, observations: newColor }})}
                placeholder="Add group..." 
              />
          </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b bg-rose-50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                  <HardDrive className="text-rose-600" />
                  <div>
                      <h2 className="text-lg font-bold text-slate-800">Resource Health</h2>
                      <p className="text-xs text-slate-500">Monitoring 1MB sync bucket limits.</p>
                  </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-rose-600 block">{formatBytes(storageStats.total)}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Used of ~5MB Local</span>
              </div>
          </div>
          <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <ResourceBar label="Tasks Buffer" current={storageStats.tasks} limit={RESOURCE_LIMIT_BYTES} />
                  <ResourceBar label="Logs Buffer" current={storageStats.logs} limit={RESOURCE_LIMIT_BYTES} />
                  <ResourceBar label="Observations Buffer" current={storageStats.obs} limit={RESOURCE_LIMIT_BYTES} />
              </div>
              <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100 flex items-center justify-between">
                  <div className="flex items-start gap-3">
                      <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={18} />
                      <div>
                          <p className="text-xs font-bold text-rose-900">Purge Inactive Data</p>
                          <p className="text-[10px] text-rose-700">Clears "Done" and "Archived" items to free up resources.</p>
                      </div>
                  </div>
                  <button onClick={handlePurge} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-rose-100 flex items-center gap-2">
                      <Trash2 size={14} /> Purge Inactive
                  </button>
              </div>
          </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b bg-purple-50 flex items-center gap-3">
              <Key size={24} className="text-purple-600" />
              <div>
                  <h2 className="text-lg font-bold text-slate-800">AI Report Config</h2>
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

      <div className="grid grid-cols-1 gap-4">
          <button onClick={() => { const data = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ tasks, logs, observations }, null, 2)); const link = document.createElement('a'); link.setAttribute("href", data); link.setAttribute("download", `protrack_backup_${new Date().toISOString().split('T')[0]}.json`); link.click(); }} className="flex items-center justify-center gap-3 p-6 bg-slate-900 text-white rounded-2xl border border-slate-800 hover:bg-black transition-all group shadow-xl">
              <Download className="text-indigo-400 group-hover:text-white" />
              <span className="text-sm font-bold uppercase tracking-widest">Download Full System Backup (JSON)</span>
          </button>
      </div>
    </div>
  );
};

export default Settings;