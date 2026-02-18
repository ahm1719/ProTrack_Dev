import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  ListTodo, 
  MessageSquare, 
  Settings as SettingsIcon, 
  Plus, 
  Search, 
  Menu, 
  X, 
  AlertTriangle, 
  Sparkles, 
  HelpCircle,
  LogOut,
  Target,
  Layers,
  Calendar,
  Briefcase,
  Maximize2,
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import { 
  Task, 
  DailyLog, 
  Observation, 
  AppConfig, 
  Priority, 
  Status, 
  ObservationStatus, 
  ViewMode, 
  TaskAttachment,
  BackupSettings,
  TaskUpdate
} from './types';

import TaskCard from './components/TaskCard';
import DailyJournal from './components/DailyJournal';
import ObservationsLog from './components/ObservationsLog';
import Settings from './components/Settings';
import AIChat from './components/AIChat';
import UserManual from './components/UserManual';
import TaskDetailModal from './components/TaskDetailModal';
import DayFocusModal from './components/DayFocusModal'; 
import { FullLogo } from './components/Branding';

import { subscribeToCollections, syncData, initFirebase } from './services/firebaseService';
import { generateWeeklySummary } from './services/geminiService';
import { performBackup, selectBackupFolder } from './services/backupService';

const BUILD_VERSION = "V4.8.4";

const DEFAULT_CONFIG: AppConfig = {
  taskStatuses: Object.values(Status),
  taskPriorities: Object.values(Priority),
  observationStatuses: Object.values(ObservationStatus),
  groupLabels: {
    statuses: "Task Statuses",
    priorities: "Priorities",
    observations: "Observation Groups"
  },
  groupColors: {
    statuses: "#6366f1",
    priorities: "#f59e0b",
    observations: "#8b5cf6"
  },
  itemColors: {},
  updateHighlightOptions: [
    { id: 'blocker', label: 'Blocker', color: '#fca5a5' },
    { id: 'milestone', label: 'Milestone', color: '#fcd34d' },
    { id: 'idea', label: 'Idea', color: '#bef264' }
  ],
  retentionPeriodDays: 60
};

const getWeekNumber = (d: Date): number => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const App: React.FC = () => {
  // State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [offDays, setOffDays] = useState<string[]>([]);
  const [appConfig, setAppConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  
  const [view, setView] = useState<ViewMode>(ViewMode.DASHBOARD);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncEnabled, setIsSyncEnabled] = useState(false);
  
  const [activeTaskTab, setActiveTaskTab] = useState<'active' | 'upcoming' | 'archive'>('active');
  
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Modals & UI State
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [highlightedUpdateContent, setHighlightedUpdateContent] = useState<string | null>(null);
  
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  
  // Focus View
  const [focusModeDate, setFocusModeDate] = useState<string | null>(null);
  
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);

  const [generatedReport, setGeneratedReport] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('protrack_theme');
      // Default to true (Dark Mode) if not set, restoring baseline
      return saved ? saved === 'dark' : true;
    }
    return true;
  });

  // Backup State
  const [backupSettings, setBackupSettings] = useState<BackupSettings>({
    enabled: false,
    intervalMinutes: 10,
    lastBackup: null,
    folderName: null
  });
  const [backupStatus, setBackupStatus] = useState<'idle' | 'running' | 'error' | 'permission_needed'>('idle');
  const [backupHandle, setBackupHandle] = useState<any>(null);

  // New Task Form
  const [newTaskForm, setNewTaskForm] = useState({
    source: `CW${getWeekNumber(new Date())}`,
    projectId: '',
    displayId: '',
    title: '',
    description: '',
    dueDate: new Date().toISOString().split('T')[0],
    status: Status.NOT_STARTED as string,
    priority: Priority.MEDIUM as string
  });

  // Effects
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    const savedConfig = localStorage.getItem('protrack_firebase_config');
    const localAppConfig = localStorage.getItem('protrack_app_config');
    const savedBackup = localStorage.getItem('protrack_backup_settings');
    
    if (localAppConfig) {
      try {
        const parsed = JSON.parse(localAppConfig);
        setAppConfig({ ...DEFAULT_CONFIG, ...parsed });
      } catch (e) { console.error("Config parse error", e); }
    }

    if (savedBackup) {
      try { setBackupSettings(JSON.parse(savedBackup)); } 
      catch (e) { console.error("Backup settings parse error", e); }
    }

    const localData = localStorage.getItem('protrack_data');
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        setTasks(parsed.tasks || []);
        setLogs(parsed.logs || []);
        setObservations(parsed.observations || []);
        setOffDays(parsed.offDays || []);
      } catch (e) { console.error("Data parse error", e); }
    }

    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        if (initFirebase(config)) setIsSyncEnabled(true);
      } catch (e) { console.error("Firebase init failed", e); }
    }
    return () => clearInterval(timer);
  }, []);

  // Theme Effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('protrack_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Sync Subscription
  useEffect(() => {
    if (isSyncEnabled) {
      const unsubscribe = subscribeToCollections({
        onTasks: (cloudTasks) => setTasks(cloudTasks),
        onLogs: (cloudLogs) => setLogs(cloudLogs),
        onObservations: (cloudObs) => setObservations(cloudObs),
        onOffDays: (cloudOff) => setOffDays(cloudOff),
        onConfig: (cloudConf) => setAppConfig(cloudConf)
      });
      return () => { if (unsubscribe) unsubscribe(); };
    }
  }, [isSyncEnabled]);

  // Backup Effect
  useEffect(() => {
    let intervalId: any;
    if (backupSettings.enabled && backupSettings.folderName && backupHandle) {
       intervalId = setInterval(async () => {
           setBackupStatus('running');
           const success = await performBackup(backupHandle, { tasks, logs, observations, offDays, appConfig });
           if (success) {
               const now = new Date().toISOString();
               setBackupSettings(prev => ({ ...prev, lastBackup: now }));
               localStorage.setItem('protrack_backup_settings', JSON.stringify({ ...backupSettings, lastBackup: now }));
               setBackupStatus('idle');
           } else {
               setBackupStatus('permission_needed');
           }
       }, backupSettings.intervalMinutes * 60 * 1000);
    }
    return () => clearInterval(intervalId);
  }, [backupSettings, backupHandle, tasks, logs, observations, offDays, appConfig]);

  const persistData = (newTasks: Task[], newLogs: DailyLog[], newObs: Observation[], newOffDays: string[]) => {
    setTasks(newTasks);
    setLogs(newLogs);
    setObservations(newObs);
    setOffDays(newOffDays);
    localStorage.setItem('protrack_data', JSON.stringify({ tasks: newTasks, logs: newLogs, observations: newObs, offDays: newOffDays }));
    
    if (isSyncEnabled) {
        // We use full sync for simplicity here, but ideally we'd use granular syncData calls in each handler
        syncData([{ type: 'full', action: 'overwrite', data: { tasks: newTasks, logs: newLogs, observations: newObs, offDays: newOffDays, appConfig } }]);
    }
  };

  const handleSetupBackup = async () => {
      const handle = await selectBackupFolder();
      if (handle) {
          setBackupHandle(handle);
          setBackupSettings(prev => ({ ...prev, folderName: handle.name, enabled: true }));
          localStorage.setItem('protrack_backup_settings', JSON.stringify({ ...backupSettings, folderName: handle.name, enabled: true }));
      }
  };

  const activeProjects = useMemo(() => {
    const projects = tasks
      .filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED)
      .map(t => t.projectId);
    return Array.from(new Set(projects)).filter(Boolean);
  }, [tasks]);

  const suggestNextId = (projectId: string) => {
    const projectTasks = tasks.filter(t => t.projectId === projectId);
    let maxSeq = 0;
    projectTasks.forEach(t => {
      const parts = t.displayId.split('-');
      const seqStr = parts[parts.length - 1];
      const seq = parseInt(seqStr);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    });
    return projectId ? `${projectId}-${(maxSeq + 1).toString().padStart(2, '0')}` : '';
  };

  const handleCreateTask = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    setModalError(null);

    const isDuplicate = tasks.some(t => t.displayId.toLowerCase() === newTaskForm.displayId.toLowerCase());
    if (isDuplicate) {
      setModalError(`Duplicate Display ID: "${newTaskForm.displayId}" already exists.`);
      return;
    }

    const newTask: Task = {
      ...newTaskForm,
      id: uuidv4(),
      updates: [],
      createdAt: new Date().toISOString()
    };
    persistData([...tasks, newTask], logs, observations, offDays);
    setHighlightedTaskId(newTask.id);
    setShowNewTaskModal(false);
    setNewTaskForm({
      source: `CW${getWeekNumber(new Date())}`,
      projectId: '',
      displayId: '',
      title: '',
      description: '',
      dueDate: new Date().toISOString().split('T')[0],
      status: appConfig.taskStatuses[0] || Status.NOT_STARTED,
      priority: appConfig.taskPriorities[1] || Priority.MEDIUM
    });
    setView(ViewMode.TASKS);
  };

  const updateTaskStatus = (id: string, status: string) => {
    const updated = tasks.map(t => t.id === id ? { ...t, status } : t);
    persistData(updated, logs, observations, offDays);
  };

  const updateTaskFields = (id: string, fields: Partial<Task>) => {
    if (fields.displayId) {
       const isDuplicate = tasks.some(t => t.id !== id && t.displayId.toLowerCase() === fields.displayId?.toLowerCase());
       if (isDuplicate) {
          alert(`Error: Display ID "${fields.displayId}" is already taken.`);
          return;
       }
    }
    const updated = tasks.map(t => t.id === id ? { ...t, ...fields } : t);
    persistData(updated, logs, observations, offDays);
  };

  const addUpdateToTask = (id: string, content: string, attachments?: TaskAttachment[], highlightColor?: string) => {
    const timestamp = new Date().toISOString();
    const updateId = uuidv4();
    const updated = tasks.map(t => t.id === id ? { ...t, updates: [...t.updates, { id: updateId, timestamp, content, attachments, highlightColor }] } : t);
    const newLog: DailyLog = { id: uuidv4(), date: new Date().toLocaleDateString('en-CA'), taskId: id, content };
    persistData(updated, [...logs, newLog], observations, offDays);
  };

  const handleEditUpdate = (taskId: string, updateId: string, content: string, timestamp?: string, highlightColor?: string | null) => {
    const newTasks = tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          updates: t.updates.map(u => u.id === updateId ? { ...u, content, timestamp: timestamp || u.timestamp, highlightColor: highlightColor === null ? undefined : (highlightColor || u.highlightColor) } : u)
        };
      }
      return t;
    });

    // Also update linked log if exists
    const newLogs = logs.map(l => {
        if (l.taskId === taskId) {
             // Logic to find corresponding log is fuzzy without direct link ID, assuming content match or simple sync
             const originalTask = tasks.find(t => t.id === taskId);
             const originalUpdate = originalTask?.updates.find(u => u.id === updateId);
             if (originalUpdate && l.content === originalUpdate.content) {
                 return { ...l, content, date: timestamp ? timestamp.split('T')[0] : l.date };
             }
        }
        return l;
    });

    persistData(newTasks, newLogs, observations, offDays);
  };

  const handleDeleteUpdate = (taskId: string, updateId: string) => {
    if (!confirm('Delete this history record?')) return;
    
    const task = tasks.find(t => t.id === taskId);
    const update = task?.updates.find(u => u.id === updateId);
    
    const newTasks = tasks.map(t => {
      if (t.id === taskId) {
        return { ...t, updates: t.updates.filter(u => u.id !== updateId) };
      }
      return t;
    });

    const newLogs = logs.filter(l => !(l.taskId === taskId && l.content === update?.content));
    persistData(newTasks, newLogs, observations, offDays);
  };

  const deleteTask = (id: string) => {
    persistData(tasks.filter(t => t.id !== id), logs, observations, offDays);
    if (selectedTask?.id === id) setSelectedTask(null);
  };

  const handleEditLog = (logId: string, taskId: string, content: string, date: string) => {
    const newLogs = logs.map(l => l.id === logId ? { ...l, taskId, content, date } : l);
    persistData(tasks, newLogs, observations, offDays);
  };

  const handleDeleteLog = (logId: string) => {
    if (confirm('Delete this journal entry?')) {
      const newLogs = logs.filter(l => l.id !== logId);
      persistData(tasks, newLogs, observations, offDays);
    }
  };

  const handleUpdateAppConfig = (newConfig: AppConfig) => {
    setAppConfig(newConfig);
    localStorage.setItem('protrack_app_config', JSON.stringify(newConfig));
    if (isSyncEnabled) syncData([{ type: 'config', action: 'update', data: newConfig }]);
  };

  const todayStr = new Date().toLocaleDateString('en-CA');
  
  const statusSummary = useMemo(() => {
    return appConfig.taskStatuses.map(s => ({
      label: s,
      count: tasks.filter(t => t.status === s).length
    }));
  }, [tasks, appConfig.taskStatuses]);

  const overdueTasks = useMemo(() => tasks.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED && t.dueDate && t.dueDate < todayStr), [tasks, todayStr]);

  const filteredTasks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const base = tasks.filter(t => 
        t.description.toLowerCase().includes(q) || 
        t.displayId.toLowerCase().includes(q) || 
        (t.title && t.title.toLowerCase().includes(q))
    );
    
    if (activeTaskTab === 'active') {
        // Show active tasks not done/archived, OR completed tasks updated today
        return base.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED);
    }
    if (activeTaskTab === 'upcoming') {
        // Just an example filter, can be customized
        return base.filter(t => t.dueDate && t.dueDate > todayStr && t.status !== Status.DONE && t.status !== Status.ARCHIVED);
    }
    if (activeTaskTab === 'archive') {
        return base.filter(t => t.status === Status.DONE || t.status === Status.ARCHIVED);
    }
    return base;
  }, [tasks, searchQuery, activeTaskTab, todayStr]);

  // Weekly Timeline Logic
  const weekDays = useMemo(() => {
    const days = [];
    // Start from today for the next 7 days
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push(d.toLocaleDateString('en-CA'));
    }
    return days;
  }, [todayStr]);

  const weekTasks = useMemo(() => {
    const map: Record<string, Task[]> = {};
    weekDays.forEach(d => {
      map[d] = tasks.filter(t => t.dueDate === d && t.status !== Status.DONE && t.status !== Status.ARCHIVED);
    });
    return map;
  }, [tasks, weekDays]);

  const getStatusColorMini = (s: string) => {
    switch (s) {
      case Status.DONE:
        return 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300';
      case Status.IN_PROGRESS:
        return 'bg-amber-500 text-slate-900 font-bold';
      case Status.WAITING:
        return 'bg-amber-500/20 border-amber-500/50 text-amber-300';
      case Status.NOT_STARTED:
        return 'bg-pink-500/20 border-pink-500/50 text-pink-300';
      default:
        return 'bg-slate-200 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300';
    }
  };

  const renderContent = () => {
    switch (view) {
      case ViewMode.DASHBOARD:
        return (
          <div className="space-y-6 animate-fade-in pb-10">
             <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap gap-2">
                            <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold border border-white/10 flex items-center gap-2 cursor-pointer hover:bg-white/20 transition-colors" onClick={() => setView(ViewMode.TASKS)}>
                                <Target size={12} />
                                <span>{tasks.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED).length} Active Tasks</span>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold border border-white/10 flex items-center gap-2 cursor-pointer hover:bg-white/20 transition-colors" onClick={() => setView(ViewMode.OBSERVATIONS)}>
                                <MessageSquare size={12} />
                                <span>{observations.filter(o => o.status === ObservationStatus.NEW).length} New Obs</span>
                            </div>
                        </div>
                        <div>
                             <h1 className="text-3xl font-bold flex items-baseline gap-2">
                                {currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                <span className="text-indigo-200 font-mono text-lg">CW {getWeekNumber(currentTime)}</span>
                             </h1>
                             <p className="text-indigo-100 opacity-80 text-sm">{currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                         <button onClick={() => setFocusModeDate(todayStr)} className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white px-5 py-2.5 rounded-xl transition-all text-sm font-bold shadow-lg shadow-indigo-800/20">
                            <Maximize2 size={18} /> Focus Mode
                        </button>
                        <button onClick={async () => {
                            setIsGeneratingReport(true); setShowReportModal(true);
                            try { const r = await generateWeeklySummary(tasks, logs, appConfig); setGeneratedReport(r); } 
                            catch (e: any) { setGeneratedReport(e.message); } finally { setIsGeneratingReport(false); }
                        }} className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-5 py-2.5 rounded-xl transition-all text-sm font-bold border border-white/10 shadow-lg backdrop-blur-sm">
                            <Sparkles size={18} /> AI Report
                        </button>
                    </div>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {statusSummary.map(s => (
                    <div key={s.label} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4 rounded-xl flex items-center justify-between hover:border-indigo-200 dark:hover:border-indigo-700 transition-all group">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-indigo-500 dark:group-hover:text-indigo-400 truncate max-w-[120px]">{s.label}</span>
                            <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{s.count}</span>
                        </div>
                        <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 text-slate-400 group-hover:text-indigo-500 transition-colors">
                            <Layers size={20} />
                        </div>
                    </div>
                ))}
             </div>

             {overdueTasks.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl p-6">
                    <h3 className="text-red-800 dark:text-red-400 font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                        <AlertTriangle size={18} /> Overdue Items ({overdueTasks.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {overdueTasks.map(t => (
                            <TaskCard 
                                key={t.id} 
                                task={t} 
                                onUpdateStatus={updateTaskStatus} 
                                onOpenTask={() => setSelectedTask(t)} 
                                availableStatuses={appConfig.taskStatuses}
                                statusColors={appConfig.itemColors || {}}
                            />
                        ))}
                    </div>
                </div>
             )}
          </div>
        );

      case ViewMode.TASKS:
        return (
          <div className="h-full flex flex-col space-y-6 animate-fade-in">
             <div className="flex justify-between items-center shrink-0">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Daily Workspace</h1>
                <button onClick={() => setShowNewTaskModal(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none font-bold text-sm">
                    <Plus size={18} /> New Task
                </button>
             </div>

             {/* Weekly Timeline */}
             <div className="shrink-0 space-y-2">
                <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Weekly Timeline</h3>
                <div className="flex gap-4 overflow-x-auto pb-4 snap-x custom-scrollbar">
                    {weekDays.map(d => (
                        <div key={d} className={`min-w-[280px] w-[280px] p-4 rounded-xl border flex flex-col transition-all snap-start ${d === todayStr ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-900/50 scale-105 z-10' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm'}`}>
                            <div className="flex justify-between items-start mb-4 border-b border-slate-100 dark:border-slate-700/50 pb-2">
                                <div>
                                    <span className={`block text-[10px] font-bold uppercase tracking-widest ${d === todayStr ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'}`}>{new Date(d).toLocaleDateString([], { weekday: 'long' })}</span>
                                    <span className={`text-xl font-bold ${d === todayStr ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>{new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                                </div>
                                {d === todayStr && <span className="bg-white/20 text-white text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider backdrop-blur-sm">Today</span>}
                                {d !== todayStr && <Maximize2 size={12} className="text-slate-400 dark:text-slate-600" />}
                            </div>
                            <div className="flex-1 space-y-2 min-h-[120px]">
                                {weekTasks[d]?.length ? weekTasks[d].map(t => (
                                    <div 
                                      key={t.id} 
                                      onClick={() => setSelectedTask(t)} 
                                      className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 transition-all cursor-pointer group"
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-bold">{t.displayId}</span>
                                            <div className={`w-2 h-2 rounded-full ${t.status === Status.IN_PROGRESS ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                        </div>
                                        <p className="text-xs text-slate-700 dark:text-slate-200 line-clamp-2 font-medium leading-snug">{t.description}</p>
                                        <div className="mt-2 flex justify-end">
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${getStatusColorMini(t.status)}`}>
                                                {t.status}
                                            </span>
                                        </div>
                                    </div>
                                )) : <div className="h-full flex items-center justify-center text-[10px] text-slate-400 dark:text-slate-600 italic">No tasks due</div>}
                            </div>
                        </div>
                    ))}
                </div>
             </div>

             <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-3 gap-8 pb-6">
                 {/* Left Column: Task List */}
                 <div className="xl:col-span-2 flex flex-col bg-slate-100/50 dark:bg-slate-800/20 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-inner">
                     <div className="bg-white dark:bg-slate-800 p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4 shrink-0">
                        <div className="flex bg-slate-100 dark:bg-slate-700/50 p-1 rounded-xl">
                            {['active', 'upcoming', 'archive'].map((tab) => (
                                <button 
                                    key={tab}
                                    onClick={() => setActiveTaskTab(tab as any)} 
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${activeTaskTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{filteredTasks.length} ITEMS</span>
                     </div>
                     
                     <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredTasks.map(t => (
                                <TaskCard 
                                    key={t.id} 
                                    task={t} 
                                    onUpdateStatus={updateTaskStatus} 
                                    onOpenTask={() => setSelectedTask(t)}
                                    availableStatuses={appConfig.taskStatuses}
                                    availablePriorities={appConfig.taskPriorities}
                                    statusColors={appConfig.itemColors || {}}
                                    isHighlighted={highlightedTaskId === t.id}
                                />
                            ))}
                         </div>
                         {filteredTasks.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-600 opacity-50">
                                <ListTodo size={48} className="mb-4" />
                                <p className="font-bold">No tasks match your criteria</p>
                            </div>
                         )}
                     </div>
                 </div>

                 {/* Right Column: History & Calendar */}
                 <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        <DailyJournal 
                            tasks={tasks} 
                            logs={logs} 
                            onAddLog={(l) => persistData(tasks, [...logs, { ...l, id: uuidv4() }], observations, offDays)} 
                            onUpdateTask={updateTaskFields} 
                            offDays={offDays} 
                            onToggleOffDay={(d) => persistData(tasks, logs, observations, offDays.includes(d) ? offDays.filter(x => x !== d) : [...offDays, d])}
                            onToggleOffDayRange={(dates) => persistData(tasks, logs, observations, Array.from(new Set([...offDays, ...dates])))}
                            onClearOffDays={(dates) => persistData(tasks, logs, observations, offDays.filter(d => !dates.includes(d)))}
                            onEditLog={handleEditLog}
                            onDeleteLog={handleDeleteLog}
                            searchQuery={searchQuery}
                            onHighlightTask={(id) => {
                                const task = tasks.find(t => t.id === id);
                                if (task) setSelectedTask(task);
                            }}
                            onOpenTask={(task, logContent) => {
                                setSelectedTask(task);
                                setHighlightedUpdateContent(logContent);
                            }}
                        />
                    </div>
                 </div>
             </div>
          </div>
        );
        
      case ViewMode.JOURNAL:
        return (
            <DailyJournal 
                tasks={tasks} 
                logs={logs} 
                onAddLog={(l) => persistData(tasks, [...logs, { ...l, id: uuidv4() }], observations, offDays)} 
                onUpdateTask={updateTaskFields} 
                offDays={offDays} 
                onToggleOffDay={(d) => persistData(tasks, logs, observations, offDays.includes(d) ? offDays.filter(x => x !== d) : [...offDays, d])}
                onToggleOffDayRange={(dates) => persistData(tasks, logs, observations, Array.from(new Set([...offDays, ...dates])))}
                onClearOffDays={(dates) => persistData(tasks, logs, observations, offDays.filter(d => !dates.includes(d)))}
                onEditLog={handleEditLog}
                onDeleteLog={handleDeleteLog}
                searchQuery={searchQuery}
                onHighlightTask={(id) => {
                    const task = tasks.find(t => t.id === id);
                    if (task) setSelectedTask(task);
                }}
                onOpenTask={(task, logContent) => {
                    setSelectedTask(task);
                    setHighlightedUpdateContent(logContent);
                }}
            />
        );

      case ViewMode.OBSERVATIONS:
        return <ObservationsLog observations={observations} onAddObservation={o => persistData(tasks, logs, [...observations, o], offDays)} onEditObservation={o => persistData(tasks, logs, observations.map(x => x.id === o.id ? o : x), offDays)} onDeleteObservation={id => persistData(tasks, logs, observations.filter(x => x.id !== id), offDays)} columns={appConfig.observationStatuses} itemColors={appConfig.itemColors} />;
      case ViewMode.SETTINGS:
        return (
          <Settings 
            tasks={tasks} 
            logs={logs} 
            observations={observations} 
            onImportData={(d) => persistData(d.tasks, d.logs, d.observations, d.offDays || [])} 
            onSyncConfigUpdate={c => setIsSyncEnabled(!!c)} 
            isSyncEnabled={isSyncEnabled} 
            appConfig={appConfig} 
            onUpdateConfig={handleUpdateAppConfig} 
            onPurgeData={(newTasks, newLogs, newObs) => persistData(newTasks, newLogs, newObs, offDays)} 
            backupSettings={backupSettings}
            setBackupSettings={setBackupSettings}
            onSetupBackupFolder={handleSetupBackup}
            backupStatus={backupStatus}
            onVerifyBackupPermission={() => backupHandle && performBackup(backupHandle, { tasks, logs, observations, offDays, appConfig })}
            isDarkMode={isDarkMode}
            onToggleTheme={setIsDarkMode}
          />
        );
      case ViewMode.HELP:
        return <UserManual />;
      default:
        return null;
    }
  };

  return (
    <div className={`flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-300`}>
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col z-20 shadow-xl`}>
        <div className="p-4 flex flex-col items-center gap-1 border-b dark:border-slate-800 h-24 justify-center">
           <FullLogo isSidebarOpen={isSidebarOpen} />
           {isSidebarOpen && <span className="text-[10px] font-mono text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest">{BUILD_VERSION}</span>}
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
           {[
             { mode: ViewMode.DASHBOARD, icon: LayoutDashboard, label: 'Dashboard' },
             { mode: ViewMode.TASKS, icon: ListTodo, label: 'Daily Workspace' },
             { mode: ViewMode.JOURNAL, icon: Calendar, label: 'Journal' },
             { mode: ViewMode.OBSERVATIONS, icon: MessageSquare, label: 'Observations' },
           ].map(item => (
             <button key={item.mode} onClick={() => setView(item.mode)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${view === item.mode ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'}`}>
                <item.icon size={20} />
                {isSidebarOpen && <span>{item.label}</span>}
             </button>
           ))}
           <div className="pt-4 mt-4 border-t dark:border-slate-800">
             <button onClick={() => setView(ViewMode.SETTINGS)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${view === ViewMode.SETTINGS ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'}`}>
                <SettingsIcon size={20} />
                {isSidebarOpen && <span>Settings</span>}
             </button>
             <button onClick={() => setView(ViewMode.HELP)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${view === ViewMode.HELP ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'}`}>
                <HelpCircle size={20} />
                {isSidebarOpen && <span>Guide</span>}
             </button>
           </div>
        </nav>
        <div className="p-4 border-t dark:border-slate-800">
           <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg w-full flex justify-center">
              {isSidebarOpen ? <LogOut size={20} className="rotate-180" /> : <Menu size={20} />}
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="h-16 bg-white dark:bg-slate-950 border-b dark:border-slate-800 flex items-center justify-between px-6 shrink-0 z-10 transition-colors">
           <div className="relative max-w-md w-full">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input type="text" placeholder="Search tasks, logs, projects..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-lg text-sm outline-none text-slate-700 dark:text-slate-200" />
           </div>
           <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isSyncEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{isSyncEnabled ? 'Cloud Synced' : 'Local Only'}</span>
           </div>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-slate-900 custom-scrollbar transition-colors">
           {renderContent()}
        </div>

        {/* New Task Modal */}
        {showNewTaskModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <form onSubmit={handleCreateTask} className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in border dark:border-slate-800">
                <div className="p-5 border-b dark:border-slate-800 flex justify-between items-center bg-indigo-600 text-white">
                   <h2 className="font-bold flex items-center gap-2"><Plus size={20}/> Create New Task</h2>
                   <button type="button" onClick={() => setShowNewTaskModal(false)}><X size={20}/></button>
                </div>
                <div className="p-6 space-y-4">
                   {modalError && (
                     <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl flex items-center gap-2 text-xs font-bold">
                        <AlertTriangle size={16} /> {modalError}
                     </div>
                   )}
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Source (CW)</label>
                         <div className="relative">
                            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input required value={newTaskForm.source} onChange={e => setNewTaskForm({...newTaskForm, source: e.target.value})} className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 dark:text-white" />
                         </div>
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Project ID</label>
                         <div className="relative">
                            <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input required list="active-projects" value={newTaskForm.projectId} onChange={e => {
                                const pid = e.target.value;
                                setNewTaskForm({...newTaskForm, projectId: pid, displayId: suggestNextId(pid)});
                            }} placeholder="Project Name..." className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 dark:text-white" />
                            <datalist id="active-projects">
                               {activeProjects.map(p => <option key={p} value={p} />)}
                            </datalist>
                         </div>
                      </div>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Display ID</label>
                      <input required value={newTaskForm.displayId} onChange={e => setNewTaskForm({...newTaskForm, displayId: e.target.value})} placeholder="PRJ-001..." className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 dark:text-white font-bold" />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Title</label>
                      <input 
                        required
                        value={newTaskForm.title} 
                        onChange={e => setNewTaskForm({...newTaskForm, title: e.target.value})} 
                        placeholder="Task title..." 
                        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 dark:text-white" 
                      />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Description</label>
                      <textarea 
                        value={newTaskForm.description} 
                        onChange={e => setNewTaskForm({...newTaskForm, description: e.target.value})} 
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                handleCreateTask(e);
                            }
                        }}
                        rows={3} 
                        placeholder="What needs to be done? (Ctrl+Enter to create)" 
                        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 resize-none dark:text-white" 
                      />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Due Date</label>
                         <input type="date" value={newTaskForm.dueDate} onChange={e => setNewTaskForm({...newTaskForm, dueDate: e.target.value})} className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 dark:text-white" />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Priority</label>
                         <select value={newTaskForm.priority} onChange={e => setNewTaskForm({...newTaskForm, priority: e.target.value})} className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 dark:text-white">
                            {appConfig.taskPriorities.map(p => <option key={p} value={p}>{p}</option>)}
                         </select>
                      </div>
                   </div>
                </div>
                <div className="p-4 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3">
                   <button type="button" onClick={() => setShowNewTaskModal(false)} className="px-4 py-2 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all">Cancel</button>
                   <button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all">Create Task</button>
                </div>
             </form>
          </div>
        )}

        {/* Task Detail Modal */}
        {selectedTask && (
            <TaskDetailModal 
                task={selectedTask}
                allTasks={tasks}
                onClose={() => setSelectedTask(null)}
                onUpdateStatus={updateTaskStatus}
                onUpdateTask={updateTaskFields}
                onAddUpdate={addUpdateToTask}
                onEditUpdate={handleEditUpdate}
                onDeleteUpdate={handleDeleteUpdate}
                onDeleteTask={deleteTask}
                availableStatuses={appConfig.taskStatuses}
                availablePriorities={appConfig.taskPriorities}
                updateTags={appConfig.updateHighlightOptions || []}
                statusColors={appConfig.itemColors || {}}
                offDays={offDays}
                initialHighlightContent={highlightedUpdateContent}
            />
        )}

        {/* Focus Mode Modal */}
        {focusModeDate && (
            <DayFocusModal 
                date={focusModeDate}
                tasks={tasks}
                onClose={() => setFocusModeDate(null)}
                onUpdateStatus={updateTaskStatus}
                onUpdateTask={updateTaskFields}
                onOpenTask={setSelectedTask}
            />
        )}

        {/* Report Modal */}
        {showReportModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border dark:border-slate-800">
                <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center bg-indigo-600 text-white">
                   <h2 className="font-bold flex items-center gap-2"><Sparkles size={18}/> Weekly AI Report</h2>
                   <button onClick={() => setShowReportModal(false)}><X size={20}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 dark:text-slate-300">
                   {isGeneratingReport ? (
                       <div className="flex flex-col items-center justify-center py-12 gap-4">
                           <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                           <p>Analyzing {appConfig.aiReportConfig?.periodType === 'current_week' ? 'this week' : 'tasks'}...</p>
                       </div>
                    ) : (
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                            {generatedReport.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                        </div>
                    )}
                </div>
                <div className="p-4 border-t dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-950">
                   <button onClick={() => { navigator.clipboard.writeText(generatedReport); alert('Copied!'); }} className="px-4 py-2 text-slate-600 dark:text-slate-400 font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800">Copy</button>
                   <button onClick={() => setShowReportModal(false)} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">Close</button>
                </div>
             </div>
          </div>
        )}
      </main>
      <AIChat tasks={tasks} logs={logs} observations={observations} appConfig={appConfig} onOpenSettings={() => setView(ViewMode.SETTINGS)} />
    </div>
  );
};

export default App;