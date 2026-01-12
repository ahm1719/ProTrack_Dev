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
  CheckCircle2, 
  Clock, 
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
  TaskAttachment
} from './types';

import TaskCard from './components/TaskCard';
import DailyJournal from './components/DailyJournal';
import ObservationsLog from './components/ObservationsLog';
import Settings from './components/Settings';
import AIChat from './components/AIChat';
import UserManual from './components/UserManual';

import { subscribeToData, saveDataToCloud, initFirebase } from './services/firebaseService';
import { generateWeeklySummary } from './services/geminiService';

const BUILD_VERSION = "V2.0.9";

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
  }
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
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [generatedReport, setGeneratedReport] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [newTaskForm, setNewTaskForm] = useState({
    source: `CW${getWeekNumber(new Date())}`,
    projectId: '',
    displayId: '',
    description: '',
    dueDate: new Date().toISOString().split('T')[0],
    status: Status.NOT_STARTED as string,
    priority: Priority.MEDIUM as string
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    const savedConfig = localStorage.getItem('protrack_firebase_config');
    const localAppConfig = localStorage.getItem('protrack_app_config');
    
    if (localAppConfig) {
      const parsed = JSON.parse(localAppConfig);
      setAppConfig({ ...DEFAULT_CONFIG, ...parsed });
    }

    const localData = localStorage.getItem('protrack_data');
    if (localData) {
      const parsed = JSON.parse(localData);
      setTasks(parsed.tasks || []);
      setLogs(parsed.logs || []);
      setObservations(parsed.observations || []);
      setOffDays(parsed.offDays || []);
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
      const unsubscribe = subscribeToData((data: any) => {
        setTasks(data.tasks || []);
        setLogs(data.logs || []);
        setObservations(data.observations || []);
        if (data.offDays) setOffDays(data.offDays);
      });
      return () => { if (unsubscribe) unsubscribe(); };
    }
  }, [isSyncEnabled]);

  const persistData = (newTasks: Task[], newLogs: DailyLog[], newObs: Observation[], newOffDays: string[]) => {
    setTasks(newTasks);
    setLogs(newLogs);
    setObservations(newObs);
    setOffDays(newOffDays);
    localStorage.setItem('protrack_data', JSON.stringify({ tasks: newTasks, logs: newLogs, observations: newObs, offDays: newOffDays }));
    if (isSyncEnabled) saveDataToCloud({ tasks: newTasks, logs: newLogs, observations: newObs, offDays: newOffDays });
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

  const handleCreateTask = (e: React.FormEvent) => {
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

  const addUpdateToTask = (id: string, content: string, attachments?: TaskAttachment[]) => {
    const timestamp = new Date().toISOString();
    const updateId = uuidv4();
    const updated = tasks.map(t => t.id === id ? { ...t, updates: [...t.updates, { id: updateId, timestamp, content, attachments }] } : t);
    const newLog: DailyLog = { id: uuidv4(), date: new Date().toLocaleDateString('en-CA'), taskId: id, content };
    persistData(updated, [...logs, newLog], observations, offDays);
  };

  const handleEditUpdate = (taskId: string, updateId: string, content: string, timestamp?: string) => {
    const newTasks = tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          updates: t.updates.map(u => u.id === updateId ? { ...u, content, timestamp: timestamp || u.timestamp } : u)
        };
      }
      return t;
    });

    const newLogs = logs.map(l => {
      if (l.taskId === taskId) {
        const originalTask = tasks.find(t => t.id === taskId);
        const originalUpdate = originalTask?.updates.find(u => u.id === updateId);
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
    if (confirm('Delete task?')) {
      persistData(tasks.filter(t => t.id !== id), logs, observations, offDays);
    }
  };

  const handleUpdateAppConfig = (newConfig: AppConfig) => {
    setAppConfig(newConfig);
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
      map[d] = tasks.filter(t => t.dueDate === d);
    });
    return map;
  }, [tasks, weekDays]);

  const filteredTasks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const base = tasks.filter(t => t.description.toLowerCase().includes(q) || t.displayId.toLowerCase().includes(q));
    if (activeTaskTab === 'current') return base.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED);
    return base.filter(t => t.status === Status.DONE || t.status === Status.ARCHIVED);
  }, [tasks, searchQuery, activeTaskTab]);

  const getStatusColorMini = (s: string) => {
    switch (s) {
      case Status.DONE:
        return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      case Status.IN_PROGRESS:
        return 'bg-blue-50 border-blue-200 text-blue-700';
      case Status.WAITING:
        return 'bg-amber-50 border-amber-200 text-amber-700';
      case Status.ARCHIVED:
        return 'bg-slate-100 border-slate-200 text-slate-400 opacity-75';
      default:
        return 'bg-white border-slate-100 text-slate-600';
    }
  };

  const renderContent = () => {
    switch (view) {
      case ViewMode.DASHBOARD:
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
                        try { const r = await generateWeeklySummary(tasks, logs); setGeneratedReport(r); } 
                        catch (e: any) { setGeneratedReport(e.message); } finally { setIsGeneratingReport(false); }
                    }} className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-6 py-2.5 rounded-xl transition-all text-sm font-bold border border-white/10 shadow-lg backdrop-blur-sm">
                        <Sparkles size={18} /> Weekly Report
                    </button>
                </div>
             </div>

             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Layers size={14} /> Weekly Status Distribution
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div className="bg-indigo-600 p-4 rounded-xl flex flex-col justify-between shadow-md shadow-indigo-100">
                        <span className="text-[10px] font-bold text-indigo-100 uppercase tracking-wider">Active Backlog</span>
                        <div className="flex items-end justify-between mt-2">
                            <span className="text-3xl font-black text-white">{weeklyFocusCount}</span>
                            <Target size={20} className="text-indigo-300" />
                        </div>
                    </div>
                    {statusSummary.map(s => (
                        <div key={s.label} className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex flex-col justify-between hover:bg-white hover:border-indigo-100 transition-all group">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-indigo-500 truncate">{s.label}</span>
                            <div className="flex items-end justify-between mt-2">
                                <span className="text-3xl font-black text-slate-800">{s.count}</span>
                                <div className="p-1 bg-white rounded border border-slate-100 shadow-xs">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-indigo-400" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
             </div>

             {overdueTasks.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-6">
                    <h3 className="text-red-800 font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                        <AlertTriangle size={18} /> Overdue Items ({overdueTasks.length})
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {overdueTasks.map(t => <TaskCard key={t.id} task={t} onUpdateStatus={updateTaskStatus} onEdit={() => { setHighlightedTaskId(t.id); setView(ViewMode.TASKS); }} onDelete={deleteTask} onAddUpdate={addUpdateToTask} availableStatuses={appConfig.taskStatuses} availablePriorities={appConfig.taskPriorities} onUpdateTask={updateTaskFields} />)}
                    </div>
                </div>
             )}
          </div>
        );

      case ViewMode.TASKS:
        return (
          <div className="h-full flex flex-col space-y-6 animate-fade-in">
             <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Daily Tasks</h1>
                <button onClick={() => setShowNewTaskModal(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 font-bold">
                    <Plus size={20} /> New Task
                </button>
             </div>

             <div className="flex gap-4 overflow-x-auto pb-4 snap-x custom-scrollbar shrink-0 h-56">
                {weekDays.map(d => (
                    <div key={d} className={`min-w-[280px] w-[280px] p-4 rounded-2xl border flex flex-col transition-all ${d === todayStr ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-100 shadow-md scale-105 z-10' : 'bg-white border-slate-200 shadow-sm'}`}>
                        <div className="flex justify-between items-start mb-3 border-b pb-2 border-slate-100">
                            <div>
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(d).toLocaleDateString([], { weekday: 'long' })}</span>
                                <span className="text-lg font-bold text-slate-800">{new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                            </div>
                            {d === todayStr && <span className="bg-indigo-600 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">TODAY</span>}
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {weekTasks[d]?.length ? weekTasks[d].map(t => (
                                <div 
                                  key={t.id} 
                                  onClick={() => setHighlightedTaskId(t.id)} 
                                  className={`p-3 rounded-xl border text-xs shadow-sm hover:ring-2 hover:ring-indigo-300 transition-all cursor-pointer group ${getStatusColorMini(t.status)}`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="font-mono font-bold">{t.displayId}</span>
                                      {t.status === Status.DONE && <CheckCircle2 size={12} className="text-emerald-600" />}
                                      {t.status === Status.IN_PROGRESS && <Clock size={12} className="text-blue-600" />}
                                    </div>
                                    <p className={`line-clamp-2 leading-tight ${t.status === Status.DONE ? 'line-through opacity-60' : ''}`}>{t.description}</p>
                                </div>
                            )) : <div className="h-full flex items-center justify-center text-[10px] text-slate-300 italic">No deadlines</div>}
                        </div>
                    </div>
                ))}
             </div>

             <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 flex flex-col bg-slate-100/50 rounded-2xl border border-slate-200 overflow-hidden shadow-inner">
                    <div className="bg-white p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button onClick={() => setActiveTaskTab('current')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTaskTab === 'current' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Active Tasks</button>
                            <button onClick={() => setActiveTaskTab('completed')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeTaskTab === 'completed' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Archive & Done</button>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{filteredTasks.length} {activeTaskTab} ITEMS</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {filteredTasks.map(t => <TaskCard key={t.id} task={t} onUpdateStatus={updateTaskStatus} onEdit={() => setHighlightedTaskId(t.id)} onDelete={deleteTask} onAddUpdate={addUpdateToTask} onEditUpdate={handleEditUpdate} onDeleteUpdate={handleDeleteUpdate} autoExpand={t.id === highlightedTaskId} availableStatuses={appConfig.taskStatuses} availablePriorities={appConfig.taskPriorities} onUpdateTask={updateTaskFields} isDailyView={true} />)}
                        </div>
                        {filteredTasks.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-300 opacity-50">
                                <ListTodo size={48} className="mb-4" />
                                <p className="font-bold">No tasks match your criteria</p>
                            </div>
                        )}
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        <DailyJournal tasks={tasks} logs={logs} onAddLog={(l) => persistData(tasks, [...logs, { ...l, id: uuidv4() }], observations, offDays)} onUpdateTask={updateTaskFields} offDays={offDays} onToggleOffDay={(d) => persistData(tasks, logs, observations, offDays.includes(d) ? offDays.filter(x => x !== d) : [...offDays, d])} />
                    </div>
                </div>
             </div>
          </div>
        );

      case ViewMode.OBSERVATIONS:
        return <ObservationsLog observations={observations} onAddObservation={o => persistData(tasks, logs, [...observations, o], offDays)} onEditObservation={o => persistData(tasks, logs, observations.map(x => x.id === o.id ? o : x), offDays)} onDeleteObservation={id => persistData(tasks, logs, observations.filter(x => x.id !== id), offDays)} columns={appConfig.observationStatuses} />;
      case ViewMode.SETTINGS:
        return (
          <Settings 
            tasks={tasks} 
            logs={logs} 
            observations={observations} 
            onImportData={(d) => persistData(d.tasks, d.logs, d.observations, offDays)} 
            onSyncConfigUpdate={c => setIsSyncEnabled(!!c)} 
            isSyncEnabled={isSyncEnabled} 
            appConfig={appConfig} 
            onUpdateConfig={handleUpdateAppConfig} 
            onPurgeData={(newTasks: Task[], newLogs: DailyLog[]) => persistData(newTasks, newLogs, observations, offDays)} 
          />
        );
      case ViewMode.HELP:
        return <UserManual />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-20`}>
        <div className="p-4 flex flex-col items-center gap-1 border-b h-24 justify-center">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">P</div>
              {isSidebarOpen && <span className="font-bold text-xl tracking-tight">ProTrack<span className="text-indigo-600">AI</span></span>}
           </div>
           {isSidebarOpen && <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-widest">{BUILD_VERSION}</span>}
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
           {[
             { mode: ViewMode.DASHBOARD, icon: LayoutDashboard, label: 'Dashboard' },
             { mode: ViewMode.TASKS, icon: ListTodo, label: 'Daily Tasks' },
             { mode: ViewMode.OBSERVATIONS, icon: MessageSquare, label: 'Observations' },
           ].map(item => (
             <button key={item.mode} onClick={() => setView(item.mode)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${view === item.mode ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}>
                <item.icon size={20} />
                {isSidebarOpen && <span>{item.label}</span>}
             </button>
           ))}
           <div className="pt-4 mt-4 border-t">
             <button onClick={() => setView(ViewMode.SETTINGS)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${view === ViewMode.SETTINGS ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}>
                <SettingsIcon size={20} />
                {isSidebarOpen && <span>Settings</span>}
             </button>
             <button onClick={() => setView(ViewMode.HELP)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${view === ViewMode.HELP ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}>
                <HelpCircle size={20} />
                {isSidebarOpen && <span>User Guide</span>}
             </button>
           </div>
        </nav>
        <div className="p-4 border-t">
           <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg w-full flex justify-center">
              {isSidebarOpen ? <LogOut size={20} className="rotate-180" /> : <Menu size={20} />}
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="h-16 bg-white border-b flex items-center justify-between px-6 shrink-0 z-10">
           <div className="relative max-w-md w-full">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search tasks, logs, projects..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm outline-none" />
           </div>
           <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isSyncEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isSyncEnabled ? 'Cloud Synced' : 'Local Only'}</span>
           </div>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-slate-50 custom-scrollbar">
           {renderContent()}
        </div>

        {/* New Task Modal */}
        {showNewTaskModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <form onSubmit={handleCreateTask} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
                <div className="p-5 border-b flex justify-between items-center bg-indigo-600 text-white">
                   <h2 className="font-bold flex items-center gap-2"><Plus size={20}/> Create New Task</h2>
                   <button type="button" onClick={() => setShowNewTaskModal(false)}><X size={20}/></button>
                </div>
                <div className="p-6 space-y-4">
                   {modalError && (
                     <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 text-xs font-bold">
                        <AlertTriangle size={16} /> {modalError}
                     </div>
                   )}
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Source (CW)</label>
                         <div className="relative">
                            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input required value={newTaskForm.source} onChange={e => setNewTaskForm({...newTaskForm, source: e.target.value})} className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-100" />
                         </div>
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Project ID</label>
                         <div className="relative">
                            <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input required list="active-projects" value={newTaskForm.projectId} onChange={e => {
                                const pid = e.target.value;
                                setNewTaskForm({...newTaskForm, projectId: pid, displayId: suggestNextId(pid)});
                            }} placeholder="Project Name..." className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-100" />
                            <datalist id="active-projects">
                               {activeProjects.map(p => <option key={p} value={p} />)}
                            </datalist>
                         </div>
                      </div>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Display ID</label>
                      <input required value={newTaskForm.displayId} onChange={e => setNewTaskForm({...newTaskForm, displayId: e.target.value})} placeholder="PRJ-001..." className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-100" />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</label>
                      <textarea required value={newTaskForm.description} onChange={e => setNewTaskForm({...newTaskForm, description: e.target.value})} rows={3} placeholder="What needs to be done?" className="w-full px-3 py-2 text-sm bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 resize-none" />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Due Date</label>
                         <input type="date" value={newTaskForm.dueDate} onChange={e => setNewTaskForm({...newTaskForm, dueDate: e.target.value})} className="w-full px-3 py-2 text-sm bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-100" />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Priority</label>
                         <select value={newTaskForm.priority} onChange={e => setNewTaskForm({...newTaskForm, priority: e.target.value})} className="w-full px-3 py-2 text-sm bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-100">
                            {appConfig.taskPriorities.map(p => <option key={p} value={p}>{p}</option>)}
                         </select>
                      </div>
                   </div>
                </div>
                <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
                   <button type="button" onClick={() => setShowNewTaskModal(false)} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-all">Cancel</button>
                   <button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all">Create Task</button>
                </div>
             </form>
          </div>
        )}

        {showReportModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-indigo-600 text-white">
                   <h2 className="font-bold flex items-center gap-2"><Sparkles size={18}/> Weekly AI Report</h2>
                   <button onClick={() => setShowReportModal(false)}><X size={20}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                   {isGeneratingReport ? <div className="flex flex-col items-center justify-center py-12 gap-4"><div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div><p>Analyzing week...</p></div> : <div className="prose prose-sm max-w-none">{generatedReport.split('\n').map((line, i) => <p key={i}>{line}</p>)}</div>}
                </div>
                <div className="p-4 border-t flex justify-end gap-2 bg-slate-50">
                   <button onClick={() => { navigator.clipboard.writeText(generatedReport); alert('Copied!'); }} className="px-4 py-2 text-slate-600 font-bold rounded-lg hover:bg-slate-200">Copy</button>
                   <button onClick={() => setShowReportModal(false)} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">Close</button>
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