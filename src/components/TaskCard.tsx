
import React, { useMemo } from 'react';
import { Task, Status, Priority, HighlightOption } from '../types';
/* Added ChevronDown to imported components from lucide-react to fix compilation error */
import { Clock, Calendar, CheckCircle2, Archive, Hourglass, ArrowRight, ListChecks, Repeat, AlertTriangle, ChevronDown } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onUpdateStatus: (id: string, status: string) => void;
  onOpenTask: () => void;
  allowDelete?: boolean;
  isReadOnly?: boolean;
  allowStatusChange?: boolean;
  availableStatuses?: string[];
  availablePriorities?: string[];
  isDailyView?: boolean;
  updateTags?: HighlightOption[];
  statusColors?: Record<string, string>;
  onDelete?: (id: string) => void;
  todayStr?: string;
}

const TaskCard: React.FC<TaskCardProps> = ({ 
  task, 
  onUpdateStatus, 
  onOpenTask,
  isReadOnly = false,
  allowStatusChange,
  availableStatuses = Object.values(Status),
  availablePriorities = Object.values(Priority),
  updateTags = [],
  statusColors = {},
  todayStr = new Date().toLocaleDateString('en-CA')
}) => {
  const latestUpdate = useMemo(() => {
    if (!task.updates || task.updates.length === 0) return null;
    return [...task.updates].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }, [task.updates]);

  const isOverdue = useMemo(() => {
    return task.dueDate && 
           task.dueDate < todayStr && 
           task.status !== Status.DONE && 
           task.status !== Status.ARCHIVED;
  }, [task.dueDate, task.status, todayStr]);

  /**
   * Helper to strip formatting tags for snippet display
   */
  const getCleanContent = (content: string) => {
    if (!content) return '';
    return content.replace(/\*\*/g, '').replace(/==/g, '');
  };

  const getPriorityColor = (p: string) => {
    if (p === Priority.HIGH) return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
    if (p === Priority.MEDIUM) return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
    if (p === Priority.LOW) return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  };

  const getContrastYIQ = (hexcolor: string) => {
    if (!hexcolor) return '#ffffff';
    const hex = hexcolor.replace('#', '');
    if (hex.length !== 6) return '#ffffff';
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#1e293b' : '#ffffff';
  };

  const getStatusStyle = (s: string) => {
    const custom = statusColors[s];
    if (custom) {
        return { 
            backgroundColor: custom, 
            color: getContrastYIQ(custom),
            borderColor: custom
        };
    }
    // Default Fallbacks
    if (s === Status.DONE) return { backgroundColor: '#10b981', color: '#ffffff', borderColor: '#10b981' }; 
    if (s === Status.IN_PROGRESS) return { backgroundColor: '#3b82f6', color: '#ffffff', borderColor: '#3b82f6' }; 
    if (s === Status.WAITING) return { backgroundColor: '#fbbf24', color: '#ffffff', borderColor: '#fbbf24' }; 
    if (s === Status.ARCHIVED) return { backgroundColor: '#64748b', color: '#ffffff', borderColor: '#64748b' }; 
    return { backgroundColor: '#e2e8f0', color: '#475569', borderColor: '#e2e8f0' }; 
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
        if (dateStr.includes('T')) {
            const date = new Date(dateStr);
            return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
        } else {
            const [y, m, d] = dateStr.split('-');
            const date = new Date(Number(y), Number(m)-1, Number(d));
            return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
        }
    } catch (e) {
        return dateStr;
    }
  };

  const isCompleted = task.status === Status.DONE || task.status === Status.ARCHIVED;
  const canChangeStatus = allowStatusChange ?? !isReadOnly;

  // Subtask calculations
  const subtaskCount = task.subtasks?.length || 0;
  const completedSubtasks = task.subtasks?.filter(st => st.completed).length || 0;
  const subtaskProgress = subtaskCount > 0 ? Math.round((completedSubtasks / subtaskCount) * 100) : 0;

  return (
    <div 
        onClick={onOpenTask}
        className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md cursor-pointer flex flex-col group relative overflow-hidden border ${
          isCompleted ? 'opacity-60 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700' : 
          isOverdue ? 'border-red-400 dark:border-red-600 bg-red-50/20 dark:bg-red-900/10 ring-1 ring-red-100 dark:ring-red-900/30' :
          'border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-700'
        }`}
    >
      {isOverdue && (
        <div className="absolute top-0 right-0">
          <div className="bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded-bl-lg shadow-sm animate-pulse tracking-tighter uppercase">
            Overdue
          </div>
        </div>
      )}
      
      <div className="p-5 flex-1 flex flex-col h-full">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex flex-wrap gap-2 items-center">
             <span className="font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded border border-transparent">
                {task.source}
             </span>
             <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded border border-transparent flex items-center gap-1">
                {task.displayId}
                {task.recurrence && <Repeat size={10} className="text-indigo-400" />}
             </span>
             <span className={`text-[10px] px-2 py-1 rounded-full border ${getPriorityColor(task.priority)} font-medium`}>
                {task.priority}
             </span>
          </div>
          <div className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
             <ArrowRight size={18} />
          </div>
        </div>

        {/* Content */}
        <div className="mb-4">
            <h3 className={`text-base font-bold mb-2 leading-tight line-clamp-2 ${
                isCompleted ? 'line-through text-slate-500 dark:text-slate-500' : 
                isOverdue ? 'text-red-900 dark:text-red-200' : 
                'text-slate-800 dark:text-slate-100'
            }`}>
              {task.title || task.description}
            </h3>
            
            {/* Subtask Progress Bar if existing */}
            {subtaskCount > 0 && (
                <div className="flex items-center gap-2 mb-2">
                    <ListChecks size={14} className={completedSubtasks === subtaskCount ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'} />
                    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                            className={`h-full rounded-full transition-all duration-500 ${completedSubtasks === subtaskCount ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                            style={{ width: `${subtaskProgress}%` }}
                        />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tabular-nums">{completedSubtasks}/{subtaskCount}</span>
                </div>
            )}
        </div>

        {/* Latest Update Snippet */}
        {latestUpdate && (
            <div 
                className="mt-auto mb-3 bg-slate-50/80 dark:bg-slate-700/50 rounded-lg p-2.5 text-xs text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700 flex items-start gap-2 shadow-sm"
                style={{ borderLeftWidth: '3px', borderLeftColor: latestUpdate.highlightColor || '#cbd5e1' }}
            >
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">LATEST</span>
                        <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500">{formatDate(latestUpdate.timestamp)}</span>
                    </div>
                    <p className="truncate font-medium text-slate-700 dark:text-slate-300">
                        {getCleanContent(latestUpdate.content)}
                    </p>
                </div>
            </div>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3 border-t border-slate-50 dark:border-slate-700">
          <div className="flex items-center gap-3 text-[11px] font-medium">
            <div className="flex items-center gap-1.5">
              <Calendar size={12} className={isOverdue ? 'text-red-500 dark:text-red-400' : task.dueDate ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-600'} />
              <span className={isOverdue ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-500 dark:text-slate-400'}>
                {task.dueDate ? formatDate(task.dueDate) : 'No Date'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
               <Clock size={12} className="text-slate-300 dark:text-slate-600" />
               <span>{task.updates.length}</span>
            </div>
          </div>

          <div className="shrink-0" onClick={e => e.stopPropagation()}>
            {!canChangeStatus ? (
               <span 
                 className="inline-block text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm uppercase tracking-wide border dark:border-transparent"
                 style={getStatusStyle(task.status)}
               >
                 {task.status}
               </span>
            ) : (
              <div className="relative group">
                  <select
                    value={task.status}
                    onChange={(e) => onUpdateStatus(task.id, e.target.value)}
                    className="text-[10px] font-bold pl-3 pr-6 py-1.5 rounded-full cursor-pointer border outline-none appearance-none shadow-sm hover:brightness-105 transition-all uppercase tracking-wide m-0 min-w-[80px] text-center dark:border-transparent"
                    style={getStatusStyle(task.status)}
                  >
                    {availableStatuses.map((s) => (
                      <option key={s} value={s} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                        {s}
                      </option>
                    ))}
                  </select>
                  {/* ChevronDown component from lucide-react */}
                  <ChevronDown 
                    size={10} 
                    className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60"
                    style={{ color: getStatusStyle(task.status).color }}
                  />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
