
import React, { useMemo } from 'react';
import { Task, Status, Priority } from '../types';
import { X, CheckCircle2, ArrowRight, Play, RotateCcw, Calendar, ListTodo, CheckSquare } from 'lucide-react';

interface DayFocusModalProps {
  date: string;
  tasks: Task[];
  onClose: () => void;
  onUpdateStatus: (id: string, status: string) => void;
  onUpdateTask: (id: string, fields: Partial<Task>) => void;
}

const getPriorityColor = (p: string) => {
  if (p === Priority.HIGH) return 'bg-red-500';
  if (p === Priority.MEDIUM) return 'bg-amber-500';
  return 'bg-emerald-500';
};

const MiniCard: React.FC<{ 
    task: Task; 
    type: 'pool' | 'processed'; 
    onUpdateStatus: (id: string, status: string) => void;
}> = ({ task, type, onUpdateStatus }) => (
    <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl shadow-sm hover:border-indigo-500/50 transition-all group">
        <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${getPriorityColor(task.priority)}`}></div>
                <span className="font-mono text-[10px] text-slate-400">{task.displayId}</span>
            </div>
            {task.status === Status.DONE && <CheckCircle2 size={14} className="text-emerald-500" />}
        </div>
        <h4 className="text-slate-200 font-bold text-sm mb-3 line-clamp-2">{task.title || task.description}</h4>
        
        <div className="flex items-center justify-end">
            {type === 'pool' ? (
                <button 
                    onClick={() => onUpdateStatus(task.id, Status.IN_PROGRESS)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
                >
                    Start <Play size={10} fill="currentColor" />
                </button>
            ) : (
                <div className="flex gap-2">
                    {task.status !== Status.DONE ? (
                        <>
                            <button 
                                onClick={() => onUpdateStatus(task.id, Status.NOT_STARTED)}
                                className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                                title="Move back to Pool"
                            >
                                <RotateCcw size={14} />
                            </button>
                            <button 
                                onClick={() => onUpdateStatus(task.id, Status.DONE)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
                            >
                                Complete <CheckCircle2 size={10} />
                            </button>
                        </>
                    ) : (
                        <button 
                            onClick={() => onUpdateStatus(task.id, Status.IN_PROGRESS)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
                        >
                            Reopen
                        </button>
                    )}
                </div>
            )}
        </div>
    </div>
);

const DayFocusModal: React.FC<DayFocusModalProps> = ({ date, tasks, onClose, onUpdateStatus, onUpdateTask }) => {
  const dateObj = new Date(date);
  const displayDate = dateObj.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

  // Filter tasks relevant to this view (Due on or before this date, or worked on this date)
  const relevantTasks = useMemo(() => {
    return tasks.filter(t => {
        // Include if due on this date
        if (t.dueDate === date) return true;
        // Include if due before this date and not done (Overdue backlog)
        if (t.dueDate && t.dueDate < date && t.status !== Status.DONE && t.status !== Status.ARCHIVED) return true;
        // Include if In Progress (even if due later, we are working on it)
        if (t.status === Status.IN_PROGRESS) return true;
        return false;
    });
  }, [tasks, date]);

  const poolTasks = relevantTasks.filter(t => t.status === Status.NOT_STARTED || t.status === Status.WAITING);
  const processedTasks = relevantTasks.filter(t => t.status === Status.IN_PROGRESS || t.status === Status.DONE);

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-slate-900 w-full max-w-6xl h-[85vh] rounded-3xl shadow-2xl border border-slate-800 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-indigo-600 to-indigo-800 flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Calendar className="text-indigo-200" />
                        {displayDate}
                    </h2>
                    <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mt-1 opacity-80">Today's Execution & Workflow</p>
                </div>
                <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors">
                    <X size={24} />
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-hidden p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Column 1: Task Pool */}
                <div className="flex flex-col bg-slate-800/30 rounded-2xl border border-slate-800 overflow-hidden">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <ListTodo size={16} /> Task Pool
                        </h3>
                        <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-xs font-bold">{poolTasks.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {poolTasks.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600">
                                <CheckSquare size={48} className="mb-4 opacity-20" />
                                <p className="text-sm">No tasks pending for this day.</p>
                            </div>
                        )}
                        {poolTasks.map(t => <MiniCard key={t.id} task={t} type="pool" onUpdateStatus={onUpdateStatus} />)}
                    </div>
                </div>

                {/* Column 2: Processed Tasks */}
                <div className="flex flex-col bg-slate-800/30 rounded-2xl border border-slate-800 overflow-hidden border-t-4 border-t-emerald-500/50">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                        <h3 className="text-sm font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                            <CheckCircle2 size={16} /> Processed Tasks
                        </h3>
                        <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-xs font-bold">{processedTasks.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {processedTasks.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600">
                                <Play size={48} className="mb-4 opacity-20" />
                                <p className="text-sm">Start tasks from the pool to see them here.</p>
                            </div>
                        )}
                        {processedTasks.map(t => <MiniCard key={t.id} task={t} type="processed" onUpdateStatus={onUpdateStatus} />)}
                    </div>
                </div>

            </div>
        </div>
    </div>
  );
};

export default DayFocusModal;
