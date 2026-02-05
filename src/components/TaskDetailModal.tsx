
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Task, Status, Priority, TaskAttachment, HighlightOption, Subtask, RecurrenceConfig } from '../types';
import { X, Calendar, Clock, Paperclip, File, Download as DownloadIcon, CheckCircle2, Circle, Plus, Trash2, Save, Edit2, AlertCircle, Archive, Hourglass, Repeat, ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface TaskDetailModalProps {
  task: Task;
  allTasks: Task[];
  onClose: () => void;
  onUpdateStatus: (id: string, status: string) => void;
  onUpdateTask: (id: string, fields: Partial<Task>) => void;
  onAddUpdate: (id: string, content: string, attachments?: TaskAttachment[], highlightColor?: string) => void;
  onEditUpdate?: (taskId: string, updateId: string, newContent: string, newTimestamp?: string, highlightColor?: string | null) => void;
  onDeleteUpdate?: (taskId: string, updateId: string) => void;
  availableStatuses: string[];
  availablePriorities: string[];
  updateTags: HighlightOption[];
  onDeleteTask: (id: string) => void;
  statusColors?: Record<string, string>;
}

const AutoResizeTextarea = ({ value, onChange, className, placeholder, onKeyDown, autoFocus }: any) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    };

    useLayoutEffect(() => {
        adjustHeight();
    }, [value]);

    useEffect(() => {
        // Re-adjust on window resize to handle wrapping changes
        const handleResize = () => adjustHeight();
        window.addEventListener('resize', handleResize);
        
        // Safety check: layout shifts slightly after mount due to animations or flexbox settling
        const timer = setTimeout(adjustHeight, 50);
        
        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(timer);
        };
    }, []);

    return (
        <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
                onChange(e);
                adjustHeight();
            }}
            className={className}
            placeholder={placeholder}
            rows={1}
            onKeyDown={onKeyDown}
            autoFocus={autoFocus}
        />
    );
};

const WorkloadDatePicker: React.FC<{ 
    selectedDate: string; 
    onChange: (d: string) => void; 
    allTasks: Task[]; 
    currentTaskId: string 
}> = ({ selectedDate, onChange, allTasks, currentTaskId }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(() => {
        const d = new Date(selectedDate);
        return isNaN(d.getTime()) ? new Date() : d;
    });
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const getWorkload = (dateStr: string) => {
        return allTasks.filter(t => 
            t.id !== currentTaskId && 
            t.dueDate === dateStr && 
            t.status !== Status.DONE && 
            t.status !== Status.ARCHIVED
        ).length;
    };

    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => {
        const day = new Date(year, month, 1).getDay();
        return day === 0 ? 6 : day - 1; // Mon start
    };

    const generateDays = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const days = [];

        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(i);
        return days;
    };

    const handleDateClick = (day: number) => {
        const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        onChange(dateStr);
        setIsOpen(false);
    };

    const formatDateDisplay = (dateStr: string) => {
        if (!dateStr) return 'No Date';
        return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none dark:text-white text-left flex justify-between items-center"
            >
                {formatDateDisplay(selectedDate)}
                <Calendar size={16} className="text-slate-400" />
            </button>

            {isOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 p-3 w-[17rem] animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                        <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"><ChevronLeft size={18} /></button>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
                        <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"><ChevronRight size={18} /></button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {['M','T','W','T','F','S','S'].map(d => <div key={d} className="text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {generateDays().map((day, idx) => {
                            if (!day) return <div key={idx} />;
                            const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
                            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                            const workload = getWorkload(dateStr);
                            const isSelected = dateStr === selectedDate;
                            
                            let workloadColor = 'bg-emerald-500';
                            if (workload >= 3) workloadColor = 'bg-amber-500';
                            if (workload >= 5) workloadColor = 'bg-red-500';

                            return (
                                <button 
                                    key={idx} 
                                    onClick={() => handleDateClick(day)}
                                    className={`relative h-9 rounded-lg text-sm font-bold transition-all flex items-center justify-center ${isSelected ? 'bg-indigo-600 text-white shadow-md scale-105 z-10' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
                                >
                                    {day}
                                    {workload > 0 && !isSelected && (
                                        <div className={`absolute -top-1.5 -right-1.5 w-5 h-5 text-[10px] font-bold flex items-center justify-center rounded-full text-white ${workloadColor} border-2 border-white dark:border-slate-800 shadow-md z-20`}>
                                            {workload}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-center">
                        <div className="flex items-center gap-3 text-[9px] text-slate-400 font-medium">
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Light</span>
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Med</span>
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Heavy</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  allTasks,
  onClose,
  onUpdateStatus,
  onUpdateTask,
  onAddUpdate,
  onEditUpdate,
  onDeleteUpdate,
  availableStatuses,
  availablePriorities,
  updateTags,
  onDeleteTask,
  statusColors = {}
}) => {
  const [newUpdate, setNewUpdate] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<TaskAttachment[]>([]);
  const [newUpdateColor, setNewUpdateColor] = useState<string>(updateTags[0]?.color || '#94a3b8');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const taskFileInputRef = useRef<HTMLInputElement>(null);

  // Subtask Drag State
  const [draggedSubtaskId, setDraggedSubtaskId] = useState<string | null>(null);

  // Editing state for updates
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
  const [editUpdateContent, setEditUpdateContent] = useState('');
  const [editUpdateDate, setEditUpdateDate] = useState('');
  const [editUpdateColor, setEditUpdateColor] = useState<string | null>(null);
  const [showEditColorPicker, setShowEditColorPicker] = useState(false);

  // Recurrence State
  const [recurrenceType, setRecurrenceType] = useState<string>(task.recurrence?.type || 'none');
  const [recurrenceInterval, setRecurrenceInterval] = useState<number>(task.recurrence?.interval || 1);

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
    if (s === Status.DONE) return { backgroundColor: '#d1fae5', color: '#047857', borderColor: '#a7f3d0' }; 
    if (s === Status.IN_PROGRESS) return { backgroundColor: '#dbeafe', color: '#1d4ed8', borderColor: '#bfdbfe' }; 
    if (s === Status.WAITING) return { backgroundColor: '#fef3c7', color: '#b45309', borderColor: '#fde68a' }; 
    if (s === Status.ARCHIVED) return { backgroundColor: '#f1f5f9', color: '#64748b', borderColor: '#e2e8f0' }; 
    return { backgroundColor: '#f1f5f9', color: '#475569', borderColor: '#e2e8f0' }; 
  };

  const getPriorityColor = (p: string) => {
    if (p === Priority.HIGH) return 'text-red-600 bg-red-50 border-red-100 dark:bg-red-900/30 dark:text-red-300 dark:border-red-900/50';
    if (p === Priority.MEDIUM) return 'text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-900/50';
    if (p === Priority.LOW) return 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-900/50';
    return 'text-slate-600 bg-slate-50 border-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00');
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
        return dateStr;
    }
  };

  const handleRecurrenceChange = (type: string, interval: number) => {
      setRecurrenceType(type);
      setRecurrenceInterval(interval);
      
      if (type === 'none') {
          onUpdateTask(task.id, { recurrence: undefined });
      } else {
          onUpdateTask(task.id, { 
              recurrence: { 
                  type: type as RecurrenceConfig['type'], 
                  interval: interval 
              } 
          });
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
                    const currentAttachments = task.attachments || [];
                    onUpdateTask(task.id, { attachments: [...currentAttachments, attachment] });
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
    if (task.attachments) {
        onUpdateTask(task.id, { attachments: task.attachments.filter(a => a.id !== id) });
    }
  };

  const downloadAttachment = (att: TaskAttachment) => {
    const link = document.createElement('a');
    link.href = att.data;
    link.download = att.name;
    link.click();
  };

  const handleSubmitUpdate = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (newUpdate.trim() || pendingAttachments.length > 0) {
      onAddUpdate(task.id, newUpdate, pendingAttachments.length > 0 ? pendingAttachments : undefined, newUpdateColor);
      setNewUpdate('');
      setPendingAttachments([]);
      setShowColorPicker(false);
    }
  };

  // Subtask Handlers
  const handleAddSubtask = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    const newSubtask: Subtask = {
        id: uuidv4(),
        title: newSubtaskTitle.trim(),
        completed: false
    };
    onUpdateTask(task.id, { subtasks: [...(task.subtasks || []), newSubtask] });
    setNewSubtaskTitle('');
  };

  const toggleSubtask = (subtaskId: string) => {
    const updatedSubtasks = (task.subtasks || []).map(st => {
        if (st.id === subtaskId) {
            const isCompleted = !st.completed;
            return { 
                ...st, 
                completed: isCompleted,
                completedAt: isCompleted ? new Date().toISOString() : undefined
            };
        }
        return st;
    });
    onUpdateTask(task.id, { subtasks: updatedSubtasks });
  };

  const deleteSubtask = (subtaskId: string) => {
    const updatedSubtasks = (task.subtasks || []).filter(st => st.id !== subtaskId);
    onUpdateTask(task.id, { subtasks: updatedSubtasks });
  };

  const updateSubtaskTitle = (subtaskId: string, newTitle: string) => {
      const updatedSubtasks = (task.subtasks || []).map(st => 
        st.id === subtaskId ? { ...st, title: newTitle } : st
      );
      onUpdateTask(task.id, { subtasks: updatedSubtasks });
  };

  // Subtask Drag & Drop Handlers
  const handleSubtaskDragStart = (e: React.DragEvent, id: string) => {
    setDraggedSubtaskId(id);
    e.dataTransfer.effectAllowed = "move";
    // Set transparent drag image or default
  };

  const handleSubtaskDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleSubtaskDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedSubtaskId || draggedSubtaskId === targetId) return;

    const currentSubtasks = task.subtasks || [];
    const fromIndex = currentSubtasks.findIndex(s => s.id === draggedSubtaskId);
    const toIndex = currentSubtasks.findIndex(s => s.id === targetId);

    if (fromIndex === -1 || toIndex === -1) return;

    const newSubtasks = [...currentSubtasks];
    const [movedSubtask] = newSubtasks.splice(fromIndex, 1);
    newSubtasks.splice(toIndex, 0, movedSubtask);

    onUpdateTask(task.id, { subtasks: newSubtasks });
    setDraggedSubtaskId(null);
  };

  // Update Editing Handlers
  const startEditingUpdate = (update: { id: string, content: string, timestamp: string, highlightColor?: string }) => {
    setEditingUpdateId(update.id);
    setEditUpdateContent(update.content);
    setEditUpdateColor(update.highlightColor || null);
    setShowEditColorPicker(false);
    
    const d = new Date(update.timestamp);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setEditUpdateDate(`${year}-${month}-${day}`);
  };

  const saveEditedUpdate = (updateId: string) => {
    if (onEditUpdate && editUpdateContent.trim()) {
      let newTimestamp = undefined;
      if (editUpdateDate) {
         newTimestamp = new Date(`${editUpdateDate}T12:00:00`).toISOString();
      }
      onEditUpdate(task.id, updateId, editUpdateContent.trim(), newTimestamp, editUpdateColor);
      setEditingUpdateId(null);
      setShowEditColorPicker(false);
    }
  };

  const handleDelete = () => {
      if (confirm('Are you sure you want to delete this task completely?')) {
          onDeleteTask(task.id);
          onClose();
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-800 w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-10">
            <div className="flex items-center gap-3 overflow-hidden">
                <div className="flex items-center gap-2 text-sm font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600">
                    <span className="font-bold">{task.source}</span>
                    <span className="text-slate-300 dark:text-slate-500">/</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">{task.displayId}</span>
                </div>
                <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-600 mx-1" />
                <select
                    value={task.status}
                    onChange={(e) => onUpdateStatus(task.id, e.target.value)}
                    className="text-xs font-bold px-3 py-1.5 rounded-full cursor-pointer border outline-none appearance-none transition-all dark:border-transparent"
                    style={getStatusStyle(task.status)}
                >
                    {availableStatuses.map(s => <option key={s} value={s} className="dark:bg-slate-800">{s}</option>)}
                </select>
                <select
                    value={task.priority}
                    onChange={(e) => onUpdateTask(task.id, { priority: e.target.value })}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full cursor-pointer border outline-none appearance-none transition-all ${getPriorityColor(task.priority)}`}
                >
                    {availablePriorities.map(p => <option key={p} value={p} className="dark:bg-slate-800">{p}</option>)}
                </select>
            </div>
            
            <div className="flex items-center gap-2">
                <button onClick={handleDelete} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Delete Task">
                    <Trash2 size={18} />
                </button>
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Close">
                    <X size={20} />
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col md:flex-row">
            {/* Main Content Column */}
            <div className="flex-1 p-8 md:pr-12 space-y-8 min-w-0">
                {/* Description */}
                <div className="group">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Description</label>
                    <AutoResizeTextarea 
                        value={task.description}
                        onChange={(e: any) => onUpdateTask(task.id, { description: e.target.value })}
                        className="w-full text-xl font-medium text-slate-800 dark:text-slate-200 bg-transparent border-none outline-none resize-none placeholder-slate-300 focus:ring-0 p-0 leading-relaxed overflow-hidden"
                        placeholder="Task description..."
                    />
                </div>

                {/* Subtasks */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <CheckCircle2 size={14} /> Subtasks
                        </label>
                        {task.subtasks && task.subtasks.length > 0 && (
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                                {task.subtasks.filter(t => t.completed).length}/{task.subtasks.length}
                            </span>
                        )}
                    </div>
                    
                    <div className="space-y-1 mb-3">
                        {task.subtasks?.map(st => (
                            <div 
                                key={st.id} 
                                draggable="true"
                                onDragStart={(e) => handleSubtaskDragStart(e, st.id)}
                                onDragOver={handleSubtaskDragOver}
                                onDrop={(e) => handleSubtaskDrop(e, st.id)}
                                className={`flex items-start gap-3 p-2 rounded-lg group transition-all ${
                                    draggedSubtaskId === st.id ? 'opacity-30 border-2 border-dashed border-indigo-400' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                }`}
                            >
                                <div className="mt-1.5 cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-indigo-500 dark:hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <GripVertical size={14} />
                                </div>
                                <button 
                                    onClick={() => toggleSubtask(st.id)}
                                    className={`mt-1 shrink-0 ${st.completed ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-500 dark:text-slate-500 dark:hover:text-indigo-400'}`}
                                    title={st.completed ? "Mark as incomplete" : "Mark as done"}
                                >
                                    {st.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                                </button>
                                <div className="flex-1 min-w-0">
                                    <AutoResizeTextarea 
                                        value={st.title}
                                        onChange={(e: any) => updateSubtaskTitle(st.id, e.target.value)}
                                        className={`w-full bg-transparent border-none outline-none text-sm p-0 focus:ring-0 resize-none overflow-hidden ${st.completed ? 'line-through text-slate-400 decoration-slate-300' : 'text-slate-700 dark:text-slate-300 font-medium'}`}
                                        placeholder="Subtask title"
                                    />
                                    {st.completed && st.completedAt && (
                                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 flex items-center gap-1">
                                            Completed on {new Date(st.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    )}
                                </div>
                                <button 
                                    onClick={() => deleteSubtask(st.id)}
                                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                    title="Delete subtask"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                    
                    <div className="flex items-start gap-3 pl-8 opacity-60 hover:opacity-100 transition-opacity group/add">
                        <Plus size={18} className="text-slate-400 mt-2" />
                        <AutoResizeTextarea 
                            value={newSubtaskTitle}
                            onChange={(e: any) => setNewSubtaskTitle(e.target.value)}
                            placeholder="Add a subtask..."
                            className="flex-1 bg-transparent border-none outline-none text-sm py-2 placeholder-slate-400 dark:text-slate-300 resize-none overflow-hidden"
                            onKeyDown={(e: any) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleAddSubtask(e);
                                }
                            }}
                        />
                    </div>
                </div>

                {/* History / Updates */}
                <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 block flex items-center gap-2">
                        <Clock size={14} /> Activity & Updates
                    </label>

                    {/* New Update Input */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
                        <textarea
                            placeholder="Write an update..."
                            value={newUpdate}
                            onChange={(e) => setNewUpdate(e.target.value)}
                            className="w-full bg-transparent border-none outline-none text-sm text-slate-700 dark:text-slate-200 min-h-[60px] resize-y placeholder-slate-400"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    handleSubmitUpdate(e);
                                }
                            }}
                        />
                        {pendingAttachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3 mt-2">
                                {pendingAttachments.map(att => (
                                    <div key={att.id} className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 px-2 py-1 rounded text-[10px] font-bold text-indigo-600 dark:text-indigo-400 shadow-sm">
                                        <File size={10} />
                                        <span className="max-w-[150px] truncate">{att.name}</span>
                                        <button onClick={() => setPendingAttachments(prev => prev.filter(p => p.id !== att.id))} className="text-slate-300 hover:text-red-500">
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex justify-between items-center pt-2 border-t border-slate-200/50 dark:border-slate-700">
                            <div className="flex items-center gap-2">
                                <button onClick={() => fileInputRef.current?.click()} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors" title="Attach file">
                                    <Paperclip size={16} />
                                </button>
                                <div className="relative">
                                    <button onClick={() => setShowColorPicker(!showColorPicker)} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1">
                                        <div className="w-3 h-3 rounded-full shadow-sm border border-slate-300 dark:border-slate-600" style={{ backgroundColor: newUpdateColor }} />
                                    </button>
                                    {showColorPicker && (
                                        <>
                                            <div className="fixed inset-0 z-30" onClick={() => setShowColorPicker(false)} />
                                            <div className="absolute bottom-full left-0 mb-2 p-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-600 flex flex-col gap-1 z-40 w-40 max-h-56 overflow-y-auto custom-scrollbar">
                                                {updateTags.map(tag => (
                                                    <button key={tag.id} onClick={() => { setNewUpdateColor(tag.color); setShowColorPicker(false); }} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded text-xs dark:text-slate-300">
                                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                                                        <span className="truncate">{tag.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            <button 
                                onClick={handleSubmitUpdate} 
                                disabled={!newUpdate.trim() && pendingAttachments.length === 0}
                                className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                                Post
                            </button>
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" multiple onChange={(e) => handleFileChange(e, false)} />
                    </div>

                    {/* Timeline */}
                    <div className="space-y-6 relative pl-4 border-l-2 border-slate-100 dark:border-slate-700 ml-2">
                        {task.updates.slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(update => (
                            <div key={update.id} className="relative pl-6 group">
                                <div 
                                    className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 shadow-sm"
                                    style={{ backgroundColor: update.highlightColor || '#cbd5e1' }}
                                />
                                <div className="flex items-baseline justify-between mb-1">
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono">
                                        {new Date(update.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                    </span>
                                    {/* Action Buttons for Update */}
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => startEditingUpdate(update)} className="text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400"><Edit2 size={12}/></button>
                                        {onDeleteUpdate && <button onClick={() => onDeleteUpdate(task.id, update.id)} className="text-slate-300 hover:text-red-500 dark:hover:text-red-400"><Trash2 size={12}/></button>}
                                    </div>
                                </div>

                                {editingUpdateId === update.id ? (
                                    <div className="bg-white dark:bg-slate-900 border-2 border-indigo-100 dark:border-indigo-900 p-3 rounded-lg shadow-sm space-y-2">
                                        <div className="flex gap-2 mb-2">
                                            <input 
                                                type="date"
                                                value={editUpdateDate}
                                                onChange={(e) => setEditUpdateDate(e.target.value)}
                                                className="text-xs p-1 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-white"
                                            />
                                            {/* Tag Picker for Edit */}
                                            <div className="relative">
                                                <button onClick={() => setShowEditColorPicker(!showEditColorPicker)} className="p-1 border border-slate-200 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-800"><div className="w-4 h-4 rounded-full" style={{backgroundColor: editUpdateColor || '#cbd5e1'}}/></button>
                                                {showEditColorPicker && (
                                                    <>
                                                        <div className="fixed inset-0 z-30" onClick={() => setShowEditColorPicker(false)}/>
                                                        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-xl rounded-lg p-2 z-40 w-32">
                                                            {updateTags.map(t => (
                                                                <button key={t.id} onClick={() => { setEditUpdateColor(t.color); setShowEditColorPicker(false); }} className="block w-full text-left px-2 py-1 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                                    <div className="w-2 h-2 rounded-full" style={{backgroundColor: t.color}}/> {t.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <textarea 
                                            value={editUpdateContent}
                                            onChange={e => setEditUpdateContent(e.target.value)}
                                            className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded p-2 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none bg-white dark:bg-slate-800 dark:text-white"
                                            rows={3}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                                    saveEditedUpdate(update.id);
                                                }
                                            }}
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setEditingUpdateId(null)} className="px-3 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">Cancel</button>
                                            <button onClick={() => saveEditedUpdate(update.id)} className="px-3 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded">Save</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                        {update.content}
                                    </div>
                                )}

                                {update.attachments && update.attachments.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {update.attachments.map(att => (
                                            <button 
                                                key={att.id}
                                                onClick={() => downloadAttachment(att)}
                                                className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-2 py-1 rounded text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all shadow-sm"
                                            >
                                                <DownloadIcon size={10} />
                                                <span className="max-w-[120px] truncate">{att.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sidebar Column */}
            <div className="w-full md:w-72 bg-slate-50/50 dark:bg-slate-900/50 border-l border-slate-100 dark:border-slate-700 p-6 space-y-6 flex-shrink-0">
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Project ID</label>
                        <input 
                            value={task.projectId}
                            onChange={(e) => onUpdateTask(task.id, { projectId: e.target.value })}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none dark:text-white"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Due Date</label>
                        <WorkloadDatePicker 
                            selectedDate={task.dueDate} 
                            onChange={(d) => onUpdateTask(task.id, { dueDate: d })} 
                            allTasks={allTasks}
                            currentTaskId={task.id}
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block flex items-center gap-1">
                            <Repeat size={12} /> Recurrence
                        </label>
                        <select 
                            value={recurrenceType}
                            onChange={(e) => handleRecurrenceChange(e.target.value, recurrenceInterval)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none dark:text-white"
                        >
                            <option value="none">None (One-time)</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                        </select>
                        {recurrenceType !== 'none' && (
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-slate-500 dark:text-slate-400">Every</span>
                                <input 
                                    type="number"
                                    min="1"
                                    value={recurrenceInterval}
                                    onChange={(e) => handleRecurrenceChange(recurrenceType, parseInt(e.target.value) || 1)}
                                    className="w-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 text-sm font-medium text-center focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none dark:text-white"
                                />
                                <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">{recurrenceType.replace('ly', '(s)')}</span>
                            </div>
                        )}
                    </div>
                    
                    <div className="pt-4 border-t border-slate-200/50 dark:border-slate-700">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block flex items-center gap-2">
                            <Paperclip size={12} /> Global Files
                        </label>
                        <div className="space-y-2">
                            {task.attachments?.map(att => (
                                <div key={att.id} className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-sm group">
                                    <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded text-indigo-600 dark:text-indigo-400"><File size={14}/></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate cursor-pointer hover:underline" onClick={() => downloadAttachment(att)}>{att.name}</p>
                                        <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase">{att.type.split('/')[1] || 'FILE'}</p>
                                    </div>
                                    <button onClick={() => removeTaskAttachment(att.id)} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <X size={14}/>
                                    </button>
                                </div>
                            ))}
                            <button 
                                onClick={() => taskFileInputRef.current?.click()}
                                className="w-full py-2 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-400 dark:text-slate-500 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all flex items-center justify-center gap-2"
                            >
                                <Plus size={14} /> Add File
                            </button>
                            <input type="file" ref={taskFileInputRef} className="hidden" onChange={(e) => handleFileChange(e, true)} />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200/50 dark:border-slate-700 space-y-2 text-xs text-slate-400 dark:text-slate-500">
                        <div className="flex justify-between">
                            <span>Created</span>
                            <span className="font-mono">{formatDate(task.createdAt)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Updates</span>
                            <span className="font-mono">{task.updates.length}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal;
