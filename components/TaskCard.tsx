import React, { useState, useEffect, useRef } from 'react';
import { Task, Status, Priority, TaskAttachment } from '../types';
import { Clock, Calendar, ChevronDown, ChevronUp, Edit2, CheckCircle2, AlertCircle, FolderGit2, Trash2, Hourglass, ArrowRight, Archive, X, Save, Paperclip, File, Download as DownloadIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface TaskCardProps {
  task: Task;
  onUpdateStatus: (id: string, status: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onAddUpdate: (id: string, content: string, attachments?: TaskAttachment[]) => void;
  onEditUpdate?: (taskId: string, updateId: string, newContent: string, newTimestamp?: string) => void;
  onDeleteUpdate?: (taskId: string, updateId: string) => void;
  allowDelete?: boolean;
  isReadOnly?: boolean;
  allowStatusChange?: boolean;
  onNavigate?: () => void;
  onUpdateTask?: (id: string, fields: Partial<Task>) => void;
  autoExpand?: boolean;
  availableStatuses?: string[];
  availablePriorities?: string[];
  isDailyView?: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({ 
  task, 
  onUpdateStatus, 
  onEdit, 
  onDelete, 
  onAddUpdate,
  onEditUpdate,
  onDeleteUpdate,
  allowDelete = true, 
  isReadOnly = false,
  allowStatusChange,
  onNavigate,
  onUpdateTask,
  autoExpand = false,
  availableStatuses = Object.values(Status),
  availablePriorities = Object.values(Priority),
  isDailyView = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newUpdate, setNewUpdate] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<TaskAttachment[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const taskFileInputRef = useRef<HTMLInputElement>(null);
  
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
  const [editUpdateContent, setEditUpdateContent] = useState('');
  const [editUpdateDate, setEditUpdateDate] = useState('');

  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState('');

  useEffect(() => {
    if (autoExpand) {
      setIsExpanded(true);
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [autoExpand]);

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
            const d = String(date.getDate()).padStart(2, '0');
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const y = date.getFullYear();
            return `${d}/${m}/${y}`;
        } else {
            const [y, m, d] = dateStr.split('-');
            return `${d}/${m}/${y}`;
        }
    } catch (e) {
        return dateStr;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isTaskFile = false) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                const attachment = {
                    id: uuidv4(),
                    name: file.name,
                    type: file.type,
                    data: event.target!.result as string
                };
                if (isTaskFile) {
                    if (onUpdateTask) {
                        const currentAttachments = task.attachments || [];
                        onUpdateTask(task.id, { attachments: [...currentAttachments, attachment] });
                    }
                } else {
                    setPendingAttachments(prev => [...prev, attachment]);
                }
            }
        };
        reader.readAsDataURL(file);
    });
    if (e.target) e.target.value = '';
  };

  const removeTaskAttachment = (id: string) => {
    if (onUpdateTask && task.attachments) {
        onUpdateTask(task.id, { attachments: task.attachments.filter(a => a.id !== id) });
    }
  };

  const removePendingAttachment = (id: string) => {
    setPendingAttachments(prev => prev.filter(a => a.id !== id));
  };

  const downloadAttachment = (att: TaskAttachment) => {
    const link = document.createElement('a');
    link.href = att.data;
    link.download = att.name;
    link.click();
  };

  const isCompleted = task.status === Status.DONE || task.status === Status.ARCHIVED;
  const canChangeStatus = allowStatusChange ?? !isReadOnly;

  const handleSubmitUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUpdate.trim() || pendingAttachments.length > 0) {
      onAddUpdate(task.id, newUpdate, pendingAttachments.length > 0 ? pendingAttachments : undefined);
      setNewUpdate('');
      setPendingAttachments([]);
    }
  };

  const startEditingUpdate = (update: { id: string, content: string, timestamp: string }) => {
    if (isReadOnly) return;
    setEditingUpdateId(update.id);
    setEditUpdateContent(update.content);
    
    const d = new Date(update.timestamp);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setEditUpdateDate(`${year}-${month}-${day}`);
  };

  const cancelEditingUpdate = () => {
    setEditingUpdateId(null);
    setEditUpdateContent('');
    setEditUpdateDate('');
  };

  const saveEditedUpdate = (updateId: string) => {
    if (onEditUpdate && editUpdateContent.trim()) {
      let newTimestamp = undefined;
      if (editUpdateDate) {
         newTimestamp = new Date(`${editUpdateDate}T12:00:00`).toISOString();
      }

      onEditUpdate(task.id, updateId, editUpdateContent.trim(), newTimestamp);
      setEditingUpdateId(null);
    }
  };

  const handleFieldClick = (field: string, value: string) => {
    if (isReadOnly || !onUpdateTask) return;
    setEditingField(field);
    setTempValue(value);
  };

  const handleFieldSave = () => {
    if (editingField && onUpdateTask) {
       onUpdateTask(task.id, { [editingField]: tempValue });
       setEditingField(null);
    }
  };

  const handleFieldKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (editingField !== 'description') handleFieldSave();
      }
      if (e.key === 'Escape') {
          setEditingField(null);
      }
  };

  return (
    <div ref={cardRef} className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300 hover:shadow-md ${isCompleted ? 'opacity-60 bg-slate-50' : ''} ${autoExpand ? 'ring-2 ring-indigo-500 shadow-lg' : ''}`}>
      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <div className="flex flex-wrap gap-2 items-center">
             {editingField === 'source' ? (
                 <input 
                    autoFocus
                    className="font-mono text-xs font-bold text-slate-700 bg-white border border-indigo-300 px-2 py-1 rounded w-16 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onBlur={handleFieldSave}
                    onKeyDown={handleFieldKeyDown}
                 />
             ) : (
                <span 
                  onClick={() => handleFieldClick('source', task.source)}
                  className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded cursor-pointer hover:bg-slate-200 hover:text-slate-700 transition-colors border border-transparent hover:border-slate-300"
                >
                  {task.source}
                </span>
             )}

             {editingField === 'displayId' ? (
                 <input 
                    autoFocus
                    className="font-mono text-sm font-bold text-indigo-700 bg-white border border-indigo-300 px-2 py-1 rounded w-24 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onBlur={handleFieldSave}
                    onKeyDown={handleFieldKeyDown}
                 />
             ) : (
                <span 
                  onClick={() => handleFieldClick('displayId', task.displayId)}
                  className="font-mono text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded cursor-pointer hover:bg-indigo-100 transition-colors border border-transparent hover:border-indigo-200"
                >
                  {task.displayId}
                </span>
             )}

             {editingField === 'priority' ? (
                 <select
                    autoFocus
                    className="text-xs font-medium px-2 py-1 rounded border border-indigo-300 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    value={tempValue}
                    onChange={(e) => {
                        setTempValue(e.target.value);
                        onUpdateTask && onUpdateTask(task.id, { priority: e.target.value });
                        setEditingField(null);
                    }}
                    onBlur={() => setEditingField(null)}
                 >
                     {availablePriorities.map(p => <option key={p} value={p}>{p}</option>)}
                 </select>
             ) : (
                <span 
                  onClick={() => handleFieldClick('priority', task.priority)}
                  className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(task.priority)} font-medium cursor-pointer hover:brightness-95 transition-all`}
                >
                  {task.priority}
                </span>
             )}
          </div>
          <div className="flex items-center gap-1">
            {isReadOnly ? (
              onNavigate && (
                <button 
                  onClick={onNavigate} 
                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium"
                >
                  Open <ArrowRight size={14} />
                </button>
              )
            ) : (
              <>
                <button 
                  onClick={() => taskFileInputRef.current?.click()}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="Attach global task file"
                >
                  <Paperclip size={16} />
                </button>
                <input 
                  type="file" 
                  ref={taskFileInputRef} 
                  className="hidden" 
                  onChange={(e) => handleFileChange(e, true)}
                />
                
                {!isDailyView && (
                    <button 
                    onClick={() => onEdit(task)} 
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                    <Edit2 size={16} />
                    </button>
                )}
                {allowDelete && (
                  <button 
                    onClick={() => onDelete(task.id)} 
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {editingField === 'description' ? (
            <textarea
                autoFocus
                className="w-full text-lg font-medium text-slate-800 bg-white border border-indigo-300 rounded p-2 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                rows={3}
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                onBlur={handleFieldSave}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) handleFieldSave();
                    if (e.key === 'Escape') setEditingField(null);
                }}
            />
        ) : (
            <h3 
              onClick={() => handleFieldClick('description', task.description)}
              className={`text-lg font-semibold text-slate-800 mb-2 leading-tight whitespace-pre-wrap cursor-pointer hover:text-indigo-700 transition-colors border border-transparent hover:border-dashed hover:border-slate-300 rounded p-0.5 -m-0.5 ${isCompleted ? 'line-through text-slate-500' : ''}`}
            >
              {task.description}
            </h3>
        )}

        {/* Global Task Attachments */}
        {task.attachments && task.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
                {task.attachments.map(att => (
                    <div key={att.id} className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold text-slate-500 shadow-xs group">
                        <File size={10} />
                        <span onClick={() => downloadAttachment(att)} className="max-w-[100px] truncate cursor-pointer hover:text-indigo-600">{att.name}</span>
                        {!isReadOnly && (
                            <button onClick={() => removeTaskAttachment(att.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <X size={10} />
                            </button>
                        )}
                    </div>
                ))}
            </div>
        )}

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-1 group relative">
              <Calendar size={14} className={editingField === 'dueDate' ? 'text-indigo-500' : ''} />
              {editingField === 'dueDate' ? (
                  <input 
                    type="date"
                    autoFocus
                    value={tempValue}
                    onChange={(e) => {
                        setTempValue(e.target.value);
                        onUpdateTask && onUpdateTask(task.id, { dueDate: e.target.value });
                        setEditingField(null);
                    }}
                    onBlur={() => setEditingField(null)}
                    className="text-xs border border-indigo-300 rounded px-1 py-0.5 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
              ) : (
                <span 
                    onClick={() => handleFieldClick('dueDate', task.dueDate)}
                    className="cursor-pointer hover:text-indigo-600 hover:underline decoration-dashed decoration-indigo-300 underline-offset-2"
                >
                    {task.dueDate ? formatDate(task.dueDate) : 'No Date'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
               {task.status === Status.DONE ? <CheckCircle2 size={14} className="text-emerald-500"/> : 
                task.status === Status.ARCHIVED ? <Archive size={14} className="text-slate-500"/> :
                task.status === Status.WAITING ? <Hourglass size={14} className="text-amber-500"/> : 
                <Clock size={14} />}
               <span>{task.updates.length} updates</span>
            </div>
          </div>

          {!canChangeStatus ? (
             <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${getStatusColor(task.status)}`}>
               {task.status}
             </span>
          ) : (
            <select
              value={task.status}
              onChange={(e) => onUpdateStatus(task.id, e.target.value)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer border-none outline-none ring-0 ${getStatusColor(task.status)} hover:opacity-90 transition-opacity`}
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

      <div className="border-t border-slate-100">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-5 py-2 flex items-center justify-center gap-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
        >
          {isExpanded ? 'Hide History' : (isReadOnly ? 'View History' : 'View History & Add Update')}
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {isExpanded && (
          <div className="px-5 pb-5 bg-slate-50">
            {!isReadOnly && (
              <div className="pt-4 space-y-2">
                <form onSubmit={handleSubmitUpdate}>
                    <div className="relative">
                    <input
                        type="text"
                        placeholder="Log a quick update..."
                        value={newUpdate}
                        onChange={(e) => setNewUpdate(e.target.value)}
                        className="w-full pl-4 pr-20 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900"
                        autoFocus={autoExpand}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                            title="Attach File to update"
                        >
                            <Paperclip size={18} />
                        </button>
                        <button
                            type="submit"
                            disabled={!newUpdate.trim() && pendingAttachments.length === 0}
                            className="p-1 text-indigo-600 disabled:text-slate-300 hover:text-indigo-800"
                        >
                            <CheckCircle2 size={18} />
                        </button>
                    </div>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        multiple 
                        onChange={(e) => handleFileChange(e, false)}
                    />
                    </div>
                </form>

                {pendingAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {pendingAttachments.map(att => (
                            <div key={att.id} className="flex items-center gap-1 bg-white border border-indigo-200 px-2 py-1 rounded text-[10px] font-bold text-indigo-600 shadow-sm group">
                                <File size={10} />
                                <span className="max-w-[100px] truncate">{att.name}</span>
                                <button onClick={() => removePendingAttachment(att.id)} className="text-slate-300 hover:text-red-500">
                                    <X size={10} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
              </div>
            )}

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar mt-4">
              {task.updates.length === 0 && (
                <p className="text-center text-xs text-slate-400 py-2">No updates recorded yet.</p>
              )}
              {task.updates.slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((update) => (
                <div key={update.id} className="flex gap-3 text-sm group">
                  <div className="flex-shrink-0 w-24 text-xs text-slate-400 text-right pt-0.5">
                    {editingUpdateId === update.id ? (
                        <input 
                            type="date"
                            value={editUpdateDate}
                            onChange={(e) => setEditUpdateDate(e.target.value)}
                            className="w-full text-[10px] p-1 border border-indigo-300 rounded outline-none bg-white"
                        />
                    ) : (
                        formatDate(update.timestamp)
                    )}
                  </div>
                  
                  <div className="flex-grow">
                    {editingUpdateId === update.id ? (
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={editUpdateContent}
                          onChange={(e) => setEditUpdateContent(e.target.value)}
                          className="flex-grow p-2 text-xs border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditedUpdate(update.id);
                            if (e.key === 'Escape') cancelEditingUpdate();
                          }}
                        />
                        <button 
                          onClick={() => saveEditedUpdate(update.id)}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                        >
                          <Save size={14} />
                        </button>
                        <button 
                          onClick={cancelEditingUpdate}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="relative">
                            <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-700 shadow-sm text-xs group-hover:pr-14">
                            {update.content}
                            </div>
                            {!isReadOnly && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => startEditingUpdate(update)}
                                    className="text-slate-400 hover:text-indigo-600 p-1"
                                    title="Edit Update"
                                >
                                    <Edit2 size={12} />
                                </button>
                                {onDeleteUpdate && (
                                    <button
                                        onClick={() => onDeleteUpdate(task.id, update.id)}
                                        className="text-slate-400 hover:text-red-600 p-1"
                                        title="Delete Update"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                )}
                            </div>
                            )}
                        </div>
                        
                        {update.attachments && update.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {update.attachments.map(att => (
                                    <button 
                                        key={att.id}
                                        onClick={() => downloadAttachment(att)}
                                        className="flex items-center gap-1.5 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 px-2 py-1 rounded text-[10px] font-bold text-slate-600 hover:text-indigo-600 transition-all shadow-xs"
                                        title={`Download ${att.name}`}
                                    >
                                        <DownloadIcon size={10} />
                                        <span className="max-w-[120px] truncate">{att.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                      </div>
                    )}
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