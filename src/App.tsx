
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
  Repeat,
  Maximize2
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
  FileSystemDirectoryHandle,
  RecurrenceConfig,
  SyncAction
} from './types';

import TaskCard from './components/TaskCard';
import TaskDetailModal from './components/TaskDetailModal';
import DailyJournal from './components/DailyJournal';
import ObservationsLog from './components/ObservationsLog';
import Settings from './components/Settings';
import AIChat from './components/AIChat';
import UserManual from './components/UserManual';
import { FullLogo } from './components/Branding';

import { subscribeToCollections, syncData, initFirebase } from './services/firebaseService';
import { generateWeeklySummary } from './services/geminiService';
import { 
  selectBackupFolder, 
  performBackup, 
  getStoredDirectoryHandle, 
  verifyPermission 
} from './services/backupService';

const BUILD_VERSION = "V4.0.1 - Data Safety Fix";

const DEFAULT_CONFIG: AppConfig = {
  taskStatuses: Object.values(Status),
  taskPriorities: Object.values(Priority),
  observationStatuses: Object.values(ObservationStatus),
  groupLabels: { statuses: "Task Statuses", priorities: "Priorities", observations: "Observation Groups" },
  groupColors: { statuses: "#6366f1", priorities: "#f59e0b", observations: "#8b5cf6" },
  updateHighlightOptions: [
    { id: 'neutral', color: '#94a3b8', label: 'Neutral' },
    { id: 'high', color: '#ef4444', label: 'High Priority' },
    { id: 'warning', color: '#f59e0b', label: 'Warning' },
    { id: 'update', color: '#3b82f6', label: 'Update' },
    { id: 'success', color: '#10b981', label: 'Success' },
    { id: 'note', color: '#8b5cf6', label: 'Note' },
  ],
  itemColors: {}
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
  const [activeTaskTab, setActiveTaskTab] = useState<'current' | 'future' | 'completed'>('current');
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null); 
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null); 
  
  const [showReportModal, setShowReportModal] = useState(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [generatedReport, setGeneratedReport] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const activeTask = useMemo(() => tasks.find(t => t.id === activeTaskId), [tasks, activeTaskId]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    const savedConfig = localStorage.getItem('protrack_firebase_config');
    const localAppConfig = localStorage.getItem('protrack_app_config');
    
    if (localAppConfig) {
      try {
        const parsed = JSON.parse(localAppConfig);
        setAppConfig(prev => ({ ...DEFAULT_CONFIG, ...parsed }));
      } catch (e) { console.error("Config parse error", e); }
    }

    const localData = localStorage.getItem('protrack_data');
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        if (parsed.tasks) setTasks(parsed.tasks);
        if (parsed.logs) setLogs(parsed.logs);
        if (parsed.observations) setObservations(parsed.observations);
        if (parsed.offDays) setOffDays(parsed.offDays);
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
          onTasks: (cloudTasks) => setTasks(cloudTasks),
          onLogs: (cloudLogs) => setLogs(cloudLogs),
          onObservations: (cloudObs) => setObservations(cloudObs),
          onOffDays: (cloudOffDays) => setOffDays(cloudOffDays),
          onConfig: (cloudConfig) => setAppConfig(cloudConfig)
      });
      return () => { if (unsubscribe) unsubscribe(); };
    }
  }, [isSyncEnabled]);

  const updateTaskStatus = (id: string, status: string) => {
    const updatedTasks = tasks.map(t => t.id === id ? { ...t, status } : t);
    setTasks(updatedTasks);
    if (isSyncEnabled) syncData([{ type: 'task', action: 'update', id, data: { status } }]);
  };

  const renderContent = () => {
    switch (view) {
      case ViewMode.DASHBOARD:
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                         <h1 className="text-3xl font-bold flex items-baseline gap-2">
                            {currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            <span className="text-indigo-200 font-mono text-lg">CW {getWeekNumber(currentTime)}</span>
                         </h1>
                         <p className="text-indigo-100 opacity-80 text-sm">{currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</p>
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
          </div>
        );
      case ViewMode.TASKS:
        return (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Tasks</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tasks.map(t => (
                <TaskCard 
                  key={t.id} 
                  task={t} 
                  onUpdateStatus={updateTaskStatus} 
                  onOpenTask={() => setActiveTaskId(t.id)} 
                  statusColors={appConfig.itemColors}
                />
              ))}
            </div>
          </div>
        );
      case ViewMode.OBSERVATIONS:
        return (
          <ObservationsLog 
            observations={observations} 
            onAddObservation={(o) => {
              const newObs = [...observations, o];
              setObservations(newObs);
              if (isSyncEnabled) syncData([{ type: 'observation', action: 'create', id: o.id, data: o }]);
            }} 
            onEditObservation={(o) => {
              const newObs = observations.map(obs => obs.id === o.id ? o : obs);
              setObservations(newObs);
              if (isSyncEnabled) syncData([{ type: 'observation', action: 'update', id: o.id, data: o }]);
            }} 
            onDeleteObservation={(id) => {
              const newObs = observations.filter(obs => obs.id !== id);
              setObservations(newObs);
              if (isSyncEnabled) syncData([{ type: 'observation', action: 'delete', id }]);
            }} 
          />
        );
      case ViewMode.SETTINGS:
        return (
          <Settings 
            tasks={tasks} logs={logs} observations={observations} 
            appConfig={appConfig} isSyncEnabled={isSyncEnabled}
            onUpdateConfig={setAppConfig} onSyncConfigUpdate={() => setIsSyncEnabled(true)}
            onImportData={(d) => { setTasks(d.tasks); setLogs(d.logs); setObservations(d.observations); }}
            onPurgeData={(nt, nl) => { setTasks(nt); setLogs(nl); }}
          />
        );
      case ViewMode.HELP:
        return <UserManual />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transition-all duration-300 flex flex-col z-20`}>
        <div className="p-4 flex items-center gap-3 border-b dark:border-slate-700">
           <FullLogo isSidebarOpen={isSidebarOpen} />
        </div>
        <nav className="flex-1 p-4 space-y-2">
           {[
             { mode: ViewMode.DASHBOARD, icon: LayoutDashboard, label: 'Dashboard' },
             { mode: ViewMode.TASKS, icon: ListTodo, label: 'Tasks' },
             { mode: ViewMode.OBSERVATIONS, icon: MessageSquare, label: 'Observations' },
           ].map(item => (
             <button key={item.mode} onClick={() => setView(item.mode)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${view === item.mode ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                <item.icon size={20} />
                {isSidebarOpen && <span>{item.label}</span>}
             </button>
           ))}
        </nav>
        <div className="p-4 border-t dark:border-slate-700">
           <button onClick={() => setView(ViewMode.SETTINGS)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${view === ViewMode.SETTINGS ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                <SettingsIcon size={20} />
                {isSidebarOpen && <span>Settings</span>}
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white dark:bg-slate-800 border-b dark:border-slate-700 flex items-center justify-between px-6 shrink-0 z-10">
           <div className="relative max-w-md w-full">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border-none rounded-lg text-sm outline-none dark:text-white" />
           </div>
           <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isSyncEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isSyncEnabled ? 'Synced' : 'Local'}</span>
           </div>
        </header>
        <div className="flex-1 overflow-auto p-6 custom-scrollbar">
           {renderContent()}
        </div>

        {activeTask && (
          <TaskDetailModal 
            task={activeTask} 
            allTasks={tasks} 
            onClose={() => setActiveTaskId(null)}
            onUpdateStatus={updateTaskStatus}
            onUpdateTask={(id, fields) => setTasks(tasks.map(t => t.id === id ? { ...t, ...fields } : t))}
            onAddUpdate={(id, content, atts, color) => {
              const task = tasks.find(t => t.id === id);
              if (task) {
                const updated = { ...task, updates: [...task.updates, { id: uuidv4(), timestamp: new Date().toISOString(), content, attachments: atts, highlightColor: color }] };
                setTasks(tasks.map(t => t.id === id ? updated : t));
              }
            }}
            availableStatuses={appConfig.taskStatuses}
            availablePriorities={appConfig.taskPriorities}
            updateTags={appConfig.updateHighlightOptions || []}
            onDeleteTask={(id) => setTasks(tasks.filter(t => t.id !== id))}
            statusColors={appConfig.itemColors}
          />
        )}
      </main>
      <AIChat tasks={tasks} logs={logs} observations={observations} appConfig={appConfig} onOpenSettings={() => setView(ViewMode.SETTINGS)} />
    </div>
  );
};

// CRITICAL: Ensure default export exists to resolve import errors.
export default App;
