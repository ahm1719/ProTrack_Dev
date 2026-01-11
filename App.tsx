import React, { useState, useEffect, useCallback } from 'react';
import { Task, DailyLog, ViewMode, Status, Priority, Observation, ObservationStatus, FirebaseConfig } from './types';
import TaskCard from './components/TaskCard';
import DailyJournal from './components/DailyJournal';
import UserManual from './components/UserManual';
import ObservationsLog from './components/ObservationsLog';
import Settings from './components/Settings';
import { generateWeeklySummary } from './services/geminiService';
import { initFirebase, subscribeToData, saveDataToCloud } from './services/firebaseService';
import { 
  LayoutDashboard, 
  ListTodo, 
  BookOpen, 
  Sparkles, 
  Plus, 
  Search, 
  Menu,
  X,
  Clock,
  Settings as SettingsIcon,
  CalendarDays,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  StickyNote,
  Archive,
  Copy
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// --- MOCK DATA FOR INITIAL LOAD ---
const INITIAL_TASKS: Task[] = [
  {
    id: '1',
    displayId: 'P1130-28',
    source: 'CW02',
    projectId: 'PROJ-ALPHA',
    description: 'Prepare a set of slides for the end user to show project stage and limitations.',
    dueDate: '2026-01-09',
    status: Status.IN_PROGRESS,
    priority: Priority.HIGH,
    updates: [
      { id: 'u1', timestamp: '2026-01-07T10:00:00', content: 'Started work on slide set.' },
      { id: 'u2', timestamp: '2026-01-08T14:30:00', content: 'Updated slides to include positive news on AY4/5.' }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    displayId: 'G-2',
    source: 'CW49',
    projectId: 'PROJ-BETA',
    description: 'Think of structure and identify needed folders for Mfiles BSS copy.',
    dueDate: '2026-01-10',
    status: Status.NOT_STARTED,
    priority: Priority.MEDIUM,
    updates: [],
    createdAt: new Date().toISOString()
  }
];

const INITIAL_LOGS: DailyLog[] = [
  { id: 'l1', date: '2026-01-08', taskId: '1', content: 'Updated slides to include positive news on AY4/5 and the proposed way forward.' }
];

const INITIAL_OBSERVATIONS: Observation[] = [];
const INITIAL_OFF_DAYS: string[] = [];

// Helper to get current CW
const getCurrentCW = (): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // Thursday in current week decides the year.
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  // Adjust to Thursday in week 1 and count number of weeks from date to week1.
  const weekNumber = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `CW${weekNumber.toString().padStart(2, '0')}`;
};

// Helper: Get formatted date strings for the current week (Mon-Sun)
const getWeekDays = (refDate: Date): string[] => {
  const d = new Date(refDate);
  const day = d.getDay(); // 0 Sun, 1 Mon ...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  const monday = new Date(d.setDate(diff));
  
  const week = [];
  for (let i = 0; i < 7; i++) {
    const wDay = new Date(monday);
    wDay.setDate(monday.getDate() + i);
    // Format YYYY-MM-DD locally
    const y = wDay.getFullYear();
    const m = String(wDay.getMonth() + 1).padStart(2, '0');
    const da = String(wDay.getDate()).padStart(2, '0');
    week.push(`${y}-${m}-${da}`);
  }
  return week;
};

// Helper: Get local ISO date string
const getLocalISODate = (d: Date) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDateDDMMYYYY = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
};

// --- LOGO COMPONENT ---
const Logo = () => (
  <div className="flex items-center gap-2 select-none">
    <div className="relative w-8 h-8 flex items-center justify-center">
       {/* Background Glow */}
       <div className="absolute inset-0 bg-cyan-400 rounded-full blur-md opacity-20"></div>
       {/* Icon */}
       <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9 relative z-10 drop-shadow-sm">
         <defs>
           <linearGradient id="iconGradient" x1="0" y1="0" x2="1" y2="1">
             <stop offset="0%" stopColor="#06b6d4" /> {/* Cyan 500 */}
             <stop offset="100%" stopColor="#3b82f6" /> {/* Blue 500 */}
           </linearGradient>
         </defs>
         <path d="M12 2C7.58 2 4 5.58 4 10C4 15 12 22 12 22C12 22 20 15 20 10C20 5.58 16.42 2 12 2Z" fill="url(#iconGradient)" />
         {/* Brain circuit lines */}
         <path d="M12 6V8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
         <path d="M12 14V16" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
         <path d="M9 11H8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
         <path d="M16 11H15" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
         <path d="M9.5 8.5L8.5 7.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
         <path d="M14.5 8.5L15.5 7.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
         <circle cx="12" cy="11" r="2.5" stroke="white" strokeWidth="1.5" />
       </svg>
    </div>
    <div className="flex items-baseline tracking-tight">
      <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-500 to-blue-600">Track</span>
      <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-lime-500 to-emerald-500">Pro</span>
    </div>
  </div>
);

const App: React.FC = () => {
  // --- STATE ---
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('protrack_tasks');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.map((t: any) => {
        if (t.status === 'Completed') return { ...t, status: 'Done' }; 
        if (t.status === 'On Hold') return { ...t, status: 'Waiting for others' };
        return t;
      });
    }
    return INITIAL_TASKS;
  });

  const [logs, setLogs] = useState<DailyLog[]>(() => {
    const saved = localStorage.getItem('protrack_logs');
    return saved ? JSON.parse(saved) : INITIAL_LOGS;
  });

  const [observations, setObservations] = useState<Observation[]>(() => {
    const saved = localStorage.getItem('protrack_observations');
    let parsed = saved ? JSON.parse(saved) : INITIAL_OBSERVATIONS;
    parsed = parsed.map((o: any) => ({
      ...o,
      status: o.status || ObservationStatus.NEW
    }));
    return parsed;
  });

  const [offDays, setOffDays] = useState<string[]>(() => {
    const saved = localStorage.getItem('protrack_off_days');
    return saved ? JSON.parse(saved) : INITIAL_OFF_DAYS;
  });

  const [currentView, setCurrentView] = useState<ViewMode>(ViewMode.DASHBOARD);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [journalTaskId, setJournalTaskId] = useState<string>(''); 
  
  // Modal State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [modalProjectId, setModalProjectId] = useState('');
  const [modalDisplayId, setModalDisplayId] = useState('');

  // UI State for groupings
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);
  const [isFutureExpanded, setIsFutureExpanded] = useState(false);

  // AI Summary State
  const [summary, setSummary] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync State
  const [isSyncEnabled, setIsSyncEnabled] = useState(false);

  // Time State
  const [now, setNow] = useState(new Date());

  // --- SYNC EFFECTS ---
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const savedConfig = localStorage.getItem('protrack_firebase_config');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig) as FirebaseConfig;
        initFirebase(config);
        setIsSyncEnabled(true);
        
        subscribeToData((remoteData) => {
          if (remoteData.tasks) {
            const migratedTasks = remoteData.tasks.map((t: any) => {
               if (t.status === 'Completed') return { ...t, status: 'Done' };
               if (t.status === 'On Hold') return { ...t, status: 'Waiting for others' };
               return t;
            });
            setTasks(migratedTasks);
            localStorage.setItem('protrack_tasks', JSON.stringify(migratedTasks));
          }
          if (remoteData.logs) {
            setLogs(remoteData.logs);
            localStorage.setItem('protrack_logs', JSON.stringify(remoteData.logs));
          }
          if (remoteData.observations) {
            const migratedObs = remoteData.observations.map((o: any) => ({
              ...o,
              status: o.status || ObservationStatus.NEW
            }));
            setObservations(migratedObs);
            localStorage.setItem('protrack_observations', JSON.stringify(migratedObs));
          }
          if (remoteData.offDays) {
            setOffDays(remoteData.offDays);
            localStorage.setItem('protrack_off_days', JSON.stringify(remoteData.offDays));
          }
        });
      } catch (error) {
        console.error("Auto-init Firebase failed:", error);
        setIsSyncEnabled(false);
      }
    }
  }, []);

  const persistData = useCallback((newTasks: Task[], newLogs: DailyLog[], newObs: Observation[], newOffDays: string[]) => {
    localStorage.setItem('protrack_tasks', JSON.stringify(newTasks));
    localStorage.setItem('protrack_logs', JSON.stringify(newLogs));
    localStorage.setItem('protrack_observations', JSON.stringify(newObs));
    localStorage.setItem('protrack_off_days', JSON.stringify(newOffDays));

    if (isSyncEnabled) {
      saveDataToCloud({
        tasks: newTasks,
        logs: newLogs,
        observations: newObs,
        offDays: newOffDays
      });
    }
  }, [isSyncEnabled]);

  const updateTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
    persistData(newTasks, logs, observations, offDays);
  };
  
  const updateLogs = (newLogs: DailyLog[]) => {
    setLogs(newLogs);
    persistData(tasks, newLogs, observations, offDays);
  };

  const updateObservations = (newObs: Observation[]) => {
    setObservations(newObs);
    persistData(tasks, logs, newObs, offDays);
  };

  const updateOffDays = (newOffDays: string[]) => {
    setOffDays(newOffDays);
    persistData(tasks, logs, observations, newOffDays);
  };

  const toggleOffDay = (date: string) => {
    const exists = offDays.includes(date);
    const newOffDays = exists 
      ? offDays.filter(d => d !== date)
      : [...offDays, date];
    updateOffDays(newOffDays);
  };

  const handleSyncConfigUpdate = (config: FirebaseConfig | null) => {
    if (config) {
      setIsSyncEnabled(true);
      subscribeToData((remoteData) => {
          if (remoteData.tasks) {
             const migratedTasks = remoteData.tasks.map((t: any) => {
               if (t.status === 'Completed') return { ...t, status: 'Done' };
               if (t.status === 'On Hold') return { ...t, status: 'Waiting for others' };
               return t;
            });
             setTasks(migratedTasks);
             localStorage.setItem('protrack_tasks', JSON.stringify(migratedTasks));
          }
          if (remoteData.logs) {
             setLogs(remoteData.logs);
             localStorage.setItem('protrack_logs', JSON.stringify(remoteData.logs));
          }
           if (remoteData.observations) {
            const migratedObs = remoteData.observations.map((o: any) => ({
              ...o,
              status: o.status || ObservationStatus.NEW
            }));
            setObservations(migratedObs);
            localStorage.setItem('protrack_observations', JSON.stringify(migratedObs));
          }
          if (remoteData.offDays) {
            setOffDays(remoteData.offDays);
            localStorage.setItem('protrack_off_days', JSON.stringify(remoteData.offDays));
          }
      });
      saveDataToCloud({ tasks, logs, observations, offDays });
    } else {
      setIsSyncEnabled(false);
      window.location.reload(); 
    }
  };

  // --- HELPER: ID Generation ---
  const generateNextDisplayId = (projectId: string) => {
    if (!projectId) return '';
    const cleanPid = projectId.trim().toUpperCase();
    const projectTasks = tasks.filter(t => t.projectId && t.projectId.toUpperCase() === cleanPid);
    if (projectTasks.length === 0) return `${cleanPid}-1`;
    let maxSeq = 0;
    const regex = new RegExp(`^${escapeRegExp(cleanPid)}-(\\d+)$`, 'i');
    projectTasks.forEach(t => {
      const match = t.displayId.match(regex);
      if (match) {
        const seq = parseInt(match[1], 10);
        if (seq > maxSeq) maxSeq = seq;
      }
    });
    return `${cleanPid}-${maxSeq + 1}`;
  };

  function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  const getPriorityColor = (p: Priority) => {
    switch (p) {
      case Priority.HIGH: return 'bg-red-100 text-red-800 border-red-200';
      case Priority.MEDIUM: return 'bg-amber-100 text-amber-800 border-amber-200';
      case Priority.LOW: return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  // --- ACTIONS ---
  const openTaskModal = (task?: Task) => {
    setEditingTask(task || null);
    setModalProjectId(task?.projectId || '');
    setModalDisplayId(task?.displayId || '');
    setIsTaskModalOpen(true);
  };

  const handleProjectIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setModalProjectId(newVal);
    if (!editingTask) {
       setModalDisplayId(generateNextDisplayId(newVal));
    }
  };

  const handleCreateOrUpdateTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const displayId = modalDisplayId || `T-${Math.floor(Math.random() * 1000)}`;
    const projectId = modalProjectId.toUpperCase();
    const newTask: Task = {
      id: editingTask ? editingTask.id : uuidv4(),
      displayId: displayId,
      source: (formData.get('source') as string) || getCurrentCW(),
      projectId: projectId,
      description: formData.get('description') as string,
      dueDate: formData.get('dueDate') as string,
      priority: formData.get('priority') as Priority,
      status: (formData.get('status') as Status) || Status.NOT_STARTED,
      updates: editingTask ? editingTask.updates : [],
      createdAt: editingTask ? editingTask.createdAt : new Date().toISOString(),
    };
    let updatedTasks = [];
    if (editingTask) {
      updatedTasks = tasks.map(t => t.id === editingTask.id ? newTask : t);
    } else {
      updatedTasks = [newTask, ...tasks];
    }
    updateTasks(updatedTasks);
    setIsTaskModalOpen(false);
    setEditingTask(null);
  };

  const updateTaskStatus = (id: string, status: Status) => {
    const updatedTasks = tasks.map(t => t.id === id ? { ...t, status } : t);
    updateTasks(updatedTasks);
  };

  const updateTaskFields = (id: string, fields: Partial<Task>) => {
    const updatedTasks = tasks.map(t => t.id === id ? { ...t, ...fields } : t);
    updateTasks(updatedTasks);
  };

  const addUpdateToTask = (taskId: string, content: string) => {
    const newUpdate = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      content
    };
    const newLog = {
      id: uuidv4(),
      date: new Date().toISOString().split('T')[0],
      taskId,
      content
    };
    const updatedTasks = tasks.map(t => 
      t.id === taskId ? { ...t, updates: [...t.updates, newUpdate] } : t
    );
    const updatedLogs = [...logs, newLog];
    setTasks(updatedTasks);
    setLogs(updatedLogs);
    persistData(updatedTasks, updatedLogs, observations, offDays);
  };

  const editTaskUpdate = (taskId: string, updateId: string, newContent: string, newTimestamp?: string) => {
    const updatedTasks = tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          updates: t.updates.map(u => {
            if (u.id === updateId) {
                return { ...u, content: newContent, timestamp: newTimestamp || u.timestamp };
            }
            return u;
          })
        };
      }
      return t;
    });
    updateTasks(updatedTasks);
  };

  const deleteTaskUpdate = (taskId: string, updateId: string) => {
    if (window.confirm('Delete this update?')) {
        const updatedTasks = tasks.map(t => {
            if (t.id === taskId) {
                return { ...t, updates: t.updates.filter(u => u.id !== updateId) };
            }
            return t;
        });
        updateTasks(updatedTasks);
    }
  };

  const addDailyLog = (logData: Omit<DailyLog, 'id'>) => {
    const newLog = { ...logData, id: uuidv4() };
    const updatedLogs = [...logs, newLog];
    const updateEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      content: `[Log Entry: ${logData.date}] ${logData.content}`
    };
    const updatedTasks = tasks.map(t => 
      t.id === logData.taskId ? { ...t, updates: [...t.updates, updateEntry] } : t
    );
    setTasks(updatedTasks);
    setLogs(updatedLogs);
    persistData(updatedTasks, updatedLogs, observations, offDays);
  };

  const addObservation = (obs: Observation) => {
    const updatedObs = [...observations, obs];
    updateObservations(updatedObs);
  };

  const editObservation = (updatedObs: Observation) => {
    const updatedObsList = observations.map(o => o.id === updatedObs.id ? updatedObs : o);
    updateObservations(updatedObsList);
  };

  const deleteObservation = (id: string) => {
    const updatedObs = observations.filter(o => o.id !== id);
    updateObservations(updatedObs);
  };

  const deleteTask = (id: string) => {
    if (window.confirm('Are you sure you want to permanently delete this task? Associated logs will also be removed.')) {
      const updatedTasks = tasks.filter(t => t.id !== id);
      const updatedLogs = logs.filter(l => l.taskId !== id);
      setTasks(updatedTasks);
      setLogs(updatedLogs);
      persistData(updatedTasks, updatedLogs, observations, offDays);
    }
  };

  const handleImportData = (data: { tasks: Task[]; logs: DailyLog[]; observations: Observation[] }) => {
    setTasks(data.tasks);
    setLogs(data.logs);
    const migratedObs = (data.observations || []).map((o: any) => ({
      ...o,
      status: o.status || ObservationStatus.NEW
    }));
    setObservations(migratedObs);
    persistData(data.tasks, data.logs, migratedObs, offDays);
    setCurrentView(ViewMode.DASHBOARD);
  };

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const result = await generateWeeklySummary(tasks, logs);
      setSummary(result);
    } catch (err: any) {
      setError(err.message || "Failed to generate summary.");
    } finally {
      setIsGenerating(false);
    }
  };

  // --- VIEW RENDERING ---
  const renderDashboard = () => {
    const todayStr = getLocalISODate(new Date());
    const overdueTasks = tasks.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED && t.dueDate < todayStr);
    const dueTodayTasks = tasks.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED && t.dueDate === todayStr);
    
    // Quick Counts
    const countNotStarted = tasks.filter(t => t.status === Status.NOT_STARTED).length;
    const countInProgress = tasks.filter(t => t.status === Status.IN_PROGRESS).length;
    const countWaiting = tasks.filter(t => t.status === Status.WAITING).length;
    const countDone = tasks.filter(t => t.status === Status.DONE).length;
    const countArchived = tasks.filter(t => t.status === Status.ARCHIVED).length;
    
    return (
      <div className="space-y-6 animate-fade-in pb-12">
        {/* Date/Time Header */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center">
           <div>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-800">
                {now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </h2>
              <div className="flex items-center gap-2 mt-2 text-slate-500">
                 <Clock size={20} className="text-indigo-600" />
                 <span className="text-xl font-medium font-mono">{now.toLocaleTimeString()}</span>
              </div>
           </div>
           <div className="mt-4 md:mt-0 px-4 py-2 bg-slate-50 rounded-lg border border-slate-100 hidden md:block">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Week</div>
              <div className="text-xl font-bold text-slate-700">{getCurrentCW()}</div>
           </div>
        </div>

        {/* Dashboard Grid */}
         <div className="grid grid-cols-1 gap-6">
           <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-indigo-200">
             <div className="flex justify-between items-center mb-3">
               <h3 className="font-semibold text-indigo-100 text-sm">Task Overview</h3>
               <ListTodo className="opacity-50" size={20} />
             </div>
             <div className="grid grid-cols-5 gap-2">
                 <div className="bg-white/10 rounded p-2 backdrop-blur-sm flex flex-col justify-between"><span className="text-[10px] text-indigo-200 uppercase truncate">Not Started</span><span className="text-xl font-bold">{countNotStarted}</span></div>
                 <div className="bg-white/10 rounded p-2 backdrop-blur-sm flex flex-col justify-between"><span className="text-[10px] text-indigo-200 uppercase truncate">In Progress</span><span className="text-xl font-bold">{countInProgress}</span></div>
                 <div className="bg-white/10 rounded p-2 backdrop-blur-sm flex flex-col justify-between"><span className="text-[10px] text-indigo-200 uppercase truncate">Waiting</span><span className="text-xl font-bold">{countWaiting}</span></div>
                 <div className="bg-white/10 rounded p-2 backdrop-blur-sm flex flex-col justify-between"><span className="text-[10px] text-indigo-200 uppercase truncate">Done</span><span className="text-xl font-bold">{countDone}</span></div>
                 <div className="bg-white/10 rounded p-2 backdrop-blur-sm flex flex-col justify-between"><span className="text-[10px] text-indigo-200 uppercase truncate">Archived</span><span className="text-xl font-bold">{countArchived}</span></div>
             </div>
           </div>
         </div>

         {/* Urgent Items */}
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             {overdueTasks.length > 0 && (
               <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
                 <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={18} className="text-red-600"/>
                        <h3 className="font-bold text-red-900">Attention Needed: Overdue</h3>
                    </div>
                    <span className="bg-red-200 text-red-800 text-xs font-bold px-2 py-1 rounded-full">{overdueTasks.length}</span>
                 </div>
                 <div className="divide-y divide-red-50">
                     {overdueTasks.map(t => (
                         <div key={t.id} className="p-4 flex justify-between items-start cursor-pointer hover:bg-red-50/50 transition-colors" onClick={() => { setJournalTaskId(t.id); setCurrentView(ViewMode.TASKS); }}>
                             <div className="flex flex-col gap-2 w-full">
                                 {/* Properties Row */}
                                 <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <span className="font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{t.source}</span>
                                    <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">{t.displayId}</span>
                                    <span className="font-bold text-red-600 flex items-center gap-1 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                                       <CalendarDays size={10}/> {formatDateDDMMYYYY(t.dueDate)}
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-bold ${getPriorityColor(t.priority)}`}>{t.priority}</span>
                                    <span className="text-slate-500 font-medium">({t.status})</span>
                                 </div>
                                 {/* Full Description */}
                                 <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                                    {t.description}
                                 </p>
                             </div>
                             <ArrowRight size={16} className="text-red-300 mt-1 flex-shrink-0 ml-4"/>
                         </div>
                     ))}
                 </div>
               </div>
             )}
              {dueTodayTasks.length > 0 && (
               <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
                 <div className="bg-amber-50 px-6 py-4 border-b border-amber-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CalendarDays size={18} className="text-amber-600"/>
                        <h3 className="font-bold text-amber-900">Due Today</h3>
                    </div>
                    <span className="bg-amber-200 text-amber-800 text-xs font-bold px-2 py-1 rounded-full">{dueTodayTasks.length}</span>
                 </div>
                  <div className="divide-y divide-amber-50">
                     {dueTodayTasks.map(t => (
                         <div key={t.id} className="p-4 flex justify-between items-start cursor-pointer hover:bg-amber-50/50 transition-colors" onClick={() => { setJournalTaskId(t.id); setCurrentView(ViewMode.TASKS); }}>
                             <div className="flex flex-col gap-2 w-full">
                                 {/* Properties Row */}
                                 <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <span className="font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{t.source}</span>
                                    <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">{t.displayId}</span>
                                    <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-bold ${getPriorityColor(t.priority)}`}>{t.priority}</span>
                                    <span className="text-slate-500 font-medium">({t.status})</span>
                                 </div>
                                 {/* Description */}
                                 <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                                     {t.description}
                                 </p>
                             </div>
                             <ArrowRight size={16} className="text-amber-300 mt-1 flex-shrink-0 ml-4"/>
                         </div>
                     ))}
                 </div>
               </div>
             )}
         </div>
      </div>
    );
  };

  const renderTasksAndJournal = () => {
    // 1. Calculate Date Ranges
    const todayDateObj = new Date();
    const todayISO = getLocalISODate(todayDateObj);
    const currentWeekDays = getWeekDays(todayDateObj); // ['2026-01-05', '2026-01-06'...] Mon-Sun

    // 2. Filter Tasks
    // Filter active (not done/archived) tasks first for the board
    const activeTasks = tasks.filter(t => {
      // Apply search filter if exists
      if (searchTerm) {
          const term = searchTerm.toLowerCase();
          return t.description.toLowerCase().includes(term) || t.displayId.toLowerCase().includes(term) || t.source.toLowerCase().includes(term);
      }
      return true;
    });

    const pendingTasks = activeTasks.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED);
    const completedTasks = activeTasks.filter(t => t.status === Status.DONE || t.status === Status.ARCHIVED);

    // 3. Group Pending Tasks
    // Overdue: Due date < today
    const overdue = pendingTasks.filter(t => t.dueDate && t.dueDate < todayISO);
    
    // Future: Due date > end of current week
    const endOfWeekISO = currentWeekDays[6];
    const future = pendingTasks.filter(t => t.dueDate && t.dueDate > endOfWeekISO);
    
    // No Date
    const noDate = pendingTasks.filter(t => !t.dueDate);

    return (
    <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Left Column: Daily Journal - Adjusted to 1/4 width */}
      <div className="lg:col-span-1 lg:sticky lg:top-8 h-fit space-y-4">
         <DailyJournal 
            tasks={tasks} 
            logs={logs} 
            onAddLog={addDailyLog} 
            onUpdateTask={updateTaskFields}
            initialTaskId={journalTaskId}
            offDays={offDays}
            onToggleOffDay={toggleOffDay}
         />
      </div>

      {/* Right Column: Task Board - Adjusted to 3/4 width */}
      <div className="lg:col-span-3 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-bold text-slate-800">Task Board</h2>
          <button 
            onClick={() => openTaskModal()}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus size={18} />
            New Task
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search tasks..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="space-y-8">
            
            {/* 1. Overdue Section (Prominent) */}
            {overdue.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-red-600 border-b border-red-100 pb-2">
                        <AlertTriangle size={18} />
                        <h3 className="font-bold text-sm uppercase tracking-wide">Overdue Items</h3>
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold">{overdue.length}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                        {overdue.map(task => (
                            <TaskCard 
                                key={task.id} 
                                task={task} 
                                onUpdateStatus={updateTaskStatus}
                                onEdit={(t) => openTaskModal(t)}
                                onDelete={deleteTask}
                                onAddUpdate={addUpdateToTask}
                                onEditUpdate={editTaskUpdate}
                                onDeleteUpdate={deleteTaskUpdate}
                                onUpdateTask={updateTaskFields}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* 2. Current Week Distribution (Mon - Sun) */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-700 border-b border-slate-200 pb-2">
                    <CalendarDays size={18} className="text-indigo-600" />
                    <h3 className="font-bold text-sm uppercase tracking-wide">This Week</h3>
                </div>
                
                {/* Responsive Grid for Days - Updated for 3-col width */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {currentWeekDays.map((dayISO) => {
                        // Find tasks for this day
                        const dayTasks = pendingTasks.filter(t => t.dueDate === dayISO);
                        const [y, m, d] = dayISO.split('-').map(Number);
                        const dateObj = new Date(y, m - 1, d);
                        const isToday = dayISO === todayISO;
                        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                        const dateDisplay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

                        return (
                            <div 
                                key={dayISO} 
                                className={`flex flex-col gap-3 p-3 rounded-xl border transition-colors min-h-[150px] ${
                                    isToday 
                                    ? 'bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-100' 
                                    : isWeekend 
                                        ? 'bg-slate-50/50 border-slate-200/60' 
                                        : 'bg-white border-slate-200'
                                }`}
                            >
                                <div className="flex justify-between items-center border-b border-black/5 pb-2 mb-1">
                                    <div className="flex flex-col">
                                        <span className={`text-xs font-bold uppercase ${isToday ? 'text-indigo-700' : 'text-slate-500'}`}>
                                            {dayName}
                                        </span>
                                        <span className={`text-xs ${isToday ? 'font-bold text-indigo-900' : 'text-slate-400'}`}>
                                            {dateDisplay}
                                        </span>
                                    </div>
                                    {isToday && <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold">TODAY</span>}
                                    <span className="text-xs font-mono text-slate-300">{dayTasks.length}</span>
                                </div>

                                {/* Tasks List for the Day */}
                                <div className="flex flex-col gap-2 flex-1">
                                    {dayTasks.length === 0 ? (
                                        <div className="flex-1 flex items-center justify-center text-slate-300 text-xs italic py-4">
                                            No tasks due
                                        </div>
                                    ) : (
                                        dayTasks.map(task => (
                                            <div key={task.id} className="w-full"> 
                                                <TaskCard 
                                                    task={task} 
                                                    onUpdateStatus={updateTaskStatus}
                                                    onEdit={(t) => openTaskModal(t)}
                                                    onDelete={deleteTask}
                                                    onAddUpdate={addUpdateToTask}
                                                    onEditUpdate={editTaskUpdate}
                                                    onDeleteUpdate={deleteTaskUpdate}
                                                    onUpdateTask={updateTaskFields}
                                                    isReadOnly={false} 
                                                />
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 3. Future / No Date / Completed (Collapsible) */}
            <div className="pt-4 space-y-4">
                {/* Future & No Date */}
                {(future.length > 0 || noDate.length > 0) && (
                    <div className="border rounded-xl border-slate-200 bg-slate-50 overflow-hidden">
                        <button 
                            onClick={() => setIsFutureExpanded(!isFutureExpanded)}
                            className="w-full flex items-center justify-between p-4 text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            <div className="flex items-center gap-2 font-bold text-sm">
                                <Clock size={16} />
                                <span>Upcoming & Unscheduled</span>
                                <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs">{future.length + noDate.length}</span>
                            </div>
                            {isFutureExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>
                        
                        {isFutureExpanded && (
                            <div className="p-4 border-t border-slate-200 grid grid-cols-1 gap-3">
                                {[...noDate, ...future].map(task => (
                                    <TaskCard 
                                        key={task.id} 
                                        task={task} 
                                        onUpdateStatus={updateTaskStatus}
                                        onEdit={(t) => openTaskModal(t)}
                                        onDelete={deleteTask}
                                        onAddUpdate={addUpdateToTask}
                                        onEditUpdate={editTaskUpdate}
                                        onDeleteUpdate={deleteTaskUpdate}
                                        onUpdateTask={updateTaskFields}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                 {/* Completed */}
                 {completedTasks.length > 0 && (
                    <div className="border rounded-xl border-slate-200 bg-slate-50 overflow-hidden">
                        <button 
                            onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
                            className="w-full flex items-center justify-between p-4 text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            <div className="flex items-center gap-2 font-bold text-sm">
                                <Archive size={16} />
                                <span>Completed & Archived</span>
                                <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs">{completedTasks.length}</span>
                            </div>
                            {isCompletedExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>
                        
                        {isCompletedExpanded && (
                            <div className="p-4 border-t border-slate-200 grid grid-cols-1 gap-3">
                                {completedTasks.map(task => (
                                    <TaskCard 
                                        key={task.id} 
                                        task={task} 
                                        onUpdateStatus={updateTaskStatus}
                                        onEdit={(t) => openTaskModal(t)}
                                        onDelete={deleteTask}
                                        onAddUpdate={addUpdateToTask}
                                        onEditUpdate={editTaskUpdate}
                                        onDeleteUpdate={deleteTaskUpdate}
                                        onUpdateTask={updateTaskFields}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  )};

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden">
      
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-white border-r border-slate-200 shadow-sm z-20 transition-all">
        <div className="p-6 border-b border-slate-100 flex flex-col gap-2">
           <Logo />
           <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase pl-1">Project OS v16</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
           <button 
             onClick={() => setCurrentView(ViewMode.DASHBOARD)}
             className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${currentView === ViewMode.DASHBOARD ? 'bg-indigo-50 text-indigo-700 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium'}`}
           >
              <LayoutDashboard size={20} className={currentView === ViewMode.DASHBOARD ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'} />
              Dashboard
           </button>
           <button 
             onClick={() => setCurrentView(ViewMode.TASKS)}
             className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${currentView === ViewMode.TASKS || currentView === ViewMode.JOURNAL ? 'bg-indigo-50 text-indigo-700 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium'}`}
           >
              <ListTodo size={20} className={currentView === ViewMode.TASKS ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'} />
              Task Board
           </button>
           <button 
             onClick={() => setCurrentView(ViewMode.OBSERVATIONS)}
             className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${currentView === ViewMode.OBSERVATIONS ? 'bg-indigo-50 text-indigo-700 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium'}`}
           >
              <StickyNote size={20} className={currentView === ViewMode.OBSERVATIONS ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'} />
              Observations
           </button>
           
           <div className="pt-4 mt-4 border-t border-slate-100">
             <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">System</p>
             <button 
              onClick={handleGenerateSummary}
              disabled={isGenerating}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-purple-50 hover:text-purple-700 font-medium transition-all group"
             >
                <Sparkles size={20} className={isGenerating ? 'animate-spin text-purple-500' : 'text-purple-500'} />
                {isGenerating ? 'Analyzing...' : 'Generate Report'}
             </button>
             <button 
               onClick={() => setCurrentView(ViewMode.SETTINGS)}
               className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${currentView === ViewMode.SETTINGS ? 'bg-indigo-50 text-indigo-700 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium'}`}
             >
                <SettingsIcon size={20} className={currentView === ViewMode.SETTINGS ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'} />
                Settings
             </button>
              <button 
               onClick={() => setCurrentView(ViewMode.HELP)}
               className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${currentView === ViewMode.HELP ? 'bg-indigo-50 text-indigo-700 font-bold shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium'}`}
             >
                <BookOpen size={20} className={currentView === ViewMode.HELP ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'} />
                User Guide
             </button>
           </div>
        </nav>

        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
           <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${isSyncEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
              <span className="text-xs font-medium text-slate-500">
                Sync Status: <span className={isSyncEnabled ? 'text-emerald-600 font-bold' : 'text-slate-600'}>{isSyncEnabled ? 'Live' : 'Offline'}</span>
              </span>
           </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden absolute top-0 left-0 right-0 bg-white border-b border-slate-200 p-4 z-30 flex items-center justify-between">
         <div className="scale-90 origin-left">
            <Logo />
         </div>
         <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-600 bg-slate-100 rounded-lg">
           {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
         </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute inset-0 bg-white z-20 pt-20 px-6 animate-fade-in flex flex-col gap-2">
           <button onClick={() => { setCurrentView(ViewMode.DASHBOARD); setIsMobileMenuOpen(false); }} className="p-4 bg-slate-50 rounded-xl font-bold text-slate-700 flex items-center gap-3"><LayoutDashboard/> Dashboard</button>
           <button onClick={() => { setCurrentView(ViewMode.TASKS); setIsMobileMenuOpen(false); }} className="p-4 bg-slate-50 rounded-xl font-bold text-slate-700 flex items-center gap-3"><ListTodo/> Task Board</button>
           <button onClick={() => { setCurrentView(ViewMode.OBSERVATIONS); setIsMobileMenuOpen(false); }} className="p-4 bg-slate-50 rounded-xl font-bold text-slate-700 flex items-center gap-3"><StickyNote/> Observations</button>
           <button onClick={() => { handleGenerateSummary(); setIsMobileMenuOpen(false); }} className="p-4 bg-purple-50 rounded-xl font-bold text-purple-700 flex items-center gap-3"><Sparkles/> AI Report</button>
           <button onClick={() => { setCurrentView(ViewMode.SETTINGS); setIsMobileMenuOpen(false); }} className="p-4 bg-slate-50 rounded-xl font-bold text-slate-700 flex items-center gap-3"><SettingsIcon/> Settings</button>
           <button onClick={() => { setCurrentView(ViewMode.HELP); setIsMobileMenuOpen(false); }} className="p-4 bg-slate-50 rounded-xl font-bold text-slate-700 flex items-center gap-3"><BookOpen/> Guide</button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col relative pt-16 md:pt-0">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth custom-scrollbar">
           {currentView === ViewMode.DASHBOARD && renderDashboard()}
           {(currentView === ViewMode.TASKS || currentView === ViewMode.JOURNAL) && renderTasksAndJournal()}
           {currentView === ViewMode.OBSERVATIONS && (
             <ObservationsLog 
               observations={observations}
               onAddObservation={addObservation}
               onEditObservation={editObservation}
               onDeleteObservation={deleteObservation}
             />
           )}
           {currentView === ViewMode.SETTINGS && (
             <Settings 
                tasks={tasks} 
                logs={logs} 
                observations={observations} 
                onImportData={handleImportData} 
                onSyncConfigUpdate={handleSyncConfigUpdate}
                isSyncEnabled={isSyncEnabled}
             />
           )}
           {currentView === ViewMode.HELP && <UserManual />}
        </div>
      </main>

      {/* Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                 <h3 className="font-bold text-lg text-slate-800">
                    {editingTask ? 'Edit Task' : 'Create New Task'}
                 </h3>
                 <button onClick={() => setIsTaskModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={20} />
                 </button>
              </div>
              <form onSubmit={handleCreateOrUpdateTask} className="p-6 overflow-y-auto custom-scrollbar space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Source ID</label>
                       <input 
                         name="source" 
                         defaultValue={editingTask?.source || getCurrentCW()} 
                         className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                         required
                       />
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project ID</label>
                       <input 
                         name="projectId" 
                         value={modalProjectId} 
                         onChange={handleProjectIdChange}
                         placeholder="PROJ-X"
                         className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                         required
                       />
                    </div>
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Display ID (Auto)</label>
                    <input 
                      name="displayId" 
                      value={modalDisplayId}
                      readOnly
                      className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm font-mono text-slate-500 cursor-not-allowed"
                    />
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                    <textarea 
                      name="description" 
                      defaultValue={editingTask?.description} 
                      placeholder="What needs to be done?"
                      className="w-full p-3 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                      required
                    />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date</label>
                       <input 
                         type="date"
                         name="dueDate" 
                         defaultValue={editingTask?.dueDate || new Date().toISOString().split('T')[0]} 
                         className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                         required
                       />
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Priority</label>
                       <select 
                         name="priority" 
                         defaultValue={editingTask?.priority || Priority.MEDIUM}
                         className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                       >
                         {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                       </select>
                    </div>
                 </div>

                 <div className="pt-4 flex gap-3">
                    <button type="button" onClick={() => setIsTaskModalOpen(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-50">Cancel</button>
                    <button type="submit" className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 shadow-lg shadow-indigo-200">
                       {editingTask ? 'Save Changes' : 'Create Task'}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* AI Summary Modal */}
      {(summary || error) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-purple-50">
                 <div className="flex items-center gap-2 text-purple-800">
                    <Sparkles size={20} />
                    <h3 className="font-bold text-lg">Weekly Intelligence Report</h3>
                 </div>
                 <button onClick={() => { setSummary(''); setError(null); }} className="text-slate-400 hover:text-slate-600">
                    <X size={20} />
                 </button>
              </div>
              <div className="p-8 overflow-y-auto custom-scrollbar">
                 {error ? (
                   <div className="text-center py-8">
                      <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 mb-2">Generation Failed</h3>
                      <p className="text-slate-600 mb-6">{error}</p>
                      <button onClick={() => { setSummary(''); setError(null); }} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium">Close</button>
                   </div>
                 ) : (
                   <div className="prose prose-slate prose-sm max-w-none">
                     <div className="whitespace-pre-wrap font-medium text-slate-700 leading-relaxed">
                       {summary}
                     </div>
                   </div>
                 )}
              </div>
              {!error && (
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                   <button onClick={() => { navigator.clipboard.writeText(summary); alert('Copied to clipboard!'); }} className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-white text-slate-700">
                      <Copy size={16} /> Copy Text
                   </button>
                   <button onClick={() => { setSummary(''); }} className="px-6 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 shadow-md">
                      Done
                   </button>
                </div>
              )}
           </div>
        </div>
      )}

    </div>
  );
}

export default App;