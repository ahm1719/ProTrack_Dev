
export enum Priority {
  HIGH = 'High',
  MEDIUM = 'Medium',
  LOW = 'Low'
}

export enum Status {
  NOT_STARTED = 'Not Started',
  IN_PROGRESS = 'In Progress',
  WAITING = 'Waiting for others',
  DONE = 'Done',
  ARCHIVED = 'Archived'
}

export enum ObservationStatus {
  NEW = 'New',
  REVIEWING = 'Reviewing',
  RESOLVED = 'Resolved',
  ARCHIVED = 'Archived'
}

export interface HighlightOption {
  id: string;
  color: string;
  label: string;
}

export interface AppConfig {
  taskStatuses: string[];
  taskPriorities: string[];
  observationStatuses: string[];
  groupLabels: {
    statuses: string;
    priorities: string;
    observations: string;
  };
  groupColors: {
    statuses: string;
    priorities: string;
    observations: string;
  };
  updateHighlightOptions?: HighlightOption[];
  itemColors?: Record<string, string>; // { "Status Name": "#hexcode" }
  aiReportConfig?: {
    customInstructions?: string;
    periodType?: 'current_week' | '7_days' | '14_days' | '30_days';
  };
}

export interface BackupSettings {
  enabled: boolean;
  intervalMinutes: number;
  lastBackup: string | null; // ISO String
  folderName: string | null;
}

export interface TaskAttachment {
  id: string;
  name: string;
  type: string;
  data: string; // Base64
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string; // ISO String
}

export interface TaskUpdate {
  id: string;
  timestamp: string; // ISO String
  content: string;
  attachments?: TaskAttachment[];
  highlightColor?: string; // For visual tagging of updates (e.g., Blockers)
}

export interface RecurrenceConfig {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
}

export interface Task {
  id: string; // Internal UUID
  displayId: string; // User facing ID like P1130-28
  source: string; // CW02, CW49
  projectId: string; // New Project ID field
  description: string;
  dueDate: string; // YYYY-MM-DD
  status: string; 
  priority: string; 
  updates: TaskUpdate[]; // Historical updates/comments
  subtasks?: Subtask[]; // List of actionable sub-items
  recurrence?: RecurrenceConfig; // Recurrence settings
  createdAt: string;
  attachments?: TaskAttachment[]; // Global task attachments
  order?: number; // For manual sorting in daily view
}

export interface DailyLog {
  id: string;
  date: string; // YYYY-MM-DD
  taskId: string;
  content: string;
}

export interface Observation {
  id: string;
  timestamp: string;
  content: string;
  status: string;
  images?: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string; // Base64 data URL
  timestamp: number;
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export enum ViewMode {
  DASHBOARD = 'DASHBOARD',
  TASKS = 'TASKS',
  JOURNAL = 'JOURNAL',
  REPORT = 'REPORT',
  OBSERVATIONS = 'OBSERVATIONS',
  SETTINGS = 'SETTINGS',
  HELP = 'HELP'
}

// --- File System Access API Types ---
export interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
  isSameEntry(other: FileSystemHandle): Promise<boolean>;
  queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
}

export interface FileSystemDirectoryHandle extends FileSystemHandle {
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
}

export interface FileSystemFileHandle extends FileSystemHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
}

export interface FileSystemWritableFileStream extends WritableStream {
  write(data: any): Promise<void>;
  close(): Promise<void>;
}

// --- Sync Types ---
export interface SyncAction {
  type: 'task' | 'log' | 'observation' | 'offDays' | 'config' | 'full';
  action: 'create' | 'update' | 'delete' | 'overwrite';
  id?: string;
  data?: any;
}
