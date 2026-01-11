import React, { useState, useEffect, useCallback } from 'react';
import { Task, DailyLog, ViewMode, Status, Priority, Observation, ObservationStatus, FirebaseConfig } from './types';
import TaskCard from './components/TaskCard';
import DailyJournal from './components/DailyJournal';
import UserManual from './components/UserManual';
import ObservationsLog from './components/ObservationsLog';
import Settings from './components/Settings';
import AIChat from './components/AIChat';
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
  Copy,
  CheckCircle2,
  Circle
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
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNumber = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `CW${weekNumber.toString().padStart(2, '0')}`;
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
       <div className="absolute inset-0 bg-cyan-400 rounded-full blur-md opacity-20"></div>
       <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9 relative z-10 drop-shadow-sm">
         <defs>
           <linearGradient id="iconGradient" x1="0" y1="0" x2="1" y2="1">
             <stop offset="0%" stopColor="#06b6d4" />
             <stop offset="100%" stopColor="#3b82f6" />
           </linearGradient>
         </defs>
         <path d="M12 2C7.58 2 4 5.58 4 10C4 15 12 22 12 22C12 22 20 15 20 10C20 5.58 16.42 2 12 2Z" fill="url(#iconGradient)" />
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

  const filteredTasks = tasks
    .filter(t => t.status !== Status.ARCHIVED)
    .filter(t => 
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.displayId.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
        const prioScore = { [Priority.HIGH]: 3, [Priority.MEDIUM]: 2, [Priority.LOW]: 1 };
        if (prioScore[a.priority] !== prioScore[b.priority]) return prioScore[b.priority] - prioScore[a.priority];
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

  const renderTasksAndJournal = () => {
    return (
      <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-4 gap-8 pb-12">
        {/* Left Column: Daily Journal */}
        <div className="lg:col-span-1 space-y-4">
           <div className="lg:sticky lg:top-0">
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
        </div>

        {/* Right Column: Task Board */}
        <div className="lg:col-span-3 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
               <div>
                  <h1 className="text-2xl font-bold text-slate-900">Task Board</h1>
                  <p className="text-sm text-slate-500">Manage your projects and priorities.</p>
               </div>
               <div className="flex items-center gap-2 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                     <input 
                        type="text" 
                        placeholder="Search tasks..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                     />
                  </div>
                  <button 
                    onClick={() => openTaskModal()}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-lg shadow-indigo-200 whitespace-nowrap"
                  >
                    <Plus size={18} /> <span className="hidden sm:inline">New Task</span>
                  </button>
               </div>
            </div>

            {/* Task List */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
               {filteredTasks.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                     <ListTodo size={48} className="mx-auto mb-4 opacity-20" />
                     <p>No active tasks found.</p>
                  </div>
               ) : (
                  filteredTasks.map(task => (
                     <TaskCard 
                        key={task.id} 
                        task={task} 
                        onUpdateStatus={updateTaskStatus}
                        onEdit={openTaskModal}
                        onDelete={deleteTask}
                        onAddUpdate={addUpdateToTask}
                        onEditUpdate={editTaskUpdate}
                        onDeleteUpdate={deleteTaskUpdate}
                        onUpdateTask={updateTaskFields}
                     />
                  ))
               )}
            </div>
            
            {/* Completed / Archived Toggle */}
            <div className="pt-8 border-t border-slate-200">
               <button 
                 onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
                 className="flex items-center gap-2 text-slate-500 font-bold text-sm hover:text-indigo-600 transition-colors"
               >
                  {isCompletedExpanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                  Show Archived Tasks
               </button>
               {isCompletedExpanded && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4 opacity-75">
                     {tasks.filter(t => t.status === Status.ARCHIVED || t.status === Status.DONE).map(task => (
                         <TaskCard 
                            key={task.id} 
                            task={task} 
                            onUpdateStatus={updateTaskStatus}
                            onEdit={openTaskModal}
                            onDelete={deleteTask}
                            onAddUpdate={addUpdateToTask}
                            isReadOnly={true}
                         />
                     ))}
                  </div>
               )}
            </div>
        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    const todayStr = getLocalISODate(new Date());
    const overdueTasks = tasks.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED && t.dueDate < todayStr);
    const dueTodayTasks = tasks.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED && t.dueDate === todayStr);
    
    const countNotStarted = tasks.filter(t => t.status === Status.NOT_STARTED).length;
    const countInProgress = tasks.filter(t => t.status === Status.IN_PROGRESS).length;
    const countWaiting = tasks.filter(t => t.status === Status.WAITING).length;
    const countDone = tasks.filter(t => t.status === Status.DONE).length;
    const countArchived = tasks.filter(t => t.status === Status.ARCHIVED).length;
    
    const obsNew = observations.filter(o => o.status === ObservationStatus.NEW).length;
    const obsWip = observations.filter(o => o.status === ObservationStatus.REVIEWING).length;
    const obsResolved = observations.filter(o => o.status === ObservationStatus.RESOLVED).length;

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

        {/* Dashboard Grid - Stats */}
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           {/* Task Overview */}
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

           {/* Observations Overview */}
           <div className="bg-gradient-to-br from-fuchsia-600 to-purple-600 rounded-2xl p-5 text-white shadow-lg shadow-purple-200">
             <div className="flex justify-between items-center mb-3">
               <h3 className="font-semibold text-purple-100 text-sm">Observations Tracker</h3>
               <StickyNote className="opacity-50" size={20} />
             </div>
             <div className="flex justify-between gap-2 text-center h-full max-h-[60px]">
                 <div className="bg-white/10 rounded p-2 backdrop-blur-sm flex-1 flex flex-col justify-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                        <Circle size={10} className="text-white fill-white"/>
                        <span className="text-[10px] text-purple-200 uppercase">New</span>
                    </div>
                    <span className="text-xl font-bold leading-none">{obsNew}</span>
                 </div>
                 <div className="bg-white/10 rounded p-2 backdrop-blur-sm flex-1 flex flex-col justify-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                        <Clock size={10} className="text-white"/>
                        <span className="text-[10px] text-purple-200 uppercase">WIP</span>
                    </div>
                    <span className="text-xl font-bold leading-none">{obsWip}</span>
                 </div>
                 <div className="bg-white/10 rounded p-2 backdrop-blur-sm flex-1 flex flex-col justify-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                        <CheckCircle2 size={10} className="text-white"/>
                        <span className="text-[10px] text-purple-200 uppercase">Resolved</span>
                    </div>
                    <span className="text-xl font-bold leading-none">{obsResolved}</span>
                 </div>
             </div>
           </div>
         </div>

         {/* Weekly Summary Section */}
         <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
                <Sparkles size={100} className="text-indigo-500" />
            </div>
            <div className="flex justify-between items-center mb-4 relative z-10">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                   <Sparkles className="text-indigo-500" size={20} />
                   AI Weekly Report
                </h3>
                <button 
                  onClick={handleGenerateSummary}
                  disabled={isGenerating}
                  className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-800 disabled:opacity-50 transition-colors"
                >
                   {isGenerating ? 'Thinking...' : 'Generate Report'}
                </button>
            </div>
            
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg mb-4 border border-red-100 flex items-center gap-2">
                 <AlertTriangle size={16} /> {error}
              </div>
            )}

            {summary ? (
               <div className="prose prose-sm max-w-none text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <pre className="whitespace-pre-wrap font-sans">{summary}</pre>
               </div>
            ) : (
               <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                  Click generate to analyze this week's logs and tasks.
               </div>
            )}
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

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
       {/* Mobile Menu Overlay */}
       {isMobileMenuOpen && (
         <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
       )}

       {/* Sidebar */}
       <aside className={`fixed md:sticky top-0 h-screen w-64 bg-slate-900 text-slate-300 z-50 transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} flex flex-col`}>
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
             <Logo />
             <button className="md:hidden text-slate-400" onClick={() => setIsMobileMenuOpen(false)}><X size={20} /></button>
          </div>
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
             {[
               { mode: ViewMode.DASHBOARD, icon: LayoutDashboard, label: 'Dashboard' },
               { mode: ViewMode.TASKS, icon: ListTodo, label: 'Task Board' },
               { mode: ViewMode.OBSERVATIONS, icon: StickyNote, label: 'Observations' },
             ].map(item => (
                <button
                  key={item.mode}
                  onClick={() => { setCurrentView(item.mode); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === item.mode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50 font-medium' : 'hover:bg-slate-800 hover:text-white'}`}
                >
                  <item.icon size={20} />
                  {item.label}
                </button>
             ))}
             
             <div className="pt-4 mt-4 border-t border-slate-800">
               <button
                  onClick={() => { setCurrentView(ViewMode.SETTINGS); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === ViewMode.SETTINGS ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50 font-medium' : 'hover:bg-slate-800 hover:text-white'}`}
               >
                  <SettingsIcon size={20} />
                  Settings
               </button>
                <button
                  onClick={() => { setCurrentView(ViewMode.HELP); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === ViewMode.HELP ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50 font-medium' : 'hover:bg-slate-800 hover:text-white'}`}
               >
                  <BookOpen size={20} />
                  Guide
               </button>
             </div>
          </nav>
       </aside>

       {/* Main Area */}
       <main className="flex-1 flex flex-col min-w-0 h-screen">
          {/* Mobile Header */}
          <div className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-30">
             <Logo />
             <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 bg-slate-100 rounded-lg text-slate-600"><Menu size={20}/></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative">
             {currentView === ViewMode.DASHBOARD && renderDashboard()}
             
             {currentView === ViewMode.TASKS && renderTasksAndJournal()}

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

       {/* Task Modal Overlay */}
       {isTaskModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">
                {editingTask ? 'Edit Task' : 'New Task'}
              </h2>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateOrUpdateTask} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project ID</label>
                  <input 
                    name="projectId" 
                    value={modalProjectId} 
                    onChange={handleProjectIdChange}
                    placeholder="e.g. PROJ-A" 
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase font-mono text-sm"
                    required
                  />
                </div>
                 <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Source (CW)</label>
                  <input 
                    name="source" 
                    defaultValue={editingTask?.source || getCurrentCW()}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                  />
                </div>
              </div>

               <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 flex justify-between items-center">
                 <span className="text-xs font-bold text-indigo-800 uppercase">Assigned ID</span>
                 <span className="font-mono font-bold text-indigo-600 text-lg">{modalDisplayId || '---'}</span>
               </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                <textarea 
                  name="description" 
                  defaultValue={editingTask?.description}
                  rows={3} 
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date</label>
                  <input 
                    type="date" 
                    name="dueDate" 
                    defaultValue={editingTask?.dueDate}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Priority</label>
                  <select 
                    name="priority" 
                    defaultValue={editingTask?.priority || Priority.MEDIUM}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

               {editingTask && (
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                    <select 
                      name="status" 
                      defaultValue={editingTask.status}
                      className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    >
                      {Object.values(Status).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                 </div>
               )}

              <div className="pt-4 flex gap-3">
                 <button 
                   type="button" 
                   onClick={() => setIsTaskModalOpen(false)}
                   className="flex-1 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                 >
                   Cancel
                 </button>
                 <button 
                   type="submit" 
                   className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors shadow-lg shadow-indigo-200"
                 >
                   {editingTask ? 'Save Changes' : 'Create Task'}
                 </button>
              </div>
            </form>
          </div>
        </div>
       )}

       {/* AI Chat Overlay */}
       <AIChat tasks={tasks} logs={logs} onOpenSettings={() => setCurrentView(ViewMode.SETTINGS)} />
    </div>
  );
};

export default App;