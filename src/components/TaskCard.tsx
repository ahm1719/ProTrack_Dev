
import React, { useMemo } from 'react';
import { Task, Status, Priority, HighlightOption } from '../types';
import { Clock, Calendar, CheckCircle2, Archive, Hourglass, ArrowRight, ListChecks } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onUpdateStatus: (id: string, status: string) => void;
  // This prop will now trigger the modal
  onOpenTask: () => void;
  allowDelete?: boolean;
  isReadOnly?: boolean;
  allowStatusChange?: boolean;
  availableStatuses?: string[];
  availablePriorities?: string[];
  isDailyView?: boolean;
  updateTags?: HighlightOption[];
  onDelete?: (id: string) => void; // Kept for interface compatibility but main actions move to modal
}

const TaskCard: React.FC<TaskCardProps> = ({ 
  task, 
  onUpdateStatus, 
  onOpenTask,
  isReadOnly = false,
  allowStatusChange,
  availableStatuses = Object.values(Status),
  availablePriorities = Object.values(Priority),
  updateTags = []
}) => {
  const latestUpdate = useMemo(() => {
    if (!task.updates || task.updates.length === 0) return null;
    return [...task.updates].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }, [task.updates]);

  const getPriorityColor = (p: string) => {
    if (p === Priority.HIGH) return 'bg-red-100 text-red-800 border-red-200';
    if (p === Priority.MEDIUM) return 'bg-amber-100 text-amber-800 border-amber-200';
    if (p === Priority.LOW) return 'bg-green-100 text-green-800 border-green-200';
    return 'bg-slate-100 text-slate-800 border-slate-200';
  };

  const getStatusColor = (s: string) => {
    if (s === Status.DONE) return 'bg-emerald-500 text-white';
    if (s === Status.IN_PROGRESS) return 'bg-blue-500 text-white';
    if (s === Status.NOT_STARTED) return 'bg-slate-200 text-slate-600';
    if (s === Status.WAITING) return 'bg-amber-400 text-white';
    if (s === Status.ARCHIVED) return 'bg-slate-500 text-white';
    return 'bg-slate-200 text-slate-600';
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
        className={`bg-white rounded-xl shadow-sm border border-slate-200 transition-all duration-300 hover:shadow-md hover:border-indigo-200 cursor-pointer flex flex-col group relative overflow-hidden ${isCompleted ? 'opacity-60 bg-slate-50' : ''}`}
    >
      <div className="p-5 flex-1 flex flex-col h-full">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex flex-wrap gap-2 items-center">
             <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded border border-transparent">
                {task.source}
             </span>
             <span className="font-mono text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-transparent">
                {task.displayId}
             </span>
             <span className={`text-[10px] px-2 py-1 rounded-full border ${getPriorityColor(task.priority)} font-medium`}>
                {task.priority}
             </span>
          </div>
          <div className="text-slate-300 group-hover:text-indigo-500 transition-colors">
             <ArrowRight size={18} />
          </div>
        </div>

        {/* Content */}
        <div className="mb-4">
            <h3 className={`text-base font-semibold text-slate-800 mb-2 leading-tight line-clamp-2 ${isCompleted ? 'line-through text-slate-500' : ''}`}>
              {task.description}
            </h3>
            
            {/* Subtask Progress Bar if existing */}
            {subtaskCount > 0 && (
                <div className="flex items-center gap-2 mb-2">
                    <ListChecks size={14} className={completedSubtasks === subtaskCount ? 'text-emerald-500' : 'text-slate-400'} />
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                            className={`h-full rounded-full transition-all duration-500 ${completedSubtasks === subtaskCount ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                            style={{ width: `${subtaskProgress}%` }}
                        />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 tabular-nums">{completedSubtasks}/{subtaskCount}</span>
                </div>
            )}
        </div>

        {/* Latest Update Snippet */}
        {latestUpdate && (
            <div 
                className="mt-auto mb-3 bg-slate-50/80 rounded-lg p-2.5 text-xs text-slate-600 border border-slate-100 flex items-start gap-2 shadow-sm"
                style={{ borderLeftWidth: '3px', borderLeftColor: latestUpdate.highlightColor || '#cbd5e1' }}
            >
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">LATEST</span>
                        <span className="text-[9px] font-mono text-slate-400">{formatDate(latestUpdate.timestamp)}</span>
                    </div>
                    <p className="truncate font-medium text-slate-700">{latestUpdate.content}</p>
                </div>
            </div>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3 border-t border-slate-50">
          <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500">
            <div className="flex items-center gap-1.5">
              <Calendar size={12} className={task.dueDate ? 'text-indigo-500' : 'text-slate-300'} />
              <span>{task.dueDate ? formatDate(task.dueDate) : 'No Date'}</span>
            </div>
            <div className="flex items-center gap-1.5">
               <Clock size={12} className="text-slate-300" />
               <span>{task.updates.length}</span>
            </div>
          </div>

          <div className="shrink-0" onClick={e => e.stopPropagation()}>
            {!canChangeStatus ? (
               <span className={`inline-block text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm ${getStatusColor(task.status)} uppercase tracking-wide`}>
                 {task.status}
               </span>
            ) : (
              <select
                value={task.status}
                onChange={(e) => onUpdateStatus(task.id, e.target.value)}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-full cursor-pointer border-none outline-none ring-0 shadow-sm ${getStatusColor(task.status)} hover:brightness-105 transition-all uppercase tracking-wide m-0 appearance-none min-w-[80px] text-center`}
              >
                {availableStatuses.map((s) => (
                  <option key={s} value={s} className="bg-white text-slate-800">
                    {s}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
