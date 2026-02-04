
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
                        {/* Item Color Picker */}
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

const TagEditor = ({
    tags = [],
    onUpdate
}: {
    tags: HighlightOption[],
    onUpdate: (tags: HighlightOption[]) => void
}) => {
    const [newLabel, setNewLabel] = useState('');
    const [newColor, setNewColor] = useState('#6366f1');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editLabel, setEditLabel] = useState('');

    const handleAdd = () => {
        if (newLabel.trim()) {
            const id = newLabel.toLowerCase().replace(/\s+/g, '-') + '-' + Math.random().toString(36).substr(2, 5);
            onUpdate([...tags, { id, label: newLabel.trim(), color: newColor }]);
            setNewLabel('');
            setNewColor('#6366f1'); // reset to default indigo
        }
    };

    const handleUpdateTag = (id: string, updates: Partial<HighlightOption>) => {
        onUpdate(tags.map(t => t.id === id ? { ...t, ...updates } : t));
        if (editingId === id && updates.label) setEditingId(null);
    };

    const handleDelete = (id: string) => {
        if (confirm("Delete this tag?")) {
            onUpdate(tags.filter(t => t.id !== id));
        }
    };

    return (
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 h-full">
            <div className="mb-3 flex items-center justify-between">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 text-[10px] uppercase tracking-widest flex items-center gap-2">
                    Update Tags
                </h4>
            </div>
            <div className="flex flex-wrap gap-2 mb-4 min-h-[40px]">
                {tags.map((tag) => (
                    <div key={tag.id} className="flex items-center gap-1.5 bg-white dark:bg-slate-700 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 text-[10px] font-bold text-slate-600 dark:text-slate-300 shadow-sm group">
                        <div className="relative w-3 h-3 shrink-0 rounded-full border border-slate-200 dark:border-slate-500 overflow-hidden cursor-pointer hover:scale-110 transition-transform">
                            <input 
                                type="color" 
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] p-0 border-0 opacity-0 cursor-pointer"
                                value={tag.color}
                                onChange={(e) => handleUpdateTag(tag.id, { color: e.target.value })}
                                title="Change Color"
                            />
                            <div 
                                className="w-full h-full pointer-events-none"
                                style={{ backgroundColor: tag.color }}
                            />
                        </div>

                        {editingId === tag.id ? (
                            <input 
                                autoFocus
                                className="bg-transparent border-none outline-none w-20 text-indigo-600 dark:text-indigo-400"
                                value={editLabel}
                                onChange={e => setEditLabel(e.target.value)}
                                onBlur={() => handleUpdateTag(tag.id, { label: editLabel })}
                                onKeyDown={e => e.key === 'Enter' && handleUpdateTag(tag.id, { label: editLabel })}
                            />
                        ) : (
                            <>
                                <span onDoubleClick={() => { setEditingId(tag.id); setEditLabel(tag.label); }}>{tag.label}</span>
                                <button onClick={() => { setEditingId(tag.id); setEditLabel(tag.label); }} className="text-slate-300 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Edit2 size={10} />
                                </button>
                                <button onClick={() => handleDelete(tag.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <X size={10} />
                                </button>
                            </>
                        )}
                    </div>
                ))}
            </div>
            <div className="flex gap-2 items-center">
                <div className="relative w-8 h-8 shrink-0 rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden cursor-pointer bg-white dark:bg-slate-700">
                    <input 
                        type="color" 
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] p-0 border-0 opacity-0 cursor-pointer"
                        value={newColor}
                        onChange={(e) => setNewColor(e.target.value)}
                        title="New Tag Color"
                    />
                    <div className="w-full h-full pointer-events-none" style={{ backgroundColor: newColor }} />
                </div>
                <input 
                    type="text" 
                    value={newLabel} 
                    onChange={(e) => setNewLabel(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()} 
                    placeholder="New tag label..." 
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
  const [geminiKey, setGeminiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [configJson, setConfigJson] = useState('');
  const [lastManualBackup, setLastManualBackup] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('protrack_gemini_key');
    if (savedKey) setGeminiKey(savedKey);
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target?.result as string);
            if (data.tasks && data.logs) {
                onImportData(data);
                alert('Data imported successfully!');
            } else {
                alert('Invalid backup file format.');
            }
        } catch (err) {
            alert('Failed to parse backup file.');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadBackup = async () => {
    const data = { tasks, logs, observations, offDays, appConfig };
    const fileName = await saveManualBackup(data);
    if (fileName) {
        setLastManualBackup(fileName);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">System Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Manage classifications, AI keys, and cloud synchronization.</p>
      </div>

      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-6 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <Palette className="text-indigo-600 dark:text-indigo-400" />
                  <div>
                      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Appearance</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Customize the look and feel.</p>
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
                      <span className="text-xs font-bold">{isDarkMode ? 'Dark Mode' : 'Light Mode'}</span>
                  </button>
              )}
          </div>
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-6 border-b dark:border-slate-700 bg-indigo-50 dark:bg-indigo-900/20 flex items-center gap-3">
              <List className="text-indigo-600 dark:text-indigo-400" />
              <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Classifications & Lists</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Double-click headers to rename. Use the color dot to customize themes.</p>
              </div>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
                <ListEditor 
                    title={appConfig.groupLabels?.statuses || "Task Statuses"} 
                    color={appConfig.groupColors?.statuses}
                    items={appConfig.taskStatuses} 
                    onUpdate={items => onUpdateConfig({...appConfig, taskStatuses: items})} 
                    onRenameTitle={newTitle => onUpdateConfig({...appConfig, groupLabels: { ...appConfig.groupLabels!, statuses: newTitle }})}
                    onUpdateColor={newColor => onUpdateConfig({...appConfig, groupColors: { ...appConfig.groupColors!, statuses: newColor }})}
                    placeholder="Add status..."
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
                    placeholder="Add priority..."
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
                    placeholder="Add group..."
                    itemColors={appConfig.itemColors}
                    onItemColorChange={(item, color) => onUpdateConfig({...appConfig, itemColors: { ...(appConfig.itemColors || {}), [item]: color }})}
                />
            </div>
            {/* Tag Editor Section */}
            <div className="border-t border-slate-100 dark:border-slate-700 pt-6">
                <TagEditor 
                    tags={appConfig.updateHighlightOptions || []}
                    onUpdate={(tags) => onUpdateConfig({ ...appConfig, updateHighlightOptions: tags })}
                />
            </div>
          </div>
      </section>

      {backupSettings && setBackupSettings && (
        <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-6 border-b dark:border-slate-700 bg-blue-50 dark:bg-blue-900/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Folder className="text-blue-600 dark:text-blue-400" />
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Automatic Local Backups</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Save detailed JSON backups to a local folder automatically.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {backupStatus === 'running' && (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
                            ACTIVE
                        </span>
                    )}
                    {backupStatus === 'permission_needed' && (
                        <button 
                            onClick={onVerifyBackupPermission}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors animate-pulse"
                        >
                            <AlertTriangle size={10} />
                            PERMISSION REQUIRED
                        </button>
                    )}
                    {backupStatus === 'error' && (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800">
                            ERROR
                        </span>
                    )}
                    {(backupStatus === 'idle' && !backupSettings.enabled) && (
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold border bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-600">
                            INACTIVE
                        </span>
                    )}
                </div>
            </div>
            <div className="p-6 flex flex-col gap-6">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex-1">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Backup Destination</span>
                        {backupSettings.folderName ? (
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                                <FolderOpen size={16} className="text-blue-500 dark:text-blue-400"/>
                                {backupSettings.folderName}
                            </div>
                        ) : (
                            <span className="text-sm text-slate-400 dark:text-slate-500 italic">No folder selected</span>
                        )}
                    </div>
                    <button 
                        onClick={onSetupBackupFolder}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all shadow-sm whitespace-nowrap"
                    >
                        {backupSettings.folderName ? 'Change Folder' : 'Select Backup Folder'}
                    </button>
                </div>

                <div className="flex items-center gap-4 border-t border-slate-100 dark:border-slate-700 pt-4">
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Frequency</label>
                        <select 
                            value={backupSettings.intervalMinutes}
                            onChange={(e) => setBackupSettings && setBackupSettings(prev => ({ ...prev, intervalMinutes: parseInt(e.target.value) }))}
                            className="w-full md:w-48 p-2 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:border-blue-500 dark:text-white"
                        >
                            <option value={5}>Every 5 minutes</option>
                            <option value={10}>Every 10 minutes (Recommended)</option>
                            <option value={30}>Every 30 minutes</option>
                            <option value={60}>Every hour</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right mr-4 hidden md:block">
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Last Backup</span>
                            <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                                {backupSettings.lastBackup 
                                    ? new Date(backupSettings.lastBackup).toLocaleString([], { 
                                        year: 'numeric', 
                                        month: 'numeric', 
                                        day: 'numeric', 
                                        hour: 'numeric', 
                                        minute: '2-digit', 
                                        hour12: true 
                                      }) 
                                    : 'Never'
                                }
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Enable Auto-Backup</span>
                            <button 
                                onClick={() => setBackupSettings && setBackupSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                                disabled={!backupSettings.folderName}
                                className={`w-12 h-6 rounded-full transition-all relative ${backupSettings.enabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'} ${!backupSettings.folderName ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${backupSettings.enabled ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
      )}

      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-6 border-b dark:border-slate-700 bg-rose-50 dark:bg-rose-900/20 flex justify-between items-center">
              <div className="flex items-center gap-3">
                  <HardDrive className="text-rose-600 dark:text-rose-400" />
                  <div>
                      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Resource Health</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Monitoring 1MB sync bucket limits.</p>
                  </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-rose-600 dark:text-rose-400 block">{formatBytes(storageStats.total)}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Used of ~5MB Local</span>
              </div>
          </div>
          <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <ResourceBar label="Tasks Buffer" current={storageStats.tasks} limit={RESOURCE_LIMIT_BYTES} />
                  <ResourceBar label="Logs Buffer" current={storageStats.logs} limit={RESOURCE_LIMIT_BYTES} />
                  <ResourceBar label="Observations Buffer" current={storageStats.obs} limit={RESOURCE_LIMIT_BYTES} />
              </div>
              <div className="bg-rose-50/50 dark:bg-rose-900/10 p-4 rounded-xl border border-rose-100 dark:border-rose-900/30 flex items-center justify-between">
                  <div className="flex items-start gap-3">
                      <AlertTriangle className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" size={18} />
                      <div>
                          <p className="text-xs font-bold text-rose-900 dark:text-rose-300">Purge Inactive Data</p>
                          <p className="text-[10px] text-rose-700 dark:text-rose-400">Clears "Done" and "Archived" items to free up resources.</p>
                      </div>
                  </div>
                  <button onClick={handlePurge} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-rose-100 flex items-center gap-2">
                      <Trash2 size={14} /> Purge Inactive
                  </button>
              </div>
          </div>
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-6 border-b dark:border-slate-700 bg-purple-50 dark:bg-purple-900/20 flex items-center gap-3">
              <Key size={24} className="text-purple-600 dark:text-purple-400" />
              <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">AI Report Config</h2>
              </div>
          </div>
          <div className="p-6 space-y-6">
              <div className="flex gap-2">
                  <div className="relative flex-1">
                      <input type={showKey ? "text" : "password"} value={geminiKey} onChange={e => setGeminiKey(e.target.value)} placeholder="Gemini API Key..." className="w-full pl-4 pr-10 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 bg-white dark:bg-slate-700 dark:text-white" />
                      <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showKey ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
                  </div>
                  <button onClick={() => { localStorage.setItem('protrack_gemini_key', geminiKey); alert('Saved!'); }} className="px-6 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold shadow-md">Save</button>
              </div>
          </div>
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-6 border-b dark:border-slate-700 bg-emerald-50 dark:bg-emerald-900/20 flex justify-between items-center">
              <div className="flex items-center gap-3">
                  <Cloud className="text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Cloud Sync</h2>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${isSyncEnabled ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-600'}`}>
                  {isSyncEnabled ? 'CONNECTED' : 'OFFLINE'}
              </span>
          </div>
          <div className="p-6">
              <textarea value={configJson} onChange={e => setConfigJson(e.target.value)} placeholder='Paste Firebase Config JSON here...' className="w-full h-40 p-4 font-mono text-[10px] bg-slate-900 text-emerald-400 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
              <div className="mt-4 flex gap-3">
                  <button onClick={() => { try { const c = JSON.parse(configJson); initFirebase(c); localStorage.setItem('protrack_firebase_config', JSON.stringify(c)); onSyncConfigUpdate(c); alert('Connected!'); } catch (e: any) { alert(e.message); } }} className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-bold text-sm shadow-lg">Connect Sync</button>
                  <button onClick={() => { localStorage.removeItem('protrack_firebase_config'); onSyncConfigUpdate(null); setConfigJson(''); }} className="px-6 py-3 border border-slate-200 dark:border-slate-600 text-slate-400 font-bold text-sm rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Disconnect</button>
              </div>
          </div>
      </section>

      <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <button onClick={handleDownloadBackup} className="flex items-center justify-center gap-3 p-6 bg-slate-900 text-white rounded-2xl border border-slate-800 hover:bg-black transition-all group shadow-xl">
                <Download className="text-indigo-400 group-hover:text-white" />
                <span className="text-sm font-bold uppercase tracking-widest">Download Full System Backup (JSON)</span>
            </button>
            {lastManualBackup && (
                <div className="text-center text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5 animate-fade-in">
                    <CheckCircle2 size={10} className="text-emerald-500" />
                    Last manual backup saved as: <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">{lastManualBackup}</span>
                </div>
            )}
          </div>
          
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
             <div className="flex items-center justify-center gap-3 p-6 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all shadow-sm">
                <FolderOpen className="text-slate-400 group-hover:text-indigo-500" />
                <span className="text-sm font-bold uppercase tracking-widest">Restore Backup</span>
             </div>
             <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept=".json" 
                onChange={handleFileUpload}
             />
          </div>
      </div>
    </div>
  );
};

export default Settings;
