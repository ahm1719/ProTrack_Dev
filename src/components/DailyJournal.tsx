
import React, { useState, useEffect } from 'react';
import { Task, DailyLog, Status } from '../types';
import { Filter, RotateCcw, ChevronLeft, ChevronRight, Ban, Calendar as CalendarIcon, PlusCircle, Edit2, Trash2, X, Save, History } from 'lucide-react';

interface DailyJournalProps {
  tasks: Task[];
  logs: DailyLog[];
  onAddLog: (log: Omit<DailyLog, 'id'>) => void;
  onUpdateTask: (taskId: string, updates: { status?: Status; dueDate?: string }) => void;
  initialTaskId?: string;
  offDays?: string[];
  onToggleOffDay?: (date: string) => void;
  searchQuery?: string;
  onEditLog: (logId: string, taskId: string, content: string, date: string) => void;
  onDeleteLog: (logId: string) => void;
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

const getWeekNumber = (d: Date): number => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

interface MiniCalendarProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  offDays: string[];
}

const MiniCalendar = ({ selectedDate, onSelectDate, offDays }: MiniCalendarProps) => {
  const [sYear, sMonth, sDay] = selectedDate.split('-').map(Number);
  const [viewDate, setViewDate] = useState(new Date(sYear, sMonth - 1, 1));

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDayObj = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const firstDayOfWeek = firstDayObj.getDay();
  const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

  const generateWeeks = () => {
    const weeks = [];
    const totalSlots = Math.ceil((daysInMonth + startOffset) / 7) * 7;
    let currentWeek: { cw: number; days: (React.ReactNode | null)[] } = { cw: 0, days: [] };
    
    for (let i = 0; i < totalSlots; i++) {
        const dayNum = i - startOffset + 1;
        if (i % 7 === 0) {
            const thursdayOffset = i + 3; 
            const thursdayDayNum = thursdayOffset - startOffset + 1;
            const safeDay = Math.max(1, Math.min(thursdayDayNum, daysInMonth)); 
            const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), safeDay);
            currentWeek = { cw: getWeekNumber(d), days: [] };
        }
        if (dayNum > 0 && dayNum <= daysInMonth) {
            const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), dayNum);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === todayStr;
            const dayOfWeek = d.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isOffDay = offDays.includes(dateStr);
            let bgClass = 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300';
            if (isOffDay) bgClass = 'bg-red-50 dark:bg-red-900/20 text-red-400 line-through decoration-red-300';
            else if (isWeekend) bgClass = 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500';
            if (isSelected) bgClass = 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none scale-110 font-bold';
            else if (!isSelected && isToday) bgClass = 'border-2 border-indigo-500 text-indigo-700 dark:text-indigo-400 font-bold';
            currentWeek.days.push(
                <button
                    key={dateStr}
                    onClick={() => onSelectDate(dateStr)}
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-xs transition-all duration-200 ${bgClass}`}
                >
                    {dayNum}
                </button>
            );
        } else {
            currentWeek.days.push(null);
        }
        if (currentWeek.days.length === 7) weeks.push(currentWeek);
    }
    return weeks;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 w-full">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400"><ChevronLeft size={16} /></button>
        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
        <button onClick={nextMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400"><ChevronRight size={16} /></button>
      </div>
      <div className="w-full">
          <div className="grid grid-cols-[2rem_1fr] gap-2 mb-2 items-center">
             <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 select-none text-center">CW</div>
             <div className="grid grid-cols-7">
                 {['M','T','W','T','F','S','S'].map((d, i) => (
                     <div key={i} className="text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 select-none">{d}</div>
                 ))}
             </div>
          </div>
          <div className="space-y-1">
             {generateWeeks().map((week, idx) => (
                 <div key={idx} className="grid grid-cols-[2rem_1fr] gap-2 items-center">
                     <div className="h-8 flex items-center justify-center text-[10px] text-slate-400 dark:text-slate-500 font-mono bg-slate-50 dark:bg-slate-900 rounded-sm border border-slate-100 dark:border-slate-700">{week.cw}</div>
                     <div className="grid grid-cols-7 justify-items-center">
                        {week.days.map((day, dIdx) => (
                            <div key={dIdx} className="h-8 w-8 flex items-center justify-center">{day || <div className="h-full w-full" />}</div>
                        ))}
                     </div>
                 </div>
             ))}
          </div>
      </div>
    </div>
  );
};

const DailyJournal: React.FC<DailyJournalProps> = ({ tasks, logs, onAddLog, onUpdateTask, offDays = [], onToggleOffDay, searchQuery = '', onEditLog, onDeleteLog }) => {
  const [entryDate, setEntryDate] = useState<string>(new Date().toLocaleDateString('en-CA'));
  const [logContent, setLogContent] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  
  // Driving the timeline view based on the selected calendar date
  const [viewRange, setViewRange] = useState({
    start: getStartOfWeek(new Date(entryDate)),
    end: getEndOfWeek(new Date(entryDate))
  });

  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTaskId, setEditTaskId] = useState('');
  const [editDate, setEditDate] = useState('');

  // Update the timeline range whenever the user clicks a new date in the calendar
  useEffect(() => {
    const dateObj = new Date(entryDate);
    setViewRange({
      start: getStartOfWeek(dateObj),
      end: getEndOfWeek(dateObj)
    });
  }, [entryDate]);

  const handleAddEntry = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (!logContent.trim()) return;
    onAddLog({
      date: entryDate,
      taskId: selectedTaskId,
      content: logContent.trim()
    });
    setLogContent('');
    setSelectedTaskId('');
  };

  const handleSaveEdit = () => {
    if (editingLogId) {
        onEditLog(editingLogId, editTaskId, editContent, editDate);
        setEditingLogId(null);
    }
  };

  const q = searchQuery.toLowerCase();
  const filteredLogs = logs.filter(l => {
    const matchesDate = l.date >= viewRange.start && l.date <= viewRange.end;
    const matchesSearch = q === '' || l.content.toLowerCase().includes(q);
    return matchesDate && matchesSearch;
  });
  
  const logsByDate: Record<string, DailyLog[]> = {};
  filteredLogs.forEach(log => {
    if (!logsByDate[log.date]) logsByDate[log.date] = [];
    logsByDate[log.date].push(log);
  });
  
  const sortedDates = Object.keys(logsByDate).sort().reverse();

  const handleResetToToday = () => {
    setEntryDate(new Date().toLocaleDateString('en-CA'));
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <CalendarIcon className="text-indigo-600 dark:text-indigo-400" />
                History & Calendar
            </h2>
            <button 
                onClick={handleResetToToday}
                className="p-1.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors flex items-center gap-1.5"
                title="Go to Today"
            >
                <RotateCcw size={12} /> TODAY
            </button>
        </div>
      </div>

      <div className="space-y-4">
        <MiniCalendar selectedDate={entryDate} onSelectDate={setEntryDate} offDays={offDays} />
        
        <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 shadow-sm space-y-3">
            <h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                <PlusCircle size={14}/> Add Entry for {entryDate}
            </h4>
            <form onSubmit={handleAddEntry} className="space-y-2">
                <select 
                    value={selectedTaskId} 
                    onChange={(e) => setSelectedTaskId(e.target.value)}
                    className="w-full text-xs p-2 border border-indigo-200 dark:border-slate-600 rounded-lg outline-none bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-600"
                >
                    <option value="">(No Task Linked)</option>
                    {tasks.filter(t => t.status !== Status.ARCHIVED).map(t => (
                        <option key={t.id} value={t.id}>{t.displayId} - {t.description.substring(0, 30)}...</option>
                    ))}
                </select>
                <textarea 
                    placeholder="Log progress... (Ctrl+Enter to add)"
                    value={logContent}
                    onChange={(e) => setLogContent(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            handleAddEntry(e);
                        }
                    }}
                    rows={3}
                    className="w-full text-xs p-3 border border-indigo-200 dark:border-slate-600 rounded-xl outline-none bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-600 resize-none"
                />
                <button 
                    type="submit" 
                    disabled={!logContent.trim()}
                    className="w-full bg-indigo-600 text-white py-2 rounded-lg text-xs font-bold shadow-md disabled:opacity-50 hover:bg-indigo-700"
                >
                    Add to Timeline
                </button>
            </form>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-[400px]">
        {sortedDates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 bg-slate-50 dark:bg-slate-800 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center p-4">
            <p className="text-slate-400 dark:text-slate-500 text-sm">No entries found for this week.</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-1">Select another date in the calendar to browse history.</p>
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            {sortedDates.map(date => {
               const [y, m, d] = date.split('-').map(Number);
               const localDate = new Date(y, m - 1, d);
               return (
                  <div key={date}>
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 pl-1 mb-2 text-xs uppercase tracking-wide sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md py-1 z-10 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${date === entryDate ? 'bg-indigo-500 scale-125 ring-2 ring-indigo-200 dark:ring-indigo-900' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                        {localDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric'})}
                    </h3>
                    <div className="relative border-l-2 border-indigo-100 dark:border-indigo-900/50 ml-3 space-y-4 py-1 pb-4">
                        {logsByDate[date].slice().reverse().map((log) => {
                        const isEditing = editingLogId === log.id;
                        const task = tasks.find(t => t.id === (isEditing ? editTaskId : log.taskId));
                        const isStatusChange = log.content.includes('Status:');

                        return (
                            <div key={log.id} className="relative pl-6 group">
                            <div className={`absolute -left-[7px] top-3 w-3 h-3 rounded-full bg-white dark:bg-slate-900 border-2 transition-colors ${isStatusChange ? 'border-indigo-400' : 'border-slate-300 dark:border-slate-600 group-hover:border-indigo-500'}`}></div>
                            
                            {isEditing ? (
                                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border-2 border-indigo-400 shadow-md space-y-2">
                                    <div className="flex gap-2">
                                        <input 
                                            type="date"
                                            value={editDate}
                                            onChange={(e) => setEditDate(e.target.value)}
                                            className="w-1/2 text-xs p-1.5 border border-slate-200 dark:border-slate-600 rounded outline-none bg-white dark:bg-slate-700 dark:text-white"
                                        />
                                        <select 
                                            value={editTaskId} 
                                            onChange={(e) => setEditTaskId(e.target.value)}
                                            className="w-1/2 text-xs p-1.5 border border-slate-200 dark:border-slate-600 rounded outline-none bg-white dark:bg-slate-700 dark:text-white"
                                        >
                                            <option value="">(No Task Linked)</option>
                                            {tasks.filter(t => t.status !== Status.ARCHIVED).map(t => (
                                                <option key={t.id} value={t.id}>{t.displayId} - {t.description.substring(0, 30)}...</option>
                                            ))}
                                        </select>
                                    </div>
                                    <textarea 
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                                e.preventDefault();
                                                handleSaveEdit();
                                            }
                                        }}
                                        className="w-full text-xs p-2 border border-slate-200 dark:border-slate-600 rounded outline-none resize-none h-20 bg-white dark:bg-slate-700 dark:text-white"
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setEditingLogId(null)} className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><X size={14}/></button>
                                        <button onClick={handleSaveEdit} className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded"><Save size={14}/></button>
                                    </div>
                                </div>
                            ) : (
                                <div className={`bg-white dark:bg-slate-800 p-3 rounded-lg border shadow-sm hover:shadow-md transition-all relative ${isStatusChange ? 'border-indigo-100 dark:border-indigo-900 bg-indigo-50/20' : 'border-slate-200 dark:border-slate-700'}`}>
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-wrap gap-1.5 items-center mb-1">
                                            {task && <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">{task.displayId}</span>}
                                            {isStatusChange && <span className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-900 flex items-center gap-1"><History size={8}/> System Event</span>}
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => { 
                                                    setEditingLogId(log.id); 
                                                    setEditContent(log.content); 
                                                    setEditTaskId(log.taskId);
                                                    setEditDate(log.date);
                                                }} 
                                                className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded"
                                            >
                                                <Edit2 size={12}/>
                                            </button>
                                            <button onClick={() => onDeleteLog(log.id)} className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded"><Trash2 size={12}/></button>
                                        </div>
                                    </div>
                                    <p className={`text-xs leading-relaxed whitespace-pre-wrap ${isStatusChange ? 'text-indigo-700 dark:text-indigo-300 font-medium italic' : 'text-slate-700 dark:text-slate-300'}`}>
                                        {log.content}
                                    </p>
                                </div>
                            )}
                            </div>
                        );
                        })}
                    </div>
                  </div>
               );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyJournal;
