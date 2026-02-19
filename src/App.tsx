
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
  CheckCircle2, 
  Clock, 
  Sparkles, 
  HelpCircle,
  LogOut,
  Target,
  Layers,
  Calendar,
  Briefcase,
  Moon,
  Sun
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
  TaskAttachment
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

const BUILD_VERSION = "V4.9.2";

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
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  
  // New Modals State
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [focusedDate, setFocusedDate] = useState<string | null>(null);

  const [generatedReport, setGeneratedReport] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Timeline Resizing State
  const [timelineHeight, setTimelineHeight] = useState(320);
  const isResizingRef = useRef(false);

  const [newTaskForm, setNewTaskForm] = useState({
    source: `CW${getWeekNumber(new Date())}`,
    projectId: '',
    displayId: '',
    description: '',
    dueDate: new Date().toISOString().split('T')[0],
    status: Status.NOT_STARTED as string,
    priority: Priority.MEDIUM as string
  });

  // Dark Mode Toggle
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('protrack_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    const savedConfig = localStorage.getItem('protrack_firebase_config');
    const localAppConfig = localStorage.getItem('protrack_app_config');
    const savedTheme = localStorage.getItem('protrack_theme');
    const savedTimelineHeight = localStorage.getItem('protrack_timeline_height');
    
    if (savedTheme === 'dark') setIsDarkMode(true);
    if (savedTimelineHeight) setTimelineHeight(parseInt(savedTimelineHeight, 10));

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

    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        if (initFirebase(config)) setIsSyncEnabled(true);
      } catch (e) { console.error("Firebase init failed", e); }
    }
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isSyncEnabled) {
      const unsubscribe = subscribeToCollections({
        onTasks: (data) => setTasks(data),
        onLogs: (data) => setLogs(data),
        onObservations: (data) => setObservations(data),
        onOffDays: (data) => setOffDays(data),
        onConfig: (data) => setAppConfig({ ...DEFAULT_CONFIG, ...data })
      });
      return () => { if (unsubscribe) unsubscribe(); };
    }
  }, [isSyncEnabled]);

  // Timeline Resizing Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      e.preventDefault();
      setTimelineHeight(prev => {
        const newHeight = prev + e.movementY;
        return Math.max(200, Math.min(800, newHeight));
      });
    };

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
        localStorage.setItem('protrack_timeline_height', timelineHeight.toString());
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [timelineHeight]);

  const persistData = (newTasks: Task[], newLogs: DailyLog[], newObs: Observation[], newOffDays: string[], newConfig?: AppConfig) => {
    setTasks(newTasks);
    setLogs(newLogs);
    setObservations(newObs);
    setOffDays(newOffDays);
    if (newConfig) setAppConfig(newConfig);
    
    localStorage.setItem('protrack_data', JSON.stringify({ tasks: newTasks, logs: newLogs, observations: newObs, offDays: newOffDays }));
    if (newConfig) localStorage.setItem('protrack_app_config', JSON.stringify(newConfig));
  };

  // Helper for direct sync calls
  const syncTask = (task: Task, action: 'create' | 'update' | 'delete' = 'update') => {
      if (isSyncEnabled) syncData([{ type: 'task', action, id: task.id, data: task }]);
      // Update local state immediately
      if (action === 'delete') setTasks(prev => prev.filter(t => t.id !== task.id));
      else setTasks(prev => {
          const exists = prev.some(t => t.id === task.id);
          if (exists) return prev.map(t => t.id === task.id ? task : t);
          return [...prev, task];
      });
      // Also persist to local storage
      const updatedTasks = action === 'delete' ? tasks.filter(t => t.id !== task.id) : (tasks.some(t => t.id === task.id) ? tasks.map(t => t.id === task.id ? task : t) : [...tasks, task]);
      localStorage.setItem('protrack_data', JSON.stringify({ tasks: updatedTasks, logs, observations, offDays }));
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
    return projectId ? `${projectId}-${maxSeq + 1}` : '';
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
    
    syncTask(newTask, 'create');
    setHighlightedTaskId(newTask.id);
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
    const task = tasks.find(t => t.id === id);
    if (task) syncTask({ ...task, status }, 'update');
  };

  const updateTaskFields = (id: string, fields: Partial<Task>) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
        if (fields.displayId) {
           const isDuplicate = tasks.some(t => t.id !== id && t.displayId.toLowerCase() === fields.displayId?.toLowerCase());
           if (isDuplicate) {
              alert(`Error: Display ID "${fields.displayId}" is already taken.`);
              return;
           }
        }
        syncTask({ ...task, ...fields }, 'update');
    }
  };

  const addUpdateToTask = (id: string, content: string, attachments?: TaskAttachment[], highlightColor?: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
        const timestamp = new Date().toISOString();
        const updateId = uuidv4();
        const updatedTask = { ...task, updates: [...task.updates, { id: updateId, timestamp, content, attachments, highlightColor }] };
        
        syncTask(updatedTask, 'update');

        const newLog: DailyLog = { id: uuidv4(), date: new Date().toLocaleDateString('en-CA'), taskId: id, content };
        if (isSyncEnabled) syncData([{ type: 'log', action: 'create', id: newLog.id, data: newLog }]);
        setLogs(prev => [...prev, newLog]);
    }
  };

  const handleEditUpdate = (taskId: string, updateId: string, content: string, timestamp?: string, highlightColor?: string | null) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        const updatedTask = {
            ...task,
            updates: task.updates.map(u => u.id === updateId ? { 
                ...u, 
                content, 
                timestamp: timestamp || u.timestamp,
                highlightColor: highlightColor === null ? undefined : (highlightColor || u.highlightColor)
            } : u)
        };
        syncTask(updatedTask, 'update');
    }
  };

  const handleDeleteUpdate = (taskId: string, updateId: string) => {
    if (!confirm('Delete this history record?')) return;
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        const updatedTask = { ...task, updates: task.updates.filter(u => u.id !== updateId) };
        syncTask(updatedTask, 'update');
    }
  };

  const deleteTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) syncTask(task, 'delete');
    if (selectedTask?.id === id) setSelectedTask(null);
  };

  const handleEditLog = (logId: string, taskId: string, content: string, date: string) => {
    const newLogs = logs.map(l => l.id === logId ? { ...l, taskId, content, date } : l);
    if (isSyncEnabled) syncData([{ type: 'log', action: 'update', id: logId, data: { id: logId, taskId, content, date } }]);
    setLogs(newLogs);
    persistData(tasks, newLogs, observations, offDays); // Fallback local persist
  };

  const handleDeleteLog = (logId: string) => {
    if (confirm('Delete this journal entry?')) {
      if (isSyncEnabled) syncData([{ type: 'log', action: 'delete', id: logId }]);
      const newLogs = logs.filter(l => l.id !== logId);
      setLogs(newLogs);
      persistData(tasks, newLogs, observations, offDays);
    }
  };

  const handleUpdateAppConfig = (newConfig: AppConfig) => {
    setAppConfig(newConfig);
    if (isSyncEnabled) syncData([{ type: 'config', action: 'update', data: newConfig }]);
    localStorage.setItem('protrack_app_config', JSON.stringify(newConfig));
  };

  const todayStr = new Date().toLocaleDateString('en-CA');
  
  const weeklyFocusCount = useMemo(() => {
    return tasks.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED).length;
  }, [tasks]);

  const statusSummary = useMemo(() => {
    return appConfig.taskStatuses.map(s => ({
      label: s,
      count: tasks.filter(t => t.status === s).length
    }));
  }, [tasks, appConfig.taskStatuses]);

  const overdueTasks = useMemo(() => tasks.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED && t.dueDate && t.dueDate < todayStr), [tasks, todayStr]);

  const weekDays = useMemo(() => {
    const days = [];
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); 
    const monday = new Date(today.setDate(diff));
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d.toLocaleDateString('en-CA'));
    }
    return days;
  }, [todayStr]);

  const weekTasks = useMemo(() => {
    const map: Record<string, Task[]> = {};
    weekDays.forEach(d => {
      map[d] = tasks.filter(t => t.dueDate === d && t.status !== Status.ARCHIVED);
    });
    return map;
  }, [tasks, weekDays]);

  const filteredTasks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const base = tasks.filter(t => (t.description.toLowerCase().includes(q) || t.title?.toLowerCase().includes(q) || t.displayId.toLowerCase().includes(q)));
    if (activeTaskTab === 'current') return base.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED);
    return base.filter(t => t.status === Status.DONE || t.status === Status.ARCHIVED);
  }, [tasks, searchQuery, activeTaskTab]);

  const getStatusColorMini = (s: string) => {
    switch (s) {
      case Status.DONE:
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300';
      case Status.IN_PROGRESS:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
      case Status.WAITING:
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300';
      case Status.ARCHIVED:
        return 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
      default:
        return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    }
  };

  const renderContent = () => {
    switch (view) {
      case ViewMode.DASHBOARD:
        return (
          <div className="space-y-6 animate-fade-in">
             <div className="bg-gradient-to-r from-indigo-600 to-purple-700 dark:from-indigo-900 dark:to-purple-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
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
                    <div className="bg-indigo-600 dark:bg-indigo-700 p-4 rounded-xl flex flex-col justify-between shadow-md shadow-indigo-100 dark:shadow-none">
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
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-2xl p-6">
                    <h3 className="text-red-800 dark:text-red-300 font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                        <AlertTriangle size={18} /> Overdue Items ({overdueTasks.length})
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {overdueTasks.map(t => <TaskCard key={t.id} task={t} onUpdateStatus={updateTaskStatus} onOpenTask={() => setSelectedTask(t)} availableStatuses={appConfig.taskStatuses} availablePriorities={appConfig.taskPriorities} statusColors={appConfig.itemColors} updateTags={appConfig.updateHighlightOptions} />)}
                    </div>
                </div>
             )}
          </div>
        );

      case ViewMode.TASKS:
        return (
          <div className="h-full flex flex-col animate-fade-in">
             <div className="flex justify-between items-center mb-4 shrink-0">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Daily Tasks</h1>
                <button onClick={() => setShowNewTaskModal(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none font-bold">
                    <Plus size={20} /> New Task
                </button>
             </div>

             {/* Resizable Weekly Timeline */}
             <div 
                className="flex gap-4 overflow-x-auto pb-4 snap-x custom-scrollbar shrink-0"
                style={{ height: timelineHeight }}
             >
                {weekDays.map(d => (
                    <div key={d} className={`min-w-[280px] w-[280px] p-4 rounded-2xl border flex flex-col transition-all h-full ${d === todayStr ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 ring-2 ring-indigo-100 dark:ring-indigo-900 shadow-md z-10' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm'}`}>
                        <div 
                            className="flex justify-between items-start mb-3 border-b pb-2 border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-4 -mt-4 p-4 rounded-t-2xl transition-colors shrink-0"
                            onClick={() => setFocusedDate(d)}
                        >
                            <div>
                                <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{new Date(d).toLocaleDateString([], { weekday: 'long' })}</span>
                                <span className="text-lg font-bold text-slate-800 dark:text-slate-200">{new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                            </div>
                            {d === todayStr && <span className="bg-indigo-600 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">TODAY</span>}
                        </div>
                        
                        {/* Scrollable Task List Inside Card */}
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-0">
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
                                    <p className="text-xs text-slate-700 dark:text-slate-200 line-clamp-2 font-medium leading-snug">{t.title || t.description}</p>
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

             {/* Draggable Divider */}
             <div 
                className="h-3 w-full cursor-row-resize flex items-center justify-center hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-colors shrink-0 group z-20 my-1"
                onMouseDown={() => {
                    isResizingRef.current = true;
                    document.body.style.cursor = 'row-resize';
                    document.body.style.userSelect = 'none';
                }}
             >
                <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 group-hover:bg-indigo-400 transition-colors shadow-sm" />
             </div>

             <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 flex flex-col bg-slate-100/50 dark:bg-slate-900/30 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-inner">
                    <div className="bg-white dark:bg-slate-800 p-5 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                            <button onClick={() => setActiveTaskTab('current')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTaskTab === 'current' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Active Tasks</button>
                            <button onClick={() => setActiveTaskTab('completed')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTaskTab === 'completed' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Archive & Done</button>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{filteredTasks.length} {activeTaskTab} ITEMS</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {filteredTasks.map(t => <TaskCard key={t.id} task={t} onUpdateStatus={updateTaskStatus} onOpenTask={() => setSelectedTask(t)} onDelete={deleteTask} availableStatuses={appConfig.taskStatuses} availablePriorities={appConfig.taskPriorities} statusColors={appConfig.itemColors} updateTags={appConfig.updateHighlightOptions} />)}
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
                            onAddLog={(l) => {
                                const newLog = { ...l, id: uuidv4() };
                                setLogs(prev => [...prev, newLog]);
                                if (isSyncEnabled) syncData([{ type: 'log', action: 'create', id: newLog.id, data: newLog }]);
                            }}
                            onUpdateTask={updateTaskFields} 
                            offDays={offDays} 
                            onToggleOffDay={(d) => {
                                const newOffDays = offDays.includes(d) ? offDays.filter(x => x !== d) : [...offDays, d];
                                setOffDays(newOffDays);
                                if (isSyncEnabled) syncData([{ type: 'offDays', action: 'overwrite', data: newOffDays }]);
                            }}
                            onToggleOffDayRange={(dates) => {
                                const newOffDays = Array.from(new Set([...offDays, ...dates]));
                                setOffDays(newOffDays);
                                if (isSyncEnabled) syncData([{ type: 'offDays', action: 'overwrite', data: newOffDays }]);
                            }}
                            onClearOffDays={(dates) => {
                                const newOffDays = offDays.filter(d => !dates.includes(d));
                                setOffDays(newOffDays);
                                if (isSyncEnabled) syncData([{ type: 'offDays', action: 'overwrite', data: newOffDays }]);
                            }}
                            onEditLog={handleEditLog}
                            onDeleteLog={handleDeleteLog}
                            searchQuery={searchQuery}
                            onHighlightTask={(tid) => {
                                const t = tasks.find(tsk => tsk.id === tid);
                                if (t) setSelectedTask(t);
                            }}
                        />
                    </div>
                </div>
             </div>
          </div>
        );

      case ViewMode.OBSERVATIONS:
        return <ObservationsLog 
                  observations={observations} 
                  onAddObservation={o => {
                      setObservations(prev => [...prev, o]);
                      if (isSyncEnabled) syncData([{ type: 'observation', action: 'create', id: o.id, data: o }]);
                  }} 
                  onEditObservation={o => {
                      setObservations(prev => prev.map(x => x.id === o.id ? o : x));
                      if (isSyncEnabled) syncData([{ type: 'observation', action: 'update', id: o.id, data: o }]);
                  }} 
                  onDeleteObservation={id => {
                      setObservations(prev => prev.filter(x => x.id !== id));
                      if (isSyncEnabled) syncData([{ type: 'observation', action: 'delete', id }]);
                  }} 
                  columns={appConfig.observationStatuses}
                  itemColors={appConfig.itemColors} 
               />;
      case ViewMode.SETTINGS:
        return (
          <Settings 
            tasks={tasks} 
            logs={logs} 
            observations={observations} 
            onImportData={(d) => persistData(d.tasks, d.logs, d.observations, d.offDays || [], d.appConfig)} 
            onSyncConfigUpdate={c => setIsSyncEnabled(!!c)} 
            isSyncEnabled={isSyncEnabled} 
            appConfig={appConfig} 
            onUpdateConfig={handleUpdateAppConfig} 
            onPurgeData={(newTasks, newLogs, newObs) => {
                setTasks(newTasks);
                setLogs(newLogs);
                setObservations(newObs);
                // For full sync replace
                if (isSyncEnabled) syncData([{ type: 'full', action: 'overwrite', data: { tasks: newTasks, logs: newLogs, observations: newObs, offDays, appConfig } }]);
                localStorage.setItem('protrack_data', JSON.stringify({ tasks: newTasks, logs: newLogs, observations: newObs, offDays }));
            }} 
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
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-300">
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col z-20`}>
        <div className="p-4 flex flex-col items-center gap-1 border-b dark:border-slate-800 h-24 justify-center">
           <FullLogo isSidebarOpen={isSidebarOpen} />
           {isSidebarOpen && <span className="text-[10px] font-mono text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest">{BUILD_VERSION}</span>}
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
           {[
             { mode: ViewMode.DASHBOARD, icon: LayoutDashboard, label: 'Dashboard' },
             { mode: ViewMode.TASKS, icon: ListTodo, label: 'Daily Tasks' },
             { mode: ViewMode.OBSERVATIONS, icon: MessageSquare, label: 'Observations' },
           ].map(item => (
             <button key={item.mode} onClick={() => setView(item.mode)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${view === item.mode ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <item.icon size={20} />
                {isSidebarOpen && <span>{item.label}</span>}
             </button>
           ))}
           <div className="pt-4 mt-4 border-t dark:border-slate-800">
             <button onClick={() => setView(ViewMode.SETTINGS)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${view === ViewMode.SETTINGS ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <SettingsIcon size={20} />
                {isSidebarOpen && <span>Settings</span>}
             </button>
             <button onClick={() => setView(ViewMode.HELP)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${view === ViewMode.HELP ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <HelpCircle size={20} />
                {isSidebarOpen && <span>User Guide</span>}
             </button>
           </div>
        </nav>
        <div className="p-4 border-t dark:border-slate-800">
           <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg w-full flex justify-center">
              {isSidebarOpen ? <LogOut size={20} className="rotate-180" /> : <Menu size={20} />}
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="h-16 bg-white dark:bg-slate-900 border-b dark:border-slate-800 flex items-center justify-between px-6 shrink-0 z-10 transition-colors">
           <div className="relative max-w-md w-full">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input type="text" placeholder="Search tasks, logs, projects..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-sm outline-none dark:text-slate-200 dark:placeholder-slate-600" />
           </div>
           <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isSyncEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{isSyncEnabled ? 'Cloud Synced' : 'Local Only'}</span>
           </div>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-slate-950 custom-scrollbar transition-colors">
           {renderContent()}
        </div>

        {/* New Task Modal */}
        {showNewTaskModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <form onSubmit={handleCreateTask} className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in border dark:border-slate-800">
                <div className="p-5 border-b dark:border-slate-800 flex justify-between items-center bg-indigo-600 dark:bg-indigo-900 text-white">
                   <h2 className="font-bold flex items-center gap-2"><Plus size={20}/> Create New Task</h2>
                   <button type="button" onClick={() => setShowNewTaskModal(false)}><X size={20}/></button>
                </div>
                <div className="p-6 space-y-4">
                   {modalError && (
                     <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl flex items-center gap-2 text-xs font-bold">
                        <AlertTriangle size={16} /> {modalError}
                     </div>
                   )}
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Source (CW)</label>
                         <div className="relative">
                            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                            <input required value={newTaskForm.source} onChange={e => setNewTaskForm({...newTaskForm, source: e.target.value})} className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 dark:text-white" />
                         </div>
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Project ID</label>
                         <div className="relative">
                            <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                            <input required list="active-projects" value={newTaskForm.projectId} onChange={e => {
                                const pid = e.target.value;
                                setNewTaskForm({...newTaskForm, projectId: pid, displayId: suggestNextId(pid)});
                            }} placeholder="Project Name..." className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 dark:text-white" />
                            <datalist id="active-projects">
                               {activeProjects.map(p => <option key={p} value={p} />)}
                            </datalist>
                         </div>
                      </div>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Display ID</label>
                      <input required value={newTaskForm.displayId} onChange={e => setNewTaskForm({...newTaskForm, displayId: e.target.value})} placeholder="PRJ-001..." className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 dark:text-white" />
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
                        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 resize-none dark:text-white" 
                      />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Due Date</label>
                         <input type="date" value={newTaskForm.dueDate} onChange={e => setNewTaskForm({...newTaskForm, dueDate: e.target.value})} className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 dark:text-white" />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Priority</label>
                         <select value={newTaskForm.priority} onChange={e => setNewTaskForm({...newTaskForm, priority: e.target.value})} className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 dark:text-white">
                            {appConfig.taskPriorities.map(p => <option key={p} value={p}>{p}</option>)}
                         </select>
                      </div>
                   </div>
                </div>
                <div className="p-4 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3">
                   <button type="button" onClick={() => setShowNewTaskModal(false)} className="px-4 py-2 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all">Cancel</button>
                   <button type="submit" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all">Create Task</button>
                </div>
             </form>
          </div>
        )}

        {/* Report Modal */}
        {showReportModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border dark:border-slate-800">
                <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center bg-indigo-600 dark:bg-indigo-900 text-white">
                   <h2 className="font-bold flex items-center gap-2"><Sparkles size={18}/> Weekly AI Report</h2>
                   <button onClick={() => setShowReportModal(false)}><X size={20}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 dark:text-slate-200">
                   {isGeneratingReport ? <div className="flex flex-col items-center justify-center py-12 gap-4"><div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div><p>Analyzing week...</p></div> : <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">{generatedReport}</div>}
                </div>
                <div className="p-4 border-t dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-900">
                   <button onClick={() => { navigator.clipboard.writeText(generatedReport); alert('Copied!'); }} className="px-4 py-2 text-slate-600 dark:text-slate-300 font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800">Copy</button>
                   <button onClick={() => setShowReportModal(false)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg">Close</button>
                </div>
             </div>
          </div>
        )}

        {/* Task Detail Modal */}
        {selectedTask && (
            <TaskDetailModal 
                task={tasks.find(t => t.id === selectedTask.id) || selectedTask}
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

        {/* Day Focus Modal */}
        {focusedDate && (
            <DayFocusModal 
                date={focusedDate}
                tasks={tasks}
                onClose={() => setFocusedDate(null)}
                onUpdateStatus={updateTaskStatus}
                onUpdateTask={updateTaskFields}
                onOpenTask={setSelectedTask}
            />
        )}
      </main>
      <AIChat tasks={tasks} logs={logs} observations={observations} appConfig={appConfig} onOpenSettings={() => setView(ViewMode.SETTINGS)} />
    </div>
  );
};

export default App;
