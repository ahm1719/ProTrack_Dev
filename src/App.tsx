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
  CalendarDays,
  Target,
  Layers
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

const BUILD_VERSION = "V1.8 (Active)";

const DEFAULT_CONFIG: AppConfig = {
  taskStatuses: Object.values(Status),
  taskPriorities: Object.values(Priority),
  observationStatuses: Object.values(ObservationStatus)
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
  const [generatedReport, setGeneratedReport] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    const savedConfig = localStorage.getItem('protrack_firebase_config');
    const localAppConfig = localStorage.getItem('protrack_app_config');
    
    if (localAppConfig) setAppConfig(JSON.parse(localAppConfig));

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

  const updateTaskStatus = (id: string, status: string) => {
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
    const updated = tasks.map(t => t.id === id ? { ...t, updates: [...t.updates, { id: updateId, timestamp, content }] } : t);
    const newLog: DailyLog = { id: uuidv4(), date: new Date().toLocaleDateString('en-CA'), taskId: id, content };
    persistData(updated, [...logs, newLog], observations, offDays);
  };

  const createNewTask = () => {
    const newTask: Task = {
      id: uuidv4(),
      displayId: `T-${Math.floor(Math.random() * 1000)}`,
      source: `CW${getWeekNumber(new Date())}`,
      projectId: 'General',
      description: 'New Task Description',
      dueDate: new Date().toISOString().split('T')[0],
      status: appConfig.taskStatuses[0] || Status.NOT_STARTED,
      priority: appConfig.taskPriorities[1] || Priority.MEDIUM,
      updates: [],
      createdAt: new Date().toISOString()
    };
    persistData([...tasks, newTask], logs, observations, offDays);
    setHighlightedTaskId(newTask.id);
    setView(ViewMode.TASKS);
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
      map[d] = tasks.filter(t => t.dueDate === d && t.status !== Status.DONE && t.status !== Status.ARCHIVED);
    });
    return map;
  }, [tasks, weekDays]);

  const filteredTasks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const base = tasks.filter(t => t.description.toLowerCase().includes(q) || t.displayId.toLowerCase().includes(q));
    if (activeTaskTab === 'current') return base.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED);
    return base.filter(t => t.status === Status.DONE || t.status === Status.ARCHIVED);
  }, [tasks, searchQuery, activeTaskTab]);

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
                    {/* Integrated Backlog Card */}
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
                <h1 className="text-2xl font-bold text-slate-800">Command Center</h1>
                <button onClick={createNewTask} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                    <Plus size={18} /> New Task
                </button>
             </div>

             <div className="flex gap-4 overflow-x-auto pb-4 snap-x custom-scrollbar shrink-0">
                {weekDays.map(d => (
                    <div key={d} className={`min-w-[240px] w-[240px] p-3 rounded-2xl border flex flex-col h-48 transition-all ${d === todayStr ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-100 shadow-md' : 'bg-white border-slate-200 shadow-sm'}`}>
                        <div className="flex justify-between items-start mb-2 border-b pb-1 border-slate-100">
                            <div>
                                <span className="block text-[10px] font-bold text-slate-400 uppercase">{new Date(d).toLocaleDateString([], { weekday: 'short' })}</span>
                                <span className="text-sm font-bold text-slate-800">{new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                            </div>
                            {d === todayStr && <span className="bg-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold">TODAY</span>}
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {weekTasks[d]?.length ? weekTasks[d].map(t => (
                                <div key={t.id} onClick={() => setHighlightedTaskId(t.id)} className="bg-white p-2 rounded-lg border border-slate-100 text-[10px] shadow-sm hover:border-indigo-400 cursor-pointer">
                                    <span className="font-mono text-indigo-600 font-bold block mb-1">{t.displayId}</span>
                                    <p className="line-clamp-2 text-slate-600 leading-tight">{t.description}</p>
                                </div>
                            )) : <div className="h-full flex items-center justify-center text-[10px] text-slate-300 italic">No deadlines</div>}
                        </div>
                    </div>
                ))}
             </div>

             <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 flex flex-col bg-slate-100/50 rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="bg-white p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button onClick={() => setActiveTaskTab('current')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTaskTab === 'current' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Active Tasks</button>
                            <button onClick={() => setActiveTaskTab('completed')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTaskTab === 'completed' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Archive & Done</button>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{filteredTasks.length} {activeTaskTab} ITEMS</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredTasks.map(t => <TaskCard key={t.id} task={t} onUpdateStatus={updateTaskStatus} onEdit={() => setHighlightedTaskId(t.id)} onDelete={deleteTask} onAddUpdate={addUpdateToTask} autoExpand={t.id === highlightedTaskId} availableStatuses={appConfig.taskStatuses} availablePriorities={appConfig.taskPriorities} onUpdateTask={updateTaskFields} />)}
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        <DailyJournal tasks={tasks} logs={logs} onAddLog={(l) => persistData(tasks, [...logs, { ...l, id: uuidv4() }], observations, offDays)} onUpdateTask={updateTaskFields} offDays={offDays} onToggleOffDay={(d) => persistData(tasks, logs, observations, offDays.includes(d) ? offDays.filter(x => x !== d) : [...offDays, d])} />
                    </div>
                </div>
             </div>
          </div>
        );

      case ViewMode.OBSERVATIONS:
        return <ObservationsLog observations={observations} onAddObservation={o => persistData(tasks, logs, [...observations, o], offDays)} onEditObservation={o => persistData(tasks, logs, observations.map(x => x.id === o.id ? o : x), offDays)} onDeleteObservation={id => persistData(tasks, logs, observations.filter(x => x.id !== id), offDays)} columns={appConfig.observationStatuses} />;
      case ViewMode.SETTINGS:
        return <Settings tasks={tasks} logs={logs} observations={observations} onImportData={d => persistData(d.tasks, d.logs, d.observations, offDays)} onSyncConfigUpdate={c => setIsSyncEnabled(!!c)} isSyncEnabled={isSyncEnabled} appConfig={appConfig} onUpdateConfig={handleUpdateAppConfig} />;
      case ViewMode.HELP:
        return <UserManual />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-20`}>
        <div className="p-4 flex items-center gap-3 border-b h-16">
           <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">P</div>
           {isSidebarOpen && <span className="font-bold text-xl tracking-tight">ProTrack<span className="text-indigo-600">AI</span></span>}
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
           {[
             { mode: ViewMode.DASHBOARD, icon: LayoutDashboard, label: 'Dashboard' },
             { mode: ViewMode.TASKS, icon: ListTodo, label: 'Task Board' },
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
              <input type="text" placeholder="Search everything..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm outline-none" />
           </div>
           <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isSyncEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isSyncEnabled ? 'Cloud Synced' : 'Local Only'}</span>
           </div>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-slate-50 custom-scrollbar">
           {renderContent()}
        </div>

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