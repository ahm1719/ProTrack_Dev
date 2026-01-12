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

export interface AppConfig {
  taskStatuses: string[];
  taskPriorities: string[];
  observationStatuses: string[];
  // Mapping of item name (e.g. "High") to hex color
  itemColors?: Record<string, string>;
  groupLabels?: {
    statuses: string;
    priorities: string;
    observations: string;
  };
}

export interface TaskAttachment {
  id: string;
  name: string;
  type: string;
  data: string; // Base64
}

export interface TaskUpdate {
  id: string;
  timestamp: string; // ISO String
  content: string;
  attachments?: TaskAttachment[];
  highlightColor?: string; // Color to highlight the update card
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
  createdAt: string;
  attachments?: TaskAttachment[]; // Global task attachments
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