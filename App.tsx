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
  ArrowRight
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
  
  // Modal State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // AI Summary State
  const [summary, setSummary] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync State
  const [isSyncEnabled, setIsSyncEnabled] = useState(false);

  // --- SYNC EFFECTS ---
  
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
          }
          if (remoteData.logs) setLogs(remoteData.logs);
          if (remoteData.observations) {
            // Apply migration on incoming remote data as well if needed
            const migratedObs = remoteData.observations.map((o: any) => ({
              ...o,
              status: o.status || ObservationStatus.NEW
            }));
            setObservations(migratedObs);
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
          }
          if (remoteData.logs) setLogs(remoteData.logs);
           if (remoteData.observations) {
            const migratedObs = remoteData.observations.map((o: any) => ({
              ...o,
              status: o.status || ObservationStatus.NEW
            }));
            setObservations(migratedObs);
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


  // --- ACTIONS ---

  const handleCreateOrUpdateTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newTask: Task = {
      id: editingTask ? editingTask.id : uuidv4(),
      displayId: (formData.get('displayId') as string) || `T-${Math.floor(Math.random() * 1000)}`,
      source: (formData.get('source') as string) || getCurrentCW(),
      projectId: (formData.get('projectId') as string) || '',
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
    } catch (err) {
      setError("Failed to generate summary. Ensure API Key is configured.");
    } finally {
      setIsGenerating(false);
    }
  };

  // --- FILTERS ---
  const filteredTasks = tasks.filter(t => 
    t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.displayId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.projectId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get active Project IDs for dropdown
  const activeProjectIds = Array.from(new Set(
    tasks
      .filter(t => t.status !== Status.DONE && t.projectId)
      .map(t => t.projectId)
  )).sort();

  // --- RENDER HELPERS ---
  const renderDashboard = () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Start of week (Monday)
    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0,0,0,0);
    const startOfWeekStr = startOfWeek.toISOString().split('T')[0];

    // Calc Stats
    const overdueTasks = tasks.filter(t => t.status !== Status.DONE && t.dueDate < todayStr);
    const dueTodayTasks = tasks.filter(t => t.status !== Status.DONE && t.dueDate === todayStr);
    
    // Weekly Stats
    const logsThisWeek = logs.filter(l => l.date >= startOfWeekStr);
    const activeTasksThisWeek = new Set(logsThisWeek.map(l => l.taskId)).size;
    const completedTasks = tasks.filter(t => t.status === Status.DONE).length;
    const activeTasksTotal = tasks.filter(t => t.status === Status.IN_PROGRESS || t.status === Status.WAITING).length;

    // Status Counts for "Active Tasks This Week" card
    const countNotStarted = tasks.filter(t => t.status === Status.NOT_STARTED).length;
    const countInProgress = tasks.filter(t => t.status === Status.IN_PROGRESS).length;
    const countWaiting = tasks.filter(t => t.status === Status.WAITING).length;
    const countDone = tasks.filter(t => t.status === Status.DONE).length;

    // Observation Stats
    const obsNew = observations.filter(o => o.status === ObservationStatus.NEW).length;
    const obsWip = observations.filter(o => o.status === ObservationStatus.REVIEWING).length;
    const obsResolved = observations.filter(o => o.status === ObservationStatus.RESOLVED).length;
    const totalObs = observations.length;

    return (
      <div className="space-y-6 animate-fade-in pb-12">
        {/* Top Level Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-indigo-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-indigo-100 text-sm">Active Tasks This Week</h3>
              <ListTodo className="opacity-50" size={20} />
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/10 rounded p-2 backdrop-blur-sm flex flex-col justify-between">
                    <span className="text-[10px] text-indigo-200 uppercase tracking-wide">Not Started</span>
                    <span className="text-xl font-bold">{countNotStarted}</span>
                </div>
                 <div className="bg-white/10 rounded p-2 backdrop-blur-sm flex flex-col justify-between">
                    <span className="text-[10px] text-indigo-200 uppercase tracking-wide">In Progress</span>
                    <span className="text-xl font-bold">{countInProgress}</span>
                </div>
                 <div className="bg-white/10 rounded p-2 backdrop-blur-sm flex flex-col justify-between">
                    <span className="text-[10px] text-indigo-200 uppercase tracking-wide">Waiting</span>
                    <span className="text-xl font-bold">{countWaiting}</span>
                </div>
                 <div className="bg-white/10 rounded p-2 backdrop-blur-sm flex flex-col justify-between">
                    <span className="text-[10px] text-indigo-200 uppercase tracking-wide">Done</span>
                    <span className="text-xl font-bold">{countDone}</span>
                </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-red-300 transition-colors">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-500">Overdue Tasks</h3>
              <AlertTriangle className={`text-red-500 ${overdueTasks.length > 0 ? 'animate-pulse' : ''}`} />
            </div>
            <p className={`text-4xl font-bold ${overdueTasks.length > 0 ? 'text-red-600' : 'text-slate-800'}`}>
              {overdueTasks.length}
            </p>
            <p className="text-xs text-slate-400 mt-2">Immediate attention required</p>
            {overdueTasks.length > 0 && <div className="absolute bottom-0 left-0 w-full h-1 bg-red-500"/>}
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:border-amber-300 transition-colors">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-500">Due Today</h3>
              <CalendarDays className="text-amber-500" />
            </div>
            <p className="text-4xl font-bold text-slate-800">{dueTodayTasks.length}</p>
            <p className="text-xs text-slate-400 mt-2">Deadlines expiring today</p>
          </div>

           <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-500">Weekly Pulse</h3>
              <Activity className="text-emerald-500" />
            </div>
            <div className="flex items-end gap-2">
              <p className="text-4xl font-bold text-slate-800">{logsThisWeek.length}</p>
              <span className="text-sm text-slate-500 mb-1.5">entries</span>
            </div>
            <p className="text-xs text-slate-400 mt-2 leading-snug">
              Updates made across {activeTasksThisWeek} tasks in the current week.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column: Priority & Deadlines */}
          <div className="lg:col-span-2 space-y-6">
             {/* Urgent Tasks Section - Focused on Overdue */}
             {overdueTasks.length > 0 && (
               <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
                 <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-red-600"/>
                    <h3 className="font-bold text-red-900">Attention Needed: Overdue</h3>
                 </div>
                 <div className="divide-y divide-red-50">
                    {overdueTasks.map(task => (
                      <div key={task.id} className="p-4 hover:bg-red-50/50 transition-colors flex items-center justify-between group">
                         <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                               <span className="text-[10px] font-bold px-2 py-0.5 rounded text-white bg-red-500">
                                 OVERDUE
                               </span>
                               <span className="text-xs font-mono font-medium text-slate-500">{task.displayId}</span>
                            </div>
                            <p className="text-sm font-medium text-slate-800">{task.description}</p>
                         </div>
                         <button 
                            onClick={() => { setEditingTask(task); setIsTaskModalOpen(true); }}
                            className="text-slate-300 hover:text-indigo-600 p-2"
                         >
                            <ArrowRight size={18}/>
                         </button>
                      </div>
                    ))}
                 </div>
               </div>
             )}

             {/* Priority Items */}
             <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-slate-800">High Priority</h2>
                  <button onClick={() => setCurrentView(ViewMode.TASKS)} className="text-sm text-indigo-600 font-medium hover:underline">View All</button>
                </div>
                <div className="space-y-4">
                  {tasks.filter(t => t.priority === Priority.HIGH && t.status !== Status.DONE).slice(0, 3).map(task => (
                    <TaskCard 
                        key={task.id} 
                        task={task} 
                        onUpdateStatus={updateTaskStatus} 
                        onEdit={(t) => { setEditingTask(t); setIsTaskModalOpen(true); }}
                        onDelete={deleteTask}
                        onAddUpdate={addUpdateToTask}
                      />
                  ))}
                  {tasks.filter(t => t.priority === Priority.HIGH && t.status !== Status.DONE).length === 0 && (
                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                      No high priority tasks pending.
                    </div>
                  )}
                </div>
             </div>
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
                 {/* Simple Progress Bar */}
                 <div className="w-full h-2 bg-slate-100 rounded-full mt-2 flex overflow-hidden">
                    <div style={{ width: `${totalObs ? (obsResolved / totalObs) * 100 : 0}%`}} className="bg-emerald-500 h-full" />
                    <div style={{ width: `${totalObs ? (obsWip / totalObs) * 100 : 0}%`}} className="bg-amber-400 h-full" />
                    <div style={{ width: `${totalObs ? (obsNew / totalObs) * 100 : 0}%`}} className="bg-blue-400 h-full" />
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTasks = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Task Board</h2>
        <button 
          onClick={() => { setEditingTask(null); setIsTaskModalOpen(true); }}
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
          placeholder="Search by ID, Source, or Description..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredTasks.map(task => (
          <TaskCard 
            key={task.id} 
            task={task} 
            onUpdateStatus={updateTaskStatus}
            onEdit={(t) => { setEditingTask(t); setIsTaskModalOpen(true); }}
            onDelete={deleteTask}
            onAddUpdate={addUpdateToTask}
          />
        ))}
        {filteredTasks.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            No tasks found matching your search.
          </div>
        )}
      </div>
    </div>
  );

  const renderReport = () => (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
      <div className="text-center space-y-2 mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-purple-200">
          <Sparkles className="text-white" size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Weekly AI Summary</h2>
        <p className="text-slate-500">Generate a comprehensive progress report from your tracked tasks and logs.</p>
      </div>

      {!summary && (
        <div className="flex justify-center">
          <button 
            onClick={handleGenerateSummary}
            disabled={isGenerating}
            className="group relative flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-full font-semibold hover:bg-slate-800 transition-all shadow-xl hover:shadow-2xl disabled:opacity-70 disabled:cursor-not-allowed"
          >
             {isGenerating ? (
               <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyzing Progress...
               </>
             ) : (
               <>
                <Sparkles size={20} className="text-yellow-400 group-hover:scale-110 transition-transform" />
                Generate Report
               </>
             )}
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {summary && (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
             <h3 className="font-semibold text-slate-700">Generated Report</h3>
             <div className="flex gap-2">
               <button onClick={handleGenerateSummary} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                 Regenerate
               </button>
             </div>
          </div>
          <div className="p-8 prose prose-slate max-w-none">
            {summary.split('\n').map((line, i) => {
              if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold mt-6 mb-3 text-slate-800">{line.replace('## ', '')}</h2>;
              if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold mt-4 mb-2 text-slate-700">{line.replace('### ', '')}</h3>;
              if (line.startsWith('**')) return <strong key={i} className="block mt-4 mb-1 text-slate-800">{line.replace(/\*\*/g, '')}</strong>;
              if (line.startsWith('- ')) return <li key={i} className="ml-4 text-slate-600 mb-1">{line.replace('- ', '')}</li>;
              if (line.match(/^\d\./)) return <div key={i} className="font-semibold mt-4 text-indigo-900">{line}</div>
              return <p key={i} className="text-slate-600 mb-2 leading-relaxed">{line}</p>;
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans text-slate-900">
      
      {/* Sidebar Navigation (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 fixed h-full z-10">
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
            ProTrack AI
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setCurrentView(ViewMode.DASHBOARD)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === ViewMode.DASHBOARD ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button 
            onClick={() => setCurrentView(ViewMode.JOURNAL)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === ViewMode.JOURNAL ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <BookOpen size={20} /> Daily Journal
          </button>
          <button 
            onClick={() => setCurrentView(ViewMode.TASKS)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === ViewMode.TASKS ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <ListTodo size={20} /> Task Board
          </button>
          <button 
            onClick={() => setCurrentView(ViewMode.REPORT)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === ViewMode.REPORT ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Sparkles size={20} /> Weekly Report
          </button>
           <button 
            onClick={() => setCurrentView(ViewMode.OBSERVATIONS)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === ViewMode.OBSERVATIONS ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <StickyNote size={20} /> Observations
          </button>
           <button 
            onClick={() => setCurrentView(ViewMode.SETTINGS)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === ViewMode.SETTINGS ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <SettingsIcon size={20} /> Settings & Data
          </button>
          <button 
            onClick={() => setCurrentView(ViewMode.HELP)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === ViewMode.HELP ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <HelpCircle size={20} /> User Manual
          </button>
        </nav>
        <div className="p-4 border-t border-slate-100">
           <button onClick={openInNewTab} className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-indigo-600 transition-colors w-full px-4">
              <ExternalLink size={14} /> Open App in New Tab
           </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full bg-white border-b border-slate-200 z-20 px-4 py-3 flex justify-between items-center shadow-sm">
         <h1 className="text-xl font-bold text-indigo-600">ProTrack AI</h1>
         <div className="flex items-center gap-4">
             <button onClick={openInNewTab} className="text-slate-400 hover:text-indigo-600">
               <ExternalLink size={20}/>
             </button>
             <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-600">
               {isMobileMenuOpen ? <X /> : <Menu />}
             </button>
         </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-white z-10 pt-20 px-6 space-y-4 md:hidden animate-in slide-in-from-top-10">
           <button onClick={() => { setCurrentView(ViewMode.DASHBOARD); setIsMobileMenuOpen(false); }} className="w-full text-left py-3 border-b border-slate-100 text-lg font-medium">Dashboard</button>
           <button onClick={() => { setCurrentView(ViewMode.JOURNAL); setIsMobileMenuOpen(false); }} className="w-full text-left py-3 border-b border-slate-100 text-lg font-medium">Daily Journal</button>
           <button onClick={() => { setCurrentView(ViewMode.TASKS); setIsMobileMenuOpen(false); }} className="w-full text-left py-3 border-b border-slate-100 text-lg font-medium">Tasks</button>
           <button onClick={() => { setCurrentView(ViewMode.REPORT); setIsMobileMenuOpen(false); }} className="w-full text-left py-3 border-b border-slate-100 text-lg font-medium">AI Report</button>
           <button onClick={() => { setCurrentView(ViewMode.OBSERVATIONS); setIsMobileMenuOpen(false); }} className="w-full text-left py-3 border-b border-slate-100 text-lg font-medium">Observations</button>
           <button onClick={() => { setCurrentView(ViewMode.SETTINGS); setIsMobileMenuOpen(false); }} className="w-full text-left py-3 border-b border-slate-100 text-lg font-medium">Settings & Data</button>
           <button onClick={() => { setCurrentView(ViewMode.HELP); setIsMobileMenuOpen(false); }} className="w-full text-left py-3 border-b border-slate-100 text-lg font-medium">User Manual</button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 mt-14 md:mt-0 transition-all max-w-[1600px] mx-auto w-full">
        {currentView === ViewMode.DASHBOARD && renderDashboard()}
        {currentView === ViewMode.TASKS && renderTasks()}
        {currentView === ViewMode.JOURNAL && <DailyJournal tasks={tasks} logs={logs} onAddLog={addDailyLog} />}
        {currentView === ViewMode.REPORT && renderReport()}
        {currentView === ViewMode.OBSERVATIONS && <ObservationsLog observations={observations} onAddObservation={addObservation} onEditObservation={editObservation} onDeleteObservation={deleteObservation} />}
        {currentView === ViewMode.SETTINGS && <Settings tasks={tasks} logs={logs} observations={observations} onImportData={handleImportData} onSyncConfigUpdate={handleSyncConfigUpdate} isSyncEnabled={isSyncEnabled} />}
        {currentView === ViewMode.HELP && <UserManual />}
      </main>

      {/* Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">{editingTask ? 'Edit Task' : 'Create New Task'}</h3>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <form onSubmit={handleCreateOrUpdateTask} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Source</label>
                  <input name="source" defaultValue={editingTask?.source || getCurrentCW()} placeholder="e.g. CW02" className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Display ID</label>
                  <input name="displayId" defaultValue={editingTask?.displayId} placeholder="e.g. P1130-28" className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900" required />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Project ID</label>
                <input 
                  list="projectIds" 
                  name="projectId" 
                  defaultValue={editingTask?.projectId} 
                  placeholder="Select or Type Project ID..." 
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900" 
                />
                <datalist id="projectIds">
                  {activeProjectIds.map(pid => <option key={pid} value={pid} />)}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Description</label>
                <textarea name="description" defaultValue={editingTask?.description} rows={3} className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Due Date</label>
                  <input type="date" name="dueDate" defaultValue={editingTask?.dueDate} className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900" required />
                </div>
                <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Priority</label>
                   <select name="priority" defaultValue={editingTask?.priority || Priority.MEDIUM} className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900">
                     <option value={Priority.HIGH}>High</option>
                     <option value={Priority.MEDIUM}>Medium</option>
                     <option value={Priority.LOW}>Low</option>
                   </select>
                </div>
              </div>
              <div>
                 <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Status</label>
                 <select name="status" defaultValue={editingTask?.status || Status.NOT_STARTED} className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900">
                   {Object.values(Status).map(s => <option key={s} value={s}>{s}</option>)}
                 </select>
              </div>
              
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsTaskModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">Save Task</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;