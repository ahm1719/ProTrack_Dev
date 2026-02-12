import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Task, Status, Priority, TaskAttachment, HighlightOption, Subtask, RecurrenceConfig } from '../types';
import { X, Calendar, Clock, Paperclip, File, Download as DownloadIcon, CheckCircle2, Circle, Plus, Trash2, Save, Edit2, AlertCircle, Archive, Hourglass, Repeat, ChevronLeft, ChevronRight, GripVertical, ChevronDown, Type, Bold, Highlighter } from 'lucide-react';
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

/**
 * Helper function to calculate ISO week number
 */
// Fix: Added missing getWeekNumber function to support the WorkloadDatePicker calendar display
const getWeekNumber = (d: Date): number => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

/**
 * Renders text with support for:
 * **text** -> bold
 * ==text== -> highlight
 */
const FormattedContent = ({ content }: { content: string }) => {
    if (!content) return null;

    // Split content into parts based on bold and highlight markers
    const parts = content.split(/(\*\*.*?\*\*|==.*?==)/g);

    return (
        <span className="whitespace-pre-wrap">
            {parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={i} className="font-black text-slate-900 dark:text-white">{part.slice(2, -2)}</strong>;
                }
                if (part.startsWith('==') && part.endsWith('==')) {
                    return (
                        <mark key={i} className="bg-amber-100 dark:bg-indigo-500/30 text-amber-900 dark:text-indigo-100 px-1 rounded font-bold border-b-2 border-amber-200 dark:border-indigo-400/50">
                            {part.slice(2, -2)}
                        </mark>
                    );
                }
                return part;
            })}
        </span>
    );
};

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
        const handleResize = () => adjustHeight();
        window.addEventListener('resize', handleResize);
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

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const days = generateDays();
    const dayChunks = [];
    for (let i = 0; i < days.length; i += 7) {
        dayChunks.push(days.slice(i, i + 7));
    }

    return (
        <div className="relative" ref={wrapperRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none dark:text-white text-left flex justify-between items-center shadow-sm hover:border-slate-300 dark:hover:border-slate-500 transition-colors"
            >
                {formatDateDisplay(selectedDate)}
                <Calendar size={18} className="text-indigo-500" />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 md:left-auto md:right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 p-4 w-[22rem] animate-fade-in origin-top-right">
                    <div className="flex justify-between items-center mb-5">
                        <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-500 dark:text-slate-400 transition-colors"><ChevronLeft size={20} /></button>
                        <span className="text-base font-black text-slate-800 dark:text-slate-200 tracking-tight">{viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
                        <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-500 dark:text-slate-400 transition-colors"><ChevronRight size={20} /></button>
                    </div>
                    <div className="grid grid-cols-[2.5rem_1fr] gap-1.5 mb-2 items-center">
                        <div className="text-center text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-tighter">CW</div>
                        <div className="grid grid-cols-7 gap-1">
                            {['M','T','W','T','F','S','S'].map(d => <div key={d} className="text-center text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">{d}</div>)}
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        {dayChunks.map((chunk, chunkIdx) => {
                            const firstDayNum = chunk.find(d => d !== null);
                            let cwDisplay = '';
                            if (firstDayNum !== undefined) {
                                const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), firstDayNum);
                                cwDisplay = getWeekNumber(d).toString();
                            } else if (chunkIdx === 0) {
                                const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
                                cwDisplay = getWeekNumber(d).toString();
                            }

                            return (
                                <div key={chunkIdx} className="grid grid-cols-[2.5rem_1fr] gap-1.5 items-center">
                                    <div className="text-[10px] font-mono font-black text-slate-400 dark:text-slate-600 text-center py-2 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-100/50 dark:border-slate-800/50">
                                        {cwDisplay}
                                    </div>
                                    <div className="grid grid-cols-7 gap-1">
                                        {chunk.map((day, idx) => {
                                            if (day === null) return <div key={idx} className="h-9" />;
                                            const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
                                            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                            const workload = getWorkload(dateStr);
                                            const isSelected = dateStr === selectedDate;
                                            const isToday = dateStr === todayStr;
                                            
                                            let workloadColor = 'bg-emerald-500';
                                            if (workload >= 3) workloadColor = 'bg-amber-500';
                                            if (workload >= 5) workloadColor = 'bg-red-500';

                                            let btnClasses = "relative h-9 rounded-xl text-[14px] font-bold transition-all flex items-center justify-center border-2 ";
                                            if (isSelected) {
                                                btnClasses += "border-indigo-600 bg-indigo-600 text-white shadow-lg scale-105 z-10 ring-2 ring-indigo-100 dark:ring-indigo-900/50";
                                            } else if (isToday) {
                                                btnClasses += "border-indigo-500 text-indigo-700 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20";
                                            } else {
                                                btnClasses += "border-transparent hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300";
                                            }

                                            return (
                                                <button 
                                                    key={idx} 
                                                    onClick={() => handleDateClick(day)}
                                                    className={btnClasses}
                                                >
                                                    {day}
                                                    {workload > 0 && (
                                                        <div className={`absolute -top-1.5 -right-1.5 w-5 h-5 text-[10px] font-black flex items-center justify-center rounded-full text-white ${workloadColor} border-2 border-white dark:border-slate-800 shadow-sm z-20`}>
                                                            {workload}
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-center">
                        <div className="flex items-center gap-4 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">
                            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></div> Light</span>
                            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm"></div> Med</span>
                            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm"></div> Heavy</span>
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
  const updateTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editUpdateTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isMouseDownOnBackdrop = useRef(false);

  // Subtask Drag State
  const [draggedSubtaskId, setDraggedSubtaskId] = useState<string | null>(null);

  // Editing state for updates
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
  const [editUpdateContent, setEditUpdateContent] = useState('');
  const [editUpdateDate, setEditUpdateDate] = useState('');
  const [editUpdateColor, setEditUpdateColor] = useState<string | null>(null);
  const [showEditColorPicker, setShowEditColorPicker] = useState(false);

  // Direct Color Change State
  const [activeColorPickerUpdateId, setActiveColorPickerUpdateId] = useState<string | null>(null);

  // Recurrence State
  const [recurrenceType, setRecurrenceType] = useState<string>(task.recurrence?.type || 'none');
  const [recurrenceInterval, setRecurrenceInterval] = useState<number>(task.recurrence?.interval || 1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !editingUpdateId) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, editingUpdateId]);

  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    isMouseDownOnBackdrop.current = e.target === e.currentTarget;
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (isMouseDownOnBackdrop.current && e.target === e.currentTarget) {
      onClose();
    }
    isMouseDownOnBackdrop.current = false;
  };

  const applyFormatting = (textarea: HTMLTextAreaElement | null, tag: string, setter: (val: string) => void) => {
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    // Check if already wrapped
    if (selectedText.startsWith(tag) && selectedText.endsWith(tag)) {
        setter(before + selectedText.slice(tag.length, -tag.length) + after);
    } else {
        setter(before + tag + selectedText + tag + after);
    }
    
    // Refocus
    setTimeout(() => textarea.focus(), 0);
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
    if (s === Status.DONE) return { backgroundColor: '#d1fae5', color: '#065f46', borderColor: '#34d399' };
    if (s === Status.IN_PROGRESS) return { backgroundColor: '#dbeafe', color: '#1e40af', borderColor: '#60a5fa' };
    if (s === Status.WAITING) return { backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#fcd34d' };
    if (s === Status.ARCHIVED) return { backgroundColor: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' };
    return { backgroundColor: '#f1f5f9', color: '#475569', borderColor: '#e2e8f0' }; 
  };

  const getPriorityColor = (p: string) => {
    if (p === Priority.HIGH) return 'text-red-700 bg-red-50 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-900/50';
    if (p === Priority.MEDIUM) return 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-900/50';
    if (p === Priority.LOW) return 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-900/50';
    return 'text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
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

  const handleSubtaskDragStart = (e: React.DragEvent, id: string) => {
    setDraggedSubtaskId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleSubtaskDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleSubtaskDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = draggedSubtaskId;
    
    setDraggedSubtaskId(null);

    if (!sourceId || sourceId === targetId) return;

    const currentSubtasks = task.subtasks || [];
    const fromIndex = currentSubtasks.findIndex(s => s.id === sourceId);
    const toIndex = currentSubtasks.findIndex(s => s.id === targetId);

    if (fromIndex === -1 || toIndex === -1) return;

    const newSubtasks = [...currentSubtasks];
    const [movedSubtask] = newSubtasks.splice(fromIndex, 1);
    newSubtasks.splice(toIndex, 0, movedSubtask);

    onUpdateTask(task.id, { subtasks: newSubtasks });
  };

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

  const statusStyle = getStatusStyle(task.status);

  return (
    <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-fade-in" 
        onMouseDown={handleBackdropMouseDown}
        onClick={handleBackdropClick}
    >
      <div 
        className="bg-white dark:bg-slate-800 w-full max-w-7xl h-[92vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col relative"
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-10">
            <div className="flex items-center gap-4 overflow-hidden">
                <div className="flex items-center gap-2 text-sm font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm">
                    <span className="font-bold">{task.source}</span>
                    <span className="text-slate-300 dark:text-slate-500">/</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-black">{task.displayId}</span>
                </div>
                <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-600 mx-1" />
                
                <div className="relative group">
                    <select
                        value={task.status}
                        onChange={(e) => onUpdateStatus(task.id, e.target.value)}
                        className="text-xs font-black pl-4 pr-10 py-2 rounded-full cursor-pointer border outline-none appearance-none transition-all shadow-sm hover:brightness-95 focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 dark:focus:ring-offset-slate-800 uppercase tracking-wider"
                        style={statusStyle}
                    >
                        {availableStatuses.map(s => <option key={s} value={s} className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-200">{s}</option>)}
                    </select>
                    <ChevronDown 
                        size={16} 
                        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ color: statusStyle.color, opacity: 0.7 }}
                    />
                </div>

                <div className="relative group">
                    <select
                        value={task.priority}
                        onChange={(e) => onUpdateTask(task.id, { priority: e.target.value })}
                        className={`text-xs font-black pl-4 pr-10 py-2 rounded-full cursor-pointer border outline-none appearance-none transition-all shadow-sm hover:brightness-95 focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 dark:focus:ring-offset-slate-800 uppercase tracking-wider ${getPriorityColor(task.priority)}`}
                    >
                        {availablePriorities.map(p => <option key={p} value={p} className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-200">{p}</option>)}
                    </select>
                    <ChevronDown 
                        size={16} 
                        className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-60 ${task.priority === Priority.HIGH ? 'text-red-700' : task.priority === Priority.MEDIUM ? 'text-amber-700' : task.priority === Priority.LOW ? 'text-emerald-700' : 'text-slate-600'}`}
                    />
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <button onClick={handleDelete} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all" title="Delete Task">
                    <Trash2 size={20} />
                </button>
                <button onClick={onClose} className="p-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all" title="Close">
                    <X size={24} />
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col md:flex-row">
            {/* Main Content Column */}
            <div className="flex-1 p-10 md:pr-14 space-y-10 min-w-0">
                {/* Title and Description */}
                <div className="space-y-8">
                    <div className="group">
                        <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 block">Task Title</label>
                        <AutoResizeTextarea 
                            value={task.title || ''}
                            onChange={(e: any) => onUpdateTask(task.id, { title: e.target.value })}
                            className="w-full text-3xl font-black text-slate-900 dark:text-slate-100 bg-transparent border-none outline-none resize-none placeholder-slate-300 dark:placeholder-slate-700 focus:ring-0 p-0 leading-tight overflow-hidden tracking-tight"
                            placeholder="Brief summary title..."
                        />
                    </div>

                    <div className="group">
                        <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 block">Description</label>
                        <AutoResizeTextarea 
                            value={task.description}
                            onChange={(e: any) => onUpdateTask(task.id, { description: e.target.value })}
                            className="w-full text-xl font-medium text-slate-600 dark:text-slate-400 bg-transparent border-none outline-none resize-none placeholder-slate-300 dark:placeholder-slate-700 focus:ring-0 p-0 leading-relaxed overflow-hidden"
                            placeholder="Enter detailed task instructions or notes..."
                        />
                    </div>
                </div>

                {/* Subtasks */}
                <div>
                    <div className="flex items-center justify-between mb-5">
                        <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <CheckCircle2 size={16} /> Subtasks
                        </label>
                        {task.subtasks && task.subtasks.length > 0 && (
                            <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full">
                                {task.subtasks.filter(t => t.completed).length}/{task.subtasks.length}
                            </span>
                        )}
                    </div>
                    
                    <div className="space-y-1.5 mb-5">
                        {task.subtasks?.map(st => (
                            <div 
                                key={st.id} 
                                draggable="true"
                                onDragStart={(e) => handleSubtaskDragStart(e, st.id)}
                                onDragOver={handleSubtaskDragOver}
                                onDragEnd={() => setDraggedSubtaskId(null)}
                                onDrop={(e) => handleSubtaskDrop(e, st.id)}
                                className={`flex items-start gap-4 p-3 rounded-2xl group transition-all ${
                                    draggedSubtaskId === st.id ? 'opacity-30 border-2 border-dashed border-indigo-400 bg-indigo-50 dark:bg-indigo-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                }`}
                            >
                                <div className="mt-1.5 cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-indigo-500 dark:hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <GripVertical size={16} />
                                </div>
                                <button 
                                    onClick={() => toggleSubtask(st.id)}
                                    className={`mt-1 shrink-0 ${st.completed ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-500 dark:text-slate-500 dark:hover:text-indigo-400'}`}
                                >
                                    {st.completed ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                                </button>
                                <div className="flex-1 min-w-0">
                                    <AutoResizeTextarea 
                                        value={st.title}
                                        onChange={(e: any) => updateSubtaskTitle(st.id, e.target.value)}
                                        className={`w-full bg-transparent border-none outline-none text-base p-0 focus:ring-0 resize-none overflow-hidden ${st.completed ? 'line-through text-slate-400 decoration-slate-300' : 'text-slate-700 dark:text-slate-200 font-bold'}`}
                                        placeholder="Subtask title"
                                    />
                                    {st.completed && st.completedAt && (
                                        <p className="text-[10px] text-emerald-600 dark:text-emerald-500 font-black mt-1 flex items-center gap-1">
                                            DONE {new Date(st.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    )}
                                </div>
                                <button 
                                    onClick={() => deleteSubtask(st.id)}
                                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1.5"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                    
                    <div className="flex items-start gap-4 pl-10 opacity-60 hover:opacity-100 transition-opacity group/add">
                        <Plus size={20} className="text-indigo-500 mt-2.5" />
                        <AutoResizeTextarea 
                            value={newSubtaskTitle}
                            onChange={(e: any) => setNewSubtaskTitle(e.target.value)}
                            placeholder="Add a next step..."
                            className="flex-1 bg-transparent border-none outline-none text-base py-2.5 placeholder-slate-400 dark:text-slate-600 resize-none overflow-hidden font-bold"
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
                <div className="pt-8 border-t border-slate-100 dark:border-slate-700">
                    <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6 block flex items-center gap-2">
                        <Clock size={16} /> Activity & Updates
                    </label>

                    {/* New Update Input */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 mb-10 shadow-sm">
                        <textarea
                            ref={updateTextareaRef}
                            placeholder="Write a progress update..."
                            value={newUpdate}
                            onChange={(e) => setNewUpdate(e.target.value)}
                            className="w-full bg-transparent border-none outline-none text-base text-slate-700 dark:text-slate-200 min-h-[80px] resize-y placeholder-slate-400 dark:placeholder-slate-600 font-medium"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    handleSubmitUpdate(e);
                                }
                            }}
                        />
                        {pendingAttachments.length > 0 && (
                            <div className="flex flex-wrap gap-2.5 mb-4 mt-3">
                                {pendingAttachments.map(att => (
                                    <div key={att.id} className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-xl text-[11px] font-black text-indigo-600 dark:text-indigo-400 shadow-sm">
                                        <File size={12} />
                                        <span className="max-w-[180px] truncate">{att.name}</span>
                                        <button onClick={() => setPendingAttachments(prev => prev.filter(p => p.id !== att.id))} className="text-slate-300 hover:text-red-500 transition-colors">
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex justify-between items-center pt-4 border-t border-slate-200/50 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-all" title="Attach file">
                                    <Paperclip size={20} />
                                </button>
                                
                                {/* Formatting Tools */}
                                <div className="flex items-center border-l border-slate-200 dark:border-slate-700 ml-1 pl-3 gap-1">
                                    <button 
                                        onClick={() => applyFormatting(updateTextareaRef.current, '**', setNewUpdate)}
                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-all"
                                        title="Bold (Selection)"
                                    >
                                        <Bold size={18} />
                                    </button>
                                    <button 
                                        onClick={() => applyFormatting(updateTextareaRef.current, '==', setNewUpdate)}
                                        className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-lg transition-all"
                                        title="Highlight (Selection)"
                                    >
                                        <Highlighter size={18} />
                                    </button>
                                </div>

                                <div className="relative">
                                    <button onClick={() => setShowColorPicker(!showColorPicker)} className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5 border border-transparent hover:border-slate-300 dark:hover:border-slate-600">
                                        <div className="w-4 h-4 rounded-full shadow-sm border border-slate-300 dark:border-slate-600" style={{ backgroundColor: newUpdateColor }} />
                                        <ChevronDown size={14} className="text-slate-400" />
                                    </button>
                                    {showColorPicker && (
                                        <>
                                            <div className="fixed inset-0 z-30" onClick={() => setShowColorPicker(false)} />
                                            <div className="absolute bottom-full left-0 mb-3 p-2 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col gap-1.5 z-40 w-48 max-h-64 overflow-y-auto custom-scrollbar animate-fade-in origin-bottom-left">
                                                {updateTags.map(tag => (
                                                    <button key={tag.id} onClick={() => { setNewUpdateColor(tag.color); setShowColorPicker(false); }} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors">
                                                        <div className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: tag.color }} />
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
                                className="bg-indigo-600 text-white px-7 py-2.5 rounded-xl text-sm font-black hover:bg-indigo-700 disabled:opacity-40 transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
                            >
                                Post Update
                            </button>
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" multiple onChange={(e) => handleFileChange(e, false)} />
                    </div>

                    {/* Timeline */}
                    <div className="space-y-10 relative pl-5 border-l-2 border-slate-100 dark:border-slate-700/50 ml-3">
                        {task.updates.slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(update => (
                            <div key={update.id} className="relative pl-8 group">
                                <div className="absolute -left-[11px] top-2 z-10">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setActiveColorPickerUpdateId(activeColorPickerUpdateId === update.id ? null : update.id); }}
                                        className="w-5 h-5 rounded-full border-[3px] border-white dark:border-slate-800 shadow-md hover:scale-125 transition-transform"
                                        style={{ backgroundColor: update.highlightColor || '#cbd5e1' }}
                                        title="Change Tag"
                                    />
                                    {activeColorPickerUpdateId === update.id && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setActiveColorPickerUpdateId(null)} />
                                            <div className="absolute top-7 left-0 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl p-3 w-40 flex flex-col gap-1.5 animate-fade-in origin-top-left">
                                                <button 
                                                    onClick={() => { onEditUpdate?.(task.id, update.id, update.content, update.timestamp, null); setActiveColorPickerUpdateId(null); }}
                                                    className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 transition-colors"
                                                >
                                                    <div className="w-3.5 h-3.5 rounded-full border border-slate-200 bg-slate-100 dark:bg-slate-800" />
                                                    None
                                                </button>
                                                {updateTags.map(tag => (
                                                    <button 
                                                        key={tag.id} 
                                                        onClick={() => { onEditUpdate?.(task.id, update.id, update.content, update.timestamp, tag.color); setActiveColorPickerUpdateId(null); }}
                                                        className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
                                                    >
                                                        <div className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: tag.color }} />
                                                        <span className="truncate">{tag.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                                
                                <div className="flex items-baseline justify-between mb-2">
                                    <span className="text-xs font-black text-slate-400 dark:text-slate-500 font-mono tracking-tight">
                                        {new Date(update.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                    </span>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => startEditingUpdate(update)} className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-lg"><Edit2 size={14}/></button>
                                        {onDeleteUpdate && <button onClick={() => onDeleteUpdate(task.id, update.id)} className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-slate-700 rounded-lg"><Trash2 size={14}/></button>}
                                    </div>
                                </div>

                                {editingUpdateId === update.id ? (
                                    <div className="bg-white dark:bg-slate-900 border-2 border-indigo-100 dark:border-indigo-900 p-5 rounded-2xl shadow-xl space-y-4">
                                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                                            <input 
                                                type="date"
                                                value={editUpdateDate}
                                                onChange={(e) => setEditUpdateDate(e.target.value)}
                                                className="text-xs font-bold p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                            <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-1 gap-1">
                                                <button 
                                                    onClick={() => applyFormatting(editUpdateTextareaRef.current, '**', setEditUpdateContent)}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all"
                                                    title="Bold (Selection)"
                                                >
                                                    <Bold size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => applyFormatting(editUpdateTextareaRef.current, '==', setEditUpdateContent)}
                                                    className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all"
                                                    title="Highlight (Selection)"
                                                >
                                                    <Highlighter size={16} />
                                                </button>
                                            </div>
                                            <div className="relative">
                                                <button onClick={() => setShowEditColorPicker(!showEditColorPicker)} className="p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-white transition-colors"><div className="w-5 h-5 rounded-full shadow-sm" style={{backgroundColor: editUpdateColor || '#cbd5e1'}}/></button>
                                                {showEditColorPicker && (
                                                    <>
                                                        <div className="fixed inset-0 z-30" onClick={() => setShowEditColorPicker(false)}/>
                                                        <div className="absolute top-full left-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl p-2.5 z-40 w-44 flex flex-col gap-1 animate-fade-in origin-top-left">
                                                            {updateTags.map(t => (
                                                                <button key={t.id} onClick={() => { setEditUpdateColor(t.color); setShowEditColorPicker(false); }} className="flex items-center gap-3 w-full text-left px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-300 rounded-xl transition-colors">
                                                                    <div className="w-3.5 h-3.5 rounded-full shadow-sm" style={{backgroundColor: t.color}}/> {t.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <textarea 
                                            ref={editUpdateTextareaRef}
                                            value={editUpdateContent}
                                            onChange={e => setEditUpdateContent(e.target.value)}
                                            className="w-full text-base border border-slate-200 dark:border-slate-700 rounded-2xl p-4 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none bg-white dark:bg-slate-800 dark:text-white min-h-[120px] font-medium"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                                    saveEditedUpdate(update.id);
                                                }
                                            }}
                                        />
                                        <div className="flex justify-end gap-3 pt-2">
                                            <button onClick={() => setEditingUpdateId(null)} className="px-5 py-2 text-xs font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors uppercase tracking-widest">Cancel</button>
                                            <button onClick={() => saveEditedUpdate(update.id)} className="px-6 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md uppercase tracking-widest">Save Changes</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-base text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                        <FormattedContent content={update.content} />
                                    </div>
                                )}

                                {update.attachments && update.attachments.length > 0 && (
                                    <div className="flex flex-wrap gap-2.5 mt-4">
                                        {update.attachments.map(att => (
                                            <button 
                                                key={att.id}
                                                onClick={() => downloadAttachment(att)}
                                                className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-[11px] font-black text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all shadow-sm"
                                            >
                                                <DownloadIcon size={12} />
                                                <span className="max-w-[200px] truncate">{att.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sidebar Column - Increased width for calendar visibility */}
            <div className="w-full md:w-[26rem] bg-slate-50/50 dark:bg-slate-900/50 border-l border-slate-100 dark:border-slate-700 p-8 space-y-10 flex-shrink-0">
                <div className="space-y-8">
                    <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Project ID</label>
                        <input 
                            value={task.projectId}
                            onChange={(e) => onUpdateTask(task.id, { projectId: e.target.value })}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none dark:text-white shadow-sm"
                            placeholder="Project Code..."
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Due Date & Calendar</label>
                        <WorkloadDatePicker 
                            selectedDate={task.dueDate} 
                            onChange={(d) => onUpdateTask(task.id, { dueDate: d })} 
                            allTasks={allTasks}
                            currentTaskId={task.id}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block flex items-center gap-1.5">
                            <Repeat size={14} className="text-indigo-500" /> Recurrence Cycle
                        </label>
                        <select 
                            value={recurrenceType}
                            onChange={(e) => handleRecurrenceChange(e.target.value, recurrenceInterval)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none dark:text-white shadow-sm appearance-none cursor-pointer"
                        >
                            <option value="none">None (One-time)</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                        </select>
                        {recurrenceType !== 'none' && (
                            <div className="flex items-center gap-3 mt-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Every</span>
                                <input 
                                    type="number"
                                    min="1"
                                    value={recurrenceInterval}
                                    onChange={(e) => handleRecurrenceChange(recurrenceType, parseInt(e.target.value) || 1)}
                                    className="w-16 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm font-black text-center focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none dark:text-white"
                                />
                                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 capitalize">{recurrenceType.replace('ly', '(s)')}</span>
                            </div>
                        )}
                    </div>
                    
                    <div className="pt-8 border-t border-slate-200/50 dark:border-slate-800">
                        <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 block flex items-center gap-1.5">
                            <Paperclip size={14} className="text-indigo-500" /> Task Attachments
                        </label>
                        <div className="space-y-2.5">
                            {task.attachments?.map(att => (
                                <div key={att.id} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm group hover:border-indigo-200 dark:hover:border-indigo-900 transition-all">
                                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform"><File size={18}/></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-black text-slate-700 dark:text-slate-200 truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" onClick={() => downloadAttachment(att)}>{att.name}</p>
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">{att.type.split('/')[1] || 'FILE'}</p>
                                    </div>
                                    <button onClick={() => removeTaskAttachment(att.id)} className="p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                        <X size={16}/>
                                    </button>
                                </div>
                            ))}
                            <button 
                                onClick={() => taskFileInputRef.current?.click()}
                                className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-black text-slate-400 dark:text-slate-500 hover:border-indigo-400 dark:hover:border-indigo-600 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all flex items-center justify-center gap-2.5 bg-white dark:bg-slate-800/30"
                            >
                                <Plus size={18} /> Add Global File
                            </button>
                            <input type="file" ref={taskFileInputRef} className="hidden" onChange={(e) => handleFileChange(e, true)} />
                        </div>
                    </div>

                    <div className="pt-8 border-t border-slate-200/50 dark:border-slate-800 space-y-3 text-[11px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
                        <div className="flex justify-between">
                            <span>Created On</span>
                            <span className="font-mono text-slate-500 dark:text-slate-400">{formatDate(task.createdAt)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Updates Logged</span>
                            <span className="font-mono text-slate-500 dark:text-slate-400">{task.updates.length}</span>
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