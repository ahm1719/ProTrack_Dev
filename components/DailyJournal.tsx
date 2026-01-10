import React, { useState } from 'react';
import { Task, DailyLog } from '../types';
import { Calendar as CalendarIcon, Save, Plus } from 'lucide-react';

interface DailyJournalProps {
  tasks: Task[];
  logs: DailyLog[];
  onAddLog: (log: Omit<DailyLog, 'id'>) => void;
}

const DailyJournal: React.FC<DailyJournalProps> = ({ tasks, logs, onAddLog }) => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // State for new entry form
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [content, setContent] = useState('');

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId || !content.trim()) return;

    onAddLog({
      date: selectedDate,
      taskId: selectedTaskId,
      content: content.trim()
    });
    
    // Reset form but keep date
    setContent('');
    setSelectedTaskId('');
  };

  // Filter logs for selected date
  const daysLogs = logs.filter(l => l.date === selectedDate);
  // Sort incomplete tasks to top for selection
  const sortedTasks = [...tasks].sort((a, b) => a.status === 'Completed' ? 1 : -1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Daily Journal</h2>
          <p className="text-slate-500 text-sm">Log your daily progress to build your weekly report.</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
          <CalendarIcon size={18} className="text-slate-400" />
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm text-slate-700 outline-none font-medium"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Form */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Plus size={18} className="text-indigo-600"/>
            New Entry
          </h3>
          <form onSubmit={handleAddEntry} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Task Reference</label>
              <select 
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
                required
              >
                <option value="">Select a task...</option>
                {sortedTasks.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.displayId} - {t.description.substring(0, 30)}...
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Activity / Progress</label>
              <textarea 
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Sent email to Priyanka regarding cost..."
                className="w-full p-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-32 resize-none bg-slate-50"
                required
              />
            </div>

            <button 
              type="submit" 
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg font-medium transition-colors"
            >
              <Save size={18} />
              Log Activity
            </button>
          </form>
        </div>

        {/* Timeline Display */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-semibold text-slate-800 pl-1">Activities for {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric'})}</h3>
          
          {daysLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
              <div className="p-4 bg-white rounded-full shadow-sm mb-3">
                 <CalendarIcon size={24} className="text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">No activity logged for this date.</p>
              <p className="text-xs text-slate-400">Use the form to add your progress.</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-indigo-100 ml-3 space-y-8 py-2">
              {daysLogs.map((log) => {
                const task = tasks.find(t => t.id === log.taskId);
                return (
                  <div key={log.id} className="relative pl-8">
                    {/* Timeline Dot */}
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-4 border-indigo-200"></div>
                    
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-600">
                           {task?.displayId || 'Unknown Task'}
                        </span>
                        {task && (
                           <span className="text-xs text-slate-400 truncate max-w-[150px]">{task.description}</span>
                        )}
                      </div>
                      <p className="text-slate-700 text-sm leading-relaxed">{log.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyJournal;
