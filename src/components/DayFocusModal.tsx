
import React, { useMemo } from 'react';
import { Task, Status, Priority } from '../types';
import { X, CheckCircle2, ArrowRight, Play, RotateCcw, Calendar, ListTodo, CheckSquare, ArrowLeft } from 'lucide-react';

interface DayFocusModalProps {
  date: string;
  tasks: Task[];
  onClose: () => void;
  onUpdateStatus: (id: string, status: string) => void;
  onUpdateTask: (id: string, fields: Partial<Task>) => void;
  onOpenTask: (task: Task) => void;
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
    onMove: () => void;
    onOpen: () => void;
}> = ({ task, type, onUpdateStatus, onMove, onOpen }) => (
    <div 
        onClick={onOpen}
        className="bg-slate-800 border border-slate-700 p-4 rounded-xl shadow-sm hover:border-indigo-500/50 transition-all group cursor-pointer hover:shadow-md hover:bg-slate-800/80"
    >
        <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${getPriorityColor(task.priority)}`}></div>
                <span className="font-mono text-[10px] text-slate-400">{task.displayId}</span>
                {task.status === Status.DONE && <span className="bg-emerald-900/50 text-emerald-400 text-[8px] px-1.5 py-0.5 rounded font-bold uppercase">Done</span>}
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Optional Status toggles can go here if needed, kept minimal for now */}
            </div>
        </div>
        <h4 className="text-slate-200 font-bold text-sm mb-3 line-clamp-2 leading-snug">{task.title || task.description}</h4>
        
        <div className="flex items-center justify-between mt-4" onClick={e => e.stopPropagation()}>
            <div className="text-[10px] text-slate-500 font-medium">{task.status}</div>
            {type === 'pool' ? (
                <button 
                    onClick={onMove}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors shadow-sm"
                >
                    Process <ArrowRight size={12} />
                </button>
            ) : (
                <button 
                    onClick={onMove}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
                >
                    <ArrowLeft size={12} /> Return
                </button>
            )}
        </div>
    </div>
);

const DayFocusModal: React.FC<DayFocusModalProps> = ({ date, tasks, onClose, onUpdateStatus, onUpdateTask, onOpenTask }) => {
  const dateObj = new Date(date);
  const displayDate = dateObj.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

  // 1. Processed List: Tasks explicitly marked as processed TODAY
  const processedTasks = useMemo(() => {
    return tasks.filter(t => t.processedDate === date);
  }, [tasks, date]);

  // 2. Pool List: Active tasks relevant to today, NOT yet processed today
  const poolTasks = useMemo(() => {
    return tasks.filter(t => {
        // Exclude if already processed today
        if (t.processedDate === date) return false;
        
        // Exclude if explicitly archived (Done tasks usually stay in view if processed today, but if in pool, usually we only want active)
        if (t.status === Status.ARCHIVED) return false;

        // Include if Due <= Today OR Status is In Progress
        // Also include if it was processed previously? No, pool is "Remaining work"
        if (t.dueDate && t.dueDate <= date && t.status !== Status.DONE) return true;
        if (t.status === Status.IN_PROGRESS) return true;
        
        return false;
    });
  }, [tasks, date]);

  const handleMoveToProcessed = (taskId: string) => {
      onUpdateTask(taskId, { processedDate: date });
  };

  const handleReturnToPool = (taskId: string) => {
      onUpdateTask(taskId, { processedDate: null });
  };

  return (
    <div 
        className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[60] flex items-center justify-center p-6 animate-fade-in"
        onClick={onClose}
    >
        <div 
            className="bg-slate-900 w-full max-w-7xl h-[90vh] rounded-3xl shadow-2xl border border-slate-800 flex flex-col overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
        >
            
            {/* Header */}
            <div className="p-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-3xl font-black text-white flex items-center gap-3 tracking-tight">
                        <span className="text-indigo-500"><Calendar size={28} /></span>
                        {displayDate}
                    </h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1 ml-10">Daily Execution Workflow</p>
                </div>
                <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full transition-colors">
                    <X size={24} />
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-hidden p-6 grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-950/50">
                
                {/* Column 1: Task Pool */}
                <div className="flex flex-col bg-slate-900/50 rounded-2xl border border-slate-800/50 overflow-hidden">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-slate-800 rounded text-slate-400"><ListTodo size={16} /></div>
                            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Task Pool</h3>
                        </div>
                        <span className="bg-slate-800 text-slate-400 px-2.5 py-1 rounded text-xs font-bold">{poolTasks.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {poolTasks.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-60">
                                <CheckSquare size={48} className="mb-4" />
                                <p className="text-sm font-medium">Pool empty</p>
                                <p className="text-xs">No active tasks due today.</p>
                            </div>
                        )}
                        {poolTasks.map(t => (
                            <MiniCard 
                                key={t.id} 
                                task={t} 
                                type="pool" 
                                onUpdateStatus={onUpdateStatus}
                                onMove={() => handleMoveToProcessed(t.id)}
                                onOpen={() => onOpenTask(t)}
                            />
                        ))}
                    </div>
                </div>

                {/* Column 2: Processed Tasks */}
                <div className="flex flex-col bg-indigo-900/10 rounded-2xl border border-indigo-500/20 overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                    <div className="p-4 border-b border-indigo-500/20 flex justify-between items-center bg-indigo-900/20">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-indigo-500/20 rounded text-indigo-300"><CheckCircle2 size={16} /></div>
                            <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider">Processed Today</h3>
                        </div>
                        <span className="bg-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded text-xs font-bold">{processedTasks.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {processedTasks.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-indigo-300/40">
                                <Play size={48} className="mb-4" />
                                <p className="text-sm font-medium">Ready to start?</p>
                                <p className="text-xs">Move tasks here when you work on them.</p>
                            </div>
                        )}
                        {processedTasks.map(t => (
                            <MiniCard 
                                key={t.id} 
                                task={t} 
                                type="processed" 
                                onUpdateStatus={onUpdateStatus}
                                onMove={() => handleReturnToPool(t.id)}
                                onOpen={() => onOpenTask(t)}
                            />
                        ))}
                    </div>
                </div>

            </div>
        </div>
    </div>
  );
};

export default DayFocusModal;
