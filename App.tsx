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
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  StickyNote,
  Settings as SettingsIcon,
  ExternalLink,
  CalendarDays,
  Activity,
  BarChart3,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Archive,
  Copy,
  RefreshCw
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

function App() {
  // --- STATE ---
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('protrack_tasks');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Data Migration for Status changes
      return parsed.map((t: any) => {
        if (t.status === 'Completed') return { ...t, status: 'Done' }; // Legacy migration
        if (t.status === 'On Hold') return { ...t, status: 'Waiting for others' }; // Legacy migration
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
    // Migration: Ensure all observations have a status
    parsed = parsed.map((o: any) => ({
      ...o,
      status: o.status || ObservationStatus.NEW
    }));
    return parsed;
  });

  const [currentView, setCurrentView] = useState<ViewMode>(ViewMode.DASHBOARD);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [journalTaskId, setJournalTaskId] = useState<string>(''); // For deep linking to journal
  
  // Modal State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  // Controlled inputs for Modal to support auto-ID generation
  const [modalProjectId, setModalProjectId] = useState('');
  const [modalDisplayId, setModalDisplayId] = useState('');

  // UI State for groupings
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);

  // AI Summary State
  const [summary, setSummary] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync State
  const [isSyncEnabled, setIsSyncEnabled] = useState(false);

  // Time State
  const [now, setNow] = useState(new Date());

  // --- SYNC EFFECTS ---
  
  // Clock Timer
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. Initialize Firebase on Boot
  useEffect(() => {
    const savedConfig = localStorage.getItem('protrack_firebase_config');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig) as FirebaseConfig;
        initFirebase(config);
        setIsSyncEnabled(true);
        
        // Start Listening
        subscribeToData((remoteData) => {
          if (remoteData.tasks) {
            // Apply migration on incoming remote data as well
            const migratedTasks = remoteData.tasks.map((t: any) => {
               if (t.status === 'Completed') return { ...t, status: 'Done' };
               if (t.status === 'On Hold') return { ...t, status: 'Waiting for others' };
               return t;
            });
            setTasks(migratedTasks);
            // CRITICAL FIX: Persist incoming cloud data to LocalStorage immediately
            localStorage.setItem('protrack_tasks', JSON.stringify(migratedTasks));
          }
          if (remoteData.logs) {
            setLogs(remoteData.logs);
            localStorage.setItem('protrack_logs', JSON.stringify(remoteData.logs));
          }
          if (remoteData.observations) {
            // Apply migration on incoming remote data as well if needed
            const migratedObs = remoteData.observations.map((o: any) => ({
              ...o,
              status: o.status || ObservationStatus.NEW
            }));
            setObservations(migratedObs);
            localStorage.setItem('protrack_observations', JSON.stringify(migratedObs));
          }
        });
      } catch (error) {
        console.error("Auto-init Firebase failed:", error);
        setIsSyncEnabled(false);
      }
    }
  }, []);

  // 2. Persist to Local Storage & Cloud (if enabled)
  const persistData = useCallback((newTasks: Task[], newLogs: DailyLog[], newObs: Observation[]) => {
    // Save to Local Storage
    localStorage.setItem('protrack_tasks', JSON.stringify(newTasks));
    localStorage.setItem('protrack_logs', JSON.stringify(newLogs));
    localStorage.setItem('protrack_observations', JSON.stringify(newObs));

    // Save to Cloud if Sync is enabled
    if (isSyncEnabled) {
      saveDataToCloud({
        tasks: newTasks,
        logs: newLogs,
        observations: newObs
      });
    }
  }, [isSyncEnabled]);

  // Wrapper to update state and persist
  const updateTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
    persistData(newTasks, logs, observations);
  };
  
  const updateLogs = (newLogs: DailyLog[]) => {
    setLogs(newLogs);
    persistData(tasks, newLogs, observations);
  };

  const updateObservations = (newObs: Observation[]) => {
    setObservations(newObs);
    persistData(tasks, logs, newObs);
  };

  const handleSyncConfigUpdate = (config: FirebaseConfig | null) => {
    if (config) {
      setIsSyncEnabled(true);
      // Immediately try to sync current local data to cloud to 'init' the cloud if empty,
      // or start the listener.
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
      });
      // Also push current local data to ensure cloud has something if it's new
      saveDataToCloud({ tasks, logs, observations });
    } else {
      setIsSyncEnabled(false);
      // Refresh page to clear listeners is simplest way to fully disconnect in this architecture
      window.location.reload(); 
    }
  };

  const openInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  // --- HELPER: ID Generation ---
  const generateNextDisplayId = (projectId: string) => {
    if (!projectId) return '';
    const cleanPid = projectId.trim().toUpperCase();
    
    // Find all tasks belonging to this project
    const projectTasks = tasks.filter(t => t.projectId && t.projectId.toUpperCase() === cleanPid);
    
    if (projectTasks.length === 0) {
      return `${cleanPid}-1`;
    }

    // Extract sequence numbers
    let maxSeq = 0;
    // Regex matches PROJECTID-123
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

  // --- Helper: Priority Color (Matching TaskBoard) ---
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
    // Only auto-generate ID if we are creating a new task, but allow user to continue editing
    if (!editingTask) {
       setModalDisplayId(generateNextDisplayId(newVal));
    }
  };

  const handleCreateOrUpdateTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Use the state values for ID and Project ID
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
    
    // Also add to daily log automatically for convenience
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
    persistData(updatedTasks, updatedLogs, observations);
  };

  const editTaskUpdate = (taskId: string, updateId: string, newContent: string) => {
    const updatedTasks = tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          updates: t.updates.map(u => u.id === updateId ? { ...u, content: newContent } : u)
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

    // Sync back to task history
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
    persistData(updatedTasks, updatedLogs, observations);
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
      persistData(updatedTasks, updatedLogs, observations);
    }
  };

  const handleImportData = (data: { tasks: Task[]; logs: DailyLog[]; observations: Observation[] }) => {
    setTasks(data.tasks);
    setLogs(data.logs);
    // Ensure imported observations have status
    const migratedObs = (data.observations || []).map((o: any) => ({
      ...o,
      status: o.status || ObservationStatus.NEW
    }));
    setObservations(migratedObs);
    persistData(data.tasks, data.logs, migratedObs);
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

  // --- FILTERS ---
  const filteredTasks = tasks.filter(t => {
    const term = searchTerm.toLowerCase();
    const inDescription = t.description.toLowerCase().includes(term);
    const inDisplayId = t.displayId.toLowerCase().includes(term);
    const inSource = t.source.toLowerCase().includes(term);
    const inProject = t.projectId ? t.projectId.toLowerCase().includes(term) : false;
    const inDueDate = t.dueDate.toLowerCase().includes(term);
    const inUpdates = t.updates.some(u => u.content.toLowerCase().includes(term));
    
    return inDescription || inDisplayId || inSource || inProject || inDueDate || inUpdates;
  });

  // Get active Project IDs for dropdown
  const activeProjectIds = Array.from(new Set(
    tasks
      .filter(t => t.status !== Status.DONE && t.projectId)
      .map(t => t.projectId)
  )).sort();

  // --- GROUPING LOGIC ---
  // Fix: Use local time instead of UTC to ensure Due Today/Tomorrow logic aligns with user's clock
  const getLocalTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const todayStr = getLocalTodayStr();
  
  // Active Tasks: Filter out Done AND Archived, Sort by Due Date ASC (Older at top)
  const activeTasks = filteredTasks.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // Completed Tasks: Done OR Archived, Sort by Due Date DESC (Newest at top)
  const completedTasks = filteredTasks.filter(t => t.status === Status.DONE || t.status === Status.ARCHIVED)
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate));

  // Group active tasks by due date chunks for clarity
  const overdueActive = activeTasks.filter(t => t.dueDate < todayStr);
  const todayActive = activeTasks.filter(t => t.dueDate === todayStr);
  const upcomingActive = activeTasks.filter(t => t.dueDate > todayStr);

  // --- RENDER HELPERS ---
  const renderDashboard = () => {
    const today = new Date();
    
    // Start of week (Monday)
    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0,0,0,0);
    const startOfWeekStr = startOfWeek.toISOString().split('T')[0];

    // Calc Stats
    // Fix: Use local todayStr and ensure status is open
    const overdueTasks = tasks.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED && t.dueDate < todayStr);
    const dueTodayTasks = tasks.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED && t.dueDate === todayStr);
    
    // Weekly Stats
    const logsThisWeek = logs.filter(l => l.date >= startOfWeekStr);
    const completedTasksCount = tasks.filter(t => t.status === Status.DONE).length;
    
    // Status Counts for "Active Tasks This Week" card
    const countNotStarted = tasks.filter(t => t.status === Status.NOT_STARTED).length;
    const countInProgress = tasks.filter(t => t.status === Status.IN_PROGRESS).length;
    const countWaiting = tasks.filter(t => t.status === Status.WAITING).length;
    const countDone = tasks.filter(t => t.status === Status.DONE).length;
    const countArchived = tasks.filter(t => t.status === Status.ARCHIVED).length;

    // Observation Stats
    const obsNew = observations.filter(o => o.status === ObservationStatus.NEW).length;
    const obsWip = observations.filter(o => o.status === ObservationStatus.REVIEWING).length;
    const obsResolved = observations.filter(o => o.status === ObservationStatus.RESOLVED).length;
    const totalObs = observations.length;
    const activeObsTotal = obsNew + obsWip + obsResolved;

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

        {/* Active Task Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-indigo-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-indigo-100 text-sm">Active Tasks This Week</h3>
              <ListTodo className="opacity-50" size={20} />
            </div>
            {/* Adjusted Grid to fit Archived */}
            <div className="grid grid-cols-5 gap-2">
                <div className="bg-white/10 rounded p-2 backdrop-blur-sm flex flex-col justify-between">
                    <span className="text-[10px] text-indigo-200 uppercase tracking-wide truncate">Not Started</span>
                    <span className="text-xl font-bold">{countNotStarted}</span>
                </div>
                 <div className="bg-white/10 rounded p-2 backdrop-blur-sm flex flex-col justify-between">
                    <span className="text-[10px] text-indigo-200 uppercase tracking-wide truncate">In Progress</span>
                    <span className="text-xl font-bold">{countInProgress}</span>
                </div>
                 <div className="bg-white/10 rounded p-2 backdrop-blur-sm flex flex-col justify-between">
                    <span className="text-[10px] text-indigo-200 uppercase tracking-wide truncate">Waiting</span>
                    <span className="text-xl font-bold">{countWaiting}</span>
                </div>
                 <div className="bg-white/10 rounded p-2 backdrop-blur-sm flex flex-col justify-between">
                    <span className="text-[10px] text-indigo-200 uppercase tracking-wide truncate">Done</span>
                    <span className="text-xl font-bold">{countDone}</span>
                </div>
                <div className="bg-white/10 rounded p-2 backdrop-blur-sm flex flex-col justify-between">
                    <span className="text-[10px] text-indigo-200 uppercase tracking-wide truncate">Archived</span>
                    <span className="text-xl font-bold">{countArchived}</span>
                </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column: Priority & Deadlines */}
          <div className="lg:col-span-2 space-y-6">
             {/* Urgent Tasks Section - Combined Overdue */}
             {overdueTasks.length > 0 && (
               <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
                 <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={18} className="text-red-600"/>
                        <h3 className="font-bold text-red-900">Attention Needed: Overdue</h3>
                    </div>
                    <span className="bg-red-200 text-red-800 text-xs font-bold px-2 py-1 rounded-full">
                        {overdueTasks.length} Overdue
                    </span>
                 </div>
                 <div className="divide-y divide-red-50">
                    {overdueTasks.map(task => (
                      <div key={task.id} className="p-4 hover:bg-red-50/50 transition-colors flex items-center justify-between group">
                         <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                               <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getPriorityColor(task.priority)}`}>
                                 {task.priority}
                               </span>
                               <span className="text-xs font-mono font-medium text-slate-500">{task.displayId}</span>
                            </div>
                            <p className="text-sm font-medium text-slate-800">{task.description}</p>
                         </div>
                         <button 
                            onClick={() => { setJournalTaskId(task.id); setCurrentView(ViewMode.TASKS); }}
                            className="text-slate-300 hover:text-indigo-600 p-2"
                         >
                            <ArrowRight size={18}/>
                         </button>
                      </div>
                    ))}
                 </div>
               </div>
             )}

             {/* Due Today Section - Combined & Filtered for High Priority */}
             {dueTodayTasks.length > 0 && (
               <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
                 <div className="bg-amber-50 px-6 py-4 border-b border-amber-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CalendarDays size={18} className="text-amber-600"/>
                        <h3 className="font-bold text-amber-900">Actions Due Today</h3>
                    </div>
                    <span className="bg-amber-200 text-amber-800 text-xs font-bold px-2 py-1 rounded-full">
                        {dueTodayTasks.length} Total Due
                    </span>
                 </div>
                 <div className="divide-y divide-amber-50">
                    {dueTodayTasks.filter(t => t.priority === Priority.HIGH).length > 0 ? (
                        dueTodayTasks.filter(t => t.priority === Priority.HIGH).map(task => (
                        <div key={task.id} className="p-4 hover:bg-amber-50/50 transition-colors flex items-center justify-between group">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-mono font-medium text-slate-500">{task.displayId}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getPriorityColor(task.priority)}`}>
                                    {task.priority}
                                </span>
                                </div>
                                <p className="text-sm font-medium text-slate-800">{task.description}</p>
                            </div>
                            <button 
                                onClick={() => { setJournalTaskId(task.id); setCurrentView(ViewMode.TASKS); }}
                                className="text-slate-300 hover:text-indigo-600 p-2"
                            >
                                <ArrowRight size={18}/>
                            </button>
                        </div>
                        ))
                    ) : (
                        <div className="p-6 text-center text-slate-400 italic text-sm">
                            {dueTodayTasks.length} tasks due today, but no high priority items pending.
                        </div>
                    )}
                 </div>
               </div>
             )}
          </div>

          {/* Right Column: Summaries */}
          <div className="space-y-6">
            {/* Observations Status Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
               <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <StickyNote size={18} className="text-indigo-500"/>
                    Observations
                  </h3>
                  <button onClick={() => setCurrentView(ViewMode.OBSERVATIONS)} className="text-xs font-medium text-indigo-600 hover:underline">
                    Manage Board
                  </button>
               </div>
               
               <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-100">
                     <span className="text-sm font-medium text-blue-700">New</span>
                     <span className="text-lg font-bold text-blue-800">{obsNew}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-100">
                     <span className="text-sm font-medium text-amber-700">WIP</span>
                     <span className="text-lg font-bold text-amber-800">{obsWip}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                     <span className="text-sm font-medium text-emerald-700">Resolved</span>
                     <span className="text-lg font-bold text-emerald-800">{obsResolved}</span>
                  </div>
               </div>
               
               <div className="mt-6 pt-4 border-t border-slate-100">
                 <div className="flex justify-between text-xs text-slate-500">
                    <span>Total Observations</span>
                    <span className="font-mono">{totalObs}</span>
                 </div>
                 {/* Fixed Progress Bar using Flexbox for composition */}
                 <div className="w-full h-2 bg-slate-100 rounded-full mt-2 flex overflow-hidden">
                    {activeObsTotal > 0 ? (
                      <>
                        {obsResolved > 0 && <div style={{ flex: obsResolved }} className="bg-emerald-500 h-full" />}
                        {obsWip > 0 && <div style={{ flex: obsWip }} className="bg-amber-400 h-full" />}
                        {obsNew > 0 && <div style={{ flex: obsNew }} className="bg-blue-400 h-full" />}
                      </>
                    ) : (
                       <div className="w-full h-full bg-slate-200" />
                    )}
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTasksAndJournal = () => (
    <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column: Daily Journal */}
      <div className="lg:col-span-1 lg:sticky lg:top-8 h-fit space-y-4">
         <DailyJournal 
            tasks={tasks} 
            logs={logs} 
            onAddLog={addDailyLog} 
            onUpdateTask={updateTaskFields}
            initialTaskId={journalTaskId} 
         />
      </div>

      {/* Right Column: Task Board */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-bold text-slate-800">Task List</h2>
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
            placeholder="Search by ID, Due Date, Update Content..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
          />
        </div>

        <div className="grid grid-cols-1 gap-4">
          {/* Overdue Section */}
          {overdueActive.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-red-600 uppercase tracking-wide px-1">Overdue</h3>
              {overdueActive.map(task => (
                 <TaskCard 
                  key={task.id} 
                  task={task} 
                  onUpdateStatus={updateTaskStatus}
                  onEdit={(t) => openTaskModal(t)}
                  onDelete={deleteTask}
                  onAddUpdate={addUpdateToTask}
                  onEditUpdate={editTaskUpdate}
                  onDeleteUpdate={deleteTaskUpdate}
                />
              ))}
            </div>
          )}

          {/* Today Section */}
          {todayActive.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wide px-1">Due Today</h3>
              {todayActive.map(task => (
                 <TaskCard 
                  key={task.id} 
                  task={task} 
                  onUpdateStatus={updateTaskStatus}
                  onEdit={(t) => openTaskModal(t)}
                  onDelete={deleteTask}
                  onAddUpdate={addUpdateToTask}
                  onEditUpdate={editTaskUpdate}
                  onDeleteUpdate={deleteTaskUpdate}
                />
              ))}
            </div>
          )}

           {/* Upcoming Section */}
          {upcomingActive.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-green-600 uppercase tracking-wide px-1">Upcoming</h3>
              {upcomingActive.map(task => (
                 <TaskCard 
                  key={task.id} 
                  task={task} 
                  onUpdateStatus={updateTaskStatus}
                  onEdit={(t) => openTaskModal(t)}
                  onDelete={deleteTask}
                  onAddUpdate={addUpdateToTask}
                  onEditUpdate={editTaskUpdate}
                  onDeleteUpdate={deleteTaskUpdate}
                />
              ))}
            </div>
          )}

          {/* Fallback for empty active */}
          {activeTasks.length === 0 && (
             <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
               No active tasks matching filter.
             </div>
          )}

          {/* Completed/Archived Section */}
          {completedTasks.length > 0 && (
            <div className="mt-8 border-t border-slate-200 pt-4">
               <button 
                onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-medium mb-4 w-full"
               >
                 {isCompletedExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                 Completed & Archived ({completedTasks.length})
               </button>
               
               {isCompletedExpanded && (
                 <div className="space-y-4 animate-fade-in">
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
                      />
                    ))}
                 </div>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 w-full bg-white border-b border-slate-200 z-50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-xl text-indigo-900">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
            <LayoutDashboard size={18} />
          </div>
          ProTrack
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-600">
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`
        fixed lg:sticky top-0 left-0 h-screen w-[280px] bg-slate-900 text-slate-300 flex flex-col transition-transform duration-300 z-40
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6">
          <div className="flex items-center gap-3 font-bold text-2xl text-white tracking-tight mb-1">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <LayoutDashboard size={22} />
            </div>
            ProTrack <span className="text-indigo-400">AI</span>
          </div>
          <p className="text-xs text-slate-500 pl-[52px]">Offline-First Tracker</p>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2 mt-4">Main Menu</div>
          
          <button 
            onClick={() => { setCurrentView(ViewMode.DASHBOARD); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${currentView === ViewMode.DASHBOARD ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <LayoutDashboard size={20} className={currentView === ViewMode.DASHBOARD ? 'text-indigo-200' : 'text-slate-500 group-hover:text-indigo-400'} />
            <span className="font-medium">Dashboard</span>
          </button>

          <button 
            onClick={() => { setCurrentView(ViewMode.TASKS); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${currentView === ViewMode.TASKS ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <ListTodo size={20} className={currentView === ViewMode.TASKS ? 'text-indigo-200' : 'text-slate-500 group-hover:text-indigo-400'} />
            <span className="font-medium">Task Board</span>
             {/* Badge for active tasks */}
             {activeTasks.length > 0 && <span className="ml-auto bg-slate-800 text-slate-300 text-xs font-bold px-2 py-0.5 rounded-full">{activeTasks.length}</span>}
          </button>

          <button 
            onClick={() => { setCurrentView(ViewMode.OBSERVATIONS); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${currentView === ViewMode.OBSERVATIONS ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <StickyNote size={20} className={currentView === ViewMode.OBSERVATIONS ? 'text-indigo-200' : 'text-slate-500 group-hover:text-indigo-400'} />
            <span className="font-medium">Observations</span>
          </button>

          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2 mt-6">Reporting</div>

          <button 
            onClick={() => { setCurrentView(ViewMode.REPORT); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${currentView === ViewMode.REPORT ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <Sparkles size={20} className={currentView === ViewMode.REPORT ? 'text-indigo-200' : 'text-slate-500 group-hover:text-indigo-400'} />
            <span className="font-medium">AI Weekly Report</span>
          </button>

          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2 mt-6">System</div>

           <button 
            onClick={() => { setCurrentView(ViewMode.SETTINGS); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${currentView === ViewMode.SETTINGS ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <SettingsIcon size={20} className={currentView === ViewMode.SETTINGS ? 'text-indigo-200' : 'text-slate-500 group-hover:text-indigo-400'} />
            <span className="font-medium">Settings & Sync</span>
            {isSyncEnabled && <div className="ml-auto w-2 h-2 rounded-full bg-emerald-500"></div>}
          </button>

          <button 
            onClick={() => { setCurrentView(ViewMode.HELP); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${currentView === ViewMode.HELP ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <HelpCircle size={20} className={currentView === ViewMode.HELP ? 'text-indigo-200' : 'text-slate-500 group-hover:text-indigo-400'} />
            <span className="font-medium">User Guide</span>
          </button>

        </nav>

        <div className="p-4 bg-slate-950 mt-auto">
           <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
              <div className="flex items-center gap-3 mb-3">
                 <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                    <Activity size={18} />
                 </div>
                 <div>
                    <div className="text-xs font-bold text-white">System Status</div>
                    <div className="text-[10px] text-slate-400">v1.0.0 • Stable</div>
                 </div>
              </div>
              <div className="text-[10px] text-slate-500 text-center">
                 &copy; 2026 ProTrack AI
              </div>
           </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 lg:p-8 pt-20 lg:pt-8 h-screen overflow-y-auto overflow-x-hidden">
        <div className="max-w-7xl mx-auto h-full">
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
           {currentView === ViewMode.REPORT && (
             <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
               <div className="text-center space-y-2 mb-8">
                  <h1 className="text-3xl font-bold text-slate-900">Weekly Progress Report</h1>
                  <p className="text-slate-500">Generate an AI-powered summary of your tasks and logs for {getCurrentCW()}.</p>
               </div>
               
               {summary ? (
                 <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex justify-between items-center">
                       <h2 className="font-bold text-indigo-900 flex items-center gap-2">
                         <Sparkles size={18} /> Generated Summary
                       </h2>
                       <button onClick={() => setSummary('')} className="text-xs text-indigo-600 hover:underline">Clear & Reset</button>
                    </div>
                    <div className="p-8 prose prose-slate max-w-none">
                       <div className="whitespace-pre-line leading-relaxed text-slate-700">
                         {summary}
                       </div>
                    </div>
                    <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
                       <button onClick={() => navigator.clipboard.writeText(summary)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                          <Copy size={16} /> Copy Text
                       </button>
                    </div>
                 </div>
               ) : (
                 <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
                    <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                       <Sparkles size={32} className="text-indigo-500" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Ready to Generate</h3>
                    <p className="text-slate-500 max-w-md mx-auto mb-8">
                      The AI will analyze {activeTasks.length} active tasks and your daily logs from this week to create a professional status report.
                    </p>
                    
                    {error && (
                      <div className="mb-6 bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center justify-center gap-2">
                         <AlertCircle size={16} /> {error}
                      </div>
                    )}

                    <button 
                      onClick={handleGenerateSummary}
                      disabled={isGenerating}
                      className="inline-flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw size={20} className="animate-spin"/> Generating...
                        </>
                      ) : (
                        <>
                          Generate Report
                        </>
                      )}
                    </button>
                    <p className="text-xs text-slate-400 mt-4">Requires Gemini API Key in Settings</p>
                 </div>
               )}
             </div>
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

      {/* Task Edit/Create Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                 <h3 className="font-bold text-lg text-slate-800">
                    {editingTask ? 'Edit Task' : 'Create New Task'}
                 </h3>
                 <button onClick={() => setIsTaskModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={20} />
                 </button>
              </div>
              
              <form onSubmit={handleCreateOrUpdateTask} className="flex-1 overflow-y-auto p-6 space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Source ID</label>
                       <input 
                         name="source" 
                         defaultValue={editingTask?.source || getCurrentCW()} 
                         className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                       />
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Project ID</label>
                       <div className="relative">
                         <input 
                           type="text"
                           list="projectIds"
                           value={modalProjectId}
                           onChange={handleProjectIdChange}
                           placeholder="PROJ-..."
                           className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono uppercase"
                         />
                         <datalist id="projectIds">
                           {activeProjectIds.map(pid => <option key={pid} value={pid} />)}
                         </datalist>
                       </div>
                    </div>
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Display ID (Manual Override)</label>
                    <input 
                      type="text"
                      value={modalDisplayId}
                      onChange={(e) => setModalDisplayId(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                    <textarea 
                      name="description" 
                      defaultValue={editingTask?.description} 
                      rows={3}
                      required
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Priority</label>
                       <select 
                         name="priority" 
                         defaultValue={editingTask?.priority || Priority.MEDIUM}
                         className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                       >
                          {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date</label>
                       <input 
                         type="date" 
                         name="dueDate" 
                         defaultValue={editingTask?.dueDate}
                         required
                         className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                       />
                    </div>
                 </div>

                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                    <select 
                      name="status" 
                      defaultValue={editingTask?.status || Status.NOT_STARTED}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                       {Object.values(Status).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                 </div>
                 
                 <div className="pt-4 flex gap-3">
                    <button 
                      type="button" 
                      onClick={() => setIsTaskModalOpen(false)}
                      className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
                    >
                       Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-indigo-200"
                    >
                       {editingTask ? 'Save Changes' : 'Create Task'}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}

export default App;