import React, { useRef, useState, useEffect } from 'react';
import { Download, HardDrive, List, Plus, X, Trash2, Edit2, Key, Eye, EyeOff, Cloud, AlertTriangle, Palette, FolderOpen, Save, RefreshCw, Folder, Moon, Sun, Sparkles, Clock, History, Calendar, CheckCircle2 } from 'lucide-react';
import { Task, DailyLog, Observation, FirebaseConfig, AppConfig, Status, ObservationStatus, BackupSettings, HighlightOption } from '../types';
import { initFirebase } from '../services/firebaseService';
import { saveManualBackup } from '../services/backupService';
import { v4 as uuidv4 } from 'uuid';

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
  onPurgeData: (tasks: Task[], logs: DailyLog[], observations: Observation[]) => void;
  
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
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 h-full flex flex-col">
            <div className="mb-3 flex items-center justify-between shrink-0">
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
            <div className="flex-1 flex flex-wrap content-start gap-2 mb-4 min-h-[40px]">
                {items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-white dark:bg-slate-700 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 text-[10px] font-bold text-slate-600 dark:text-slate-300 shadow-sm group h-fit">
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
            <div className="flex gap-2 shrink-0">
                <input type="text" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} placeholder={placeholder} className="flex-1 px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:border-indigo-500 bg-white dark:bg-slate-700 dark:text-white dark:placeholder-slate-400" />
                <button onClick={handleAdd} className="bg-indigo-600 text-white p-1.5 rounded-lg hover:bg-indigo-700"><Plus size={14} /></button>
            </div>
        </div>
    );
};

const TagEditor = ({
    title,
    tags,
    onUpdate
}: {
    title: string,
    tags: HighlightOption[],
    onUpdate: (tags: HighlightOption[]) => void
}) => {
    const [newLabel, setNewLabel] = useState('');
    const [newColor, setNewColor] = useState('#6366f1');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editLabel, setEditLabel] = useState('');

    const handleAdd = () => {
        if (newLabel.trim()) {
            onUpdate([...tags, { id: uuidv4(), label: newLabel.trim(), color: newColor }]);
            setNewLabel('');
        }
    };

    const handleUpdateTag = (id: string, updates: Partial<HighlightOption>) => {
        onUpdate(tags.map(t => t.id === id ? { ...t, ...updates } : t));
    };

    const handleDelete = (id: string) => {
        onUpdate(tags.filter(t => t.id !== id));
    };

    return (
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 h-full flex flex-col">
            <h4 className="font-bold text-slate-700 dark:text-slate-300 text-[10px] uppercase tracking-widest mb-3 shrink-0">{title}</h4>
            <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar min-h-[100px] mb-3">
                {tags.map(tag => (
                    <div key={tag.id} className="flex items-center gap-2 bg-white dark:bg-slate-700 p-2 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm group">
                        <div className="relative w-4 h-4 shrink-0 rounded-full overflow-hidden cursor-pointer hover:scale-110 transition-transform">
                             <input
                                type="color"
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] p-0 border-0 opacity-0 cursor-pointer"
                                value={tag.color}
                                onChange={(e) => handleUpdateTag(tag.id, { color: e.target.value })}
                            />
                            <div className="w-full h-full pointer-events-none" style={{ backgroundColor: tag.color }} />
                        </div>
                        
                        {editingId === tag.id ? (
                             <input
                                autoFocus
                                className="flex-1 bg-transparent border-none outline-none text-xs text-indigo-600 dark:text-indigo-400 font-bold"
                                value={editLabel}
                                onChange={e => setEditLabel(e.target.value)}
                                onBlur={() => {
                                    if(editLabel.trim()) handleUpdateTag(tag.id, { label: editLabel.trim() });
                                    setEditingId(null);
                                }}
                                onKeyDown={e => e.key === 'Enter' && (editLabel.trim() ? (handleUpdateTag(tag.id, { label: editLabel.trim() }), setEditingId(null)) : setEditingId(null))}
                            />
                        ) : (
                            <span 
                                className="flex-1 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                                onDoubleClick={() => { setEditingId(tag.id); setEditLabel(tag.label); }}
                            >
                                {tag.label}
                            </span>
                        )}

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => { setEditingId(tag.id); setEditLabel(tag.label); }} className="text-slate-400 hover:text-indigo-500"><Edit2 size={12}/></button>
                             <button onClick={() => handleDelete(tag.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={12}/></button>
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex gap-2 items-center shrink-0">
                <div className="relative w-6 h-6 shrink-0 rounded-full overflow-hidden border border-slate-300 dark:border-slate-500 cursor-pointer">
                     <input
                        type="color"
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] p-0 border-0 opacity-0 cursor-pointer"
                        value={newColor}
                        onChange={(e) => setNewColor(e.target.value)}
                    />
                    <div className="w-full h-full pointer-events-none" style={{ backgroundColor: newColor }} />
                </div>
                <input 
                    type="text" 
                    value={newLabel} 
                    onChange={(e) => setNewLabel(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()} 
                    placeholder="New tag..." 
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:border-indigo-500 bg-white dark:bg-slate-700 dark:text-white dark:placeholder-slate-400" 
                />
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
  const [geminiKey, setGeminiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [customRetentionDays, setCustomRetentionDays] = useState<string>(appConfig.retentionPeriodDays?.toString() || '60');
  
  // Logic for custom retention window
  const standardRetentions = [30, 60, 90, 180, 365];
  const currentRetention = appConfig.retentionPeriodDays || 60;
  const isStandardValue = standardRetentions.includes(currentRetention);
  const [forceCustomMode, setForceCustomMode] = useState(false);
  const isCustomMode = !isStandardValue || forceCustomMode;

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedConfig = localStorage.getItem('protrack_firebase_config');
    if (savedConfig) setConfigJson(JSON.stringify(JSON.parse(savedConfig), null, 2));
    
    const savedKey = localStorage.getItem('protrack_gemini_key');
    if (savedKey) setGeminiKey(savedKey);
  }, []);

  const storageStats = { 
    total: getSizeInBytes({ tasks, logs, observations, offDays }),
    tasks: getSizeInBytes(tasks),
    logs: getSizeInBytes(logs),
    obs: getSizeInBytes(observations)
  };

  const handlePurgeArchivedTasks = () => {
    const targetTasks = tasks.filter(t => t.status === Status.DONE || t.status === Status.ARCHIVED);
    if (targetTasks.length === 0) {
        alert("No completed or archived tasks found to purge.");
        return;
    }

    if (confirm(`Permanently delete ${targetTasks.length} Completed and Archived tasks and all their linked logs? Active tasks will not be affected.`)) {
        const activeTasks = tasks.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED);
        const activeTaskIds = new Set(activeTasks.map(t => t.id));
        const activeLogs = logs.filter(l => activeTaskIds.has(l.taskId));
        onPurgeData(activeTasks, activeLogs, observations);
        alert("Task archive cleared.");
    }
  };

  const handlePurgeResolvedObservations = () => {
    const targetObs = observations.filter(o => o.status === ObservationStatus.RESOLVED);
    if (targetObs.length === 0) {
        alert("No resolved observations found to purge.");
        return;
    }

    if (confirm(`Permanently delete ${targetObs.length} Resolved observations? Active feedback and notes will be kept.`)) {
        const remainingObs = observations.filter(o => o.status !== ObservationStatus.RESOLVED);
        onPurgeData(tasks, logs, remainingObs);
        alert("Resolved observations purged.");
    }
  };

  const handlePurgeOldHistory = () => {
    const retentionDays = appConfig.retentionPeriodDays || 60;
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - retentionDays);
    const thresholdTime = threshold.getTime();

    const oldLogs = logs.filter(l => new Date(l.date).getTime() < thresholdTime);
    let updateCount = 0;
    tasks.forEach(t => {
        t.updates.forEach(u => {
            if (new Date(u.timestamp).getTime() < thresholdTime) updateCount++;
        });
    });

    if (oldLogs.length === 0 && updateCount === 0) {
        alert(`No history records older than ${retentionDays} days found.`);
        return;
    }

    if (confirm(`This will permanently remove ${oldLogs.length} logs and ${updateCount} task updates older than ${retentionDays} days (before ${threshold.toLocaleDateString()}). Current task statuses and task definitions will be preserved. Proceed?`)) {
        const filteredLogs = logs.filter(l => new Date(l.date).getTime() >= thresholdTime);
        const filteredTasks = tasks.map(t => ({
            ...t,
            updates: t.updates.filter(u => new Date(u.timestamp).getTime() >= thresholdTime)
        }));
        onPurgeData(filteredTasks, filteredLogs, observations);
        alert("Historical records trimmed.");
    }
  };

  const handleDownloadBackup = async () => {
    const data = { tasks, logs, observations, offDays, appConfig };
    await saveManualBackup(data);
  };

  const handleUpdateAIConfig = (field: string, value: any) => {
    onUpdateConfig({
      ...appConfig,
      aiReportConfig: {
        ...(appConfig.aiReportConfig || {}),
        [field]: value
      }
    });
  };

  const handleSaveGeminiKey = () => {
    localStorage.setItem('protrack_gemini_key', geminiKey.trim());
    alert('AI API Key saved successfully.');
  };

  const handleRetentionChange = (days: number) => {
    onUpdateConfig({ ...appConfig, retentionPeriodDays: days });
    setCustomRetentionDays(days.toString());
    if (standardRetentions.includes(days)) {
        setForceCustomMode(false);
    }
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
          <div className="p-6 border-b dark:border-slate-700 bg-purple-50 dark:bg-purple-900/20 flex items-center gap-3">
              <Sparkles className="text-purple-600 dark:text-purple-400" />
              <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">AI Settings</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Configure your Gemini API key and reporting preferences.</p>
              </div>
          </div>
          <div className="p-6 space-y-8">
              {/* API Key Sub-section */}
              <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      <Key size={12} /> Gemini API Credentials
                  </div>
                  <div className="flex gap-2">
                      <div className="relative flex-1">
                          <input 
                              type={showKey ? "text" : "password"} 
                              value={geminiKey} 
                              onChange={e => setGeminiKey(e.target.value)} 
                              placeholder="Enter Gemini API Key..." 
                              className="w-full pl-4 pr-10 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 dark:text-white" 
                          />
                          <button 
                              type="button" 
                              onClick={() => setShowKey(!showKey)} 
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                              {showKey ? <EyeOff size={16}/> : <Eye size={16}/>}
                          </button>
                      </div>
                      <button 
                          onClick={handleSaveGeminiKey} 
                          className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold shadow-md transition-all whitespace-nowrap"
                      >
                          Save Key
                      </button>
                  </div>
                  <p className="text-[10px] text-slate-400 italic">Key is stored locally in your browser and used for summarization and chat features.</p>
              </div>

              <div className="h-[1px] bg-slate-100 dark:bg-slate-700" />

              {/* Personalization Sub-section */}
              <div className="grid md:grid-cols-[1fr_2fr] gap-6">
                  <div className="space-y-4">
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                              <Clock size={12} /> Summary Period
                          </label>
                          <select 
                            value={appConfig.aiReportConfig?.periodType || 'current_week'}
                            onChange={(e) => handleUpdateAIConfig('periodType', e.target.value)}
                            className="w-full p-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 dark:text-white"
                          >
                              <option value="current_week">Current Week (Mon-Today)</option>
                              <option value="7_days">Last 7 Days</option>
                              <option value="14_days">Last 14 Days</option>
                              <option value="30_days">Last 30 Days</option>
                          </select>
                      </div>
                  </div>
                  <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">
                          Custom Instructions (Format, Tone, Priorities)
                      </label>
                      <textarea 
                        value={appConfig.aiReportConfig?.customInstructions || ''}
                        onChange={(e) => handleUpdateAIConfig('customInstructions', e.target.value)}
                        placeholder="e.g., Use a professional but bulleted format. Focus on blockers and finished tasks. Ignore Priority: Low items..."
                        className="w-full h-40 p-4 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 dark:text-white resize-none custom-scrollbar"
                      />
                      <div className="flex justify-between mt-1">
                          <p className="text-[10px] text-slate-400 italic">Leave empty for standard professional template.</p>
                          <button 
                            onClick={() => handleUpdateAIConfig('customInstructions', '')}
                            className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
                          >
                              Reset to Default
                          </button>
                      </div>
                  </div>
              </div>
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
          <div className="p-6 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
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
              <TagEditor
                title="Update Tags"
                tags={appConfig.updateHighlightOptions || []}
                onUpdate={tags => onUpdateConfig({...appConfig, updateHighlightOptions: tags})}
              />
          </div>
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-6 border-b dark:border-slate-700 bg-rose-50 dark:bg-rose-900/20 flex justify-between items-center">
              <div className="flex items-center gap-3">
                  <HardDrive className="text-rose-600 dark:text-rose-400" />
                  <div>
                      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Data Hygiene & Purge</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Optimize storage by removing inactive or old records.</p>
                  </div>
              </div>
          </div>
          <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                  <ResourceBar label="Tasks" current={storageStats.tasks} limit={RESOURCE_LIMIT_BYTES} />
                  <ResourceBar label="Logs" current={storageStats.logs} limit={RESOURCE_LIMIT_BYTES} />
                  <ResourceBar label="Observations" current={storageStats.obs} limit={RESOURCE_LIMIT_BYTES} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl flex flex-col h-full">
                      <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-xs uppercase tracking-wider mb-2">
                        <CheckCircle2 size={14} /> Task Archive
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-4 flex-1">Delete all tasks marked as Done or Archived, including their linked history logs.</p>
                      <button 
                        onClick={handlePurgeArchivedTasks}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all"
                      >
                         <Trash2 size={14} /> Purge Archived Tasks
                      </button>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl flex flex-col h-full">
                      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider mb-2">
                        <FolderOpen size={14} /> Resolved Feedback
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-4 flex-1">Permanently remove observation cards that have been marked as Resolved.</p>
                      <button 
                        onClick={handlePurgeResolvedObservations}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all"
                      >
                         <Trash2 size={14} /> Purge Resolved Obs
                      </button>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl flex flex-col h-full">
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wider mb-2">
                        <History size={14} /> Historical Noise
                      </div>
                      
                      <div className="mb-4">
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Retention Window</label>
                          <select 
                            value={isCustomMode ? -1 : currentRetention}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (val === -1) {
                                    setForceCustomMode(true);
                                    setCustomRetentionDays(currentRetention.toString());
                                } else {
                                    handleRetentionChange(val);
                                }
                            }}
                            className="w-full p-2 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded outline-none focus:ring-1 focus:ring-amber-500 dark:text-white"
                          >
                              <option value={30}>1 Month (30 days)</option>
                              <option value={60}>2 Months (60 days)</option>
                              <option value={90}>3 Months (90 days)</option>
                              <option value={180}>6 Months (180 days)</option>
                              <option value={365}>1 Year (365 days)</option>
                              <option value={-1}>Custom...</option>
                          </select>
                          {isCustomMode ? (
                              <div className="mt-2 flex items-center gap-2">
                                  <input 
                                    type="number"
                                    min="1"
                                    value={customRetentionDays === '-1' ? '' : customRetentionDays}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setCustomRetentionDays(val);
                                        const num = parseInt(val);
                                        if (!isNaN(num) && num > 0) onUpdateConfig({ ...appConfig, retentionPeriodDays: num });
                                    }}
                                    placeholder="Enter days..."
                                    className="w-full p-2 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded outline-none dark:text-white"
                                  />
                                  <span className="text-[10px] text-slate-400 font-bold">DAYS</span>
                              </div>
                          ) : null}
                      </div>

                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-4 flex-1">
                        Removes updates and logs older than {appConfig.retentionPeriodDays} days to declutter the timeline view.
                      </p>
                      <button 
                        onClick={handlePurgeOldHistory}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all"
                      >
                         <Clock size={14} /> Trim Old History
                      </button>
                  </div>
              </div>
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