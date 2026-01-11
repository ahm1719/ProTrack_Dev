import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  ListTodo, 
  BookOpen, 
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
  Archive,
  BarChart3,
  CalendarDays
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
  FirebaseConfig 
} from './types';

import TaskCard from './components/TaskCard';
import DailyJournal from './components/DailyJournal';
import ObservationsLog from './components/ObservationsLog';
import Settings from './components/Settings';
import AIChat from './components/AIChat';
import UserManual from './components/UserManual';

import { subscribeToData, saveDataToCloud, initFirebase } from './services/firebaseService';
import { generateWeeklySummary } from './services/geminiService';

const BUILD_VERSION = "V1.5 (Root Fix)";

const DEFAULT_CONFIG: AppConfig = {
  taskStatuses: Object.values(Status),
  taskPriorities: Object.values(Priority),
  observationStatuses: Object.values(ObservationStatus)
};

// Helper to calculate Calendar Week
const getWeekNumber = (d: Date): number => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const App: React.FC = () => {
  // --- State ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [offDays, setOffDays] = useState<string[]>([]); // Dates formatted YYYY-MM-DD
  const [appConfig, setAppConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  
  const [view, setView] = useState<ViewMode>(ViewMode.DASHBOARD);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncEnabled, setIsSyncEnabled] = useState(false);
  
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // UI States
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [generatedReport, setGeneratedReport] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // --- Initialization & Sync ---
  useEffect(() => {
    // Clock Timer
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);

    // 1. Load Local Config
    const savedConfig = localStorage.getItem('protrack_firebase_config');
    const localAppConfig = localStorage.getItem('protrack_app_config');
    
    if (localAppConfig) {
        setAppConfig(JSON.parse(localAppConfig));
    }

    // 2. Load Local Data (Bootstrap)
    const localData = localStorage.getItem('protrack_data');
    if (localData) {
      const parsed = JSON.parse(localData);
      setTasks(parsed.tasks || []);
      setLogs(parsed.logs || []);
      setObservations(parsed.observations || []);
      setOffDays(parsed.offDays || []);
    }

    // 3. Init Firebase if configured
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        if (initFirebase(config)) {
          setIsSyncEnabled(true);
        }
      } catch (e) {
        console.error("Failed to auto-init firebase", e);
      }
    }

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isSyncEnabled) {
      // Explicitly type data as any to handle potential inference issues from the service
      const unsubscribe = subscribeToData((data: any) => {
        setTasks(data.tasks || []);
        setLogs(data.logs || []);
        setObservations(data.observations || []);
        if (data.offDays) setOffDays(data.offDays);
      });
      return () => { if (unsubscribe) unsubscribe(); };
    }
  }, [isSyncEnabled]);

  // --- Persistence ---
  const persistData = (newTasks: Task[], newLogs: DailyLog[], newObs: Observation[], newOffDays: string[]) => {
    // Save to State
    setTasks(newTasks);
    setLogs(newLogs);
    setObservations(newObs);
    setOffDays(newOffDays);

    // Save to LocalStorage
    localStorage.setItem('protrack_data', JSON.stringify({
      tasks: newTasks,
      logs: newLogs,
      observations: newObs,
      offDays: newOffDays
    }));

    // Save to Cloud
    if (isSyncEnabled) {
      saveDataToCloud({
        tasks: newTasks,
        logs: newLogs,
        observations: newObs,
        offDays: newOffDays
      });
    }
  };

  // --- Handlers ---
  const updateTaskStatus = (id: string, status: Status) => {
    const updated = tasks.map(t => t.id === id ? { ...t, status } : t);
    persistData(updated, logs, observations, offDays);
  };

  const updateTaskFields = (id: string, fields: Partial<Task>) => {
    const updated = tasks.map(t => t.id === id ? { ...t, ...fields } : t);
    persistData(updated, logs, observations, offDays);
  };

  const addUpdateToTask = (id: string, content: string) => {
    const timestamp = new Date().toISOString();
    const updateId = uuidv4();
    const updated = tasks.map(t => {
      if (t.id === id) {
        return {
          ...t,
          updates: [...t.updates, { id: updateId, timestamp, content }]
        };
      }
      return t;
    });
    
    // Also add to Daily Journal automatically
    const newLog: DailyLog = {
      id: uuidv4(),
      date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD local
      taskId: id,
      content: content
    };
    
    persistData(updated, [...logs, newLog], observations, offDays);
  };

  const editTaskUpdate = (taskId: string, updateId: string, newContent: string, newTimestamp?: string) => {
      const updated = tasks.map(t => {
          if (t.id === taskId) {
              return {
                  ...t,
                  updates: t.updates.map(u => u.id === updateId ? { 
                      ...u, 
                      content: newContent,
                      timestamp: newTimestamp || u.timestamp
                   } : u)
              };
          }
          return t;
      });
      persistData(updated, logs, observations, offDays);
  };

  const deleteTaskUpdate = (taskId: string, updateId: string) => {
      const updated = tasks.map(t => {
          if (t.id === taskId) {
              return {
                  ...t,
                  updates: t.updates.filter(u => u.id !== updateId)
              };
          }
          return t;
      });
      persistData(updated, logs, observations, offDays);
  };

  const createNewTask = () => {
    const newTask: Task = {
      id: uuidv4(),
      displayId: `T-${Math.floor(Math.random() * 1000)}`,
      source: 'NEW',
      projectId: 'General',
      description: 'New Task Description',
      dueDate: new Date().toISOString().split('T')[0],
      status: Status.NOT_STARTED,
      priority: Priority.MEDIUM,
      updates: [],
      createdAt: new Date().toISOString()
    };
    persistData([...tasks, newTask], logs, observations, offDays);
    setHighlightedTaskId(newTask.id);
    setView(ViewMode.TASKS);
  };

  const deleteTask = (id: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      const updated = tasks.filter(t => t.id !== id);
      persistData(updated, logs, observations, offDays);
    }
  };

  // Journal Handlers
  const handleAddLog = (logData: Omit<DailyLog, 'id'>) => {
    const newLog = { ...logData, id: uuidv4() };
    persistData(tasks, [...logs, newLog], observations, offDays);
  };

  const handleToggleOffDay = (date: string) => {
      const exists = offDays.includes(date);
      const newOffDays = exists 
        ? offDays.filter(d => d !== date)
        : [...offDays, date];
      persistData(tasks, logs, observations, newOffDays);
  };

  // Observation Handlers
  const handleAddObservation = (obs: Observation) => {
    persistData(tasks, logs, [...observations, obs], offDays);
  };

  const handleEditObservation = (obs: Observation) => {
    const updated = observations.map(o => o.id === obs.id ? obs : o);
    persistData(tasks, logs, updated, offDays);
  };

  const handleDeleteObservation = (id: string) => {
    const updated = observations.filter(o => o.id !== id);
    persistData(tasks, logs, updated, offDays);
  };

  // Config Handlers
  const handleImportData = (data: { tasks: Task[], logs: DailyLog[], observations: Observation[] }) => {
    persistData(data.tasks, data.logs, data.observations, offDays);
  };

  const handleSyncConfigUpdate = (config: FirebaseConfig | null) => {
    setIsSyncEnabled(!!config);
  };
  
  const handleUpdateAppConfig = (newConfig: AppConfig) => {
      setAppConfig(newConfig);
      localStorage.setItem('protrack_app_config', JSON.stringify(newConfig));
  };

  // Report Generation
  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    setShowReportModal(true);
    try {
      const summary = await generateWeeklySummary(tasks, logs);
      setGeneratedReport(summary);
    } catch (e: any) {
      setGeneratedReport(`Error: ${e.message}`);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // --- Derived Data for Dashboard ---
  const todayStr = new Date().toLocaleDateString('en-CA');
  
  // Overdue
  const overdueTasks = useMemo(() => {
    return tasks.filter(t => 
      t.status !== Status.DONE && 
      t.status !== Status.ARCHIVED && 
      t.dueDate && 
      t.dueDate < todayStr
    );
  }, [tasks, todayStr]);

  // Due Today
  const tasksDueToday = useMemo(() => {
      return tasks.filter(t => 
        t.status !== Status.DONE && 
        t.status !== Status.ARCHIVED && 
        t.dueDate === todayStr
      );
  }, [tasks, todayStr]);

  // High Priority Due Today
  const highPriorityDueToday = useMemo(() => {
      return tasksDueToday.filter(t => t.priority === Priority.HIGH);
  }, [tasksDueToday]);


  // Weekly Data for Task Board (Combined View)
  const weekDays = useMemo(() => {
      const days = [];
      const curr = new Date();
      // Start from today, show next 7 days
      for (let i = 0; i < 7; i++) {
          const d = new Date();
          d.setDate(curr.getDate() + i);
          days.push(d.toLocaleDateString('en-CA'));
      }
      return days;
  }, [todayStr]);

  const weekTasks = useMemo(() => {
      const map: Record<string, Task[]> = {};
      weekDays.forEach(d => map[d] = []);
      tasks.forEach(t => {
          if (t.status !== Status.DONE && t.status !== Status.ARCHIVED && t.dueDate && map[t.dueDate]) {
              map[t.dueDate].push(t);
          }
      });
      return map;
  }, [tasks, weekDays]);

  const filteredTasks = useMemo(() => {
    if (!searchQuery) return tasks;
    const q = searchQuery.toLowerCase();
    return tasks.filter(t => 
      t.description.toLowerCase().includes(q) || 
      t.displayId.toLowerCase().includes(q) ||
      t.source.toLowerCase().includes(q)
    );
  }, [tasks, searchQuery]);


  // --- Render Helpers ---
  const renderContent = () => {
    switch (view) {
      case ViewMode.DASHBOARD:
        return (
          <div className="space-y-6 animate-fade-in">
             {/* Time Header with Report Gen */}
             <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-2xl p-8 text-white shadow-lg mb-6 relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <div className="flex items-baseline gap-3 mb-2">
                             <h1 className="text-4xl font-bold">
                                {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                             </h1>
                             <span className="text-indigo-200 font-mono text-xl">CW {getWeekNumber(currentTime)}</span>
                        </div>
                        <p className="text-indigo-100 text-lg opacity-90 flex items-center gap-2">
                            <CalendarDays size={20} />
                            {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-4 w-full md:w-auto">
                        <button 
                            onClick={handleGenerateReport}
                            className="w-full md:w-auto flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-6 py-3 md:py-2 rounded-lg transition-all text-sm font-bold border border-white/10 shadow-lg"
                        >
                            <Sparkles size={18} /> Generate Weekly Report
                        </button>
                    </div>
                </div>
                {/* Decorative Circles */}
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-indigo-500/30 rounded-full blur-2xl"></div>
             </div>

             {/* 1. Observation Summary Stats */}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {appConfig.observationStatuses.map((status) => {
                    const count = observations.filter(o => o.status === status).length;
                    
                    let colorClass = "bg-white border-slate-200 text-slate-600";
                    let icon = MessageSquare;
                    
                    const s = status.toLowerCase();
                    if (s.includes('new')) { colorClass = "bg-blue-50 border-blue-200 text-blue-700"; icon = AlertTriangle; }
                    else if (s.includes('review')) { colorClass = "bg-amber-50 border-amber-200 text-amber-700"; icon = Clock; }
                    else if (s.includes('resolved') || s.includes('done')) { colorClass = "bg-emerald-50 border-emerald-200 text-emerald-700"; icon = CheckCircle2; }
                    else if (s.includes('archived')) { colorClass = "bg-slate-50 border-slate-200 text-slate-500"; icon = Archive; }
                    else { colorClass = "bg-white border-slate-200 text-slate-700"; icon = BarChart3; }

                    return (
                        <div key={status} className={`p-4 rounded-xl border flex items-center justify-between shadow-sm ${colorClass} hover:shadow-md transition-shadow cursor-default`}>
                            <div>
                                <p className="text-[10px] font-bold uppercase opacity-70 mb-1 tracking-wider">{status}</p>
                                <p className="text-2xl font-bold">{count}</p>
                            </div>
                            <div className="p-2 bg-white/50 rounded-lg">
                                {React.createElement(icon, { size: 20 })}
                            </div>
                        </div>
                    );
                })}
             </div>

            {/* 2. Need Attention (Overdue) */}
            <div className="bg-red-50 rounded-2xl border border-red-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-red-800 font-bold flex items-center gap-2">
                        <AlertTriangle size={20} /> Need Attention (Overdue)
                    </h3>
                    <span className="bg-red-200 text-red-800 px-3 py-1 rounded-full text-xs font-bold">
                        {overdueTasks.length} Tasks
                    </span>
                </div>
                {overdueTasks.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        {overdueTasks.map(task => (
                                <TaskCard 
                                key={task.id} 
                                task={task} 
                                onUpdateStatus={updateTaskStatus}
                                onEdit={(t: Task) => { setHighlightedTaskId(t.id); setView(ViewMode.TASKS); }}
                                onDelete={deleteTask}
                                onAddUpdate={addUpdateToTask}
                                onEditUpdate={editTaskUpdate}
                                onDeleteUpdate={deleteTaskUpdate}
                                onUpdateTask={updateTaskFields}
                                autoExpand={task.id === highlightedTaskId}
                                availableStatuses={appConfig.taskStatuses}
                                availablePriorities={appConfig.taskPriorities}
                                />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-red-300 italic flex flex-col items-center">
                        <CheckCircle2 size={32} className="mb-2 opacity-50"/>
                        No overdue tasks. Great job!
                    </div>
                )}
            </div>

             {/* 3. Due Today */}
             <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-slate-800 font-bold flex items-center gap-2">
                        <Clock size={20} className="text-indigo-600"/> Due Today
                    </h3>
                    <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-xs font-bold">
                        {tasksDueToday.length} Total Due
                    </span>
                </div>
                
                {highPriorityDueToday.length > 0 ? (
                    <div className="space-y-4">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">High Priority Items</p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                            {highPriorityDueToday.map(task => (
                                <TaskCard 
                                    key={task.id} 
                                    task={task} 
                                    onUpdateStatus={updateTaskStatus}
                                    onEdit={(t: Task) => { setHighlightedTaskId(t.id); setView(ViewMode.TASKS); }}
                                    onDelete={deleteTask}
                                    onAddUpdate={addUpdateToTask}
                                    onEditUpdate={editTaskUpdate}
                                    onDeleteUpdate={deleteTaskUpdate}
                                    onUpdateTask={updateTaskFields}
                                    autoExpand={false}
                                    availableStatuses={appConfig.taskStatuses}
                                    availablePriorities={appConfig.taskPriorities}
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-slate-500 text-sm">
                        {tasksDueToday.length > 0 
                            ? "You have tasks due today, but none are marked as High priority." 
                            : "No tasks due today."}
                    </div>
                )}
            </div>

          </div>
        );

      case ViewMode.TASKS:
        return (
          <div className="space-y-6 h-full flex flex-col animate-fade-in">
             {/* Header */}
             <div className="flex justify-between items-center shrink-0">
                <h1 className="text-2xl font-bold text-slate-800">Task Board & Planner</h1>
                <button onClick={createNewTask} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                    <Plus size={18} /> New Task
                </button>
             </div>

             {/* 1. Upcoming Deadlines (Horizontal Scroll) - Now in Task Board */}
             <div className="shrink-0">
                 <h3 className="text-slate-700 font-bold mb-3 flex items-center gap-2 text-sm">
                    <CalendarDays size={16} className="text-indigo-600"/> Weekly Timeline
                 </h3>
                 <div className="flex gap-4 overflow-x-auto pb-4 snap-x items-start custom-scrollbar">
                    {weekDays.map(dateStr => {
                        const isToday = dateStr === todayStr;
                        const dayTasks = weekTasks[dateStr] || [];
                        const dateObj = new Date(dateStr + "T12:00:00"); 
                        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                        const displayDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        
                        const containerClass = isToday 
                            ? "bg-indigo-50 border-indigo-300 shadow-md shadow-indigo-100 ring-2 ring-indigo-200" 
                            : "bg-white border-slate-200 shadow-sm";
                        
                        return (
                            <div key={dateStr} className={`min-w-[280px] w-[280px] snap-center rounded-xl border p-3 flex flex-col gap-2 h-[300px] ${containerClass}`}>
                                <div className={`flex justify-between items-center pb-2 border-b ${isToday ? 'border-indigo-200' : 'border-slate-100'}`}>
                                    <div>
                                        <span className={`block text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>{dayName}</span>
                                        <span className={`block text-sm font-bold ${isToday ? 'text-indigo-900' : 'text-slate-700'}`}>{displayDate}</span>
                                    </div>
                                    {isToday && <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold">TODAY</span>}
                                </div>
                                
                                <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                                    {dayTasks.length === 0 ? (
                                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-1">
                                            <CheckCircle2 size={16} className="opacity-20"/>
                                            <span className="text-[10px] italic">No deadlines</span>
                                        </div>
                                    ) : (
                                        dayTasks.map(task => (
                                            <div key={task.id} className="bg-white p-2 rounded border border-slate-100 shadow-sm hover:border-indigo-200 cursor-pointer" onClick={() => setHighlightedTaskId(task.id)}>
                                                <div className="flex justify-between items-start">
                                                    <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-1 rounded">{task.displayId}</span>
                                                    <span className={`w-2 h-2 rounded-full ${task.priority === Priority.HIGH ? 'bg-red-400' : 'bg-slate-300'}`}></span>
                                                </div>
                                                <p className="text-xs text-slate-700 mt-1 line-clamp-2 leading-tight">{task.description}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                 </div>
             </div>
             
             {/* Main Combined Area: Task Grid + Daily Journal */}
             <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-3 gap-6 overflow-hidden pb-2">
                
                {/* Left: Task Grid */}
                <div className="xl:col-span-2 flex flex-col overflow-hidden bg-slate-100/50 rounded-2xl border border-slate-200">
                    <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <ListTodo size={18} className="text-indigo-600"/> All Tasks
                        </h3>
                        <span className="text-xs text-slate-500">{filteredTasks.length} tasks found</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredTasks.slice().sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(task => (
                                <TaskCard 
                                    key={task.id} 
                                    task={task} 
                                    onUpdateStatus={updateTaskStatus}
                                    onEdit={(t: Task) => setHighlightedTaskId(t.id)}
                                    onDelete={deleteTask}
                                    onAddUpdate={addUpdateToTask}
                                    onEditUpdate={editTaskUpdate}
                                    onDeleteUpdate={deleteTaskUpdate}
                                    onUpdateTask={updateTaskFields}
                                    autoExpand={task.id === highlightedTaskId}
                                    availableStatuses={appConfig.taskStatuses}
                                    availablePriorities={appConfig.taskPriorities}
                                />
                            ))}
                            {filteredTasks.length === 0 && (
                                <div className="col-span-full py-12 text-center text-slate-400">
                                    No tasks found.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Daily Journal Component */}
                <div className="flex flex-col overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-sm h-full">
                     <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        <DailyJournal 
                            tasks={tasks} 
                            logs={logs} 
                            onAddLog={handleAddLog} 
                            onUpdateTask={(tid: string, u: any) => updateTaskFields(tid, u)} 
                            offDays={offDays}
                            onToggleOffDay={handleToggleOffDay}
                        />
                     </div>
                </div>

             </div>
          </div>
        );

      case ViewMode.JOURNAL:
        // Journal is now integrated into TASKS view, but we keep this standalone view accessible
        return (
          <DailyJournal 
            tasks={tasks} 
            logs={logs} 
            onAddLog={handleAddLog} 
            onUpdateTask={(tid: string, u: any) => updateTaskFields(tid, u)} 
            offDays={offDays}
            onToggleOffDay={handleToggleOffDay}
          />
        );

      case ViewMode.OBSERVATIONS:
        return (
          <ObservationsLog 
            observations={observations}
            onAddObservation={handleAddObservation}
            onEditObservation={handleEditObservation}
            onDeleteObservation={handleDeleteObservation}
            columns={appConfig.observationStatuses}
          />
        );

      case ViewMode.SETTINGS:
        return (
          <Settings 
             tasks={tasks}
             logs={logs}
             observations={observations}
             onImportData={handleImportData}
             onSyncConfigUpdate={handleSyncConfigUpdate}
             isSyncEnabled={isSyncEnabled}
             appConfig={appConfig}
             onUpdateConfig={handleUpdateAppConfig}
          />
        );

      case ViewMode.HELP:
        return <UserManual />;
        
      default:
        return <div>Select a view</div>;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-20 shadow-sm`}>
        <div className="p-4 flex items-center gap-3 border-b border-slate-100 h-16">
           <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-indigo-200 shadow-lg">
             P
           </div>
           {isSidebarOpen && (
             <div className="flex flex-col">
                <span className="font-bold text-xl tracking-tight text-slate-800 leading-none">ProTrack<span className="text-indigo-600">AI</span></span>
                <span className="text-xs text-indigo-500 font-bold tracking-wide mt-0.5">Build {BUILD_VERSION}</span>
             </div>
           )}
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
           {[
             { mode: ViewMode.DASHBOARD, icon: LayoutDashboard, label: 'Dashboard' },
             { mode: ViewMode.TASKS, icon: ListTodo, label: 'Task Board' },
             { mode: ViewMode.JOURNAL, icon: BookOpen, label: 'Daily Journal' },
             { mode: ViewMode.OBSERVATIONS, icon: MessageSquare, label: 'Observations' },
           ].map(item => (
             <button
                key={item.mode}
                onClick={() => setView(item.mode)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${view === item.mode ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
             >
                <item.icon size={20} />
                {isSidebarOpen && <span>{item.label}</span>}
             </button>
           ))}

           <div className="pt-4 mt-4 border-t border-slate-100">
             <button
                onClick={() => setView(ViewMode.SETTINGS)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${view === ViewMode.SETTINGS ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
             >
                <SettingsIcon size={20} />
                {isSidebarOpen && <span>Settings</span>}
             </button>
              <button
                onClick={() => setView(ViewMode.HELP)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${view === ViewMode.HELP ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
             >
                <HelpCircle size={20} />
                {isSidebarOpen && <span>User Guide</span>}
             </button>
           </div>
        </nav>

        <div className="p-4 border-t border-slate-100">
           <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg w-full flex justify-center">
              {isSidebarOpen ? <LogOut size={20} className="rotate-180" /> : <Menu size={20} />}
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Top Bar */}
        <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10">
           <div className="flex items-center gap-4 flex-1">
              <div className="relative max-w-md w-full">
                 <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input 
                    type="text" 
                    placeholder="Search tasks, IDs, or descriptions..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                 />
              </div>
           </div>
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                 <div className={`w-2 h-2 rounded-full ${isSyncEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                 <span className="text-xs font-medium text-slate-500">{isSyncEnabled ? 'Synced' : 'Local Mode'}</span>
              </div>
           </div>
        </div>

        {/* View Content */}
        <div className="flex-1 overflow-auto p-6 bg-slate-50 custom-scrollbar">
           {renderContent()}
        </div>

        {/* Report Modal */}
        {showReportModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                   <h2 className="font-bold flex items-center gap-2"><Sparkles size={18}/> Weekly AI Report</h2>
                   <button onClick={() => setShowReportModal(false)} className="hover:bg-white/20 p-1 rounded transition-colors"><X size={20}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                   {isGeneratingReport ? (
                      <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-4">
                          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                          <p>Analyzing your week...</p>
                      </div>
                   ) : (
                      <div className="prose prose-sm max-w-none prose-headings:text-indigo-900 prose-a:text-indigo-600">
                          {/* Basic Markdown rendering replacement since we don't have a library */}
                          {generatedReport.split('\n').map((line, i) => (
                              <p key={i} className={line.startsWith('#') ? 'font-bold text-lg mt-4 mb-2' : line.startsWith('-') ? 'ml-4 list-disc' : 'mb-2'}>
                                  {line.replace(/^#+\s/, '').replace(/^-\s/, '')}
                              </p>
                          ))}
                      </div>
                   )}
                </div>
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                   <button onClick={() => {navigator.clipboard.writeText(generatedReport); alert('Copied!');}} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg">Copy Text</button>
                   <button onClick={() => setShowReportModal(false)} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700">Done</button>
                </div>
             </div>
          </div>
        )}
      </main>

      <AIChat tasks={tasks} logs={logs} onOpenSettings={() => setView(ViewMode.SETTINGS)} />
    </div>
  );
};

export default App;