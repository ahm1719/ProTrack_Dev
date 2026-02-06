
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

import { subscribeToData, syncData, initFirebase } from './services/firebaseService';
import { generateWeeklySummary } from './services/geminiService';
import { 
  selectBackupFolder, 
  performBackup, 
  getStoredDirectoryHandle, 
  verifyPermission 
} from './services/backupService';

const BUILD_VERSION = "V3.9.1 - Recurrence Fix";

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

const getEndOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? 0 : 7); 
  const endOfWeek = new Date(d.setDate(diff));
  endOfWeek.setHours(23, 59, 59, 999);
  return endOfWeek.toISOString().split('T')[0];
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
  
  // Navigation & Modals
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null); // For opening TaskDetailModal
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null); // For scrolling to task in list
  
  const [showReportModal, setShowReportModal] = useState(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [generatedReport, setGeneratedReport] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const [backupSettings, setBackupSettings] = useState<BackupSettings>({
    enabled: false,
    intervalMinutes: 10,
    lastBackup: null,
    folderName: null
  });
  const [backupStatus, setBackupStatus] = useState<'idle' | 'running' | 'error' | 'permission_needed'>('idle');
  const backupDirHandle = useRef<FileSystemDirectoryHandle | null>(null);

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('protrack_theme') === 'dark';
  });

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

  const activeTask = useMemo(() => tasks.find(t => t.id === activeTaskId), [tasks, activeTaskId]);

  // Apply Theme
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('protrack_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('protrack_theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    const savedConfig = localStorage.getItem('protrack_firebase_config');
    const localAppConfig = localStorage.getItem('protrack_app_config');
    
    if (localAppConfig) {
      try {
        const parsed = JSON.parse(localAppConfig);
        setAppConfig({ 
            ...DEFAULT_CONFIG, 
            ...parsed,
            updateHighlightOptions: parsed.updateHighlightOptions || DEFAULT_CONFIG.updateHighlightOptions 
        });
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

    const initBackup = async () => {
        const savedSettings = localStorage.getItem('protrack_backup_settings');
        if (savedSettings) {
            setBackupSettings(JSON.parse(savedSettings));
        }
        
        try {
            const handle = await getStoredDirectoryHandle();
            if (handle) {
                backupDirHandle.current = handle;
                if (!JSON.parse(savedSettings || '{}').folderName) {
                    setBackupSettings(prev => ({ ...prev, folderName: handle.name }));
                }
            }
        } catch (e) {
            console.error("Failed to init backup handle", e);
        }
    };
    initBackup();

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isSyncEnabled) {
      const unsubscribe = subscribeToData((data: any) => {
        if (data.tasks) setTasks(data.tasks);
        if (data.logs) setLogs(data.logs);
        if (data.observations) setObservations(data.observations);
        if (data.offDays) setOffDays(data.offDays);
        if (data.appConfig) setAppConfig(prev => ({ ...prev, ...data.appConfig }));
      });
      return () => { if (unsubscribe) unsubscribe(); };
    }
  }, [isSyncEnabled]);

  useEffect(() => {
    localStorage.setItem('protrack_backup_settings', JSON.stringify(backupSettings));
  }, [backupSettings]);

  useEffect(() => {
    let intervalId: number;

    const runBackup = async () => {
        if (!backupSettings.enabled || !backupDirHandle.current) return;

        setBackupStatus('running');
        
        const success = await performBackup(backupDirHandle.current, {
            tasks, logs, observations, offDays, appConfig
        });

        if (success) {
            setBackupStatus('idle');
            setBackupSettings(prev => ({ ...prev, lastBackup: new Date().toISOString() }));
        } else {
            if (backupDirHandle.current) {
                try {
                    const perm = await verifyPermission(backupDirHandle.current, false);
                    if (!perm) {
                        setBackupStatus('permission_needed');
                    } else {
                        setBackupStatus('error');
                    }
                } catch(e) {
                    setBackupStatus('error');
                }
            } else {
                setBackupStatus('error');
            }
        }
    };

    if (backupSettings.enabled) {
        intervalId = window.setInterval(runBackup, backupSettings.intervalMinutes * 60 * 1000);
    }

    return () => window.clearInterval(intervalId);
  }, [backupSettings.enabled, backupSettings.intervalMinutes, tasks, logs, observations, offDays, appConfig]);

  useEffect(() => {
      // Handle scrolling to highlighted task
      if (highlightedTaskId && view === ViewMode.TASKS) {
          setTimeout(() => {
              const el = document.getElementById(`task-card-${highlightedTaskId}`);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 300);
      }
  }, [highlightedTaskId, view]);

  // Enhanced persistData to handle granular sync actions
  const persistData = (
      newTasks: Task[], 
      newLogs: DailyLog[], 
      newObs: Observation[], 
      newOffDays: string[],
      syncActions?: SyncAction[]
  ) => {
    setTasks(newTasks);
    setLogs(newLogs);
    setObservations(newObs);
    setOffDays(newOffDays);
    localStorage.setItem('protrack_data', JSON.stringify({ tasks: newTasks, logs: newLogs, observations: newObs, offDays: newOffDays }));
    
    if (isSyncEnabled && syncActions && syncActions.length > 0) {
        syncData(syncActions);
    }
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

    let recurrenceConfig: RecurrenceConfig | undefined = undefined;
    if (newTaskForm.recurrenceType !== 'none') {
        recurrenceConfig = {
            type: newTaskForm.recurrenceType as any,
            interval: newTaskForm.recurrenceInterval
        };
    }

    const newTask: Task = {
      ...newTaskForm,
      recurrence: recurrenceConfig,
      id: uuidv4(),
      updates: [],
      createdAt: new Date().toISOString()
    };
    persistData([...tasks, newTask], logs, observations, offDays, [{ type: 'task', action: 'create', id: newTask.id, data: newTask }]);
    
    setHighlightedTaskId(newTask.id); 
    setActiveTaskId(newTask.id); 
    setShowNewTaskModal(false);
    setNewTaskForm({
      source: `CW${getWeekNumber(new Date())}`,
      projectId: '',
      displayId: '',
      description: '',
      dueDate: new Date().toISOString().split('T')[0],
      status: appConfig.taskStatuses[0] || Status.NOT_STARTED,
      priority: appConfig.taskPriorities[1] || Priority.MEDIUM,
      recurrenceType: 'none',
      recurrenceInterval: 1
    });
    setView(ViewMode.TASKS);
  };

  const calculateNextDate = (currentDateStr: string, type: string, interval: number): string => {
      // Robust local date calculation avoiding UTC shifts
      const [y, m, d] = currentDateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d); // Construct local date at 00:00:00
      
      if (type === 'daily') date.setDate(date.getDate() + interval);
      if (type === 'weekly') date.setDate(date.getDate() + (interval * 7));
      if (type === 'monthly') date.setMonth(date.getMonth() + interval);
      if (type === 'yearly') date.setFullYear(date.getFullYear() + interval);
      
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const updateTaskStatus = (id: string, newStatus: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task || task.status === newStatus) return;

    // Recurrence Handling: "Rollover" strategy
    if (newStatus === Status.DONE && task.recurrence && task.dueDate) {
        const nextDate = calculateNextDate(task.dueDate, task.recurrence.type, task.recurrence.interval);
        
        const timestamp = new Date().toISOString();
        const dateStr = timestamp.split('T')[0];
        
        const recurLog = {
            id: uuidv4(),
            date: dateStr,
            taskId: task.id,
            content: `Completed cycle. Rescheduled from ${task.dueDate} to ${nextDate}`
        };

        const updatedTask = {
            ...task,
            status: Status.NOT_STARTED, // Reset status
            dueDate: nextDate, // Advance date
            updates: [...task.updates, {
                id: uuidv4(),
                timestamp,
                content: `Completed recurrence cycle. Due date advanced: ${task.dueDate} → ${nextDate}`,
                highlightColor: '#10b981'
            }],
            subtasks: task.subtasks?.map(st => ({...st, completed: false, completedAt: undefined})) // Reset subtasks
        };

        const actions: SyncAction[] = [
            { type: 'task', action: 'update', id: updatedTask.id, data: updatedTask },
            { type: 'log', action: 'create', id: recurLog.id, data: recurLog }
        ];

        persistData(
            tasks.map(t => t.id === id ? updatedTask : t), 
            [...logs, recurLog], 
            observations, 
            offDays, 
            actions
        );
        return; // Exit early, do not perform standard status update
    }

    // Normal Status Update
    const oldStatus = task.status;
    const content = `Status: ${oldStatus} → ${newStatus}`;
    const timestamp = new Date().toISOString();
    const dateStr = timestamp.split('T')[0];
    const systemUpdateColor = '#6366f1';

    const updatedTask = { 
        ...task, 
        status: newStatus,
        updates: [...task.updates, { 
            id: uuidv4(), 
            timestamp, 
            content,
            highlightColor: systemUpdateColor 
        }]
    };

    const newLog = { 
        id: uuidv4(), 
        date: dateStr, 
        taskId: id, 
        content 
    };

    const actions: SyncAction[] = [
        { type: 'task', action: 'update', id: updatedTask.id, data: updatedTask },
        { type: 'log', action: 'create', id: newLog.id, data: newLog }
    ];

    persistData(
        tasks.map(t => t.id === id ? updatedTask : t), 
        [...logs, newLog], 
        observations, 
        offDays, 
        actions
    );
  };

  const updateTaskFields = (id: string, fields: Partial<Task>) => {
    const currentTask = tasks.find(t => t.id === id);
    if (!currentTask) return;

    if (fields.displayId) {
       const isDuplicate = tasks.some(t => t.id !== id && t.displayId.toLowerCase() === fields.displayId?.toLowerCase());
       if (isDuplicate) {
          alert(`Error: Display ID "${fields.displayId}" is already taken.`);
          return;
       }
    }
    const updatedTask = { ...currentTask, ...fields };
    const updatedTasks = tasks.map(t => t.id === id ? updatedTask : t);
    persistData(updatedTasks, logs, observations, offDays, [{ type: 'task', action: 'update', id: updatedTask.id, data: updatedTask }]);
  };

  const addUpdateToTask = (id: string, content: string, attachments?: TaskAttachment[], highlightColor?: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const timestamp = new Date().toISOString();
    const updateId = uuidv4();
    const updatedTask = { 
        ...task, 
        attachments: attachments ? [...(task.attachments || []), ...attachments] : task.attachments,
        updates: [...task.updates, { id: updateId, timestamp, content, highlightColor }]
    };
    
    const updatedTasks = tasks.map(t => t.id === id ? updatedTask : t);
    const newLog: DailyLog = { id: uuidv4(), date: new Date().toLocaleDateString('en-CA'), taskId: id, content };
    
    persistData(updatedTasks, [...logs, newLog], observations, offDays, [
        { type: 'task', action: 'update', id: updatedTask.id, data: updatedTask },
        { type: 'log', action: 'create', id: newLog.id, data: newLog }
    ]);
  };

  const handleEditUpdate = (taskId: string, updateId: string, content: string, timestamp?: string, highlightColor?: string | null) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedTask = {
      ...task,
      updates: task.updates.map(u => u.id === updateId ? { 
          ...u, 
          content, 
          timestamp: timestamp || u.timestamp, 
          highlightColor: highlightColor === null ? undefined : highlightColor 
      } : u)
    };

    const newTasks = tasks.map(t => t.id === taskId ? updatedTask : t);

    // Also update log if it matches content
    let logAction: SyncAction | undefined;
    const newLogs = logs.map(l => {
      if (l.taskId === taskId) {
        const originalUpdate = task.updates.find(u => u.id === updateId);
        if (l.content === originalUpdate?.content) {
            const updatedLog = { 
                ...l, 
                content, 
                date: timestamp ? timestamp.split('T')[0] : l.date 
            };
            logAction = { type: 'log', action: 'update', id: updatedLog.id, data: updatedLog };
            return updatedLog;
        }
      }
      return l;
    });

    const actions: SyncAction[] = [{ type: 'task', action: 'update', id: updatedTask.id, data: updatedTask }];
    if (logAction) actions.push(logAction);

    persistData(newTasks, newLogs, observations, offDays, actions);
  };

  const handleDeleteUpdate = (taskId: string, updateId: string) => {
    if (!confirm('Delete this history record?')) return;
    
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const update = task.updates.find(u => u.id === updateId);
    
    const updatedTask = { ...task, updates: task.updates.filter(u => u.id !== updateId) };
    const newTasks = tasks.map(t => t.id === taskId ? updatedTask : t);

    // Find and delete associated log
    let logIdToDelete: string | undefined;
    const newLogs = logs.filter(l => {
        const isMatch = l.taskId === taskId && l.content === update?.content;
        if (isMatch) logIdToDelete = l.id;
        return !isMatch;
    });

    const actions: SyncAction[] = [{ type: 'task', action: 'update', id: updatedTask.id, data: updatedTask }];
    if (logIdToDelete) actions.push({ type: 'log', action: 'delete', id: logIdToDelete });

    persistData(newTasks, newLogs, observations, offDays, actions);
  };

  const deleteTask = (id: string) => {
    persistData(tasks.filter(t => t.id !== id), logs, observations, offDays, [{ type: 'task', action: 'delete', id }]);
  };

  const handleEditLog = (logId: string, taskId: string, content: string, date: string) => {
    const updatedLog = { id: logId, taskId, content, date };
    const newLogs = logs.map(l => l.id === logId ? updatedLog : l);
    persistData(tasks, newLogs, observations, offDays, [{ type: 'log', action: 'update', id: logId, data: updatedLog }]);
  };

  const handleDeleteLog = (logId: string) => {
    if (confirm('Delete this journal entry?')) {
      const newLogs = logs.filter(l => l.id !== logId);
      persistData(tasks, newLogs, observations, offDays, [{ type: 'log', action: 'delete', id: logId }]);
    }
  };

  const handleUpdateAppConfig = (newConfig: AppConfig) => {
    setAppConfig(newConfig);
    localStorage.setItem('protrack_app_config', JSON.stringify(newConfig));
    if (isSyncEnabled) {
        syncData([{ type: 'config', action: 'update', data: newConfig }]);
    }
  };

  // Drag and Drop handlers...
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetTaskId: string, dateStr: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("text/plain");
    
    if (!draggedId || draggedId === targetTaskId) {
        setDraggedTaskId(null);
        return;
    }

    const dayTaskList = weekTasks[dateStr]; 
    if (!dayTaskList) return;

    const fromIndex = dayTaskList.findIndex(t => t.id === draggedId);
    const toIndex = dayTaskList.findIndex(t => t.id === targetTaskId);

    if (fromIndex === -1 || toIndex === -1) {
        setDraggedTaskId(null);
        return;
    }

    const newList = [...dayTaskList];
    const [movedItem] = newList.splice(fromIndex, 1);
    newList.splice(toIndex, 0, movedItem);

    const orderMap = new Map();
    newList.forEach((t, index) => orderMap.set(t.id, index));

    const syncActions: SyncAction[] = [];
    const newTasks = tasks.map(t => {
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

    persistData(newTasks, logs, observations, offDays, syncActions);
    setDraggedTaskId(null);
  };

  const handleSetupBackupFolder = async () => {
    const handle = await selectBackupFolder();
    if (handle) {
      backupDirHandle.current = handle;
      setBackupSettings(prev => ({
        ...prev,
        folderName: handle.name,
        enabled: true 
      }));
      setBackupStatus('idle');
    }
  };

  const handleVerifyBackupPermission = async () => {
    if (backupDirHandle.current) {
      const hasPerm = await verifyPermission(backupDirHandle.current, true);
      if (hasPerm) setBackupStatus('idle');
    }
  };

  // View Helpers
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

  const highPriorityDueToday = useMemo(() => tasks.filter(t => 
    t.status !== Status.DONE && 
    t.status !== Status.ARCHIVED && 
    t.priority === Priority.HIGH && 
    t.dueDate === todayStr
  ), [tasks, todayStr]);

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
    const getWeight = (p: string) => {
        if (p === Priority.HIGH) return 3;
        if (p === Priority.MEDIUM) return 2;
        if (p === Priority.LOW) return 1;
        return 0;
    };

    weekDays.forEach(d => {
      const dayTasks = tasks.filter(t => t.dueDate === d);
      dayTasks.sort((a, b) => {
          if (a.order !== undefined && b.order !== undefined) {
              return a.order - b.order;
          }
          if (a.order !== undefined) return -1;
          if (b.order !== undefined) return 1;

          const wA = getWeight(a.priority);
          const wB = getWeight(b.priority);
          if (wA !== wB) return wB - wA; 
          
          return a.displayId.localeCompare(b.displayId, undefined, { numeric: true, sensitivity: 'base' });
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
        t.updates.some(u => u.content.toLowerCase().includes(q))
    );
    
    if (activeTaskTab === 'completed') {
        return base.filter(t => t.status === Status.DONE || t.status === Status.ARCHIVED);
    }

    const activeBase = base.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED);
    const endOfWeek = getEndOfWeek(new Date());

    if (activeTaskTab === 'future') {
        return activeBase.filter(t => t.dueDate && t.dueDate > endOfWeek);
    }

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
                                {currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
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

             <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
                    <div>
                         <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Target size={20} className="text-indigo-600 dark:text-indigo-400" />
                            Task Distribution
                         </h3>
                         <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Weekly focus vs overall backlog status</p>
                    </div>
                    <div className="flex flex-col items-end">
                         <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-indigo-600 dark:text-indigo-400">{weeklyFocusCount}</span>
                            <span className="text-slate-400 dark:text-slate-500 text-sm font-bold uppercase tracking-wider">Active Tasks</span>
                         </div>
                         <span className="text-slate-400 dark:text-slate-500 text-xs font-medium">out of {tasks.length} total items</span>
                    </div>
                </div>

                <div className="h-8 bg-slate-50 dark:bg-slate-900 rounded-xl overflow-hidden flex shadow-inner mb-8 border border-slate-100 dark:border-slate-800">
                    {statusSummary.map((s) => {
                        if (s.count === 0) return null;
                        const color = getStatusColorHex(s.label);
                        const width = tasks.length > 0 ? (s.count / tasks.length) * 100 : 0;
                        return (
                            <div 
                                key={s.label} 
                                style={{ width: `${width}%`, backgroundColor: color }} 
                                className="h-full border-r border-white/20 last:border-0 relative group transition-all hover:opacity-90 flex items-center justify-center"
                                title={`${s.label}: ${s.count}`}
                            >
                                {width > 10 && <span className="text-[10px] font-bold text-white/90 drop-shadow-sm">{Math.round(width)}%</span>}
                            </div>
                        );
                    })}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {statusSummary.map(s => {
                        const isZero = s.count === 0;
                        const color = getStatusColorHex(s.label);
                        const percentage = tasks.length > 0 ? Math.round((s.count / tasks.length) * 100) : 0;
                        
                        return (
                            <div key={s.label} className={`p-4 rounded-xl border transition-all flex flex-col justify-between h-24 ${isZero ? 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 opacity-60' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-md'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
                                    {!isZero && <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{percentage}%</span>}
                                </div>
                                <div>
                                    <span className={`text-2xl font-black block leading-none mb-1 ${isZero ? 'text-slate-300 dark:text-slate-600' : 'text-slate-800 dark:text-slate-200'}`}>{s.count}</span>
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate block" title={s.label}>{s.label}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
             </div>

             {highPriorityDueToday.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-6">
                    <h3 className="text-amber-800 dark:text-amber-200 font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                        <AlertTriangle size={18} /> High Priority Due Today ({highPriorityDueToday.length})
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {highPriorityDueToday.map(t => (
                            <div key={t.id} id={`task-card-${t.id}`}>
                                <TaskCard 
                                    task={t} 
                                    onUpdateStatus={updateTaskStatus} 
                                    onOpenTask={() => setActiveTaskId(t.id)} 
                                    onDelete={deleteTask} 
                                    availableStatuses={appConfig.taskStatuses} 
                                    availablePriorities={appConfig.taskPriorities} 
                                    updateTags={appConfig.updateHighlightOptions} 
                                    statusColors={appConfig.itemColors}
                                />
                            </div>
                        ))}
                    </div>
                </div>
             )}

             {overdueTasks.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl p-6">
                    <h3 className="text-red-800 dark:text-red-200 font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                        <AlertTriangle size={18} /> Overdue Items ({overdueTasks.length})
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {overdueTasks.map(t => (
                            <div key={t.id} id={`task-card-${t.id}`}>
                                <TaskCard 
                                    task={t} 
                                    onUpdateStatus={updateTaskStatus} 
                                    onOpenTask={() => setActiveTaskId(t.id)} 
                                    onDelete={deleteTask} 
                                    availableStatuses={appConfig.taskStatuses} 
                                    availablePriorities={appConfig.taskPriorities} 
                                    updateTags={appConfig.updateHighlightOptions} 
                                    statusColors={appConfig.itemColors}
                                />
                            </div>
                        ))}
                    </div>
                </div>
             )}
          </div>
        );

      case ViewMode.TASKS:
        return (
          <div className="h-full flex flex-col space-y-6 animate-fade-in">
             <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Daily Tasks</h1>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setExpandedDay(todayStr)}
                        className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-3 rounded-xl hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all font-bold shadow-sm"
                    >
                        <Maximize2 size={18} /> Focus Today
                    </button>
                    <button onClick={() => setShowNewTaskModal(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 font-bold">
                        <Plus size={20} /> New Task
                    </button>
                </div>
             </div>

             <div className="flex gap-4 overflow-x-auto pb-4 snap-x custom-scrollbar shrink-0 h-56">
                {weekDays.map(d => {
                    const dayTasks = weekTasks[d] || [];
                    const activeCount = dayTasks.filter(t => t.status !== Status.DONE && t.status !== Status.ARCHIVED).length;
                    return (
                        <div key={d} className={`min-w-[280px] w-[280px] p-4 rounded-2xl border flex flex-col transition-all ${d === todayStr ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 ring-2 ring-indigo-100 dark:ring-indigo-900 shadow-md scale-105 z-10' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm'}`}>
                            <div className="flex justify-between items-start mb-3 border-b pb-2 border-slate-100 dark:border-slate-700">
                                <div>
                                    <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{new Date(d).toLocaleDateString([], { weekday: 'long' })}</span>
                                    <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {activeCount > 0 && (
                                        <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                            {activeCount}
                                        </span>
                                    )}
                                    {d === todayStr && <span className="bg-indigo-600 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">TODAY</span>}
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setExpandedDay(d); }}
                                        className={`p-1 rounded transition-colors ${d === todayStr ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-indigo-600'}`}
                                        title="Expand View"
                                    >
                                        <Maximize2 size={14} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {dayTasks.length ? dayTasks.map(t => {
                                    const latest = [...t.updates].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                                    return (
                                        <div 
                                        key={t.id}
                                        draggable="true"
                                        onDragStart={(e) => handleDragStart(e, t.id)}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, t.id, d)}
                                        onClick={() => setActiveTaskId(t.id)} 
                                        className={`p-3 rounded-xl border text-xs shadow-sm hover:ring-2 hover:ring-indigo-300 dark:hover:ring-indigo-600 transition-all cursor-pointer group select-none ${t.status === Status.DONE ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/50' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'} ${draggedTaskId === t.id ? 'opacity-40 border-dashed border-indigo-400' : ''}`}
                                        title="Drag to reorder"
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                            <span className={`font-mono font-bold ${(t.status === Status.DONE || t.status === Status.ARCHIVED) ? 'line-through opacity-60' : 'text-slate-700 dark:text-slate-200'} flex items-center gap-1`}>
                                                {t.displayId}
                                                {t.recurrence && <Repeat size={10} className="text-indigo-400" />}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <div 
                                                    className={`w-2 h-2 rounded-full ${t.priority === Priority.HIGH ? 'bg-red-500' : t.priority === Priority.MEDIUM ? 'bg-amber-400' : 'bg-emerald-400'}`} 
                                                    title={`Priority: ${t.priority}`} 
                                                />
                                                {t.status === Status.DONE && <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />}
                                                {t.status === Status.IN_PROGRESS && <Clock size={12} className="text-blue-600 dark:text-blue-400" />}
                                            </div>
                                            </div>
                                            <p className={`line-clamp-2 leading-tight ${(t.status === Status.DONE || t.status === Status.ARCHIVED) ? 'line-through opacity-60 text-slate-500' : 'text-slate-600 dark:text-slate-300'}`}>{t.description}</p>
                                            
                                            {latest && (
                                                <div className="mt-2 flex items-start gap-1.5">
                                                    <div 
                                                        className="w-1.5 h-1.5 rounded-full shrink-0 mt-1" 
                                                        style={{ backgroundColor: latest.highlightColor || '#cbd5e1' }} 
                                                    />
                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-medium flex-1 bg-white/50 dark:bg-slate-700/50 px-1 rounded">{latest.content}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                }) : <div className="h-full flex items-center justify-center text-[10px] text-slate-300 dark:text-slate-600 italic">No deadlines</div>}
                            </div>
                        </div>
                    );
                })}
             </div>

             <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 flex flex-col bg-slate-100/50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-inner">
                    <div className="bg-white dark:bg-slate-800 p-5 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-xl">
                            <button onClick={() => setActiveTaskTab('current')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTaskTab === 'current' ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Active Tasks</button>
                            <button onClick={() => setActiveTaskTab('future')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTaskTab === 'future' ? 'bg-white dark:bg-slate-600 text-purple-600 dark:text-purple-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Future Tasks</button>
                            <button onClick={() => setActiveTaskTab('completed')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTaskTab === 'completed' ? 'bg-white dark:bg-slate-600 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>Archive & Done</button>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{filteredTasks.length} {activeTaskTab === 'future' ? 'UPCOMING' : activeTaskTab} ITEMS</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {filteredTasks.map(t => (
                                <div key={t.id} id={`task-card-${t.id}`}>
                                    <TaskCard 
                                        task={t} 
                                        onUpdateStatus={updateTaskStatus} 
                                        onOpenTask={() => setActiveTaskId(t.id)} 
                                        onDelete={deleteTask} 
                                        availableStatuses={appConfig.taskStatuses} 
                                        availablePriorities={appConfig.taskPriorities} 
                                        updateTags={appConfig.updateHighlightOptions} 
                                        statusColors={appConfig.itemColors}
                                    />
                                </div>
                            ))}
                        </div>
                        {filteredTasks.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-300 dark:text-slate-600 opacity-50">
                                {activeTaskTab === 'future' ? <Calendar size={48} className="mb-4" /> : <ListTodo size={48} className="mb-4" />}
                                <p className="font-bold">
                                    {activeTaskTab === 'future' ? 'No upcoming tasks scheduled.' : 'No tasks match your criteria.'}
                                </p>
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
                                persistData(tasks, [...logs, newLog], observations, offDays, [{ type: 'log', action: 'create', id: newLog.id, data: newLog }]);
                            }} 
                            onUpdateTask={updateTaskFields} 
                            offDays={offDays} 
                            onToggleOffDay={(d) => {
                                const newOffDays = offDays.includes(d) ? offDays.filter(x => x !== d) : [...offDays, d];
                                persistData(tasks, logs, observations, newOffDays, [{ type: 'offDays', action: 'update', data: newOffDays }]);
                            }}
                            onEditLog={handleEditLog}
                            onDeleteLog={handleDeleteLog}
                            searchQuery={searchQuery}
                        />
                    </div>
                </div>
             </div>

             {/* Expanded Day View Modal */}
             {expandedDay && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setExpandedDay(null)}>
                    <div 
                        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-fade-in"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-indigo-600 text-white">
                            <div>
                                <h2 className="font-bold flex items-center gap-2 text-lg">
                                    {new Date(expandedDay).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                                </h2>
                                <p className="text-indigo-200 text-xs font-medium">
                                    {weekTasks[expandedDay]?.length || 0} Tasks
                                </p>
                            </div>
                            <button onClick={() => setExpandedDay(null)} className="p-1 hover:bg-indigo-500 rounded-lg transition-colors"><X size={20}/></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50 dark:bg-slate-900">
                            {weekTasks[expandedDay]?.length > 0 ? (
                                weekTasks[expandedDay].map(t => {
                                     const latest = [...t.updates].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                                     return (
                                        <div 
                                            key={t.id}
                                            draggable="true"
                                            onDragStart={(e) => handleDragStart(e, t.id)}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDrop(e, t.id, expandedDay)}
                                            onClick={() => setActiveTaskId(t.id)}
                                            className={`bg-white dark:bg-slate-800 p-4 rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer group flex items-start gap-4 ${t.status === Status.DONE ? 'opacity-60 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500'} ${draggedTaskId === t.id ? 'opacity-40 border-dashed border-indigo-400' : ''}`}
                                        >
                                            <div className="mt-1 text-slate-300 dark:text-slate-600 group-hover:text-indigo-400 cursor-grab active:cursor-grabbing">
                                                <svg width="12" height="20" viewBox="0 0 6 10" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="opacity-50">
                                                  <circle cx="1" cy="1" r="1" />
                                                  <circle cx="1" cy="5" r="1" />
                                                  <circle cx="1" cy="9" r="1" />
                                                  <circle cx="5" cy="1" r="1" />
                                                  <circle cx="5" cy="5" r="1" />
                                                  <circle cx="5" cy="9" r="1" />
                                                </svg>
                                            </div>
                                            
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded text-xs ${(t.status === Status.DONE || t.status === Status.ARCHIVED) ? 'line-through opacity-60 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700' : ''}`}>
                                                            {t.displayId}
                                                        </span>
                                                        {t.recurrence && <Repeat size={12} className="text-indigo-400" />}
                                                        <div 
                                                            className={`text-[10px] px-1.5 py-0.5 rounded-full border font-bold ${t.priority === Priority.HIGH ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-100 dark:border-red-900/50' : t.priority === Priority.MEDIUM ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border-amber-100 dark:border-amber-900/50' : 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-900/50'}`}
                                                        >
                                                            {t.priority}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {t.status === Status.DONE && <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle2 size={14}/> Done</span>}
                                                        {t.status === Status.IN_PROGRESS && <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1"><Clock size={14}/> In Progress</span>}
                                                    </div>
                                                </div>
                                                
                                                <p className={`text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed ${(t.status === Status.DONE || t.status === Status.ARCHIVED) ? 'line-through opacity-60' : ''}`}>
                                                    {t.description}
                                                </p>

                                                {/* Subtask Progress */}
                                                {t.subtasks && t.subtasks.length > 0 && (
                                                    <div className="mt-2 flex items-center gap-2">
                                                        <div className="flex-1 h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden max-w-[100px]">
                                                            <div 
                                                                className="h-full bg-emerald-500 rounded-full" 
                                                                style={{ width: `${(t.subtasks.filter(st => st.completed).length / t.subtasks.length) * 100}%` }} 
                                                            />
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 font-medium">{t.subtasks.filter(st => st.completed).length}/{t.subtasks.length} subtasks</span>
                                                    </div>
                                                )}

                                                {latest && (
                                                    <div className="mt-2 p-2 bg-slate-50/80 dark:bg-slate-700/50 rounded border border-slate-100 dark:border-slate-700 flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                                                        <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: latest.highlightColor || '#cbd5e1' }} />
                                                        <span className="truncate flex-1">{latest.content}</span>
                                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono whitespace-nowrap">{new Date(latest.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                     );
                                })
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400 dark:text-slate-600">
                                    <ListTodo size={48} className="opacity-20 mb-2" />
                                    <p className="font-medium">No tasks scheduled for this day.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
             )}
          </div>
        );

      case ViewMode.OBSERVATIONS:
        return (
            <ObservationsLog 
                observations={observations} 
                onAddObservation={o => persistData(tasks, logs, [...observations, o], offDays, [{ type: 'observation', action: 'create', id: o.id, data: o }])} 
                onEditObservation={o => persistData(tasks, logs, observations.map(x => x.id === o.id ? o : x), offDays, [{ type: 'observation', action: 'update', id: o.id, data: o }])} 
                onDeleteObservation={id => persistData(tasks, logs, observations.filter(x => x.id !== id), offDays, [{ type: 'observation', action: 'delete', id: id }])} 
                columns={appConfig.observationStatuses} 
                itemColors={appConfig.itemColors} 
            />
        );
      case ViewMode.SETTINGS:
        return (
          <Settings 
            tasks={tasks} 
            logs={logs} 
            observations={observations}
            offDays={offDays} 
            onImportData={(d) => persistData(d.tasks, d.logs, d.observations, d.offDays || [], [{ type: 'full', action: 'overwrite', data: d }])} 
            onSyncConfigUpdate={c => setIsSyncEnabled(!!c)} 
            isSyncEnabled={isSyncEnabled} 
            appConfig={appConfig} 
            onUpdateConfig={handleUpdateAppConfig} 
            onPurgeData={(newTasks: Task[], newLogs: DailyLog[]) => persistData(newTasks, newLogs, observations, offDays, [{ type: 'full', action: 'overwrite', data: { tasks: newTasks, logs: newLogs, observations, offDays, appConfig } }])} 
            backupSettings={backupSettings}
            setBackupSettings={setBackupSettings}
            onSetupBackupFolder={handleSetupBackupFolder}
            backupStatus={backupStatus}
            onVerifyBackupPermission={handleVerifyBackupPermission}
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
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-300">
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col z-20`}>
        <div className="p-4 flex flex-col items-center gap-1 border-b dark:border-slate-800 h-24 justify-center">
           <FullLogo isSidebarOpen={isSidebarOpen} />
           {isSidebarOpen && <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">{BUILD_VERSION}</span>}
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
           {[
             { mode: ViewMode.DASHBOARD, icon: LayoutDashboard, label: 'Dashboard' },
             { mode: ViewMode.TASKS, icon: ListTodo, label: 'Daily Tasks' },
             { mode: ViewMode.OBSERVATIONS, icon: MessageSquare, label: 'Observations' },
           ].map(item => (
             <button key={item.mode} onClick={() => setView(item.mode)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${view === item.mode ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <item.icon size={20} />
                {isSidebarOpen && <span>{item.label}</span>}
             </button>
           ))}
           <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
             <button onClick={() => setView(ViewMode.SETTINGS)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${view === ViewMode.SETTINGS ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <SettingsIcon size={20} />
                {isSidebarOpen && <span>Settings</span>}
             </button>
             <button onClick={() => setView(ViewMode.HELP)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${view === ViewMode.HELP ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <HelpCircle size={20} />
                {isSidebarOpen && <span>User Guide</span>}
             </button>
           </div>
        </nav>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
           <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg w-full flex justify-center">
              {isSidebarOpen ? <LogOut size={20} className="rotate-180" /> : <Menu size={20} />}
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 z-10 transition-colors duration-300">
           {view !== ViewMode.OBSERVATIONS ? (
             <div className="relative max-w-md w-full">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input type="text" placeholder="Search tasks, logs, projects..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-10 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-sm outline-none dark:text-slate-200 dark:placeholder-slate-500" />
                {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        <X size={14} />
                    </button>
                )}
             </div>
           ) : <div />}
           <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      {backupSettings.enabled ? 'Auto-Backup ON' : 'Auto-Backup OFF'}
                  </div>
                  <div className="text-[9px] text-slate-300 dark:text-slate-600 font-mono">
                      Last: {backupSettings.lastBackup ? new Date(backupSettings.lastBackup).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true}) : 'Never'}
                  </div>
              </div>
              <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isSyncEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{isSyncEnabled ? 'Cloud Synced' : 'Local Only'}</span>
              </div>
           </div>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-slate-950 custom-scrollbar relative transition-colors duration-300">
           {renderContent()}
        </div>

        {/* Global Modal for Task Details */}
        {activeTask && (
            <TaskDetailModal 
                task={activeTask}
                allTasks={tasks}
                onClose={() => setActiveTaskId(null)}
                onUpdateStatus={updateTaskStatus}
                onUpdateTask={updateTaskFields}
                onAddUpdate={addUpdateToTask}
                onEditUpdate={handleEditUpdate}
                onDeleteUpdate={handleDeleteUpdate}
                onDeleteTask={deleteTask}
                availableStatuses={appConfig.taskStatuses}
                availablePriorities={appConfig.taskPriorities}
                updateTags={appConfig.updateHighlightOptions || []}
                statusColors={appConfig.itemColors}
            />
        )}

        {showNewTaskModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <form onSubmit={handleCreateTask} className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
                <div className="p-5 border-b dark:border-slate-700 flex justify-between items-center bg-indigo-600 text-white">
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
                            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input required value={newTaskForm.source} onChange={e => setNewTaskForm({...newTaskForm, source: e.target.value})} className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 dark:text-white" />
                         </div>
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Project ID</label>
                         <div className="relative">
                            <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input required list="active-projects" value={newTaskForm.projectId} onChange={e => {
                                const pid = e.target.value;
                                setNewTaskForm({...newTaskForm, projectId: pid, displayId: suggestNextId(pid)});
                            }} placeholder="Project Name..." className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 dark:text-white" />
                            <datalist id="active-projects">
                               {activeProjects.map(p => <option key={p} value={p} />)}
                            </datalist>
                         </div>
                      </div>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Display ID</label>
                      <input required value={newTaskForm.displayId} onChange={e => setNewTaskForm({...newTaskForm, displayId: e.target.value})} placeholder="PRJ-001..." className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 dark:text-white" />
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
                        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 dark:text-white resize-none" 
                      />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Due Date</label>
                         <input type="date" value={newTaskForm.dueDate} onChange={e => setNewTaskForm({...newTaskForm, dueDate: e.target.value})} className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 dark:text-white" />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Priority</label>
                         <select value={newTaskForm.priority} onChange={e => setNewTaskForm({...newTaskForm, priority: e.target.value})} className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 dark:text-white">
                            {appConfig.taskPriorities.map(p => <option key={p} value={p}>{p}</option>)}
                         </select>
                      </div>
                   </div>
                   
                   <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                       <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1 flex items-center gap-1">
                           <Repeat size={12} /> Recurrence
                       </label>
                       <div className="flex gap-2">
                           <select 
                               value={newTaskForm.recurrenceType}
                               onChange={(e) => setNewTaskForm({...newTaskForm, recurrenceType: e.target.value})}
                               className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 dark:text-white"
                           >
                               <option value="none">None (One-time)</option>
                               <option value="daily">Daily</option>
                               <option value="weekly">Weekly</option>
                               <option value="monthly">Monthly</option>
                               <option value="yearly">Yearly</option>
                           </select>
                           {newTaskForm.recurrenceType !== 'none' && (
                               <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 rounded-xl px-2">
                                   <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Every</span>
                                   <input 
                                       type="number" 
                                       min="1"
                                       value={newTaskForm.recurrenceInterval}
                                       onChange={(e) => setNewTaskForm({...newTaskForm, recurrenceInterval: parseInt(e.target.value) || 1})}
                                       className="w-12 bg-transparent outline-none text-sm font-bold text-center dark:text-white"
                                   />
                                   <span className="text-xs text-slate-500 dark:text-slate-400 pr-1">{newTaskForm.recurrenceType.replace('ly', '(s)')}</span>
                               </div>
                           )}
                       </div>
                   </div>

                </div>
                <div className="p-4 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-end gap-3">
                   <button type="button" onClick={() => setShowNewTaskModal(false)} className="px-4 py-2 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all">Cancel</button>
                   <button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all">Create Task</button>
                </div>
             </form>
          </div>
        )}

        {showReportModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-indigo-600 text-white">
                   <h2 className="font-bold flex items-center gap-2"><Sparkles size={18}/> Weekly AI Report</h2>
                   <button onClick={() => setShowReportModal(false)}><X size={20}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 dark:text-slate-200">
                   {isGeneratingReport ? <div className="flex flex-col items-center justify-center py-12 gap-4"><div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div><p>Analyzing week...</p></div> : <div className="prose prose-sm max-w-none dark:prose-invert">{generatedReport.split('\n').map((line, i) => <p key={i}>{line}</p>)}</div>}
                </div>
                <div className="p-4 border-t dark:border-slate-700 flex justify-end gap-2 bg-slate-50 dark:bg-slate-800">
                   <button onClick={() => { navigator.clipboard.writeText(generatedReport); alert('Copied!'); }} className="px-4 py-2 text-slate-600 dark:text-slate-300 font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700">Copy</button>
                   <button onClick={() => setShowReportModal(false)} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">Close</button>
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
