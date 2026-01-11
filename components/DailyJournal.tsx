import React, { useState, useEffect } from 'react';
import { Task, DailyLog, Status } from '../types';
import { Filter, RotateCcw, ChevronLeft, ChevronRight, Ban, Calendar as CalendarIcon } from 'lucide-react';

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
  // ISO Week Number logic
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
  // Parse YYYY-MM-DD manually to ensure we create a Local Time date object, avoiding UTC shifts
  const [sYear, sMonth, sDay] = selectedDate.split('-').map(Number);
  
  // Initialize calendar view to the month of the selected date
  // Note: Month in Date constructor is 0-indexed (0=Jan, 11=Dec)
  const [viewDate, setViewDate] = useState(new Date(sYear, sMonth - 1, 1));

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDayObj = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const firstDayOfWeek = firstDayObj.getDay(); // 0 is Sunday
  
  // Calculate offset to align Monday as the first column
  // If first day is Sunday (0), offset is 6. If Monday (1), offset is 0.
  const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const prevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  // Generate Week Data for Grid
  const generateWeeks = () => {
    const weeks = [];
    const totalSlots = Math.ceil((daysInMonth + startOffset) / 7) * 7;
    
    let currentWeek: { cw: number; days: (React.ReactNode | null)[] } = { cw: 0, days: [] };
    
    for (let i = 0; i < totalSlots; i++) {
        const dayNum = i - startOffset + 1;
        
        if (i % 7 === 0) {
            // Start of a new week
            // Calculate CW based on Thursday of this week
            const thursdayOffset = i + 3; 
            const thursdayDayNum = thursdayOffset - startOffset + 1;
            // Handle boundary dates for CW calc (approximate is fine for UI, but let's try to be accurate)
            const safeDay = Math.max(1, Math.min(thursdayDayNum, daysInMonth)); 
            const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), safeDay);
            currentWeek = { cw: getWeekNumber(d), days: [] };
        }

        if (dayNum > 0 && dayNum <= daysInMonth) {
            // Valid Day
            const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), dayNum);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === todayStr;
            const dayOfWeek = d.getDay(); // 0 = Sun
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isOffDay = offDays.includes(dateStr);

            let bgClass = 'hover:bg-slate-100 text-slate-700';
            if (isOffDay) bgClass = 'bg-red-50 text-red-400 line-through decoration-red-300';
            else if (isWeekend) bgClass = 'bg-slate-100 text-slate-400';

            if (isSelected) bgClass = 'bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-110 font-bold';
            else if (!isSelected && isToday) bgClass = 'border-2 border-indigo-500 text-indigo-700 font-bold';

            currentWeek.days.push(
                <button
                    key={dateStr}
                    onClick={() => onSelectDate(dateStr)}
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-xs transition-all duration-200 ${bgClass}`}
                    title={isOffDay ? "Off Day" : isWeekend ? "Weekend" : dateStr}
                >
                    {dayNum}
                </button>
            );
        } else {
            // Empty Slot
            currentWeek.days.push(null);
        }

        if (currentWeek.days.length === 7) {
            weeks.push(currentWeek);
        }
    }
    return weeks;
  };

  const weeks = generateWeeks();

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 w-full">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ChevronLeft size={16} /></button>
        <span className="text-sm font-bold text-slate-800">
          {viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ChevronRight size={16} /></button>
      </div>
      
      {/* Grid Layout for Calendar */}
      <div className="w-full">
          {/* Header Row */}
          <div className="grid grid-cols-[2rem_1fr] gap-2 mb-2 items-center">
             <div className="text-[10px] font-bold text-slate-400 select-none text-center">CW</div>
             <div className="grid grid-cols-7">
                 {['M','T','W','T','F','S','S'].map((d, i) => (
                     <div key={i} className="text-center text-[10px] font-bold text-slate-400 select-none">{d}</div>
                 ))}
             </div>
          </div>

          {/* Week Rows */}
          <div className="space-y-1">
             {weeks.map((week, idx) => (
                 <div key={idx} className="grid grid-cols-[2rem_1fr] gap-2 items-center">
                     {/* CW Column */}
                     <div className="h-8 flex items-center justify-center text-[10px] text-slate-400 font-mono bg-slate-50 rounded-sm border border-slate-100">
                        {week.cw}
                     </div>
                     {/* Days Grid */}
                     <div className="grid grid-cols-7 justify-items-center">
                        {week.days.map((day, dIdx) => (
                            <div key={dIdx} className="h-8 w-8 flex items-center justify-center">
                                {day || <div className="h-full w-full" />}
                            </div>
                        ))}
                     </div>
                 </div>
             ))}
          </div>
      </div>
    </div>
  );
};

const DailyJournal: React.FC<DailyJournalProps> = ({ tasks, logs, onAddLog, onUpdateTask, initialTaskId, offDays = [], onToggleOffDay }) => {
  const [entryDate, setEntryDate] = useState<string>(new Date().toLocaleDateString('en-CA')); // YYYY-MM-DD local

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
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <CalendarIcon className="text-indigo-600" />
          History & Calendar
        </h2>
      </div>

      {/* Calendar Area */}
      <div className="space-y-4">
        <MiniCalendar selectedDate={entryDate} onSelectDate={setEntryDate} offDays={offDays} />
        
        {/* Date Context Controls */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div className="text-sm">
                <span className="text-slate-500 text-xs uppercase font-bold block mb-1">Selected Date</span>
                <span className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded">
                    {/* Parse manually to avoid timezone shift on display */}
                    {(() => {
                        const [y, m, d] = entryDate.split('-').map(Number);
                        const dateObj = new Date(y, m - 1, d);
                        return dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                    })()}
                </span>
            </div>
            {onToggleOffDay && (
                <button 
                  onClick={() => onToggleOffDay(entryDate)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${isSelectedDateOff ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  <Ban size={14} />
                  {isSelectedDateOff ? 'Set as Work Day' : 'Mark as Off Day'}
                </button>
            )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-2 bg-white p-3 rounded-lg border border-slate-200 shadow-sm mt-4">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-2 text-slate-600">
             <Filter size={16} />
             <span className="text-xs font-bold uppercase">Log History</span>
           </div>
           <button onClick={handleSetCurrentWeek} className="text-xs text-indigo-600 font-medium hover:underline flex items-center gap-1">
             <RotateCcw size={12}/> Reset to This Week
           </button>
        </div>
        <div className="flex items-center gap-2">
           <input 
            type="date" 
            value={viewRange.start}
            onChange={(e) => setViewRange(prev => ({ ...prev, start: e.target.value }))}
            className="w-full text-xs p-1.5 border border-slate-200 rounded bg-slate-50 outline-none focus:border-indigo-500 transition-colors"
           />
           <span className="text-slate-400">-</span>
           <input 
            type="date" 
            value={viewRange.end}
            onChange={(e) => setViewRange(prev => ({ ...prev, end: e.target.value }))}
            className="w-full text-xs p-1.5 border border-slate-200 rounded bg-slate-50 outline-none focus:border-indigo-500 transition-colors"
           />
        </div>
      </div>

      {/* Timeline Display */}
      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-[400px]">
        {sortedDates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-center p-4 mt-2">
            <p className="text-slate-400 text-sm">No logs in selected range.</p>
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            {sortedDates.map(date => {
               const [y, m, d] = date.split('-').map(Number);
               const localDate = new Date(y, m - 1, d);
               return (
                  <div key={date}>
                    <h3 className="font-bold text-slate-800 pl-1 mb-2 text-xs uppercase tracking-wide sticky top-0 bg-slate-50 py-1 z-10 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        {localDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric'})}
                    </h3>
                    <div className="relative border-l-2 border-indigo-100 ml-3 space-y-4 py-1 pb-4">
                        {logsByDate[date].slice().reverse().map((log) => {
                        const task = tasks.find(t => t.id === log.taskId);
                        return (
                            <div key={log.id} className="relative pl-6 group">
                            {/* Timeline Dot */}
                            <div className="absolute -left-[7px] top-3 w-3 h-3 rounded-full bg-white border-2 border-slate-300 group-hover:border-indigo-500 transition-colors"></div>
                            
                            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-1">
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 mb-1">
                                    {task?.displayId || 'Unknown'}
                                </span>
                                </div>
                                <p className="text-slate-700 text-xs leading-relaxed whitespace-pre-wrap">{log.content}</p>
                            </div>
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