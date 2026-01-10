import React, { useState, useEffect } from 'react';
import { Task, DailyLog, ViewMode, Status, Priority } from './types';
import TaskCard from './components/TaskCard';
import DailyJournal from './components/DailyJournal';
import UserManual from './components/UserManual';
import { generateWeeklySummary } from './services/geminiService';
import { 
  LayoutDashboard, 
  ListTodo, 
  BookOpen, 
  Sparkles, 
  Plus, 
  Search, 
  Download,
  Menu,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// --- MOCK DATA FOR INITIAL LOAD ---
const INITIAL_TASKS: Task[] = [
  {
    id: '1',
    displayId: 'P1130-28',
    source: 'CW02',
    description: 'Prepare a set of slides for the end user to show project stage and limitations.',
    dueDate: '2026-01-09',
    status: Status.IN_PROGRESS,
    priority: Priority.HIGH,
    updates: [
      { id: 'u1', timestamp: '2026-01-07T10:00:00', content: 'Started work on slide set.' },
      { id: 'u2', timestamp: '2026-01-08T14:30:00', content: 'Updated slides to include positive news on AY4/5.' }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    displayId: 'G-2',
    source: 'CW49',
    description: 'Think of structure and identify needed folders for Mfiles BSS copy.',
    dueDate: '2026-01-10',
    status: Status.NOT_STARTED,
    priority: Priority.MEDIUM,
    updates: [],
    createdAt: new Date().toISOString()
  }
];

const INITIAL_LOGS: DailyLog[] = [
  { id: 'l1', date: '2026-01-08', taskId: '1', content: 'Updated slides to include positive news on AY4/5 and the proposed way forward.' }
];

function App() {
  // --- STATE ---
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('protrack_tasks');
    return saved ? JSON.parse(saved) : INITIAL_TASKS;
  });

  const [logs, setLogs] = useState<DailyLog[]>(() => {
    const saved = localStorage.getItem('protrack_logs');
    return saved ? JSON.parse(saved) : INITIAL_LOGS;
  });

  const [currentView, setCurrentView] = useState<ViewMode>(ViewMode.DASHBOARD);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // AI Summary State
  const [summary, setSummary] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- EFFECTS ---
  useEffect(() => {
    localStorage.setItem('protrack_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('protrack_logs', JSON.stringify(logs));
  }, [logs]);

  // --- ACTIONS ---

  const handleCreateOrUpdateTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newTask: Task = {
      id: editingTask ? editingTask.id : uuidv4(),
      displayId: (formData.get('displayId') as string) || `T-${Math.floor(Math.random() * 1000)}`,
      source: (formData.get('source') as string) || 'CW00',
      description: formData.get('description') as string,
      dueDate: formData.get('dueDate') as string,
      priority: formData.get('priority') as Priority,
      status: (formData.get('status') as Status) || Status.NOT_STARTED,
      updates: editingTask ? editingTask.updates : [],
      createdAt: editingTask ? editingTask.createdAt : new Date().toISOString(),
    };

    if (editingTask) {
      setTasks(prev => prev.map(t => t.id === editingTask.id ? newTask : t));
    } else {
      setTasks(prev => [newTask, ...prev]);
    }
    
    setIsTaskModalOpen(false);
    setEditingTask(null);
  };

  const updateTaskStatus = (id: string, status: Status) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  };

  const addUpdateToTask = (taskId: string, content: string) => {
    const newUpdate = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      content
    };
    
    // Also add to daily log automatically for convenience
    const newLog = {
      id: uuidv4(),
      date: new Date().toISOString().split('T')[0],
      taskId,
      content
    };

    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, updates: [...t.updates, newUpdate] } : t
    ));
    setLogs(prev => [...prev, newLog]);
  };

  const addDailyLog = (logData: Omit<DailyLog, 'id'>) => {
    const newLog = { ...logData, id: uuidv4() };
    setLogs(prev => [...prev, newLog]);

    // Sync back to task history
    const updateEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(), // Use now for ordering, even if logged for a different date visually
      content: `[Log Entry: ${logData.date}] ${logData.content}`
    };

    setTasks(prev => prev.map(t => 
      t.id === logData.taskId ? { ...t, updates: [...t.updates, updateEntry] } : t
    ));
  };

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const result = await generateWeeklySummary(tasks, logs);
      setSummary(result);
    } catch (err) {
      setError("Failed to generate summary. Ensure API Key is configured.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ tasks, logs }, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "protrack_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  // --- FILTERS ---
  const filteredTasks = tasks.filter(t => 
    t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.displayId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.source.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- RENDER HELPERS ---
  const renderDashboard = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-indigo-100">Total Tasks</h3>
            <ListTodo className="opacity-50" />
          </div>
          <p className="text-4xl font-bold">{tasks.length}</p>
          <p className="text-xs text-indigo-200 mt-2">Active Tracker Database</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
           <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-500">In Progress</h3>
            <Clock className="text-blue-500" />
          </div>
          <p className="text-4xl font-bold text-slate-800">{tasks.filter(t => t.status === Status.IN_PROGRESS).length}</p>
          <p className="text-xs text-slate-400 mt-2">Currently being worked on</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
           <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-500">Completed</h3>
            <CheckCircle2 className="text-emerald-500" />
          </div>
          <p className="text-4xl font-bold text-slate-800">{tasks.filter(t => t.status === Status.COMPLETED).length}</p>
          <p className="text-xs text-slate-400 mt-2">Finished successfully</p>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-slate-800">Priority Items</h2>
          <button onClick={() => setCurrentView(ViewMode.TASKS)} className="text-sm text-indigo-600 font-medium hover:underline">View All</button>
        </div>
        <div className="grid grid-cols-1 gap-4">
           {tasks.filter(t => t.priority === Priority.HIGH && t.status !== Status.COMPLETED).slice(0, 3).map(task => (
             <TaskCard 
                key={task.id} 
                task={task} 
                onUpdateStatus={updateTaskStatus} 
                onEdit={(t) => { setEditingTask(t); setIsTaskModalOpen(true); }}
                onAddUpdate={addUpdateToTask}
              />
           ))}
           {tasks.filter(t => t.priority === Priority.HIGH && t.status !== Status.COMPLETED).length === 0 && (
             <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
               No high priority tasks pending. Good job!
             </div>
           )}
        </div>
      </div>
    </div>
  );

  const renderTasks = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Task Board</h2>
        <button 
          onClick={() => { setEditingTask(null); setIsTaskModalOpen(true); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus size={18} />
          New Task
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text" 
          placeholder="Search by ID, Source, or Description..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredTasks.map(task => (
          <TaskCard 
            key={task.id} 
            task={task} 
            onUpdateStatus={updateTaskStatus}
            onEdit={(t) => { setEditingTask(t); setIsTaskModalOpen(true); }}
            onAddUpdate={addUpdateToTask}
          />
        ))}
        {filteredTasks.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            No tasks found matching your search.
          </div>
        )}
      </div>
    </div>
  );

  const renderReport = () => (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
      <div className="text-center space-y-2 mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-purple-200">
          <Sparkles className="text-white" size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Weekly AI Summary</h2>
        <p className="text-slate-500">Generate a comprehensive progress report from your tracked tasks and logs.</p>
      </div>

      {!summary && (
        <div className="flex justify-center">
          <button 
            onClick={handleGenerateSummary}
            disabled={isGenerating}
            className="group relative flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-full font-semibold hover:bg-slate-800 transition-all shadow-xl hover:shadow-2xl disabled:opacity-70 disabled:cursor-not-allowed"
          >
             {isGenerating ? (
               <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyzing Progress...
               </>
             ) : (
               <>
                <Sparkles size={20} className="text-yellow-400 group-hover:scale-110 transition-transform" />
                Generate Report
               </>
             )}
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {summary && (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
             <h3 className="font-semibold text-slate-700">Generated Report</h3>
             <div className="flex gap-2">
               <button onClick={handleGenerateSummary} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                 Regenerate
               </button>
             </div>
          </div>
          <div className="p-8 prose prose-slate max-w-none">
            {/* Simple Markdown Rendering */}
            {summary.split('\n').map((line, i) => {
              if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold mt-6 mb-3 text-slate-800">{line.replace('## ', '')}</h2>;
              if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold mt-4 mb-2 text-slate-700">{line.replace('### ', '')}</h3>;
              if (line.startsWith('**')) return <strong key={i} className="block mt-4 mb-1 text-slate-800">{line.replace(/\*\*/g, '')}</strong>;
              if (line.startsWith('- ')) return <li key={i} className="ml-4 text-slate-600 mb-1">{line.replace('- ', '')}</li>;
              if (line.match(/^\d\./)) return <div key={i} className="font-semibold mt-4 text-indigo-900">{line}</div>
              return <p key={i} className="text-slate-600 mb-2 leading-relaxed">{line}</p>;
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans text-slate-900">
      
      {/* Sidebar Navigation (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 fixed h-full z-10">
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
            ProTrack AI
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setCurrentView(ViewMode.DASHBOARD)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === ViewMode.DASHBOARD ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button 
            onClick={() => setCurrentView(ViewMode.TASKS)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === ViewMode.TASKS ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <ListTodo size={20} /> Task Board
          </button>
          <button 
            onClick={() => setCurrentView(ViewMode.JOURNAL)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === ViewMode.JOURNAL ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <BookOpen size={20} /> Daily Journal
          </button>
          <button 
            onClick={() => setCurrentView(ViewMode.REPORT)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === ViewMode.REPORT ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Sparkles size={20} /> Weekly Report
          </button>
          <button 
            onClick={() => setCurrentView(ViewMode.HELP)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === ViewMode.HELP ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <HelpCircle size={20} /> User Manual
          </button>
        </nav>
        <div className="p-4 border-t border-slate-100">
          <button onClick={downloadData} className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 transition-colors w-full justify-center">
            <Download size={14} /> Backup Data (JSON)
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full bg-white border-b border-slate-200 z-20 px-4 py-3 flex justify-between items-center shadow-sm">
         <h1 className="text-xl font-bold text-indigo-600">ProTrack AI</h1>
         <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-600">
           {isMobileMenuOpen ? <X /> : <Menu />}
         </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-white z-10 pt-20 px-6 space-y-4 md:hidden animate-in slide-in-from-top-10">
           <button onClick={() => { setCurrentView(ViewMode.DASHBOARD); setIsMobileMenuOpen(false); }} className="w-full text-left py-3 border-b border-slate-100 text-lg font-medium">Dashboard</button>
           <button onClick={() => { setCurrentView(ViewMode.TASKS); setIsMobileMenuOpen(false); }} className="w-full text-left py-3 border-b border-slate-100 text-lg font-medium">Tasks</button>
           <button onClick={() => { setCurrentView(ViewMode.JOURNAL); setIsMobileMenuOpen(false); }} className="w-full text-left py-3 border-b border-slate-100 text-lg font-medium">Daily Journal</button>
           <button onClick={() => { setCurrentView(ViewMode.REPORT); setIsMobileMenuOpen(false); }} className="w-full text-left py-3 border-b border-slate-100 text-lg font-medium">AI Report</button>
           <button onClick={() => { setCurrentView(ViewMode.HELP); setIsMobileMenuOpen(false); }} className="w-full text-left py-3 border-b border-slate-100 text-lg font-medium">User Manual</button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 mt-14 md:mt-0 transition-all max-w-[1600px] mx-auto w-full">
        {currentView === ViewMode.DASHBOARD && renderDashboard()}
        {currentView === ViewMode.TASKS && renderTasks()}
        {currentView === ViewMode.JOURNAL && <DailyJournal tasks={tasks} logs={logs} onAddLog={addDailyLog} />}
        {currentView === ViewMode.REPORT && renderReport()}
        {currentView === ViewMode.HELP && <UserManual />}
      </main>

      {/* Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">{editingTask ? 'Edit Task' : 'Create New Task'}</h3>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <form onSubmit={handleCreateOrUpdateTask} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Source ID</label>
                  <input name="source" defaultValue={editingTask?.source} placeholder="e.g. CW02" className="w-full p-2 border border-slate-300 rounded-lg text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Display ID</label>
                  <input name="displayId" defaultValue={editingTask?.displayId} placeholder="e.g. P1130-28" className="w-full p-2 border border-slate-300 rounded-lg text-sm" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Description</label>
                <textarea name="description" defaultValue={editingTask?.description} rows={3} className="w-full p-2 border border-slate-300 rounded-lg text-sm" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Due Date</label>
                  <input type="date" name="dueDate" defaultValue={editingTask?.dueDate} className="w-full p-2 border border-slate-300 rounded-lg text-sm" required />
                </div>
                <div>
                   <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Priority</label>
                   <select name="priority" defaultValue={editingTask?.priority || Priority.MEDIUM} className="w-full p-2 border border-slate-300 rounded-lg text-sm">
                     <option value={Priority.HIGH}>High</option>
                     <option value={Priority.MEDIUM}>Medium</option>
                     <option value={Priority.LOW}>Low</option>
                   </select>
                </div>
              </div>
              <div>
                 <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Status</label>
                 <select name="status" defaultValue={editingTask?.status || Status.NOT_STARTED} className="w-full p-2 border border-slate-300 rounded-lg text-sm">
                   {Object.values(Status).map(s => <option key={s} value={s}>{s}</option>)}
                 </select>
              </div>
              
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsTaskModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">Save Task</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;