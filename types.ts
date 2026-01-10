export enum Priority {
  HIGH = 'High',
  MEDIUM = 'Medium',
  LOW = 'Low'
}

export enum Status {
  NOT_STARTED = 'Not Started',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
  ON_HOLD = 'On Hold'
}

export interface TaskUpdate {
  id: string;
  timestamp: string; // ISO String
  content: string;
}

export interface Task {
  id: string; // Internal UUID
  displayId: string; // User facing ID like P1130-28
  source: string; // CW02, CW49
  description: string;
  dueDate: string; // YYYY-MM-DD
  status: Status;
  priority: Priority;
  updates: TaskUpdate[]; // Historical updates/comments
  createdAt: string;
}

export interface DailyLog {
  id: string;
  date: string; // YYYY-MM-DD
  taskId: string;
  content: string;
}

export enum ViewMode {
  DASHBOARD = 'DASHBOARD',
  TASKS = 'TASKS',
  JOURNAL = 'JOURNAL',
  REPORT = 'REPORT',
  HELP = 'HELP'
}