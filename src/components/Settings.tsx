
import React, { useRef, useState, useEffect } from 'react';
import { Download, HardDrive, List, Plus, X, Trash2, Edit2, Key, Eye, EyeOff, Cloud, AlertTriangle, Palette, FolderOpen, Save, RefreshCw, Folder, CheckCircle2, Tag, Moon, Sun } from 'lucide-react';
import { Task, DailyLog, Observation, FirebaseConfig, AppConfig, Status, BackupSettings, HighlightOption } from '../types';
import { initFirebase } from '../services/firebaseService';
import { saveManualBackup } from '../services/backupService';

interface SettingsProps {
  tasks: Task[];
  logs: DailyLog[];
  observations: Observation[];
  offDays?: string[];
  onImportData: (data: { tasks: Task[]; logs: DailyLog[]; observations: Observation[]; offDays?: string[] }) => void;
  onSyncConfigUpdate: (config: FirebaseConfig | null) => void;
  isSyncEnabled: boolean;
  appConfig: AppConfig;
  onUpdateConfig: (config: AppConfig) => void;
  onPurgeData: (tasks: Task[], logs: DailyLog[]) => void;
  
  // Backup Props
  backupSettings?: BackupSettings;
  setBackupSettings?: React.Dispatch<React.SetStateAction<BackupSettings>>;
  onSetupBackupFolder?: () => void;
  backupStatus?: 'idle' | 'running' | 'error' | 'permission_needed';
  onVerifyBackupPermission?: () => void;

  // Theme Props
  isDarkMode?: boolean;
  onToggleTheme?: (isDark: boolean) => void;
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

const ListEditor = ({ 
    title, 
    color, 
    items, 
    onUpdate, 
    onRenameTitle, 
    onUpdateColor, 
    placeholder,
    itemColors,
    onItemColorChange 
}: { 
    title: string, 
    color?: string,
    items: string[], 
    onUpdate: (items: string[]) => void, 
    onRenameTitle?: (newTitle: string) => void, 
    onUpdateColor?: (newColor: string) => void,
    placeholder: string,
    itemColors?: Record<string, string>,
    onItemColorChange?: (item: string, color: string) => void
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
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 h-full">
            <div className="mb-3 flex items-center justify-between">
                <div className="flex-1 flex items-center gap-2">
                    {onUpdateColor && (
                        <div className="relative group/picker">
                            <div 
                                className="w-4 h-4 rounded-full border border-white dark:border-slate-600 shadow-sm cursor-pointer"
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
                            className="bg-white dark:bg-slate-700 border border-indigo-300 dark:border-indigo-600 rounded px-2 py-0.5 outline-none font-bold text-slate-700 dark:text-slate-200 text-[10px] uppercase tracking-widest w-full"
                            value={tempTitle}
                            onChange={e => setTempTitle(e.target.value)}
                            onBlur={handleTitleSave}
                            onKeyDown={e => e.key === 'Enter' && handleTitleSave()}
                        />
                    ) : (
                        <h4 
                            onDoubleClick={() => setIsRenamingTitle(true)}
                            className="font-bold text-slate-700 dark:text-slate-300 text-[10px] uppercase tracking-widest cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-2 group/title"
                        >
                            {title}
                            <Edit2 size={10} className="opacity-0 group-hover/title:opacity-100" />
                        </h4>
                    )}
                </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-4 min-h-[40px]">
                {items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-white dark:bg-slate-700 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 text-[10px] font-bold text-slate-600 dark:text-slate-300 shadow-sm group">
                        {onItemColorChange && (
                            <div className="relative w-3 h-3 shrink-0 rounded-full border border-slate-200 dark:border-slate-500 overflow-hidden cursor-pointer hover:scale-110 transition-transform mr-1">
                                <input 
                                    type="color" 
                                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] p-0 border-0 opacity-0 cursor-pointer"
                                    value={itemColors?.[item] || '#cbd5e1'}
                                    onChange={(e) => onItemColorChange(item, e.target.value)}
                                    title="Assign color"
                                />
                                <div 
                                    className="w-full h-full pointer-events-none"
                                    style={{ backgroundColor: itemColors?.[item] || '#cbd5e1' }}
                                />
                            </div>
                        )}

                        {editingIdx === idx ? (
                            <input 
                                autoFocus
                                className="bg-transparent border-none outline-none w-20 text-indigo-600 dark:text-indigo-400"
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
                <input type="text" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} placeholder={placeholder} className="flex-1 px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:border-indigo-500 bg-white dark:bg-slate-700 dark:text-white dark:placeholder-slate-400" />
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
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{label}</span>
                <span className={`text-[10px] font-mono ${isCritical ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-400 dark:text-slate-500'}`}>
                    {formatBytes(current)} / {formatBytes(limit)}
                </span>
            </div>
            <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div 
                    className={`h-full transition-all duration-500 rounded-full ${isCritical ? 'bg-red-500' : 'bg-indigo-500'}`} 
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};

const Settings: React.FC<SettingsProps> = ({ 
    tasks, logs, observations, offDays = [], 
    onImportData, onSyncConfigUpdate, isSyncEnabled, appConfig, onUpdateConfig, onPurgeData,
    backupSettings, setBackupSettings, onSetupBackupFolder, backupStatus, onVerifyBackupPermission,
    isDarkMode = false, onToggleTheme
}) => {
  const [configJson, setConfigJson] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedConfig = localStorage.getItem('protrack_firebase_config');
    if (savedConfig) setConfigJson(JSON.stringify(JSON.parse(savedConfig), null, 2));
  }, []);

  const storageStats = { 
    total: getSizeInBytes({ tasks, logs, observations, offDays }),
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

  const handleDownloadBackup = async () => {
    const data = { tasks, logs, observations, offDays, appConfig };
    await saveManualBackup(data);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">System Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Manage classifications and synchronization.</p>
      </div>

      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-6 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <Palette className="text-indigo-600 dark:text-indigo-400" />
                  <div>
                      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Appearance</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Customize theme.</p>
                  </div>
              </div>
              
              {onToggleTheme && (
                  <button 
                    onClick={() => onToggleTheme(!isDarkMode)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
                        isDarkMode 
                        ? 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                      {isDarkMode ? <Moon size={16} /> : <Sun size={16} />}
                      <span className="text-xs font-bold">{isDarkMode ? 'Dark' : 'Light'}</span>
                  </button>
              )}
          </div>
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-6 border-b dark:border-slate-700 bg-indigo-50 dark:bg-indigo-900/20 flex items-center gap-3">
              <List className="text-indigo-600 dark:text-indigo-400" />
              <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Classifications</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Rename or customize lists.</p>
              </div>
          </div>
          <div className="p-6 grid md:grid-cols-3 gap-6">
              <ListEditor 
                title={appConfig.groupLabels?.statuses || "Statuses"} 
                color={appConfig.groupColors?.statuses}
                items={appConfig.taskStatuses} 
                onUpdate={items => onUpdateConfig({...appConfig, taskStatuses: items})} 
                onRenameTitle={newTitle => onUpdateConfig({...appConfig, groupLabels: { ...appConfig.groupLabels!, statuses: newTitle }})}
                onUpdateColor={newColor => onUpdateConfig({...appConfig, groupColors: { ...appConfig.groupColors!, statuses: newColor }})}
                placeholder="Add..."
                itemColors={appConfig.itemColors}
                onItemColorChange={(item, color) => onUpdateConfig({...appConfig, itemColors: { ...(appConfig.itemColors || {}), [item]: color }})}
              />
              <ListEditor 
                title={appConfig.groupLabels?.priorities || "Priorities"} 
                color={appConfig.groupColors?.priorities}
                items={appConfig.taskPriorities} 
                onUpdate={items => onUpdateConfig({...appConfig, taskPriorities: items})} 
                onRenameTitle={newTitle => onUpdateConfig({...appConfig, groupLabels: { ...appConfig.groupLabels!, priorities: newTitle }})}
                onUpdateColor={newColor => onUpdateConfig({...appConfig, groupColors: { ...appConfig.groupColors!, priorities: newColor }})}
                placeholder="Add..."
                itemColors={appConfig.itemColors}
                onItemColorChange={(item, color) => onUpdateConfig({...appConfig, itemColors: { ...(appConfig.itemColors || {}), [item]: color }})}
              />
              <ListEditor 
                title={appConfig.groupLabels?.observations || "Observation Groups"} 
                color={appConfig.groupColors?.observations}
                items={appConfig.observationStatuses} 
                onUpdate={items => onUpdateConfig({...appConfig, observationStatuses: items})} 
                onRenameTitle={newTitle => onUpdateConfig({...appConfig, groupLabels: { ...appConfig.groupLabels!, observations: newTitle }})}
                onUpdateColor={newColor => onUpdateConfig({...appConfig, groupColors: { ...appConfig.groupColors!, observations: newColor }})}
                placeholder="Add..."
                itemColors={appConfig.itemColors}
                onItemColorChange={(item, color) => onUpdateConfig({...appConfig, itemColors: { ...(appConfig.itemColors || {}), [item]: color }})}
              />
          </div>
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-6 border-b dark:border-slate-700 bg-rose-50 dark:bg-rose-900/20 flex justify-between items-center">
              <div className="flex items-center gap-3">
                  <HardDrive className="text-rose-600 dark:text-rose-400" />
                  <div>
                      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Resource Health</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Monitoring sync limits.</p>
                  </div>
              </div>
          </div>
          <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <ResourceBar label="Tasks" current={storageStats.tasks} limit={RESOURCE_LIMIT_BYTES} />
                  <ResourceBar label="Logs" current={storageStats.logs} limit={RESOURCE_LIMIT_BYTES} />
                  <ResourceBar label="Observations" current={storageStats.obs} limit={RESOURCE_LIMIT_BYTES} />
              </div>
              <button onClick={handlePurge} className="w-full flex items-center justify-center gap-2 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-md">
                  <Trash2 size={14} /> Purge Inactive Data
              </button>
          </div>
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-6 border-b dark:border-slate-700 bg-emerald-50 dark:bg-emerald-900/20 flex justify-between items-center">
              <div className="flex items-center gap-3">
                  <Cloud className="text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Cloud Sync</h2>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${isSyncEnabled ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200' : 'bg-slate-100 text-slate-400'}`}>
                  {isSyncEnabled ? 'CONNECTED' : 'OFFLINE'}
              </span>
          </div>
          <div className="p-6">
              <textarea value={configJson} onChange={e => setConfigJson(e.target.value)} placeholder='Paste Firebase Config JSON...' className="w-full h-40 p-4 font-mono text-[10px] bg-slate-900 text-emerald-400 rounded-xl outline-none" />
              <div className="mt-4 flex gap-3">
                  <button onClick={() => { try { const c = JSON.parse(configJson); initFirebase(c); localStorage.setItem('protrack_firebase_config', JSON.stringify(c)); onSyncConfigUpdate(c); alert('Connected!'); } catch (e: any) { alert(e.message); } }} className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-bold text-sm shadow-lg">Connect</button>
                  <button onClick={() => { localStorage.removeItem('protrack_firebase_config'); onSyncConfigUpdate(null); setConfigJson(''); }} className="px-6 py-3 border text-slate-400 font-bold text-sm rounded-xl hover:bg-slate-50">Disconnect</button>
              </div>
          </div>
      </section>

      <div className="grid grid-cols-2 gap-4">
          <button onClick={handleDownloadBackup} className="flex items-center justify-center gap-3 p-6 bg-slate-900 text-white rounded-2xl border shadow-xl">
              <Download className="text-indigo-400" />
              <span className="text-sm font-bold uppercase tracking-widest">Backup JSON</span>
          </button>
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
             <div className="flex items-center justify-center gap-3 p-6 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl border-2 border-dashed hover:border-indigo-500 hover:bg-indigo-50 transition-all">
                <FolderOpen className="text-slate-400" />
                <span className="text-sm font-bold uppercase tracking-widest">Restore</span>
             </div>
             <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        try {
                            const data = JSON.parse(ev.target?.result as string);
                            onImportData(data);
                            alert('Restored!');
                        } catch (err) { alert('Invalid backup.'); }
                    };
                    reader.readAsText(file);
                }
             }} />
          </div>
      </div>
    </div>
  );
};

export default Settings;
