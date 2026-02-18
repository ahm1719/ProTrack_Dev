
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Task, Status, Priority, TaskAttachment, HighlightOption, Subtask, TaskUpdate } from '../types';
import { 
  X, Calendar, Clock, CheckCircle2, AlertTriangle, Send, Paperclip, 
  Trash2, Edit2, Plus, CheckSquare, Square, ChevronLeft, ChevronRight, 
  Umbrella, Save, File as FileIcon, User, ListChecks, Tag, Palette
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface TaskDetailModalProps {
  task: Task;
  allTasks: Task[];
  onClose: () => void;
  onUpdateStatus: (id: string, status: string) => void;
  onUpdateTask: (id: string, fields: Partial<Task>) => void;
  onAddUpdate: (id: string, content: string, attachments?: TaskAttachment[], highlightColor?: string) => void;
  onEditUpdate: (taskId: string, updateId: string, content: string, timestamp?: string, highlightColor?: string | null) => void;
  onDeleteUpdate: (taskId: string, updateId: string) => void;
  onDeleteTask: (id: string) => void;
  availableStatuses: string[];
  availablePriorities: string[];
  updateTags: HighlightOption[];
  statusColors: Record<string, string>;
  offDays: string[];
}

const DatePicker = ({ 
    currentDate, 
    onSelect, 
    onClose, 
    offDays, 
    allTasks 
}: { 
    currentDate: string, 
    onSelect: (date: string) => void, 
    onClose: () => void, 
    offDays: string[], 
    allTasks: Task[] 
}) => {
    const [viewDate, setViewDate] = useState(new Date(currentDate || new Date()));
    
    // Get workload for each day in the current month view
    const getWorkload = (dayStr: string) => {
        return allTasks.filter(t => t.dueDate === dayStr && t.status !== Status.DONE && t.status !== Status.ARCHIVED).length;
    };

    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay(); // 0 is Sunday
    const startOffset = firstDay === 0 ? 6 : firstDay - 1; // Start on Monday

    const days = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    const handleDateClick = (day: number) => {
        const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        // Correctly format to local ISO date part YYYY-MM-DD
        const isoDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        onSelect(isoDate);
        onClose();
    };

    const monthLabel = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    return (
        <div className="absolute top-full left-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 z-50 w-72 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)))} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400"><ChevronLeft size={16}/></button>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{monthLabel}</span>
                <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)))} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400"><ChevronRight size={16}/></button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
                {['M','T','W','T','F','S','S'].map(d => <span key={d} className="text-center text-[10px] font-bold text-slate-400 dark:text-slate-500">{d}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map((day, idx) => {
                    if (!day) return <div key={idx} />;
                    const dObj = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
                    const dayStr = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`;
                    const isSelected = dayStr === currentDate;
                    const isToday = dayStr === new Date().toLocaleDateString('en-CA');
                    const isOff = offDays.includes(dayStr);
                    const workload = getWorkload(dayStr);
                    
                    let workloadColor = 'bg-emerald-500';
                    if (workload >= 3) workloadColor = 'bg-amber-500';
                    if (workload >= 5) workloadColor = 'bg-red-500';

                    let btnClasses = `relative h-8 w-8 rounded-full flex items-center justify-center text-xs transition-all ${isSelected ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`;
                    if (isToday && !isSelected) btnClasses += ' border-2 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold';
                    if (isOff && !isSelected) btnClasses += ' bg-rose-50 dark:bg-rose-900/20 text-rose-500 dark:text-rose-400';

                    return (
                        <button 
                            key={idx} 
                            onClick={() => handleDateClick(day)}
                            className={btnClasses}
                        >
                            {day}
                            {isOff && (
                                <Umbrella size={10} className="absolute bottom-0.5 right-0.5 text-rose-400 dark:text-rose-600" />
                            )}
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
};

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ 
    task, allTasks, onClose, onUpdateStatus, onUpdateTask, onAddUpdate, onEditUpdate, onDeleteUpdate, onDeleteTask,
    availableStatuses, availablePriorities, updateTags, statusColors, offDays
}) => {
    const [newUpdate, setNewUpdate] = useState('');
    const [selectedTag, setSelectedTag] = useState<string>('');
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [isEditingDesc, setIsEditingDesc] = useState(false);
    const [tempTitle, setTempTitle] = useState(task.title || '');
    const [tempDesc, setTempDesc] = useState(task.description);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [newSubtask, setNewSubtask] = useState('');
    
    // Editing State
    const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
    const [editUpdateContent, setEditUpdateContent] = useState('');
    const [editUpdateDate, setEditUpdateDate] = useState('');
    const [editUpdateColor, setEditUpdateColor] = useState<string>('');
    
    // Inline Actions
    const [activeTagDropdownId, setActiveTagDropdownId] = useState<string | null>(null);

    const [pendingAttachments, setPendingAttachments] = useState<TaskAttachment[]>([]);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const updateInputRef = useRef<HTMLTextAreaElement>(null);

    // Sync local state when task changes (e.g. from props update)
    useEffect(() => {
        setTempTitle(task.title || '');
        setTempDesc(task.description);
    }, [task]);

    // Group updates by Date
    const groupedUpdates = useMemo(() => {
        const groups: Record<string, TaskUpdate[]> = {};
        
        // 1. Sort all updates by time ASCENDING (Chronological) for display within the day
        const chronologicallySortedUpdates = [...task.updates].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        // 2. Group by local date string
        chronologicallySortedUpdates.forEach(u => {
            const date = new Date(u.timestamp);
            const dateKey = date.toLocaleDateString('en-CA'); // YYYY-MM-DD
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(u);
        });
        
        // 3. Return array of groups, sorted by Date DESCENDING (Newest day first)
        const sortedGroupKeys = Object.keys(groups).sort().reverse();
        
        return sortedGroupKeys.map(dateKey => {
            const dateObj = new Date(dateKey + 'T12:00:00'); // Safe parsing for display
            return {
                dateKey,
                displayDate: dateKey === new Date().toLocaleDateString('en-CA') ? 'Today' : dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }),
                updates: groups[dateKey]
            };
        });
    }, [task.updates]);

    const handleSaveTitle = () => {
        if (tempTitle.trim() !== (task.title || '')) {
            onUpdateTask(task.id, { title: tempTitle.trim() });
        }
        setIsEditingTitle(false);
    };

    const handleSaveDesc = () => {
        if (tempDesc.trim() !== task.description) {
            onUpdateTask(task.id, { description: tempDesc.trim() });
        }
        setIsEditingDesc(false);
    };

    const handleAddSubtask = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSubtask.trim()) return;
        const subtasks = task.subtasks || [];
        const newItem: Subtask = { id: uuidv4(), title: newSubtask.trim(), completed: false };
        onUpdateTask(task.id, { subtasks: [...subtasks, newItem] });
        setNewSubtask('');
    };

    const toggleSubtask = (subtaskId: string) => {
        const subtasks = task.subtasks?.map(st => 
            st.id === subtaskId ? { ...st, completed: !st.completed, completedAt: !st.completed ? new Date().toISOString() : undefined } : st
        ) || [];
        onUpdateTask(task.id, { subtasks });
    };

    const deleteSubtask = (subtaskId: string) => {
        const subtasks = task.subtasks?.filter(st => st.id !== subtaskId) || [];
        onUpdateTask(task.id, { subtasks });
    };

    const handleSubmitUpdate = (e: React.FormEvent | React.KeyboardEvent) => {
        e.preventDefault();
        if (!newUpdate.trim() && pendingAttachments.length === 0) return;
        
        // Find color for tag
        let highlightColor: string | undefined = undefined;
        if (selectedTag) {
            const tag = updateTags.find(t => t.id === selectedTag);
            if (tag) highlightColor = tag.color;
        }

        onAddUpdate(task.id, newUpdate, pendingAttachments.length > 0 ? pendingAttachments : undefined, highlightColor);
        setNewUpdate('');
        setSelectedTag('');
        setPendingAttachments([]);
    };

    const startEditingUpdate = (update: TaskUpdate) => {
        setEditingUpdateId(update.id);
        setEditUpdateContent(update.content);
        setEditUpdateColor(update.highlightColor || '');
        
        // Helper to formatting ISO to YYYY-MM-DDTHH:MM local time
        const d = new Date(update.timestamp);
        const pad = (n: number) => n < 10 ? '0' + n : n;
        const localIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        setEditUpdateDate(localIso);
    };

    const saveEditedUpdate = (updateId: string) => {
        // Handle timezone properly when saving back to ISO
        const dateObj = new Date(editUpdateDate);
        if (isNaN(dateObj.getTime())) {
            alert("Invalid date");
            return;
        }
        const newTimestamp = dateObj.toISOString();
        
        onEditUpdate(task.id, updateId, editUpdateContent, newTimestamp, editUpdateColor || null);
        setEditingUpdateId(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
                    setPendingAttachments(prev => [...prev, attachment]);
                }
            };
            reader.readAsDataURL(file);
        });
        if (e.target) e.target.value = '';
    };

    const downloadAttachment = (att: TaskAttachment) => {
        const link = document.createElement('a');
        link.href = att.data;
        link.download = att.name;
        link.click();
    };

    const completedSubtasks = task.subtasks?.filter(st => st.completed).length || 0;
    const totalSubtasks = task.subtasks?.length || 0;
    const progress = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in" onMouseDown={onClose}>
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col" onMouseDown={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-6 border-b dark:border-slate-800 flex flex-col gap-4 bg-slate-50 dark:bg-slate-950">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <span className="font-mono text-xs font-black text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded">{task.source}</span>
                            <span className="font-mono text-lg font-black text-indigo-600 dark:text-indigo-400">{task.displayId}</span>
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{task.projectId}</span>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800"><X size={24} /></button>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        {/* Status Select */}
                        <div className="relative group">
                            <select 
                                value={task.status}
                                onChange={(e) => onUpdateStatus(task.id, e.target.value)}
                                className="appearance-none pl-4 pr-10 py-2 rounded-xl font-bold text-xs uppercase tracking-wide cursor-pointer focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm dark:bg-slate-800"
                                style={{ 
                                    backgroundColor: statusColors[task.status] || '#e2e8f0', 
                                    color: ['#e2e8f0', '#f1f5f9', '#ffffff'].includes(statusColors[task.status] || '') ? '#1e293b' : '#ffffff' 
                                }}
                            >
                                {availableStatuses.map(s => <option key={s} value={s} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">{s}</option>)}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50"><CheckCircle2 size={14} color="currentColor" /></div>
                        </div>

                        {/* Priority Select */}
                        <div className="relative">
                            <select 
                                value={task.priority}
                                onChange={(e) => onUpdateTask(task.id, { priority: e.target.value })}
                                className={`appearance-none pl-4 pr-10 py-2 rounded-xl font-bold text-xs uppercase tracking-wide cursor-pointer border-2 outline-none transition-all bg-white dark:bg-slate-800 dark:text-white ${
                                    task.priority === Priority.HIGH ? 'border-red-200 text-red-700 dark:border-red-900 dark:text-red-400' : 
                                    task.priority === Priority.MEDIUM ? 'border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-400' : 
                                    'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-400'
                                }`}
                            >
                                {availablePriorities.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50"><AlertTriangle size={14} className={task.priority === Priority.HIGH ? 'text-red-600' : 'text-slate-400'} /></div>
                        </div>

                        {/* Date Picker */}
                        <div className="relative">
                            <button 
                                onClick={() => setShowDatePicker(!showDatePicker)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wide border-2 transition-all ${
                                    task.dueDate && task.dueDate < new Date().toLocaleDateString('en-CA') && task.status !== Status.DONE
                                    ? 'border-red-200 text-red-600 bg-red-50 dark:bg-red-900/20 dark:border-red-900 dark:text-red-400 animate-pulse' 
                                    : 'border-slate-200 text-slate-600 hover:border-indigo-300 dark:border-slate-700 dark:text-slate-300 dark:hover:border-indigo-700'
                                }`}
                            >
                                <Calendar size={14} />
                                {task.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Set Date'}
                            </button>
                            {showDatePicker && (
                                <DatePicker 
                                    currentDate={task.dueDate} 
                                    onSelect={(d) => onUpdateTask(task.id, { dueDate: d })} 
                                    onClose={() => setShowDatePicker(false)} 
                                    offDays={offDays}
                                    allTasks={allTasks}
                                />
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col md:flex-row">
                    {/* Left Column: Details & Subtasks */}
                    <div className="flex-1 p-8 space-y-8 border-r dark:border-slate-800">
                        {/* Title & Description */}
                        <div className="space-y-4">
                            <div className="group">
                                {isEditingTitle ? (
                                    <input 
                                        autoFocus
                                        className="w-full text-2xl font-bold text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-800 border-b-2 border-indigo-500 outline-none p-1"
                                        value={tempTitle}
                                        onChange={e => setTempTitle(e.target.value)}
                                        onBlur={handleSaveTitle}
                                        onKeyDown={e => e.key === 'Enter' && handleSaveTitle()}
                                    />
                                ) : (
                                    <h1 onClick={() => setIsEditingTitle(true)} className="text-2xl font-bold text-slate-800 dark:text-white cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-2">
                                        {task.title || 'Untitled Task'}
                                        <Edit2 size={16} className="opacity-0 group-hover:opacity-100 text-slate-400" />
                                    </h1>
                                )}
                            </div>
                            
                            <div className="group">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Description</h3>
                                    {!isEditingDesc && <button onClick={() => setIsEditingDesc(true)} className="text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 size={12} /></button>}
                                </div>
                                {isEditingDesc ? (
                                    <div className="relative">
                                        <textarea 
                                            autoFocus
                                            className="w-full min-h-[150px] p-4 text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-indigo-200 dark:border-indigo-900 rounded-xl outline-none resize-y"
                                            value={tempDesc}
                                            onChange={e => setTempDesc(e.target.value)}
                                            onBlur={handleSaveDesc}
                                        />
                                        <div className="absolute bottom-2 right-2 text-[10px] text-slate-400">Click outside to save</div>
                                    </div>
                                ) : (
                                    <div onClick={() => setIsEditingDesc(true)} className="prose prose-sm dark:prose-invert text-slate-600 dark:text-slate-400 whitespace-pre-wrap cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 p-2 -ml-2 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800">
                                        {task.description || <span className="italic opacity-50">No description provided.</span>}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Subtasks */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <ListChecks size={14} /> Subtasks
                                </h3>
                                {totalSubtasks > 0 && (
                                    <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-500 dark:text-slate-400">
                                        {Math.round(progress)}% Done
                                    </span>
                                )}
                            </div>
                            
                            {/* Progress Bar */}
                            {totalSubtasks > 0 && (
                                <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                                </div>
                            )}

                            <div className="space-y-2">
                                {task.subtasks?.map(st => (
                                    <div key={st.id} className="flex items-center gap-3 group">
                                        <button onClick={() => toggleSubtask(st.id)} className={`transition-colors ${st.completed ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600 hover:text-indigo-500'}`}>
                                            {st.completed ? <CheckSquare size={18} /> : <Square size={18} />}
                                        </button>
                                        <span className={`flex-1 text-sm transition-all ${st.completed ? 'text-slate-400 dark:text-slate-600 line-through' : 'text-slate-700 dark:text-slate-300'}`}>
                                            {st.title}
                                        </span>
                                        <button onClick={() => deleteSubtask(st.id)} className="text-slate-300 dark:text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                                <form onSubmit={handleAddSubtask} className="relative flex items-center gap-3">
                                    <Plus size={18} className="text-slate-300 dark:text-slate-600" />
                                    <input 
                                        type="text" 
                                        value={newSubtask} 
                                        onChange={e => setNewSubtask(e.target.value)} 
                                        placeholder="Add a step..." 
                                        className="flex-1 bg-transparent text-sm outline-none text-slate-700 dark:text-slate-300 placeholder-slate-400"
                                    />
                                </form>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: History & Updates */}
                    <div className="w-full md:w-[400px] bg-slate-50 dark:bg-slate-900/50 flex flex-col h-[500px] md:h-auto">
                        <div className="p-4 border-b dark:border-slate-800 bg-white dark:bg-slate-900">
                            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Activity & Updates</h3>
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-1">
                                <textarea 
                                    ref={updateInputRef}
                                    placeholder="Log progress..." 
                                    value={newUpdate}
                                    onChange={e => setNewUpdate(e.target.value)}
                                    onKeyDown={e => { if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmitUpdate(e); }}
                                    className="w-full bg-transparent text-sm p-3 outline-none resize-none dark:text-white dark:placeholder-slate-500"
                                    rows={3}
                                />
                                {pendingAttachments.length > 0 && (
                                    <div className="flex flex-wrap gap-2 px-3 pb-2">
                                        {pendingAttachments.map((att, i) => (
                                            <span key={i} className="text-[10px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded flex items-center gap-1">
                                                <FileIcon size={10} /> {att.name}
                                                <button onClick={() => setPendingAttachments(prev => prev.filter((_, idx) => idx !== i))}><X size={10}/></button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="flex items-center justify-between px-2 pb-2">
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"><Paperclip size={16} /></button>
                                        <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} />
                                        
                                        {/* Tag Selector */}
                                        <select 
                                            value={selectedTag}
                                            onChange={e => setSelectedTag(e.target.value)}
                                            className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded px-2 py-1 outline-none border-none cursor-pointer hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                                        >
                                            <option value="">Tag...</option>
                                            {updateTags.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                        </select>
                                    </div>
                                    <button 
                                        onClick={handleSubmitUpdate} 
                                        disabled={!newUpdate.trim() && pendingAttachments.length === 0}
                                        className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                                    >
                                        <Send size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                            {task.updates.length === 0 && (
                                <div className="text-center py-10 opacity-50">
                                    <User size={32} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                                    <p className="text-xs text-slate-400">No activity yet.</p>
                                </div>
                            )}
                            
                            {groupedUpdates.map(group => (
                                <div key={group.dateKey} className="relative">
                                    {/* Sticky Day Header */}
                                    <div className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm py-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
                                            <Calendar size={10} />
                                            {group.displayDate}
                                        </h4>
                                    </div>

                                    <div className="space-y-0 relative">
                                        {/* Day connector line */}
                                        <div className="absolute left-[6px] top-2 bottom-2 w-[2px] bg-slate-200 dark:bg-slate-700/50"></div>

                                        {group.updates.map(update => {
                                            const isEditing = editingUpdateId === update.id;
                                            return (
                                                <div key={update.id} className="relative group pl-6 pb-6 last:pb-2">
                                                    {/* Timeline Node & Inline Tag Selector */}
                                                    <div className="absolute left-0 top-[3px] z-20">
                                                        <button 
                                                            onClick={() => setActiveTagDropdownId(activeTagDropdownId === update.id ? null : update.id)}
                                                            className={`w-3.5 h-3.5 rounded-full border-2 transition-transform hover:scale-110 ${update.highlightColor ? 'border-transparent' : 'border-indigo-200 dark:border-indigo-900 bg-white dark:bg-slate-900'}`}
                                                            style={update.highlightColor ? { backgroundColor: update.highlightColor } : {}}
                                                            title="Change Color Tag"
                                                        />
                                                        {activeTagDropdownId === update.id && (
                                                            <div className="absolute top-5 left-0 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-2 z-30 w-32 grid grid-cols-4 gap-1 animate-fade-in">
                                                                <button onClick={() => { onEditUpdate(task.id, update.id, update.content, update.timestamp, null); setActiveTagDropdownId(null); }} className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-black/20 hover:scale-110 transition-transform relative" title="Clear Tag">
                                                                    <div className="absolute inset-0 m-auto w-3 h-[1px] bg-red-500 rotate-45"></div>
                                                                </button>
                                                                {updateTags.map(tag => (
                                                                    <button 
                                                                        key={tag.id}
                                                                        onClick={() => { onEditUpdate(task.id, update.id, update.content, update.timestamp, tag.color); setActiveTagDropdownId(null); }}
                                                                        className="w-5 h-5 rounded-full hover:scale-110 transition-transform border border-transparent hover:border-slate-300 dark:hover:border-slate-500"
                                                                        style={{ backgroundColor: tag.color }}
                                                                        title={tag.label}
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}
                                                        {/* Click overlay to close dropdown */}
                                                        {activeTagDropdownId === update.id && (
                                                            <div className="fixed inset-0 z-20" onClick={() => setActiveTagDropdownId(null)} />
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold font-mono">
                                                                    {new Date(update.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                            <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-2 bg-white dark:bg-slate-900 px-1 rounded shadow-sm">
                                                                <button onClick={() => startEditingUpdate(update)} className="text-slate-400 hover:text-indigo-500"><Edit2 size={10} /></button>
                                                                {onDeleteUpdate && <button onClick={() => onDeleteUpdate(task.id, update.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={10} /></button>}
                                                            </div>
                                                        </div>
                                                        
                                                        {isEditing ? (
                                                            <div className="bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-900 rounded-lg p-2 shadow-sm space-y-2">
                                                                <textarea 
                                                                    value={editUpdateContent}
                                                                    onChange={e => setEditUpdateContent(e.target.value)}
                                                                    className="w-full text-xs outline-none resize-none dark:bg-transparent dark:text-white p-1"
                                                                    rows={3}
                                                                />
                                                                
                                                                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                                                                    <div className="flex-1">
                                                                        <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Date & Time</label>
                                                                        <input 
                                                                            type="datetime-local"
                                                                            value={editUpdateDate}
                                                                            onChange={e => setEditUpdateDate(e.target.value)}
                                                                            className="w-full text-[10px] p-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Tag</label>
                                                                        <div className="flex gap-1">
                                                                            <button 
                                                                                onClick={() => setEditUpdateColor('')} 
                                                                                className={`w-5 h-5 rounded border ${!editUpdateColor ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white dark:bg-slate-900'} flex items-center justify-center`}
                                                                                title="No Tag"
                                                                            >
                                                                                <X size={10} className="text-slate-400"/>
                                                                            </button>
                                                                            {updateTags.slice(0, 3).map(tag => (
                                                                                <button 
                                                                                    key={tag.id}
                                                                                    onClick={() => setEditUpdateColor(tag.color)}
                                                                                    className={`w-5 h-5 rounded border ${editUpdateColor === tag.color ? 'border-black dark:border-white scale-110' : 'border-transparent'}`}
                                                                                    style={{ backgroundColor: tag.color }}
                                                                                    title={tag.label}
                                                                                />
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex justify-end gap-2 mt-2">
                                                                    <button onClick={() => setEditingUpdateId(null)} className="text-[10px] text-slate-500 hover:text-slate-700 px-2 py-1">Cancel</button>
                                                                    <button onClick={() => saveEditedUpdate(update.id)} className="text-[10px] bg-indigo-600 text-white px-3 py-1 rounded font-bold hover:bg-indigo-700">Save</button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className={`p-3 rounded-lg text-sm leading-relaxed border ${update.highlightColor ? 'border-l-4' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm'}`} 
                                                                style={update.highlightColor ? { borderLeftColor: update.highlightColor, backgroundColor: `${update.highlightColor}08` } : {}}
                                                            >
                                                                <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 text-xs">{update.content}</p>
                                                                {update.attachments && update.attachments.length > 0 && (
                                                                    <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                                                                        {update.attachments.map(att => (
                                                                            <button 
                                                                                key={att.id} 
                                                                                onClick={() => downloadAttachment(att)}
                                                                                className="flex items-center gap-1 text-[10px] font-bold bg-slate-50 dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 transition-all text-slate-600 dark:text-slate-400"
                                                                            >
                                                                                <FileIcon size={10} /> {att.name}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
                    <button 
                        onClick={() => { if(confirm('Delete this task forever?')) onDeleteTask(task.id); }}
                        className="text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-2 px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                        <Trash2 size={14} /> Delete Task
                    </button>
                    <button 
                        onClick={onClose}
                        className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-slate-200 dark:shadow-none transition-all"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TaskDetailModal;
