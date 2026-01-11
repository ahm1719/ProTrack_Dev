import React, { useState, useEffect } from 'react';
import { Task, DailyLog, Status } from '../types';
import { Filter, RotateCcw, ChevronLeft, ChevronRight, Ban } from 'lucide-react';

interface DailyJournalProps {
  tasks: Task[];
  logs: DailyLog[];
  onAddLog: (log: Omit<DailyLog, 'id'>) => void;
  onUpdateTask: (taskId: string, updates: { status?: Status; dueDate?: string }) => void;
  initialTaskId?: string;
  offDays?: string[];
  onToggleOffDay?: (date: string) => void;
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
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay(); // 0 is Sunday
  
  // Adjust so 0 is Monday (0-6)
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const renderDays = () => {
    const days = [];
    const totalSlots = Math.ceil((daysInMonth + startOffset) / 7) * 7;
    
    // Fill empty slots before start of month
    for (let i = 0; i < startOffset; i++) {
        days.push(<div key={`empty-${i}`} className="h-8 w-8"></div>);
    }

    // Fill days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
      const dateStr = date.toISOString().split('T')[0];
      const isSelected = dateStr === selectedDate;
      const isToday = dateStr === todayStr;
      
      const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isOffDay = offDays.includes(dateStr);

      let bgClass = 'hover:bg-slate-100 text-slate-700';
      
      if (isOffDay) {
          bgClass = 'bg-red-50 text-red-400 line-through decoration-red-300';
      } else if (isWeekend) {
          bgClass = 'bg-slate-100 text-slate-400';
      }

      if (isSelected) {
          bgClass = 'bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-110';
      } else if (!isSelected && isToday) {
          bgClass = 'border border-indigo-500 text-indigo-600 font-bold';
      }

      days.push(
        <button
          key={dateStr}
          onClick={() => onSelectDate(dateStr)}
          className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-200
            ${bgClass}
          `}
          title={isOffDay ? "Off Day" : isWeekend ? "Weekend" : ""}
        >
          {i}
        </button>
      );
    }
    
    // Fill remaining slots
    const remaining = totalSlots - days.length;
    for(let i=0; i<remaining; i++) {
         days.push(<div key={`empty-end-${i}`} className="h-8 w-8"></div>);
    }

    return days;
  };

  const renderWeeks = () => {
    const dayElements = renderDays();
    const rows = [];
    const totalWeeks = dayElements.length / 7;

    for (let w = 0; w < totalWeeks; w++) {
        let weekRefDate = null;
        for (let d = 0; d < 7; d++) {
             const dayIndex = (w * 7 + d) - startOffset + 1;
             if (dayIndex > 0 && dayIndex <= daysInMonth) {
                 weekRefDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayIndex);
                 break;
             }
        }
        
        if (!weekRefDate) {
             weekRefDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
        }

        const cw = getWeekNumber(weekRefDate);

        rows.push(
            <div key={w} className="flex items-center">
                <div className="w-8 h-8 flex items-center justify-center text-[10px] text-slate-400 font-mono border-r border-slate-100 mr-2 bg-slate-50">
                    {cw}
                </div>
                <div className="flex gap-1">
                    {dayElements.slice(w * 7, (w + 1) * 7)}
                </div>
            </div>
        );
    }
    return rows;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 w-full">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ChevronLeft size={16} /></button>
        <span className="text-sm font-bold text-slate-800">
          {currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ChevronRight size={16} /></button>
      </div>
      
      <div className="flex mb-2">
         <div className="w-8 mr-2 text-[10px] text-center font-bold text-slate-400">CW</div>
         <div className="flex gap-1 flex-1 justify-between">
             {['M','T','W','T','F','S','S'].map((d, i) => (
                 <div key={i} className="w-8 text-center text-[10px] font-bold text-slate-400">{d}</div>
             ))}
         </div>
      </div>
      
      <div className="space-y-1">
        {renderWeeks()}
      </div>
    </div>
  );
};

const DailyJournal: React.FC<DailyJournalProps> = ({ tasks, logs, onAddLog, onUpdateTask, initialTaskId, offDays = [], onToggleOffDay }) => {
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // State for the View/Filter
  const [viewRange, setViewRange] = useState({
    start: getStartOfWeek(new Date()),
    end: getEndOfWeek(new Date())
  });

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

  const isSelectedDateOff = offDays.includes(entryDate);

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-slate-800">
          History & Calendar
        </h2>
      </div>

      {/* Calendar Area */}
      <div className="space-y-4">
        <MiniCalendar selectedDate={entryDate} onSelectDate={setEntryDate} offDays={offDays} />
        
        {/* Date Context Controls */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div className="text-sm">
                <span className="text-slate-500 text-xs uppercase font-bold block">Selected Date</span>
                <span className="font-medium text-slate-800">{new Date(entryDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
            {onToggleOffDay && (
                <button 
                  onClick={() => onToggleOffDay(entryDate)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${isSelectedDateOff ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  <Ban size={14} />
                  {isSelectedDateOff ? 'Marked as Off' : 'Mark as Off'}
                </button>
            )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-2 bg-white p-3 rounded-lg border border-slate-200 shadow-sm mt-4">
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

export default DailyJournal;