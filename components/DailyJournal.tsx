import React, { useState, useEffect } from 'react';
import { Task, DailyLog, Status } from '../types';
import { Calendar as CalendarIcon, Save, Plus, Clock, Calendar, Filter, RotateCcw, X, Info } from 'lucide-react';

interface DailyJournalProps {
  tasks: Task[];
  logs: DailyLog[];
  onAddLog: (log: Omit<DailyLog, 'id'>) => void;
  onUpdateTask: (taskId: string, updates: { status?: Status; dueDate?: string }) => void;
  initialTaskId?: string;
}

const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const newDate = new Date(d.setDate(diff));
  return newDate.toISOString().split('T')[0];
};

const getEndOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + 6; // Sunday
  const newDate = new Date(d.setDate(diff));
  return newDate.toISOString().split('T')[0];
};

const DailyJournal: React.FC<DailyJournalProps> = ({ tasks, logs, onAddLog, onUpdateTask, initialTaskId }) => {
  // State for the New Entry Form
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>(initialTaskId || '');
  const [content, setContent] = useState('');

  // State for the View/Filter
  const [viewRange, setViewRange] = useState({
    start: getStartOfWeek(new Date()),
    end: getEndOfWeek(new Date())
  });

  // Sync state if prop changes (e.g. navigation from dashboard)
  useEffect(() => {
    if (initialTaskId) {
      setSelectedTaskId(initialTaskId);
    }
  }, [initialTaskId]);

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId || !content.trim()) return;

    onAddLog({
      date: entryDate, // Use the specific entry date
      taskId: selectedTaskId,
      content: content.trim()
    });
    
    // Reset form but keep date
    setContent('');
    setSelectedTaskId('');
  };

  const handleSetCurrentWeek = () => {
    setViewRange({
      start: getStartOfWeek(new Date()),
      end: getEndOfWeek(new Date())
    });
  };

  // Filter and Group Logs
  const filteredLogs = logs.filter(l => l.date >= viewRange.start && l.date <= viewRange.end);
  
  // Group logs by date for display
  const logsByDate: Record<string, DailyLog[]> = {};
  filteredLogs.forEach(log => {
    if (!logsByDate[log.date]) logsByDate[log.date] = [];
    logsByDate[log.date].push(log);
  });
  
  // Sort dates descending
  const sortedDates = Object.keys(logsByDate).sort().reverse();

  // Sort tasks: Active first (by due date asc), then Completed/Archived (by due date desc)
  const sortedTasks = [...tasks].sort((a, b) => {
    const aIsComplete = a.status === Status.DONE || a.status === Status.ARCHIVED;
    const bIsComplete = b.status === Status.DONE || b.status === Status.ARCHIVED;

    if (aIsComplete && !bIsComplete) return 1;
    if (!aIsComplete && bIsComplete) return -1;
    
    // If both active, sort by due date ascending (older first)
    if (!aIsComplete && !bIsComplete) {
       return a.dueDate.localeCompare(b.dueDate);
    }
    // If both complete, sort by due date descending (newest first)
    return b.dueDate.localeCompare(a.dueDate);
  });

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-slate-800">
          Daily Journal
        </h2>
      </div>

      {/* Input Form */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-100">
           <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">New Entry For:</span>
           <input 
            type="date" 
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="text-sm text-slate-700 outline-none font-medium bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <form onSubmit={handleAddEntry} className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-slate-500">Task Reference</label>
                {selectedTaskId && (
                    <button 
                        type="button" 
                        onClick={() => setSelectedTaskId('')} 
                        className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"
                    >
                        <X size={12}/> Clear Selection
                    </button>
                )}
            </div>
            
            <div className="relative">
                <select 
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 appearance-none"
                required
                >
                <option value="">Select a task...</option>
                {sortedTasks.map(t => (
                    <option key={t.id} value={t.id}>
                    {t.displayId} - {t.description}
                    </option>
                ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronDownIcon />
                </div>
            </div>

            {/* Display Full Description if Selected */}
            {selectedTask && (
                <div className="mt-2 p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-600 leading-relaxed whitespace-pre-wrap flex gap-2 items-start">
                    <Info size={14} className="text-indigo-400 flex-shrink-0 mt-0.5" />
                    <span>{selectedTask.description}</span>
                </div>
            )}
          </div>

          {/* Quick Edit Controls for Selected Task */}
          {selectedTask && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100 animate-fade-in">
               <div>
                  <label className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 uppercase mb-1">
                    <Clock size={10} /> Status
                  </label>
                  <select
                    value={selectedTask.status}
                    onChange={(e) => onUpdateTask(selectedTask.id, { status: e.target.value as Status })}
                    className="w-full p-1.5 text-xs border border-indigo-200 rounded focus:ring-1 focus:ring-indigo-500 outline-none bg-white text-slate-800"
                  >
                     {Object.values(Status).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
               </div>
               <div>
                  <label className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 uppercase mb-1">
                    <Calendar size={10} /> Due Date
                  </label>
                  <input 
                    type="date"
                    value={selectedTask.dueDate}
                    onChange={(e) => onUpdateTask(selectedTask.id, { dueDate: e.target.value })}
                    className="w-full p-1.5 text-xs border border-indigo-200 rounded focus:ring-1 focus:ring-indigo-500 outline-none bg-white text-slate-800"
                  />
               </div>
            </div>
          )}
          
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Activity / Progress</label>
            <textarea 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What did you work on?"
              className="w-full p-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-32 resize-none bg-slate-50"
              required
            />
          </div>

          <button 
            type="submit" 
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg font-medium transition-colors shadow-sm"
          >
            <Save size={18} />
            Log Activity
          </button>
        </form>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-2 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-2 text-slate-600">
             <Filter size={16} />
             <span className="text-xs font-bold uppercase">View History</span>
           </div>
           <button onClick={handleSetCurrentWeek} className="text-xs text-indigo-600 font-medium hover:underline flex items-center gap-1">
             <RotateCcw size={12}/> Current Week
           </button>
        </div>
        <div className="flex items-center gap-2">
           <input 
            type="date" 
            value={viewRange.start}
            onChange={(e) => setViewRange(prev => ({ ...prev, start: e.target.value }))}
            className="w-full text-xs p-1.5 border border-slate-200 rounded bg-slate-50"
           />
           <span className="text-slate-400">-</span>
           <input 
            type="date" 
            value={viewRange.end}
            onChange={(e) => setViewRange(prev => ({ ...prev, end: e.target.value }))}
            className="w-full text-xs p-1.5 border border-slate-200 rounded bg-slate-50"
           />
        </div>
      </div>

      {/* Timeline Display */}
      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-[500px]">
        {sortedDates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-center p-4">
            <p className="text-slate-400 text-sm">No logs in selected range.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDates.map(date => (
              <div key={date}>
                 <h3 className="font-bold text-slate-800 pl-1 mb-2 text-xs uppercase tracking-wide sticky top-0 bg-slate-50 py-1 z-10">
                    {new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric'})}
                 </h3>
                 <div className="relative border-l-2 border-indigo-100 ml-3 space-y-4 py-1">
                    {logsByDate[date].slice().reverse().map((log) => {
                      const task = tasks.find(t => t.id === log.taskId);
                      return (
                        <div key={log.id} className="relative pl-6">
                          {/* Timeline Dot */}
                          <div className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-white border-2 border-indigo-300"></div>
                          
                          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                            <div className="flex justify-between items-start mb-1">
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                                {task?.displayId || 'Unknown'}
                              </span>
                            </div>
                            <p className="text-slate-700 text-xs leading-relaxed">{log.content}</p>
                          </div>
                        </div>
                      );
                    })}
                 </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Simple Chevron Icon Component for Select
const ChevronDownIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 9 6 6 6-6"/>
    </svg>
);

export default DailyJournal;