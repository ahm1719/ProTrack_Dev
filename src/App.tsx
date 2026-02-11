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
  Maximize2,
  FileText,
  StickyNote,
  ArrowRight
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

const BUILD_VERSION = "V4.4.6 - Search Shortcut";

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
  itemColors: {},
  aiReportConfig: {
    customInstructions: '',
    periodType: 'current_week'
  }
};

const getWeekNumber = (d: Date): number => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const getEndOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? 0 : 7); 
  const endOfWeek = new Date(d.setDate(diff));
  endOfWeek.setHours(23, 59, 59, 999);
  return endOfWeek.toISOString().split('T')[0];
};

// Helper for fuzzy date matching (Supports YYYY-MM-DD and DD/MM)
const checkDateMatch = (dateStr: string | undefined, query: string) => {
  if (!dateStr) return false;
  // 1. Direct Match (ISO format)
  if (dateStr.includes(query)) return true;
  
  // 2. DD/MM Format Match
  const parts = dateStr.split('-');
  if (parts.length === 3) {
      const [y, m, d] = parts;
      const ddmm = `${d}/${m}`;
      if (ddmm.includes(query)) return true;
  }
  return false;
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
  const [showSearchResults, setShowSearchResults] = useState(false);
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
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState<string | null>(null);

  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // --- Add Missing States ---
  const [newTaskForm, setNewTaskForm] = useState({
    source: `CW${getWeekNumber(new Date())}`,
    projectId: '',
    displayId: '',
    description: '',
    dueDate: new Date().toISOString().split('T')[0],
    status: Status.NOT_STARTED as string,
    priority: Priority.MEDIUM as string,
    recurrenceType: 'none',
    recurrenceInterval: 1
  });

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const [backupSettings, setBackupSettings] = useState<BackupSettings>({ enabled: false, intervalMinutes: 10, lastBackup: null, folderName: null });
  const [backupStatus, setBackupStatus] = useState<'idle' | 'running' | 'error' | 'permission_needed'>('idle');
  const backupDirHandle = useRef<FileSystemDirectoryHandle | null>(null);

  // Refs to track hydration status to prevent accidental wipes during first cloud contact
  const isHydrated = useRef({ tasks: false, logs: false, observations: false });

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('protrack_theme') === 'dark');

  const activeTask = useMemo(() => tasks.find(t => t.id === activeTaskId), [tasks, activeTaskId]);

  // --- Global Search Logic ---
  const globalSearchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return null;
    const q = searchQuery.toLowerCase();

    const matchedTasks = tasks.filter(t => 
      t.displayId.toLowerCase().includes(q) ||
      t.projectId.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      checkDateMatch(t.dueDate, q) ||
      t.updates.some(u => u.content.toLowerCase().includes(q))
    ).slice(0, 10);

    const matchedLogs = logs.filter(l => 
      l.content.toLowerCase().includes(q) ||
      checkDateMatch(l.date, q)
    ).slice(0, 10);

    const matchedObs = observations.filter(o => 
      o.content.toLowerCase().includes(q)
    ).slice(0, 10);

    const total = matchedTasks.length + matchedLogs.length + matchedObs.length;
    if (total === 0) return null;

    return { tasks: matchedTasks, logs: matchedLogs, observations: matchedObs };
  }, [searchQuery, tasks, logs, observations]);

  // --- Add Missing Helper Functions ---
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

  // Sync state with localStorage whenever items change
  useEffect(() => {
    localStorage.setItem('protrack_data', JSON.stringify({ tasks, logs, observations, offDays }));
  }, [tasks, logs, observations, offDays]);

  // Apply Theme
  useEffect(() => {
    if (isDarkMode) { document.documentElement.classList.add('dark'); localStorage.setItem('protrack_theme', 'dark'); } 
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('protrack_theme', 'light'); }
  }, [isDarkMode]);

  // Handle global Escape key to close modals and search
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSearchResults) setShowSearchResults(false);
        else if (dashboardStatusFilter) setDashboardStatusFilter(null);
        else if (expandedDay) setExpandedDay(null);
        else if (showReportModal) setShowReportModal(false);
        else if (showNewTaskModal) setShowNewTaskModal(false);
        else if (activeTaskId) setActiveTaskId(null);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [expandedDay, showReportModal, showNewTaskModal, activeTaskId, showSearchResults, dashboardStatusFilter]);

  // Global Keyboard Shortcuts (Ctrl+F)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

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

    const initBackup = async () => {
        const savedSettings = localStorage.getItem('protrack_backup_settings');
        if (savedSettings) setBackupSettings(JSON.parse(savedSettings));
        const handle = await getStoredDirectoryHandle();
        if (handle) backupDirHandle.current = handle;
    };
    initBackup();

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isSyncEnabled) {
      const unsubscribe = subscribeToCollections({
          onTasks: (cloudTasks) => {
              setTasks(prev => {
                  if (cloudTasks.length === 0 && prev.length > 0 && !isHydrated.current.tasks) {
                      syncData([{ type: 'full', action: 'overwrite', data: { tasks: prev } }]);
                      isHydrated.current.tasks = true;
                      return prev;
                  }
                  isHydrated.current.tasks = true;
                  return cloudTasks;
              });
          },
          onLogs: (cloudLogs) => {
              setLogs(prev => {
                  if (cloudLogs.length === 0 && prev.length > 0 && !isHydrated.current.logs) {
                      syncData([{ type: 'full', action: 'overwrite', data: { logs: prev } }]);
                      isHydrated.current.logs = true;
                      return prev;
                  }
                  isHydrated.current.logs = true;
                  return cloudLogs;
              });
          },
          onObservations: (cloudObs) => {
              setObservations(prev => {
                  if (cloudObs.length === 0 && prev.length > 0 && !isHydrated.current.observations) {
                      syncData([{ type: 'full', action: 'overwrite', data: { observations: prev } }]);
                      isHydrated.current.observations = true;
                      return prev;
                  }
                  isHydrated.current.observations = true;
                  return cloudObs;
              });
          },
          onOffDays: (days) => setOffDays(days),
          onConfig: (conf) => setAppConfig(prev => ({ ...prev, ...conf }))
      });
      return () => { if (unsubscribe) unsubscribe(); };
    }
  }, [isSyncEnabled]);

  const handleCreateTask = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    setModalError(null);

    const isDuplicate = tasks.some(t => t.displayId.toLowerCase() === newTaskForm.displayId.toLowerCase());
    if (isDuplicate) {
      setModalError(`Duplicate Display ID: "${newTaskForm.displayId}" already exists.`);
      return;
    }

    let recurrenceConfig: RecurrenceConfig | undefined = undefined;
    if (newTaskForm.recurrenceType !== 'none') {
        recurrenceConfig = { type: newTaskForm.recurrenceType as any, interval: newTaskForm.recurrenceInterval };
    }

    const newTask: Task = { ...newTaskForm, recurrence: recurrenceConfig, id: uuidv4(), updates: [], createdAt: new Date().toISOString() };
    
    setTasks(prev => {
        const next = [...prev, newTask];
        if (isSyncEnabled) syncData([{ type: 'task', action: 'create', id: newTask.id, data: newTask }]);
        return next;
    });
    
    setHighlightedTaskId(newTask.id); 
    setActiveTaskId(newTask.id); 
    setShowNewTaskModal(false);
    setNewTaskForm({
      source: `CW${getWeekNumber(new Date())}`, projectId: '', displayId: '', description: '',
      dueDate: new Date().toISOString().split('T')[0], status: appConfig.taskStatuses[0] || Status.NOT_STARTED,
      priority: appConfig.taskPriorities[1] || Priority.MEDIUM, recurrenceType: 'none', recurrenceInterval: 1
    });
    setView(ViewMode.TASKS);
  };

  const calculateNextDate = (currentDateStr: string, type: string, interval: number): string => {
      const [y, m, d] = currentDateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d); 
      if (type === 'daily') date.setDate(date.getDate() + interval);
      if (type === 'weekly') date.setDate(date.getDate() + (interval * 7));
      if (type === 'monthly') date.setMonth(date.getMonth() + interval);
      if (type === 'yearly') date.setFullYear(date.getFullYear() + interval);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const updateTaskStatus = (id: string, newStatus: string) => {
    setTasks(prevTasks => {
        const task = prevTasks.find(t => t.id === id);
        if (!task || task.status === newStatus) return prevTasks;

        const timestamp = new Date().toISOString();
        const dateStr = timestamp.split('T')[0];

        if (newStatus === Status.DONE && task.recurrence && task.dueDate) {
            const nextDate = calculateNextDate(task.dueDate, task.recurrence.type, task.recurrence.interval);
            const recurLog = { id: uuidv4(), date: dateStr, taskId: task.id, content: `Completed cycle. Rescheduled from ${task.dueDate} to ${nextDate}` };
            setLogs(prevLogs => {
                if (isSyncEnabled) syncData([{ type: 'log', action: 'create', id: recurLog.id, data: recurLog }]);
                return [...prevLogs, recurLog];
            });
            const updatedTask = {
                ...task, status: Status.NOT_STARTED, dueDate: nextDate,
                updates: [...task.updates, { id: uuidv4(), timestamp, content: `Completed recurrence cycle. Due date advanced: ${task.dueDate} → ${nextDate}`, highlightColor: '#10b981' }],
                subtasks: task.subtasks?.map(st => ({...st, completed: false, completedAt: undefined}))
            };
            if (isSyncEnabled) syncData([{ type: 'task', action: 'update', id: updatedTask.id, data: updatedTask }]);
            return prevTasks.map(t => t.id === id ? updatedTask : t);
        }

        const content = `Status: ${task.status} → ${newStatus}`;
        const newLog = { id: uuidv4(), date: dateStr, taskId: id, content };
        const updatedTask = { ...task, status: newStatus, updates: [...task.updates, { id: uuidv4(), timestamp, content, highlightColor: '#6366f1' }] };

        setLogs(prevLogs => {
            if (isSyncEnabled) syncData([{ type: 'log', action: 'create', id: newLog.id, data: newLog }]);
            return [...prevLogs, newLog];
        });
        if (isSyncEnabled) syncData([{ type: 'task', action: 'update', id: updatedTask.id, data: updatedTask }]);
        return prevTasks.map(t => t.id === id ? updatedTask : t);
    });
  };

  const updateTaskFields = (id: string, fields: Partial<Task>) => {
    setTasks(prevTasks => {
        const currentTask = prevTasks.find(t => t.id === id);
        if (!currentTask) return prevTasks;
        const updatedTask = { ...currentTask, ...fields };
        if (isSyncEnabled) syncData([{ type: 'task', action: 'update', id: updatedTask.id, data: updatedTask }]);
        return prevTasks.map(t => t.id === id ? updatedTask : t);
    });
  };

  const addUpdateToTask = (id: string, content: string, attachments?: TaskAttachment[], highlightColor?: string) => {
    const timestamp = new Date().toISOString();
    const updateId = uuidv4();
    const newLog: DailyLog = { id: uuidv4(), date: new Date().toLocaleDateString('en-CA'), taskId: id, content };
    setLogs(prev => {
        if (isSyncEnabled) syncData([{ type: 'log', action: 'create', id: newLog.id, data: newLog }]);
        return [...prev, newLog];
    });
    setTasks(prevTasks => {
        const task = prevTasks.find(t => t.id === id);
        if (!task) return prevTasks;
        const updatedTask = { ...task, attachments: attachments ? [...(task.attachments || []), ...attachments] : task.attachments, updates: [...task.updates, { id: updateId, timestamp, content, highlightColor }] };
        if (isSyncEnabled) syncData([{ type: 'task', action: 'update', id: updatedTask.id, data: updatedTask }]);
        return prevTasks.map(t => t.id === id ? updatedTask : t);
    });
  };

  const handleEditUpdate = (taskId: string, updateId: string, content: string, timestamp?: string, highlightColor?: string | null) => {
    setTasks(prevTasks => {
        const task = prevTasks.find(t => t.id === taskId);
        if (!task) return prevTasks;
        const updatedTask = { ...task, updates: task.updates.map(u => u.id === updateId ? { ...u, content, timestamp: timestamp || u.timestamp, highlightColor: highlightColor === null ? undefined : highlightColor } : u) };
        setLogs(prevLogs => {
            const originalUpdate = task.updates.find(u => u.id === updateId);
            const syncActions: SyncAction[] = [{ type: 'task', action: 'update', id: updatedTask.id, data: updatedTask }];
            const nextLogs = prevLogs.map(l => {
                if (l.taskId === taskId && l.content === originalUpdate?.content) {
                    const updatedLog = { ...l, content, date: timestamp ? timestamp.split('T')[0] : l.date };
                    syncActions.push({ type: 'log', action: 'update', id: updatedLog.id, data: updatedLog });
                    return updatedLog;
                }
                return l;
            });
            if (isSyncEnabled) syncData(syncActions);
            return nextLogs;
        });
        return prevTasks.map(t => t.id === taskId ? updatedTask : t);
    });
  };

  const handleDeleteUpdate = (taskId: string, updateId: string) => {
    if (!confirm('Delete this history record?')) return;
    setTasks(prevTasks => {
        const task = prevTasks.find(t => t.id === taskId);
        if (!task) return prevTasks;
        const update = task.updates.find(u => u.id === updateId);
        const updatedTask = { ...task, updates: task.updates.filter(u => u.id !== updateId) };
        setLogs(prevLogs => {
            let logIdToDelete: string | undefined;
            const nextLogs = prevLogs.filter(l => {
                const isMatch = l.taskId === taskId && l.content === update?.content;
                if (isMatch) logIdToDelete = l.id;
                return !isMatch;
            });
            const actions: SyncAction[] = [{ type: 'task', action: 'update', id: updatedTask.id, data: updatedTask }];
            if (logIdToDelete) actions.push({ type: 'log', action: 'delete', id: logIdToDelete });
            if (isSyncEnabled) syncData(actions);
            return nextLogs;
        });
        return prevTasks.map(t => t.id === taskId ? updatedTask : t);
    });
  };

  const deleteTask = (id: string) => {
    if (!confirm('Delete task?')) return;
    setTasks(prev => {
        if (isSyncEnabled) syncData([{ type: 'task', action: 'delete', id }]);
        return prev.filter(t => t.id !== id);
    });
  };

  const handleEditLog = (logId: string, taskId: string, content: string, date: string) => {
    const updatedLog = { id: logId, taskId, content, date };
    setLogs(prev => {
        if (isSyncEnabled) syncData([{ type: 'log', action: 'update', id: logId, data: updatedLog }]);
        return prev.map(l => l.id === logId ? updatedLog : l);
    });
  };

  const handleDeleteLog = (logId: string) => {
    if (!confirm('Delete entry?')) return;
    setLogs(prev => {
        if (isSyncEnabled) syncData([{ type: 'log', action: 'delete', id: logId }]);
        return prev.filter(l => l.id !== logId);
    });
  };

  const handleUpdateAppConfig = (newConfig: AppConfig) => {
    setAppConfig(newConfig);
    localStorage.setItem('protrack_app_config', JSON.stringify(newConfig));
    if (isSyncEnabled) syncData([{ type: 'config', action: 'update', data: newConfig }]);
  };

  const handleDragStart = (name: string, taskId: string) => {
    setDraggedTaskId(taskId);
  };

  const handleDrop = (e: React.DragEvent, targetTaskId: string, dateStr: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("text/plain");
    if (!draggedId || draggedId === targetTaskId) { setDraggedTaskId(null); return; }
    setTasks(prevTasks => {
        const dayTaskList = prevTasks.filter(t => t.dueDate === dateStr);
        const fromIndex = dayTaskList.findIndex(t => t.id === draggedId);
        const toIndex = dayTaskList.findIndex(t => t.id === targetTaskId);
        if (fromIndex === -1 || toIndex === -1) return prevTasks;
        const newList = [...dayTaskList];
        const [movedItem] = newList.splice(fromIndex, 1);
        newList.splice(toIndex, 0, movedItem);
        const orderMap = new Map();
        newList.forEach((t, index) => orderMap.set(t.id, index));
        const syncActions: SyncAction[] = [];
        const finalTasks = prevTasks.map(t => {
            if (orderMap.has(t.id)) {
                const newOrder = orderMap.get(t.id);
                if (t.order !== newOrder) {
                    const updated = { ...t, order: newOrder };
                    syncActions.push({ type: 'task', action: 'update', id: updated.id, data: updated });
                    return updated;
                }
            }
            return t;
        });
        if (isSyncEnabled && syncActions.length > 0) syncData(syncActions);
        return finalTasks;
    });
    setDraggedTaskId(null);
  };

  const todayStr = new Date().toLocaleDateString('en-CA');
  const weeklyFocusCount = useMemo(() => tasks.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED).length, [tasks]);
  const statusSummary = useMemo(() => appConfig.taskStatuses.map(s => ({ label: s, count: tasks.filter(t => t.status === s).length })), [tasks, appConfig.taskStatuses]);
  const overdueTasks = useMemo(() => tasks.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED && t.dueDate && t.dueDate < todayStr), [tasks, todayStr]);
  const highPriorityDueToday = useMemo(() => tasks.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED && t.priority === Priority.HIGH && t.dueDate === todayStr), [tasks, todayStr]);

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
    const getWeight = (p: string) => { if (p === Priority.HIGH) return 3; if (p === Priority.MEDIUM) return 2; if (p === Priority.LOW) return 1; return 0; };
    weekDays.forEach(d => {
      const dayTasks = tasks.filter(t => t.dueDate === d);
      dayTasks.sort((a, b) => {
          if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
          const wA = getWeight(a.priority), wB = getWeight(b.priority);
          if (wA !== wB) return wB - wA; 
          return a.displayId.localeCompare(b.displayId, undefined, { numeric: true });
      });
      map[d] = dayTasks;
    });
    return map;
  }, [tasks, weekDays]);

  const filteredTasks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const base = tasks.filter(t => 
        t.description.toLowerCase().includes(q) || 
        t.displayId.toLowerCase().includes(q) || 
        checkDateMatch(t.dueDate, q) || 
        t.updates.some(u => u.content.toLowerCase().includes(q))
    );
    if (activeTaskTab === 'completed') return base.filter(t => t.status === Status.DONE || t.status === Status.ARCHIVED);
    const activeBase = base.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED);
    const endOfWeek = getEndOfWeek(new Date());
    if (activeTaskTab === 'future') return activeBase.filter(t => t.dueDate && t.dueDate > endOfWeek);
    return activeBase.filter(t => !t.dueDate || t.dueDate <= endOfWeek);
  }, [tasks, searchQuery, activeTaskTab]);

  const getStatusColorHex = (s: string) => {
      if (appConfig.itemColors && appConfig.itemColors[s]) return appConfig.itemColors[s];
      if (s === Status.DONE) return '#10b981';
      if (s === Status.IN_PROGRESS) return '#3b82f6';
      if (s === Status.WAITING) return '#f59e0b';
      if (s === Status.ARCHIVED) return '#64748b';
      return '#cbd5e1'; 
  };

  const handleSearchResultClick = (type: 'task' | 'obs' | 'log', id: string) => {
    setShowSearchResults(false);
    setSearchQuery('');
    
    if (type === 'task') {
      setActiveTaskId(id);
    } else if (type === 'obs') {
      setView(ViewMode.OBSERVATIONS);
      // Logic to highlight specific obs could be added here if needed
    } else if (type === 'log') {
      const log = logs.find(l => l.id === id);
      if (log && log.taskId) {
        setActiveTaskId(log.taskId);
      } else {
        setView(ViewMode.TASKS);
      }
    }
  };

  const renderContent = () => {
    switch (view) {
      case ViewMode.DASHBOARD:
        return (
          <div className="space-y-6 animate-fade-in">
             <div className="bg-gradient-to-r from-indigo-600 to-purple-700 dark:from-indigo-900 dark:to-purple-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                         <h1 className="text-3xl font-bold flex items-baseline gap-2">{currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}<span className="text-indigo-200 font-mono text-lg">CW {getWeekNumber(currentTime)}</span></h1>
                         <p className="text-indigo-100 opacity-80 text-sm">{currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <button onClick={async () => {
                        setIsGeneratingReport(true); setShowReportModal(true);
                        try { const r = await generateWeeklySummary(tasks, logs, appConfig); setGeneratedReport(r); } 
                        catch (e: any) { setGeneratedReport(e.message); } finally { setIsGeneratingReport(false); }
                    }} className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-6 py-2.5 rounded-xl transition-all text-sm font-bold border border-white/10 shadow-lg backdrop-blur-sm"><Sparkles size={18} /> Generate Progress Report</button>
                </div>
             </div>
             <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
                    <div><h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><Target size={20} className="text-indigo-600 dark:text-indigo-400" />Task Distribution</h3></div>
                    <div className="flex flex-col items-end"><div className="flex items-baseline gap-2"><span className="text-4xl font-black text-indigo-600 dark:text-indigo-400">{weeklyFocusCount}</span><span className="text-slate-400 dark:text-slate-500 text-sm font-bold uppercase tracking-wider">Active Tasks</span></div></div>
                </div>
                <div className="h-8 bg-slate-50 dark:bg-slate-900 rounded-xl overflow-hidden flex shadow-inner mb-8 border border-slate-100 dark:border-slate-800">
                    {statusSummary.map((s) => s.count > 0 && (<div key={s.label} style={{ width: `${tasks.length > 0 ? (s.count / tasks.length) * 100 : 0}%`, backgroundColor: getStatusColorHex(s.label) }} className="h-full border-r border-white/20 last:border-0 relative group transition-all hover:opacity-90 flex items-center justify-center" title={`${s.label}: ${s.count}`}></div>))}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {statusSummary.map(s => {
                        const isZero = s.count === 0, percentage = tasks.length > 0 ? Math.round((s.count / tasks.length) * 100) : 0;
                        return (<div onClick={() => setDashboardStatusFilter(s.label)} key={s.label} className={`p-4 rounded-xl border transition-all flex flex-col justify-between h-24 cursor-pointer ${isZero ? 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 opacity-60' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-md'}`}><div className="flex items-center justify-between mb-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: getStatusColorHex(s.label) }}></div>{!isZero && <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{percentage}%</span>}</div><div><span className={`text-2xl font-black block leading-none mb-1 ${isZero ? 'text-slate-300 dark:text-slate-600' : 'text-slate-800 dark:text-slate-200'}`}>{s.count}</span><span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate block">{s.label}</span></div></div>);
                    })}
                </div>
             </div>
             {highPriorityDueToday.length > 0 && (<div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-6"><h3 className="text-amber-800 dark:text-amber-200 font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider"><AlertTriangle size={18} /> High Priority Due Today ({highPriorityDueToday.length})</h3><div className="grid grid-cols-1 lg:grid-cols-3 gap-4">{highPriorityDueToday.map(t => <div key={t.id}><TaskCard task={t} onUpdateStatus={updateTaskStatus} onOpenTask={() => setActiveTaskId(t.id)} availableStatuses={appConfig.taskStatuses} availablePriorities={appConfig.taskPriorities} statusColors={appConfig.itemColors} /></div>)}</div></div>)}
             {overdueTasks.length > 0 && (<div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl p-6"><h3 className="text-red-800 dark:text-red-200 font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider"><AlertTriangle size={18} /> Overdue Items ({overdueTasks.length})</h3><div className="grid grid-cols-1 lg:grid-cols-3 gap-4">{overdueTasks.map(t => <div key={t.id}><TaskCard task={t} onUpdateStatus={updateTaskStatus} onOpenTask={() => setActiveTaskId(t.id)} availableStatuses={appConfig.taskStatuses} availablePriorities={appConfig.taskPriorities} statusColors={appConfig.itemColors} /></div>)}</div></div>)}
          </div>
        );

      case ViewMode.TASKS:
        return (
          <div className="h-full flex flex-col space-y-6 animate-fade-in">
             <div className="flex justify-between items-center"><h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Daily Tasks</h1><div className="flex gap-3"><button onClick={() => setShowNewTaskModal(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition-all shadow-lg font-bold"><Plus size={20} /> New Task</button></div></div>
             <div className="flex gap-4 overflow-x-auto pb-4 snap-x custom-scrollbar shrink-0 h-56">
                {weekDays.map(d => {
                    const dayTasks = weekTasks[d] || [], activeCount = dayTasks.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED).length;
                    return (<div key={d} className={`min-w-[280px] w-[280px] p-4 rounded-2xl border flex flex-col transition-all ${d === todayStr ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 ring-2 ring-indigo-100 shadow-md scale-105 z-10' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm'}`}><div className="flex justify-between items-start mb-3 border-b pb-2 border-slate-100 dark:border-slate-700"><div><span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{new Date(d).toLocaleDateString([], { weekday: 'long' })}</span><span className="text-lg font-bold text-slate-800 dark:text-slate-100">{new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span></div><div className="flex items-center gap-2">{activeCount > 0 && <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded-full">{activeCount}</span>}<button onClick={(e) => { e.stopPropagation(); setExpandedDay(d); }} className="hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 p-1 rounded transition-colors" title="Expand Day"><Maximize2 size={14} /></button></div></div><div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">{dayTasks.map(t => (<div key={t.id} draggable="true" onDragStart={() => handleDragStart('name', t.id)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, t.id, d)} onClick={() => setActiveTaskId(t.id)} className={`p-3 rounded-xl border text-xs shadow-sm hover:ring-2 hover:ring-indigo-300 cursor-pointer select-none transition-all ${t.status === Status.DONE ? 'bg-emerald-50 dark:bg-emerald-900/20 opacity-70' : 'bg-white dark:bg-slate-800'} border-slate-200 dark:border-slate-700`}><div className="flex justify-between items-center mb-1"><span className="font-mono font-bold flex items-center gap-1">{t.displayId} {t.recurrence && <Repeat size={10} className="text-indigo-400" />}</span></div><p className="line-clamp-2 leading-tight">{t.description}</p></div>))}</div></div>);
                })}
             </div>
             <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 flex flex-col bg-slate-100/50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-inner"><div className="bg-white dark:bg-slate-800 p-5 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4"><div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-xl"><button onClick={() => setActiveTaskTab('current')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTaskTab === 'current' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>Active</button><button onClick={() => setActiveTaskTab('future')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTaskTab === 'future' ? 'bg-white dark:bg-slate-600 text-purple-600 dark:text-purple-400' : 'text-slate-500'}`}>Upcoming</button><button onClick={() => setActiveTaskTab('completed')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTaskTab === 'completed' ? 'bg-white dark:bg-slate-600 text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>Archive</button></div></div><div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 custom-scrollbar">{filteredTasks.map(t => (<div key={t.id} id={`task-card-${t.id}`}><TaskCard task={t} onUpdateStatus={updateTaskStatus} onOpenTask={() => setActiveTaskId(t.id)} availableStatuses={appConfig.taskStatuses} availablePriorities={appConfig.taskPriorities} statusColors={appConfig.itemColors} /></div>))}</div></div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden flex flex-col h-full"><div className="flex-1 overflow-y-auto p-6 custom-scrollbar"><DailyJournal tasks={tasks} logs={logs} offDays={offDays} searchQuery={searchQuery} onAddLog={(l) => { const newLog = { ...l, id: uuidv4() }; setLogs(prev => { if (isSyncEnabled) syncData([{ type: 'log', action: 'create', id: newLog.id, data: newLog }]); return [...prev, newLog]; }); }} onUpdateTask={updateTaskFields} onToggleOffDay={(d) => { const next = offDays.includes(d) ? offDays.filter(x => x !== d) : [...offDays, d]; setOffDays(next); if (isSyncEnabled) syncData([{ type: 'offDays', action: 'update', data: next }]); }} onEditLog={handleEditLog} onDeleteLog={handleDeleteLog} /></div></div>
             </div>
          </div>
        );

      case ViewMode.OBSERVATIONS:
        return (<ObservationsLog observations={observations} columns={appConfig.observationStatuses} itemColors={appConfig.itemColors} onAddObservation={o => { setObservations(prev => { if (isSyncEnabled) syncData([{ type: 'observation', action: 'create', id: o.id, data: o }]); return [...prev, o]; }); }} onEditObservation={o => { setObservations(prev => { if (isSyncEnabled) syncData([{ type: 'observation', action: 'update', id: o.id, data: o }]); return prev.map(x => x.id === o.id ? o : x); }); }} onDeleteObservation={id => { setObservations(prev => { if (isSyncEnabled) syncData([{ type: 'observation', action: 'delete', id }]); return prev.filter(x => x.id !== id); }); }} />);
      case ViewMode.SETTINGS:
        return (<Settings 
          tasks={tasks} 
          logs={logs} 
          observations={observations} 
          offDays={offDays} 
          isSyncEnabled={isSyncEnabled} 
          appConfig={appConfig} 
          isDarkMode={isDarkMode} 
          backupStatus={backupStatus} 
          backupSettings={backupSettings} 
          onImportData={(d) => { setTasks(d.tasks); setLogs(d.logs); setObservations(d.observations); setOffDays(d.offDays || []); if (isSyncEnabled) syncData([{ type: 'full', action: 'overwrite', data: d }]); }} 
          onSyncConfigUpdate={c => setIsSyncEnabled(!!c)} 
          onUpdateConfig={handleUpdateAppConfig} 
          onPurgeData={(newTasks, newLogs, newObs) => { 
            setTasks(newTasks); 
            setLogs(newLogs); 
            setObservations(newObs);
            if (isSyncEnabled) syncData([{ type: 'full', action: 'overwrite', data: { tasks: newTasks, logs: newLogs, observations: newObs, offDays, appConfig } }]); 
          }} 
          setBackupSettings={setBackupSettings} 
          onSetupBackupFolder={() => {}} 
          onToggleTheme={setIsDarkMode} 
        />);
      case ViewMode.HELP:
        return <UserManual />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-300">
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col z-20`}>
        <div className="p-4 flex flex-col items-center gap-1 border-b dark:border-slate-800 h-24 justify-center"><FullLogo isSidebarOpen={isSidebarOpen} />{isSidebarOpen && <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">{BUILD_VERSION}</span>}</div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
           {[{ mode: ViewMode.DASHBOARD, icon: LayoutDashboard, label: 'Dashboard' }, { mode: ViewMode.TASKS, icon: ListTodo, label: 'Daily Tasks' }, { mode: ViewMode.OBSERVATIONS, icon: MessageSquare, label: 'Observations' }].map(item => (<button key={item.mode} onClick={() => setView(item.mode)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${view === item.mode ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><item.icon size={20} />{isSidebarOpen && <span>{item.label}</span>}</button>))}
           <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800"><button onClick={() => setView(ViewMode.SETTINGS)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${view === ViewMode.SETTINGS ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><SettingsIcon size={20} />{isSidebarOpen && <span>Settings</span>}</button></div>
        </nav>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800"><button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg w-full flex justify-center">{isSidebarOpen ? <LogOut size={20} className="rotate-180" /> : <Menu size={20} />}</button></div>
      </aside>
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 z-30">
           <div ref={searchRef} className="relative max-w-md w-full">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder="Global Search (Tasks, Logs, Observations)..." 
                value={searchQuery} 
                onFocus={() => setShowSearchResults(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(true);
                }} 
                className="w-full pl-10 pr-10 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-sm outline-none dark:text-slate-200 transition-all focus:ring-2 focus:ring-indigo-500" 
              />
              
              {searchQuery && (
                <button 
                  onClick={() => { setSearchQuery(''); setShowSearchResults(false); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  <X size={14} />
                </button>
              )}
              
              {/* Global Search Results Dropdown */}
              {showSearchResults && globalSearchResults && (
                <div className="absolute top-full left-0 w-[500px] mt-2 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 animate-fade-in flex flex-col max-h-[70vh]">
                    <div className="p-3 border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Search Results for "{searchQuery}"</span>
                        <button onClick={() => setShowSearchResults(false)} className="text-slate-400 hover:text-slate-600"><X size={14}/></button>
                    </div>
                    <div className="overflow-y-auto p-2 space-y-4 custom-scrollbar">
                        {/* Tasks Category */}
                        {globalSearchResults.tasks.length > 0 && (
                          <div className="space-y-1">
                            <h4 className="px-3 py-1 text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-tighter flex items-center gap-2">
                                <ListTodo size={12}/> Tasks
                            </h4>
                            {globalSearchResults.tasks.map(t => (
                              <button key={t.id} onClick={() => handleSearchResultClick('task', t.id)} className="w-full text-left p-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-all group flex gap-3 items-start">
                                  <div className="bg-indigo-100 dark:bg-indigo-900/50 p-2 rounded-lg text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform shrink-0"><FileText size={16}/></div>
                                  <div className="min-w-0">
                                      <div className="flex items-center gap-2 mb-0.5">
                                          <span className="text-xs font-black font-mono text-indigo-600 dark:text-indigo-400">{t.displayId}</span>
                                          <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">{t.projectId}</span>
                                      </div>
                                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">{t.description}</p>
                                  </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Logs Category */}
                        {globalSearchResults.logs.length > 0 && (
                          <div className="space-y-1">
                            <h4 className="px-3 py-1 text-[9px] font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-tighter flex items-center gap-2">
                                <Clock size={12}/> Journal Logs
                            </h4>
                            {globalSearchResults.logs.map(l => (
                              <button key={l.id} onClick={() => handleSearchResultClick('log', l.id)} className="w-full text-left p-3 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-xl transition-all group flex gap-3 items-start">
                                  <div className="bg-emerald-100 dark:bg-emerald-900/50 p-2 rounded-lg text-emerald-600 dark:text-emerald-400 shrink-0"><Clock size={16}/></div>
                                  <div className="min-w-0">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">{l.date}</span>
                                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{l.content}</p>
                                  </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Observations Category */}
                        {globalSearchResults.observations.length > 0 && (
                          <div className="space-y-1">
                            <h4 className="px-3 py-1 text-[9px] font-black text-purple-500 dark:text-purple-400 uppercase tracking-tighter flex items-center gap-2">
                                <StickyNote size={12}/> Observations
                            </h4>
                            {globalSearchResults.observations.map(o => (
                              <button key={o.id} onClick={() => handleSearchResultClick('obs', o.id)} className="w-full text-left p-3 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-xl transition-all group flex gap-3 items-start">
                                  <div className="bg-purple-100 dark:bg-purple-900/50 p-2 rounded-lg text-purple-600 dark:text-purple-400 shrink-0"><MessageSquare size={16}/></div>
                                  <div className="min-w-0">
                                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{o.content}</p>
                                  </div>
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                </div>
              )}
           </div>
           <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isSyncEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">{isSyncEnabled ? 'Cloud Synced' : 'Local Only'}</span>
             </div>
           </div>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-slate-950 custom-scrollbar relative transition-colors duration-300">{renderContent()}</div>
        
        {/* Task Detail Modal */}
        {activeTask && (<TaskDetailModal task={activeTask} allTasks={tasks} onClose={() => setActiveTaskId(null)} onUpdateStatus={updateTaskStatus} onUpdateTask={updateTaskFields} onAddUpdate={addUpdateToTask} onEditUpdate={handleEditUpdate} onDeleteUpdate={handleDeleteUpdate} onDeleteTask={deleteTask} availableStatuses={appConfig.taskStatuses} availablePriorities={appConfig.taskPriorities} updateTags={appConfig.updateHighlightOptions || []} statusColors={appConfig.itemColors} />)}
        
        {/* New Task Modal */}
        {showNewTaskModal && (<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"><form onSubmit={handleCreateTask} className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in"><div className="p-5 border-b dark:border-slate-700 flex justify-between items-center bg-indigo-600 text-white"><h2 className="font-bold flex items-center gap-2"><Plus size={20}/> Create New Task</h2><button type="button" onClick={() => setShowNewTaskModal(false)}><X size={20}/></button></div><div className="p-6 space-y-4">{modalError && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 text-xs font-bold"><AlertTriangle size={16} /> {modalError}</div>}<div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Source (CW)</label><input required value={newTaskForm.source} onChange={e => setNewTaskForm({...newTaskForm, source: e.target.value})} className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 rounded-xl outline-none" /></div><div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Project ID</label><input required autoFocus list="active-projects" value={newTaskForm.projectId} onChange={e => { const pid = e.target.value; setNewTaskForm({...newTaskForm, projectId: pid, displayId: suggestNextId(pid)}); }} className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 rounded-xl outline-none" /><datalist id="active-projects">{activeProjects.map(p => <option key={p} value={p} />)}</datalist></div></div><div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Display ID</label><input required value={newTaskForm.displayId} onChange={e => setNewTaskForm({...newTaskForm, displayId: e.target.value})} className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 rounded-xl outline-none" /></div><div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase">Description</label><textarea required value={newTaskForm.description} onChange={e => setNewTaskForm({...newTaskForm, description: e.target.value})} rows={3} className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 rounded-xl outline-none" /></div></div><div className="p-4 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-end gap-3"><button type="button" onClick={() => setShowNewTaskModal(false)} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg">Cancel</button><button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl">Create Task</button></div></form></div>)}
        
        {/* Weekly Report Modal */}
        {showReportModal && (<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"><div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"><div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-indigo-600 text-white"><h2 className="font-bold flex items-center gap-2"><Sparkles size={18}/> Weekly AI Report</h2><button onClick={() => setShowReportModal(false)}><X size={20}/></button></div><div className="flex-1 overflow-y-auto p-6 dark:text-slate-200">{isGeneratingReport ? <div className="flex flex-col items-center justify-center py-12 gap-4"><div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div><p>Analyzing...</p></div> : <div className="prose prose-sm max-w-none dark:prose-invert">{generatedReport.split('\n').map((line, i) => <p key={i}>{line}</p>)}</div>}</div><div className="p-4 border-t dark:border-slate-700 flex justify-end gap-2 bg-slate-50 dark:bg-slate-800"><button onClick={() => { navigator.clipboard.writeText(generatedReport); alert('Copied!'); }} className="px-4 py-2 text-slate-600 font-bold rounded-lg hover:bg-slate-200">Copy</button><button onClick={() => setShowReportModal(false)} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">Close</button></div></div></div>)}

        {/* Expanded Day Modal */}
        {expandedDay && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4" onClick={() => setExpandedDay(null)}>
             <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-fade-in" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-indigo-600 text-white shrink-0">
                   <div>
                      <h2 className="text-2xl font-bold flex items-center gap-3">
                        <Calendar size={24} />
                        {new Date(expandedDay).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                      </h2>
                      <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest mt-1 opacity-80">Focused view for this day</p>
                   </div>
                   <button onClick={() => setExpandedDay(null)} className="p-2 hover:bg-white/10 rounded-full transition-all hover:rotate-90">
                      <X size={28} />
                   </button>
                </div>
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50 dark:bg-slate-950">
                   {(weekTasks[expandedDay] || []).length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {(weekTasks[expandedDay] || []).map(t => (
                           <TaskCard 
                              key={t.id} 
                              task={t} 
                              onUpdateStatus={updateTaskStatus} 
                              onOpenTask={() => { setActiveTaskId(t.id); setExpandedDay(null); }} 
                              availableStatuses={appConfig.taskStatuses} 
                              availablePriorities={appConfig.taskPriorities} 
                              statusColors={appConfig.itemColors} 
                           />
                        ))}
                      </div>
                   ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 opacity-50 py-20">
                         <ListTodo size={80} strokeWidth={1} className="mb-6" />
                         <p className="text-2xl font-bold">No tasks due on this day</p>
                         <button onClick={() => { setExpandedDay(null); setShowNewTaskModal(true); }} className="mt-6 text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
                            Click here to create one
                         </button>
                      </div>
                   )}
                </div>
                <div className="p-4 border-t dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end shrink-0">
                    <button onClick={() => setExpandedDay(null)} className="px-6 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">Close</button>
                </div>
             </div>
          </div>
        )}

        {/* Dashboard Status Drill-down Modal */}
        {dashboardStatusFilter && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 flex items-center justify-center p-4" onClick={() => setDashboardStatusFilter(null)}>
                <div className="bg-white dark:bg-slate-900 w-full max-w-6xl h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-fade-in" onClick={e => e.stopPropagation()}>
                    <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center shrink-0" style={{ backgroundColor: (getStatusColorHex(dashboardStatusFilter) || '#6366f1') + '20' }}>
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg" style={{ backgroundColor: getStatusColorHex(dashboardStatusFilter) || '#6366f1', color: '#fff' }}>
                                <Layers size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{dashboardStatusFilter}</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{tasks.filter(t => t.status === dashboardStatusFilter).length} Tasks</p>
                            </div>
                        </div>
                        <button onClick={() => setDashboardStatusFilter(null)} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors text-slate-500 dark:text-slate-400">
                            <X size={28} />
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-8 bg-slate-50 dark:bg-slate-950 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {tasks.filter(t => t.status === dashboardStatusFilter).map(t => (
                                <TaskCard 
                                    key={t.id} 
                                    task={t} 
                                    onUpdateStatus={updateTaskStatus} 
                                    onOpenTask={() => setActiveTaskId(t.id)}
                                    onDelete={deleteTask}
                                    availableStatuses={appConfig.taskStatuses} 
                                    availablePriorities={appConfig.taskPriorities} 
                                    statusColors={appConfig.itemColors} 
                                />
                            ))}
                        </div>
                        {tasks.filter(t => t.status === dashboardStatusFilter).length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center opacity-50">
                                <ListTodo size={64} className="text-slate-300 dark:text-slate-600 mb-4"/>
                                <p className="text-slate-500 dark:text-slate-400 font-bold">No tasks in this status</p>
                            </div>
                        )}
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