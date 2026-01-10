import React, { useState } from 'react';
import { Task, Status, Priority } from '../types';
import { Clock, Calendar, ChevronDown, ChevronUp, Edit2, CheckCircle2, AlertCircle } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onUpdateStatus: (id: string, status: Status) => void;
  onEdit: (task: Task) => void;
  onAddUpdate: (id: string, content: string) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onUpdateStatus, onEdit, onAddUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newUpdate, setNewUpdate] = useState('');

  const getPriorityColor = (p: Priority) => {
    switch (p) {
      case Priority.HIGH: return 'bg-red-100 text-red-800 border-red-200';
      case Priority.MEDIUM: return 'bg-amber-100 text-amber-800 border-amber-200';
      case Priority.LOW: return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  const getStatusColor = (s: Status) => {
    switch (s) {
      case Status.COMPLETED: return 'bg-emerald-500 text-white';
      case Status.IN_PROGRESS: return 'bg-blue-500 text-white';
      case Status.NOT_STARTED: return 'bg-slate-200 text-slate-600';
      case Status.ON_HOLD: return 'bg-orange-400 text-white';
    }
  };

  const handleSubmitUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUpdate.trim()) {
      onAddUpdate(task.id, newUpdate);
      setNewUpdate('');
    }
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300 hover:shadow-md ${task.status === Status.COMPLETED ? 'opacity-75' : ''}`}>
      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <div className="flex gap-2 items-center">
             <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
              {task.source}
            </span>
            <span className="font-mono text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
              {task.displayId}
            </span>
            <span className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(task.priority)} font-medium`}>
              {task.priority}
            </span>
          </div>
          <button onClick={() => onEdit(task)} className="text-slate-400 hover:text-indigo-600">
            <Edit2 size={16} />
          </button>
        </div>

        <h3 className="text-lg font-semibold text-slate-800 mb-2 leading-tight">
          {task.description}
        </h3>

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-1">
              <Calendar size={14} />
              <span>{task.dueDate}</span>
            </div>
            <div className="flex items-center gap-1">
               {task.status === Status.COMPLETED ? <CheckCircle2 size={14} className="text-emerald-500"/> : <Clock size={14} />}
               <span>{task.updates.length} updates</span>
            </div>
          </div>

          <select
            value={task.status}
            onChange={(e) => onUpdateStatus(task.id, e.target.value as Status)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer border-none outline-none ring-0 ${getStatusColor(task.status)}`}
          >
            {Object.values(Status).map((s) => (
              <option key={s} value={s} className="bg-white text-slate-800">
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expandable History Section */}
      <div className="border-t border-slate-100">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-5 py-2 flex items-center justify-center gap-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
        >
          {isExpanded ? 'Hide History' : 'View History & Add Update'}
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {isExpanded && (
          <div className="px-5 pb-5 bg-slate-50">
            {/* Quick Update Input */}
            <form onSubmit={handleSubmitUpdate} className="mb-4 pt-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Log a quick update..."
                  value={newUpdate}
                  onChange={(e) => setNewUpdate(e.target.value)}
                  className="w-full pl-4 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                <button
                  type="submit"
                  disabled={!newUpdate.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-600 disabled:text-slate-300 hover:text-indigo-800"
                >
                  <CheckCircle2 size={18} />
                </button>
              </div>
            </form>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
              {task.updates.length === 0 && (
                <p className="text-center text-xs text-slate-400 py-2">No updates recorded yet.</p>
              )}
              {task.updates.slice().reverse().map((update) => (
                <div key={update.id} className="flex gap-3 text-sm">
                  <div className="flex-shrink-0 w-24 text-xs text-slate-400 text-right pt-0.5">
                    {new Date(update.timestamp).toLocaleDateString()}
                  </div>
                  <div className="flex-grow p-2 bg-white rounded-lg border border-slate-200 text-slate-700 shadow-sm text-xs">
                    {update.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskCard;
