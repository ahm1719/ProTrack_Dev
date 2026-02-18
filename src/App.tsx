import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Briefcase
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
  FirebaseConfig,
  TaskAttachment,
  BackupSettings
} from './types';

import TaskCard from './components/TaskCard';
import DailyJournal from './components/DailyJournal';
import ObservationsLog from './components/ObservationsLog';
import Settings from './components/Settings';
import AIChat from './components/AIChat';
import UserManual from './components/UserManual';
import TaskDetailModal from './components/TaskDetailModal';
import { FullLogo } from './components/Branding';

import { subscribeToCollections, syncData, initFirebase } from './services/firebaseService';
import { generateWeeklySummary } from './services/geminiService';
import { performBackup, selectBackupFolder } from './services/backupService';

const BUILD_VERSION = "V3.6.0";

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
  const [activeTaskTab, setActiveTaskTab] = useState<'current' | 'completed'>('current');
  
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Modals & UI State
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [generatedReport, setGeneratedReport] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

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
    description: '',
    dueDate: new Date().toISOString().split('T')[0],
    status: Status.NOT_STARTED as string,
    priority: Priority.MEDIUM as string
  });

  // Initialization
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    
    // Load local storage
    const localAppConfig = localStorage.getItem('protrack_app_config');
    if (localAppConfig) {
      try {
        const parsed = JSON.parse(localAppConfig);
        setAppConfig({ ...DEFAULT_CONFIG, ...parsed });
      } catch (e) { console.error("Config parse error", e); }
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

    const savedConfig = localStorage.getItem('protrack_firebase_config');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        if (initFirebase(config)) setIsSyncEnabled(true);
      } catch (e) { console.error("Firebase init failed", e); }
    }

    // Theme check
    const savedTheme = localStorage.getItem('protrack_theme');
    if (savedTheme === 'dark') {
        setIsDarkMode(true);
        document.documentElement.classList.add('dark');
    }

    return () => clearInterval(timer);
  }, []);

  // Sync Listeners
  useEffect(() => {
    if (isSyncEnabled) {
      const unsubscribe = subscribeToCollections({
        onTasks: (cloudTasks) => setTasks(cloudTasks),
        onLogs: (cloudLogs) => setLogs(cloudLogs),
        onObservations: (cloudObs) => setObservations(cloudObs),
        onOffDays: (cloudOffDays) => setOffDays(cloudOffDays),
        onConfig: (cloudConfig) => setAppConfig(cloudConfig)
      });
      return () => { if (unsubscribe) unsubscribe(); };
    }
  }, [isSyncEnabled]);

  // Dark Mode Toggle
  const toggleTheme = (isDark: boolean) => {
    setIsDarkMode(isDark);
    if (isDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('protrack_theme', 'dark');
    } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('protrack_theme', 'light');
    }
  };

  // Data Persistence Helper
  const persistData = (newTasks: Task[], newLogs: DailyLog[], newObs: Observation[], newOffDays: string[]) => {
    setTasks(newTasks);
    setLogs(newLogs);
    setObservations(newObs);
    setOffDays(newOffDays);
    
    // Save to LocalStorage
    localStorage.setItem('protrack_data', JSON.stringify({ tasks: newTasks, logs: newLogs, observations: newObs, offDays: newOffDays }));
  };

  // CRUD Handlers
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
    
    const updatedTasks = [...tasks, newTask];
    setTasks(updatedTasks);
    localStorage.setItem('protrack_data', JSON.stringify({ tasks: updatedTasks, logs, observations, offDays }));
    if (isSyncEnabled) syncData([{ type: 'task', action: 'create', id: newTask.id, data: newTask }]);

    setShowNewTaskModal(false);
    setNewTaskForm({
      source: `CW${getWeekNumber(new Date())}`,
      projectId: '',
      displayId: '',
      description: '',
      dueDate: new Date().toISOString().split('T')[0],
      status: appConfig.taskStatuses[0] || Status.NOT_STARTED,
      priority: appConfig.taskPriorities[1] || Priority.MEDIUM
    });
    setView(ViewMode.TASKS);
  };

  const updateTaskStatus = (id: string, status: string) => {
    const updatedTasks = tasks.map(t => t.id === id ? { ...t, status } : t);
    setTasks(updatedTasks);
    localStorage.setItem('protrack_data', JSON.stringify({ tasks: updatedTasks, logs, observations, offDays }));
    if (isSyncEnabled) syncData([{ type: 'task', action: 'update', id, data: { status } }]);
  };

  const updateTaskFields = (id: string, fields: Partial<Task>) => {
    if (fields.displayId) {
       const isDuplicate = tasks.some(t => t.id !== id && t.displayId.toLowerCase() === fields.displayId?.toLowerCase());
       if (isDuplicate) {
          alert(`Error: Display ID "${fields.displayId}" is already taken.`);
          return;
       }
    }
    const updatedTasks = tasks.map(t => t.id === id ? { ...t, ...fields } : t);
    setTasks(updatedTasks);
    localStorage.setItem('protrack_data', JSON.stringify({ tasks: updatedTasks, logs, observations, offDays }));
    if (isSyncEnabled) syncData([{ type: 'task', action: 'update', id, data: fields }]);
  };

  const addUpdateToTask = (id: string, content: string, attachments?: TaskAttachment[], highlightColor?: string) => {
    const timestamp = new Date().toISOString();
    const updateId = uuidv4();
    const update = { id: updateId, timestamp, content, attachments, highlightColor };
    
    const updatedTasks = tasks.map(t => t.id === id ? { ...t, updates: [...t.updates, update] } : t);
    const newLog: DailyLog = { id: uuidv4(), date: new Date().toLocaleDateString('en-CA'), taskId: id, content };
    const updatedLogs = [...logs, newLog];

    setTasks(updatedTasks);
    setLogs(updatedLogs);
    localStorage.setItem('protrack_data', JSON.stringify({ tasks: updatedTasks, logs: updatedLogs, observations, offDays }));
    
    if (isSyncEnabled) {
        syncData([
            { type: 'task', action: 'update', id, data: { updates: updatedTasks.find(t=>t.id===id)?.updates } },
            { type: 'log', action: 'create', id: newLog.id, data: newLog }
        ]);
    }
  };

  const handleEditUpdate = (taskId: string, updateId: string, content: string, timestamp?: string, highlightColor?: string | null) => {
    const newTasks = tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          updates: t.updates.map(u => u.id === updateId ? { 
              ...u, 
              content, 
              timestamp: timestamp || u.timestamp,
              highlightColor: highlightColor === undefined ? u.highlightColor : (highlightColor === null ? undefined : highlightColor)
          } : u)
        };
      }
      return t;
    });

    const newLogs = logs.map(l => {
      if (l.taskId === taskId) {
        const originalTask = tasks.find(t => t.id === taskId);
        const originalUpdate = originalTask?.updates.find(u => u.id === updateId);
        // Loose matching by content since we don't store updateId in logs
        if (l.content === originalUpdate?.content) {
            return { 
                ...l, 
                content, 
                date: timestamp ? timestamp.split('T')[0] : l.date 
            };
        }
      }
      return l;
    });

    setTasks(newTasks);
    setLogs(newLogs);
    localStorage.setItem('protrack_data', JSON.stringify({ tasks: newTasks, logs: newLogs, observations, offDays }));
    
    if (isSyncEnabled) {
        const updatedTask = newTasks.find(t => t.id === taskId);
        syncData([{ type: 'task', action: 'update', id: taskId, data: { updates: updatedTask?.updates } }]);
        const logToSync = newLogs.find(l => l.taskId === taskId && l.content === content); 
        if (logToSync) syncData([{ type: 'log', action: 'update', id: logToSync.id, data: logToSync }]);
    }
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
    
    setTasks(newTasks);
    setLogs(newLogs);
    localStorage.setItem('protrack_data', JSON.stringify({ tasks: newTasks, logs: newLogs, observations, offDays }));

    if (isSyncEnabled) {
        syncData([
            { type: 'task', action: 'update', id: taskId, data: { updates: newTasks.find(t=>t.id===taskId)?.updates } }
        ]);
    }
  };

  const deleteTask = (id: string) => {
    setTasks(prev => {
        const next = prev.filter(t => t.id !== id);
        localStorage.setItem('protrack_data', JSON.stringify({ tasks: next, logs, observations, offDays }));
        if (isSyncEnabled) syncData([{ type: 'task', action: 'delete', id }]);
        return next;
    });
    setSelectedTask(null);
  };

  // Journal Handlers
  const handleAddLog = (log: Omit<DailyLog, 'id'>) => {
      const newLog = { ...log, id: uuidv4() };
      const newLogs = [...logs, newLog];
      setLogs(newLogs);
      localStorage.setItem('protrack_data', JSON.stringify({ tasks, logs: newLogs, observations, offDays }));
      if (isSyncEnabled) syncData([{ type: 'log', action: 'create', id: newLog.id, data: newLog }]);
  };

  const handleEditLog = (logId: string, taskId: string, content: string, date: string) => {
    const newLogs = logs.map(l => l.id === logId ? { ...l, taskId, content, date } : l);
    setLogs(newLogs);
    localStorage.setItem('protrack_data', JSON.stringify({ tasks, logs: newLogs, observations, offDays }));
    if (isSyncEnabled) syncData([{ type: 'log', action: 'update', id: logId, data: { taskId, content, date } }]);
  };

  const handleDeleteLog = (logId: string) => {
    if (confirm('Delete this journal entry?')) {
      const newLogs = logs.filter(l => l.id !== logId);
      setLogs(newLogs);
      localStorage.setItem('protrack_data', JSON.stringify({ tasks, logs: newLogs, observations, offDays }));
      if (isSyncEnabled) syncData([{ type: 'log', action: 'delete', id: logId }]);
    }
  };

  // Observations Handlers
  const handleAddObservation = (obs: Observation) => {
      const newObs = [...observations, obs];
      setObservations(newObs);
      localStorage.setItem('protrack_data', JSON.stringify({ tasks, logs, observations: newObs, offDays }));
      if (isSyncEnabled) syncData([{ type: 'observation', action: 'create', id: obs.id, data: obs }]);
  };
  
  const handleEditObservation = (obs: Observation) => {
      const newObs = observations.map(o => o.id === obs.id ? obs : o);
      setObservations(newObs);
      localStorage.setItem('protrack_data', JSON.stringify({ tasks, logs, observations: newObs, offDays }));
      if (isSyncEnabled) syncData([{ type: 'observation', action: 'update', id: obs.id, data: obs }]);
  };

  const handleDeleteObservation = (id: string) => {
      if (confirm('Delete this observation?')) {
          const newObs = observations.filter(o => o.id !== id);
          setObservations(newObs);
          localStorage.setItem('protrack_data', JSON.stringify({ tasks, logs, observations: newObs, offDays }));
          if (isSyncEnabled) syncData([{ type: 'observation', action: 'delete', id }]);
      }
  };

  // Config Handler
  const handleUpdateAppConfig = (newConfig: AppConfig) => {
    setAppConfig(newConfig);
    localStorage.setItem('protrack_app_config', JSON.stringify(newConfig));
    if (isSyncEnabled) syncData([{ type: 'config', action: 'update', data: newConfig }]);
  };
  
  // Off Days
  const toggleOffDay = (date: string) => {
      const newOffDays = offDays.includes(date) ? offDays.filter(d => d !== date) : [...offDays, date];
      setOffDays(newOffDays);
      localStorage.setItem('protrack_data', JSON.stringify({ tasks, logs, observations, offDays: newOffDays }));
      if (isSyncEnabled) syncData([{ type: 'offDays', action: 'update', data: newOffDays }]);
  };

  // Computed
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
    return projectId ? `${projectId}-${maxSeq + 1}` : '';
  };

  const filteredTasks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const base = tasks.filter(t => 
        (t.description.toLowerCase().includes(q) || t.displayId.toLowerCase().includes(q) || (t.title && t.title.toLowerCase().includes(q)))
    );
    if (activeTaskTab === 'current') return base.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED);
    return base.filter(t => t.status === Status.DONE || t.status === Status.ARCHIVED);
  }, [tasks, searchQuery, activeTaskTab]);

  const statusSummary = useMemo(() => {
    return appConfig.taskStatuses.map(s => ({
      label: s,
      count: tasks.filter(t => t.status === s).length
    }));
  }, [tasks, appConfig.taskStatuses]);

  const overdueTasks = useMemo(() => {
      const todayStr = new Date().toLocaleDateString('en-CA');
      return tasks.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED && t.dueDate && t.dueDate < todayStr);
  }, [tasks]);

  const weeklyFocusCount = tasks.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED).length;

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push(d.toLocaleDateString('en-CA'));
    }
    return days;
  }, []);

  const weekTasks = useMemo(() => {
    const map: Record<string, Task[]> = {};
    weekDays.forEach(d => {
      map[d] = tasks.filter(t => t.dueDate === d && t.status !== Status.DONE && t.status !== Status.ARCHIVED);
    });
    return map;
  }, [tasks, weekDays]);

  const renderContent = () => {
      if (view === ViewMode.DASHBOARD) {
          return (
              <div className="space-y-6 animate-fade-in">
                  <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-wrap gap-2">
                                    {appConfig.observationStatuses.slice(0, 3).map(s => (
                                        <div key={s} className="bg-white/10 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] font-bold border border-white/10 flex items-center gap-1">
                                            <span className="opacity-70">{s}:</span>
                                            <span>{observations.filter(o => o.status === s).length}</span>
                                        </div>
                                    ))}
                                </div>
                                <div>
                                     <h1 className="text-3xl font-bold flex items-baseline gap-2">
                                        {currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                        <span className="text-indigo-200 font-mono text-lg">CW {getWeekNumber(currentTime)}</span>
                                     </h1>
                                     <p className="text-indigo-100 opacity-80 text-sm">{currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                                </div>
                            </div>
                            <button onClick={async () => {
                                setIsGeneratingReport(true); setShowReportModal(true);
                                try { const r = await generateWeeklySummary(tasks, logs, appConfig); setGeneratedReport(r); } 
                                catch (e: any) { setGeneratedReport(e.message); } finally { setIsGeneratingReport(false); }
                            }} className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-6 py-2.5 rounded-xl transition-all text-sm font-bold border border-white/10 shadow-lg backdrop-blur-sm">
                                <Sparkles size={18} /> Weekly Report
                            </button>
                        </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                      <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                          <Layers size={14} /> Weekly Status Distribution
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                          <div className="bg-indigo-600 p-4 rounded-xl flex flex-col justify-between shadow-md shadow-indigo-100 dark:shadow-none">
                              <span className="text-[10px] font-bold text-indigo-100 uppercase tracking-wider">Active Backlog</span>
                              <div className="flex items-end justify-between mt-2">
                                  <span className="text-3xl font-black text-white">{weeklyFocusCount}</span>
                                  <Target size={20} className="text-indigo-300" />
                              </div>
                          </div>
                          {statusSummary.map(s => (
                              <div key={s.label} className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 p-4 rounded-xl flex flex-col justify-between hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-100 dark:hover:border-indigo-900 transition-all group">
                                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider group-hover:text-indigo-500 dark:group-hover:text-indigo-400 truncate">{s.label}</span>
                                  <div className="flex items-end justify-between mt-2">
                                      <span className="text-3xl font-black text-slate-800 dark:text-slate-200">{s.count}</span>
                                      <div className="p-1 bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700 shadow-xs">
                                          <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-indigo-400" />
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                   </div>

                   {overdueTasks.length > 0 && (
                      <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl p-6">
                          <h3 className="text-red-800 dark:text-red-300 font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                              <AlertTriangle size={18} /> Overdue Items ({overdueTasks.length})
                          </h3>
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                              {overdueTasks.map(t => (
                                  <TaskCard 
                                    key={t.id} 
                                    task={t} 
                                    onUpdateStatus={updateTaskStatus} 
                                    onOpenTask={() => setSelectedTask(t)}
                                    availableStatuses={appConfig.taskStatuses} 
                                    availablePriorities={appConfig.taskPriorities} 
                                    statusColors={appConfig.itemColors || {}}
                                  />
                              ))}
                          </div>
                      </div>
                   )}
              </div>
          );
      }
      
      if (view === ViewMode.TASKS) {
          return (
              <div className="h-full flex flex-col space-y-6 animate-fade-in">
                 <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Daily Tasks</h1>
                    <button onClick={() => setShowNewTaskModal(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none font-bold">
                        <Plus size={20} /> New Task
                    </button>
                 </div>

                 <div className="flex gap-4 overflow-x-auto pb-4 snap-x custom-scrollbar shrink-0 h-48">
                    {weekDays.map(d => {
                        const isToday = d === new Date().toLocaleDateString('en-CA');
                        return (
                            <div key={d} className={`min-w-[240px] w-[240px] p-4 rounded-2xl border flex flex-col transition-all ${isToday ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 ring-2 ring-indigo-100 dark:ring-indigo-900/40 shadow-md scale-105 z-10' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm'}`}>
                                <div className="flex justify-between items-start mb-2 border-b dark:border-slate-700 pb-2 border-slate-100">
                                    <div>
                                        <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{new Date(d).toLocaleDateString([], { weekday: 'long' })}</span>
                                        <span className="text-lg font-bold text-slate-800 dark:text-slate-200">{new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                                    </div>
                                    {isToday && <span className="bg-indigo-600 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">TODAY</span>}
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                    {weekTasks[d]?.length ? weekTasks[d].map(t => (
                                        <div 
                                          key={t.id} 
                                          onClick={() => setSelectedTask(t)} 
                                          className="p-2.5 rounded-lg border dark:border-slate-700 text-xs shadow-sm hover:ring-2 hover:ring-indigo-300 dark:hover:ring-indigo-600 transition-all cursor-pointer group bg-white dark:bg-slate-700"
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{t.displayId}</span>
                                            </div>
                                            <p className="line-clamp-2 leading-tight text-slate-600 dark:text-slate-400">{t.title || t.description}</p>
                                        </div>
                                    )) : <div className="h-full flex items-center justify-center text-[10px] text-slate-300 dark:text-slate-600 italic">No deadlines</div>}
                                </div>
                            </div>
                        );
                    })}
                 </div>

                 <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-3 gap-8">
                    <div className="xl:col-span-2 flex flex-col bg-slate-100/50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-inner">
                        <div className="bg-white dark:bg-slate-800 p-5 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-xl">
                                <button onClick={() => setActiveTaskTab('current')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTaskTab === 'current' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Active Tasks</button>
                                <button onClick={() => setActiveTaskTab('completed')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTaskTab === 'completed' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Archive & Done</button>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{filteredTasks.length} {activeTaskTab} ITEMS</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {filteredTasks.map(t => (
                                    <TaskCard 
                                        key={t.id} 
                                        task={t} 
                                        onUpdateStatus={updateTaskStatus} 
                                        onOpenTask={() => setSelectedTask(t)}
                                        availableStatuses={appConfig.taskStatuses} 
                                        availablePriorities={appConfig.taskPriorities} 
                                        statusColors={appConfig.itemColors || {}}
                                    />
                                ))}
                            </div>
                            {filteredTasks.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-300 dark:text-slate-600 opacity-50">
                                    <ListTodo size={48} className="mb-4" />
                                    <p className="font-bold">No tasks match your criteria</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden flex flex-col h-full">
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            <DailyJournal 
                                tasks={tasks} 
                                logs={logs} 
                                onAddLog={handleAddLog} 
                                onUpdateTask={updateTaskFields} 
                                offDays={offDays} 
                                onToggleOffDay={toggleOffDay}
                                onToggleOffDayRange={(dates) => {
                                    const newOffDays = Array.from(new Set([...offDays, ...dates]));
                                    setOffDays(newOffDays);
                                    localStorage.setItem('protrack_data', JSON.stringify({ tasks, logs, observations, offDays: newOffDays }));
                                    if(isSyncEnabled) syncData([{ type: 'offDays', action: 'update', data: newOffDays }]);
                                }}
                                onClearOffDays={(dates) => {
                                    const newOffDays = offDays.filter(d => !dates.includes(d));
                                    setOffDays(newOffDays);
                                    localStorage.setItem('protrack_data', JSON.stringify({ tasks, logs, observations, offDays: newOffDays }));
                                    if(isSyncEnabled) syncData([{ type: 'offDays', action: 'update', data: newOffDays }]);
                                }}
                                onEditLog={handleEditLog}
                                onDeleteLog={handleDeleteLog}
                                searchQuery={searchQuery}
                            />
                        </div>
                    </div>
                 </div>
              </div>
          );
      }

      if (view === ViewMode.OBSERVATIONS) {
          return (
              <ObservationsLog 
                observations={observations} 
                onAddObservation={handleAddObservation} 
                onEditObservation={handleEditObservation} 
                onDeleteObservation={handleDeleteObservation} 
                columns={appConfig.observationStatuses}
                itemColors={appConfig.itemColors} 
              />
          );
      }

      if (view === ViewMode.SETTINGS) {
          return (
              <Settings 
                tasks={tasks} 
                logs={logs} 
                observations={observations} 
                offDays={offDays}
                onImportData={(d) => { persistData(d.tasks || [], d.logs || [], d.observations || [], d.offDays || []); alert('Data Imported'); }}
                onSyncConfigUpdate={c => setIsSyncEnabled(!!c)} 
                isSyncEnabled={isSyncEnabled} 
                appConfig={appConfig} 
                onUpdateConfig={handleUpdateAppConfig} 
                onPurgeData={(nT, nL, nO) => persistData(nT, nL, nO, offDays)} 
                isDarkMode={isDarkMode}
                onToggleTheme={toggleTheme}
                backupSettings={backupSettings}
                setBackupSettings={setBackupSettings}
                onSetupBackupFolder={async () => {
                    const handle = await selectBackupFolder();
                    if (handle) {
                        setBackupHandle(handle);
                        setBackupSettings(prev => ({ ...prev, folderName: handle.name }));
                    }
                }}
                backupStatus={backupStatus}
                onVerifyBackupPermission={() => backupHandle && performBackup(backupHandle, { tasks, logs, observations, offDays, appConfig })}
              />
          );
      }

      if (view === ViewMode.HELP) return <UserManual />;

      return null;
  };

  return (
    <div className={`flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans overflow-hidden transition-colors ${isDarkMode ? 'dark' : ''}`}>
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transition-all duration-300 flex flex-col z-20`}>
        <div className="p-4 flex flex-col items-center gap-1 border-b dark:border-slate-700 h-24 justify-center">
           <FullLogo isSidebarOpen={isSidebarOpen} />
           {isSidebarOpen && <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">{BUILD_VERSION}</span>}
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
           {[
             { mode: ViewMode.DASHBOARD, icon: LayoutDashboard, label: 'Dashboard' },
             { mode: ViewMode.TASKS, icon: ListTodo, label: 'Daily Tasks' },
             { mode: ViewMode.OBSERVATIONS, icon: MessageSquare, label: 'Observations' },
           ].map(item => (
             <button key={item.mode} onClick={() => setView(item.mode)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${view === item.mode ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                <item.icon size={20} />
                {isSidebarOpen && <span>{item.label}</span>}
             </button>
           ))}
           <div className="pt-4 mt-4 border-t dark:border-slate-700">
             <button onClick={() => setView(ViewMode.SETTINGS)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${view === ViewMode.SETTINGS ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                <SettingsIcon size={20} />
                {isSidebarOpen && <span>Settings</span>}
             </button>
             <button onClick={() => setView(ViewMode.HELP)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${view === ViewMode.HELP ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                <HelpCircle size={20} />
                {isSidebarOpen && <span>User Guide</span>}
             </button>
           </div>
        </nav>
        <div className="p-4 border-t dark:border-slate-700">
           <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg w-full flex justify-center">
              {isSidebarOpen ? <LogOut size={20} className="rotate-180" /> : <Menu size={20} />}
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="h-16 bg-white dark:bg-slate-800 border-b dark:border-slate-700 flex items-center justify-between px-6 shrink-0 z-10 transition-colors">
           <div className="relative max-w-md w-full">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search tasks, logs, projects..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-lg text-sm outline-none dark:text-white" />
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
             <form onSubmit={handleCreateTask} className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
                <div className="p-5 border-b dark:border-slate-700 flex justify-between items-center bg-indigo-600 text-white">
                   <h2 className="font-bold flex items-center gap-2"><Plus size={20}/> Create New Task</h2>
                   <button type="button" onClick={() => setShowNewTaskModal(false)}><X size={20}/></button>
                </div>
                <div className="p-6 space-y-4">
                   {modalError && (
                     <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl flex items-center gap-2 text-xs font-bold">
                        <AlertTriangle size={16} /> {modalError}
                     </div>
                   )}
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Source (CW)</label>
                         <div className="relative">
                            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input required value={newTaskForm.source} onChange={e => setNewTaskForm({...newTaskForm, source: e.target.value})} className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 dark:text-white border dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900" />
                         </div>
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Project ID</label>
                         <div className="relative">
                            <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input required list="active-projects" value={newTaskForm.projectId} onChange={e => {
                                const pid = e.target.value;
                                setNewTaskForm({...newTaskForm, projectId: pid, displayId: suggestNextId(pid)});
                            }} placeholder="Project Name..." className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 dark:text-white border dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900" />
                            <datalist id="active-projects">
                               {activeProjects.map(p => <option key={p} value={p} />)}
                            </datalist>
                         </div>
                      </div>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Display ID</label>
                      <input required value={newTaskForm.displayId} onChange={e => setNewTaskForm({...newTaskForm, displayId: e.target.value})} placeholder="PRJ-001..." className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-900 dark:text-white border dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900" />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Description</label>
                      <textarea 
                        required 
                        value={newTaskForm.description} 
                        onChange={e => setNewTaskForm({...newTaskForm, description: e.target.value})} 
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                handleCreateTask(e);
                            }
                        }}
                        rows={3} 
                        placeholder="What needs to be done? (Ctrl+Enter to create)" 
                        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 dark:text-white border dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 resize-none" 
                      />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Due Date</label>
                         <input type="date" value={newTaskForm.dueDate} onChange={e => setNewTaskForm({...newTaskForm, dueDate: e.target.value})} className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 dark:text-white border dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900" />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Priority</label>
                         <select value={newTaskForm.priority} onChange={e => setNewTaskForm({...newTaskForm, priority: e.target.value})} className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 dark:text-white border dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900">
                            {appConfig.taskPriorities.map(p => <option key={p} value={p}>{p}</option>)}
                         </select>
                      </div>
                   </div>
                </div>
                <div className="p-4 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3">
                   <button type="button" onClick={() => setShowNewTaskModal(false)} className="px-4 py-2 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all">Cancel</button>
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
            />
        )}

        {/* Report Modal */}
        {showReportModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
                <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-indigo-600 text-white">
                   <h2 className="font-bold flex items-center gap-2"><Sparkles size={18}/> Weekly AI Report</h2>
                   <button onClick={() => setShowReportModal(false)}><X size={20}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 text-slate-700 dark:text-slate-300">
                   {isGeneratingReport ? <div className="flex flex-col items-center justify-center py-12 gap-4"><div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div><p>Analyzing week...</p></div> : <div className="prose prose-sm dark:prose-invert max-w-none">{generatedReport.split('\n').map((line, i) => <p key={i}>{line}</p>)}</div>}
                </div>
                <div className="p-4 border-t dark:border-slate-700 flex justify-end gap-2 bg-slate-50 dark:bg-slate-900">
                   <button onClick={() => { navigator.clipboard.writeText(generatedReport); alert('Copied!'); }} className="px-4 py-2 text-slate-600 dark:text-slate-400 font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700">Copy</button>
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