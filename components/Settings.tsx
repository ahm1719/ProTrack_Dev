import React, { useRef, useState, useEffect } from 'react';
import { Download, Upload, Cloud, Check, Wifi, WifiOff, AlertTriangle, RefreshCw, Key, Eye, EyeOff, Copy, Smartphone, Sparkles, FileText, RotateCcw, Database, Trash2, ImageMinus, History, HardDrive, PieChart, ExternalLink } from 'lucide-react';
import { Task, DailyLog, Observation, FirebaseConfig, Status, ObservationStatus } from '../types';
import { initFirebase } from '../services/firebaseService';

interface SettingsProps {
  tasks: Task[];
  logs: DailyLog[];
  observations: Observation[];
  onImportData: (data: { tasks: Task[]; logs: DailyLog[]; observations: Observation[] }) => void;
  onSyncConfigUpdate: (config: FirebaseConfig | null) => void;
  isSyncEnabled: boolean;
}

// Configuration from user screenshot
const PRECONFIGURED_FIREBASE: FirebaseConfig = {
  apiKey: "AIzaSyAJI8MtMerFlg_5OX7j_sOY4PNW0fm3P8g",
  authDomain: "my-protrack-1693a.firebaseapp.com",
  projectId: "my-protrack-1693a",
  storageBucket: "my-protrack-1693a.firebasestorage.app",
  messagingSenderId: "558910554999",
  appId: "1:558910554999:web:76ca794413633d68df1772",
  measurementId: "G-D2SKT81MGL"
};

const getSizeInBytes = (obj: any) => {
    try {
        return new Blob([JSON.stringify(obj)]).size;
    } catch (e) {
        return 0;
    }
};

const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const Settings: React.FC<SettingsProps> = ({ tasks, logs, observations, onImportData, onSyncConfigUpdate, isSyncEnabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  // Default to the preconfigured JSON to make it easy for the user
  const [configJson, setConfigJson] = useState(JSON.stringify(PRECONFIGURED_FIREBASE, null, 2));
  const [configError, setConfigError] = useState<string | null>(null);
  const [needsReload, setNeedsReload] = useState(false);
  const [copied, setCopied] = useState(false);

  // Gemini Key State
  const [geminiKey, setGeminiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  // Custom Report Instruction State
  const [reportInstruction, setReportInstruction] = useState('');

  // Storage Stats
  const [storageStats, setStorageStats] = useState({
      totalSize: 0,
      tasksSize: 0,
      logsSize: 0,
      obsSize: 0,
      imageCount: 0
  });

  // Load existing config into text area if available (overrides default if they changed it)
  useEffect(() => {
    const savedConfig = localStorage.getItem('protrack_firebase_config');
    if (savedConfig) {
      setConfigJson(JSON.stringify(JSON.parse(savedConfig), null, 2));
    }
    
    const savedGeminiKey = localStorage.getItem('protrack_gemini_key');
    if (savedGeminiKey) {
      setGeminiKey(savedGeminiKey);
    }

    const savedInstruction = localStorage.getItem('protrack_report_instruction');
    if (savedInstruction) {
      setReportInstruction(savedInstruction);
    }
  }, []);

  // Update storage stats when data changes
  useEffect(() => {
     const tasksBytes = getSizeInBytes(tasks);
     const logsBytes = getSizeInBytes(logs);
     const obsBytes = getSizeInBytes(observations);
     // Rough estimation of full cloud payload including keys not in raw arrays
     const total = getSizeInBytes({ tasks, logs, observations, offDays: [] }); // offDays is small
     
     // Count images
     let imgs = 0;
     observations.forEach(o => { if (o.images) imgs += o.images.length; });

     setStorageStats({
         totalSize: total,
         tasksSize: tasksBytes,
         logsSize: logsBytes,
         obsSize: obsBytes,
         imageCount: imgs
     });
  }, [tasks, logs, observations]);

  const handleSaveGeminiKey = () => {
    localStorage.setItem('protrack_gemini_key', geminiKey);
    alert("API Key saved securely to your browser's local storage.");
  };

  const handleSaveInstruction = () => {
    localStorage.setItem('protrack_report_instruction', reportInstruction);
    alert("Report instruction saved.");
  };

  const handleResetInstruction = () => {
    setReportInstruction('');
    localStorage.removeItem('protrack_report_instruction');
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ tasks, logs, observations }, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadAnchorNode.setAttribute("download", `protrack_backup_${dateStr}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.tasks && json.logs) {
          onImportData({
            tasks: json.tasks || [],
            logs: json.logs || [],
            observations: json.observations || []
          });
          setImportStatus('success');
          setTimeout(() => setImportStatus('idle'), 3000);
        } else {
          throw new Error("Invalid file format");
        }
      } catch (err) {
        setImportStatus('error');
        setTimeout(() => setImportStatus('idle'), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConnectFirebase = () => {
    setConfigError(null);
    setNeedsReload(false);
    try {
      // Allow user to paste just the object or the whole JS snippet, we try to extract the JSON
      let cleanJson = configJson;
      // Heuristic to clean up JS assignment if user pastes "const firebaseConfig = { ... };"
      if (cleanJson.includes('=')) {
        cleanJson = cleanJson.substring(cleanJson.indexOf('{'), cleanJson.lastIndexOf('}') + 1);
      }
      // Remove trailing commas which are valid in JS but not JSON
      cleanJson = cleanJson.replace(/,\s*}/g, '}'); 
      // Quote unquoted keys (basic attempt)
      cleanJson = cleanJson.replace(/(\s*?{\s*?|\s*?,\s*?)(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '$1"$3":');
      // Fix single quotes to double quotes
      cleanJson = cleanJson.replace(/(\s*)'([^']*)'(\s*)/g, '$1"$2"$3');

      const config = JSON.parse(cleanJson) as FirebaseConfig;
      
      if (!config.apiKey || !config.projectId) {
        throw new Error("Invalid Config: Missing apiKey or projectId");
      }

      // Test Connection
      initFirebase(config);
      
      // If we get here without throwing, success
      localStorage.setItem('protrack_firebase_config', JSON.stringify(config));
      onSyncConfigUpdate(config);

    } catch (err: any) {
      console.error(err);
      setConfigError(err.message || "Invalid JSON format");
      if (err.message && err.message.includes("Version Mismatch")) {
        setNeedsReload(true);
      }
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem('protrack_firebase_config');
    onSyncConfigUpdate(null);
    setConfigJson(JSON.stringify(PRECONFIGURED_FIREBASE, null, 2));
  };

  const copyConfigForMobile = () => {
      navigator.clipboard.writeText(configJson).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      });
  };

  // Cleanup Actions
  const cleanArchivedTasks = () => {
      const activeTasks = tasks.filter(t => t.status !== Status.ARCHIVED);
      const activeTaskIds = new Set(activeTasks.map(t => t.id));
      // Also clean logs associated with deleted tasks
      const keptLogs = logs.filter(l => activeTaskIds.has(l.taskId));
      
      if (confirm(`This will permanently delete ${tasks.length - activeTasks.length} archived tasks and their logs. This cannot be undone.`)) {
          onImportData({ tasks: activeTasks, logs: keptLogs, observations });
      }
  };

  const cleanOldLogs = () => {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const cutoff = ninetyDaysAgo.toISOString().split('T')[0];
      
      const keptLogs = logs.filter(l => l.date >= cutoff);
      const removedCount = logs.length - keptLogs.length;

      if (confirm(`This will permanently delete ${removedCount} logs older than 90 days. This cannot be undone.`)) {
          onImportData({ tasks, logs: keptLogs, observations });
      }
  };

  const cleanResolvedImages = () => {
      const cleanedObs = observations.map(o => {
          if (o.status === ObservationStatus.RESOLVED) {
              return { ...o, images: [] };
          }
          return o;
      });
      if (confirm("This will remove all images attached to 'Resolved' observations to save space. Text content will remain.")) {
          onImportData({ tasks, logs, observations: cleanedObs });
      }
  };

  // Limits
  const FIRESTORE_DOC_LIMIT = 1048576; // 1 MB
  const LOCAL_STORAGE_SOFT_LIMIT = 5242880; // 5 MB

  const usagePercentCloud = Math.min((storageStats.totalSize / FIRESTORE_DOC_LIMIT) * 100, 100);
  const usagePercentLocal = Math.min((storageStats.totalSize / LOCAL_STORAGE_SOFT_LIMIT) * 100, 100);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">Settings & Synchronization</h1>
        <p className="text-slate-500 max-w-2xl mx-auto">
          Configure real-time sync, manage local backups, and set API keys.
        </p>
      </div>

      <div className="grid gap-8">
        {/* Gemini API Key Section */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-purple-50">
             <div className="p-2 rounded-lg bg-purple-200 text-purple-700">
               <Key size={24} />
             </div>
             <div>
               <h2 className="text-lg font-bold text-slate-800">AI Report Configuration</h2>
               <p className="text-xs text-slate-500">Required for Weekly Summary generation.</p>
             </div>
          </div>
          <div className="p-6 space-y-6">
            <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Gemini API Key</label>
                <div className="flex gap-2">
                <div className="relative flex-1">
                    <input 
                    type={showKey ? "text" : "password"}
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="Enter your Google GenAI API Key..."
                    className="w-full pl-4 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                    <button 
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                    {showKey ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                </div>
                <button 
                    onClick={handleSaveGeminiKey}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    Save Key
                </button>
                </div>
                <p className="text-xs text-slate-400 mt-2 flex justify-between items-center">
                   <span>Get a key at <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">Google AI Studio</a>.</span>
                   <span className="flex items-center gap-1 text-slate-500"><Sparkles size={12} /> Free Tier: 15 req/min, 1M tokens/min</span>
                </p>
            </div>

            <div className="pt-6 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                   <label className="block text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                      <FileText size={14} /> Custom Report Instruction
                   </label>
                   <button 
                     onClick={handleResetInstruction}
                     className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                     title="Reset to default"
                   >
                     <RotateCcw size={12} /> Reset Default
                   </button>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                   Override the default prompt structure. E.g., "Translate to German", "Use bullet points only", or "Focus on potential risks".
                </p>
                <textarea 
                    value={reportInstruction}
                    onChange={(e) => setReportInstruction(e.target.value)}
                    placeholder="Enter custom instructions for the AI report generation..."
                    className="w-full h-32 p-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-y bg-slate-50"
                />
                <div className="flex justify-end mt-2">
                    <button 
                    onClick={handleSaveInstruction}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                    Save Instruction
                    </button>
                </div>
            </div>
          </div>
        </section>

        {/* Cloud Sync Section */}
        <section className={`bg-white rounded-2xl border ${isSyncEnabled ? 'border-emerald-200 shadow-emerald-100' : 'border-slate-200'} shadow-sm overflow-hidden`}>
          <div className={`p-6 border-b ${isSyncEnabled ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'} flex justify-between items-center`}>
            <div className="flex items-center gap-3">
               <div className={`p-2 rounded-lg ${isSyncEnabled ? 'bg-emerald-200 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                 <Cloud size={24} />
               </div>
               <div>
                 <h2 className="text-lg font-bold text-slate-800">Cloud Sync (Firebase)</h2>
                 <p className="text-xs text-slate-500">Sync across Laptop, PC, and Mobile instantly.</p>
               </div>
            </div>
            <div className="flex items-center gap-2">
              {isSyncEnabled ? (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200">
                  <Wifi size={14} /> Connected
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-bold border border-slate-200">
                  <WifiOff size={14} /> Offline
                </span>
              )}
            </div>
          </div>

          <div className="p-6 space-y-4">
             {/* Diagnostic Info */}
             <div className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded border border-slate-100">
                <span className="text-slate-500">Status Check:</span>
                <div className="flex gap-3">
                    <span className="font-mono">Tasks: {tasks.length}</span>
                    <span className="font-mono">Logs: {logs.length}</span>
                </div>
             </div>

             {!isSyncEnabled ? (
               <>
                 <div className="text-sm text-slate-600 bg-blue-50 p-4 rounded-xl border border-blue-100">
                   <strong>Setup:</strong> We have pre-loaded your configuration from the screenshot. Just click Connect below.
                 </div>
                 
                 <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Firebase Configuration</label>
                    <textarea 
                      value={configJson}
                      onChange={(e) => setConfigJson(e.target.value)}
                      placeholder={'{ "apiKey": "...", "authDomain": "...", ... }'}
                      className="w-full h-48 p-4 font-mono text-xs border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-900 text-emerald-400"
                    />
                    {configError && (
                      <div className="mt-3 space-y-2">
                        <p className="text-red-500 text-xs flex items-center gap-1"><AlertTriangle size={12}/> {configError}</p>
                        {needsReload && (
                          <button 
                            onClick={() => window.location.reload()}
                            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                          >
                            <RefreshCw size={12} /> Reload Page to Apply Fix
                          </button>
                        )}
                      </div>
                    )}
                 </div>

                 <button 
                  onClick={handleConnectFirebase}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-200"
                 >
                   Connect Cloud Sync
                 </button>
               </>
             ) : (
               <div className="space-y-6">
                  <div className="text-center py-2 space-y-4">
                      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                        <Check size={32} strokeWidth={3} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">Synchronization Active</h3>
                        <p className="text-sm text-slate-500">Your data is automatically backing up to the cloud.</p>
                      </div>
                      <button 
                        onClick={handleDisconnect}
                        className="text-sm text-red-500 hover:text-red-700 hover:underline"
                      >
                        Disconnect & Stop Sync
                      </button>
                  </div>

                  {/* Mobile Setup Helper */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                     <div className="flex justify-between items-center mb-2">
                        <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                            <Smartphone size={16} /> Setup Mobile Sync
                        </h4>
                        <button 
                            onClick={copyConfigForMobile}
                            className="text-xs bg-white border border-slate-300 hover:border-indigo-500 px-3 py-1 rounded-md flex items-center gap-1 transition-colors"
                        >
                            {copied ? <Check size={12} className="text-emerald-500"/> : <Copy size={12}/>}
                            {copied ? 'Copied!' : 'Copy Config'}
                        </button>
                     </div>
                     <p className="text-xs text-slate-500 mb-2">
                         Paste this configuration into the Settings page on your mobile device to sync data.
                     </p>
                     <div className="relative">
                         <div className="absolute inset-0 bg-slate-100/50 backdrop-blur-[1px] flex items-center justify-center z-10">
                            <span className="text-xs font-semibold text-slate-500 bg-white px-2 py-1 rounded shadow-sm border border-slate-200">Hidden for security (Click Copy above)</span>
                         </div>
                         <pre className="text-[10px] bg-slate-800 text-slate-400 p-2 rounded h-16 overflow-hidden">
                             {configJson}
                         </pre>
                     </div>
                  </div>
               </div>
             )}
          </div>
        </section>

        {/* Storage & Quotas Section */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-blue-50">
                 <div className="p-2 rounded-lg bg-blue-200 text-blue-700">
                   <HardDrive size={24} />
                 </div>
                 <div>
                   <h2 className="text-lg font-bold text-slate-800">Storage & Quotas</h2>
                   <p className="text-xs text-slate-500">Manage local resources and cloud limits.</p>
                 </div>
             </div>
             
             <div className="p-6 space-y-8">
                 <div className="grid md:grid-cols-2 gap-8">
                     {/* Cloud Limit */}
                     <div className="space-y-3">
                         <div className="flex justify-between items-end">
                            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <Cloud size={16} /> Cloud Sync Document
                            </h3>
                            <span className={`text-xs font-mono font-bold ${usagePercentCloud > 90 ? 'text-red-500' : 'text-slate-500'}`}>
                                {formatBytes(storageStats.totalSize)} / 1 MB
                            </span>
                         </div>
                         <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                             <div 
                                className={`h-2.5 rounded-full transition-all duration-500 ${usagePercentCloud > 90 ? 'bg-red-500' : usagePercentCloud > 70 ? 'bg-amber-500' : 'bg-indigo-500'}`} 
                                style={{ width: `${usagePercentCloud}%` }}
                             />
                         </div>
                         <p className="text-[10px] text-slate-400">
                             Firebase Firestore (Free Tier) limits individual documents to 1MB. If you exceed this, sync will fail.
                         </p>
                     </div>

                     {/* Local Storage Limit */}
                     <div className="space-y-3">
                         <div className="flex justify-between items-end">
                            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <Database size={16} /> Browser Storage
                            </h3>
                            <span className={`text-xs font-mono font-bold ${usagePercentLocal > 90 ? 'text-red-500' : 'text-slate-500'}`}>
                                {formatBytes(storageStats.totalSize)} / ~5 MB
                            </span>
                         </div>
                         <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                             <div 
                                className={`h-2.5 rounded-full transition-all duration-500 ${usagePercentLocal > 90 ? 'bg-red-500' : usagePercentLocal > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                                style={{ width: `${usagePercentLocal}%` }}
                             />
                         </div>
                         <p className="text-[10px] text-slate-400">
                             Browser LocalStorage typically allows 5-10MB per site.
                         </p>
                     </div>
                 </div>

                 {/* Breakdown */}
                 <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center justify-between text-xs text-slate-600">
                      <div className="flex items-center gap-2"><PieChart size={14}/> <strong>Breakdown:</strong></div>
                      <div>Tasks: <strong>{formatBytes(storageStats.tasksSize)}</strong></div>
                      <div>Logs: <strong>{formatBytes(storageStats.logsSize)}</strong></div>
                      <div>Observations: <strong>{formatBytes(storageStats.obsSize)}</strong> ({storageStats.imageCount} images)</div>
                 </div>

                 {/* Cleanup Tools */}
                 <div className="border-t border-slate-100 pt-6">
                     <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <RefreshCw size={16} className="text-slate-400" /> Resource Cleaner
                     </h3>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button 
                            onClick={cleanArchivedTasks}
                            className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-slate-200 hover:border-red-200 hover:bg-red-50 transition-all group"
                        >
                            <Trash2 size={20} className="text-slate-400 group-hover:text-red-500" />
                            <div className="text-center">
                                <span className="block text-xs font-bold text-slate-700 group-hover:text-red-700">Purge Archived Tasks</span>
                                <span className="block text-[10px] text-slate-400">Delete permanently</span>
                            </div>
                        </button>

                        <button 
                             onClick={cleanOldLogs}
                            className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-slate-200 hover:border-amber-200 hover:bg-amber-50 transition-all group"
                        >
                            <History size={20} className="text-slate-400 group-hover:text-amber-500" />
                            <div className="text-center">
                                <span className="block text-xs font-bold text-slate-700 group-hover:text-amber-700">Prune Old Logs</span>
                                <span className="block text-[10px] text-slate-400">Older than 90 days</span>
                            </div>
                        </button>

                        <button 
                            onClick={cleanResolvedImages}
                            className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50 transition-all group"
                        >
                            <ImageMinus size={20} className="text-slate-400 group-hover:text-blue-500" />
                            <div className="text-center">
                                <span className="block text-xs font-bold text-slate-700 group-hover:text-blue-700">Strip Resolved Images</span>
                                <span className="block text-[10px] text-slate-400">Keep text, remove pics</span>
                            </div>
                        </button>
                     </div>
                 </div>
             </div>
        </section>

        {/* Manual Backup Section */}
        <div className="grid md:grid-cols-2 gap-8 pt-4 border-t border-slate-200">
          {/* Export Section */}
          <div className="flex flex-col items-center text-center p-6 bg-slate-50 rounded-xl">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm text-slate-600">
               <Download size={20} />
            </div>
            <h3 className="font-bold text-slate-800 mb-1">Manual Backup</h3>
            <p className="text-xs text-slate-500 mb-4">Download a local JSON copy.</p>
            <button 
              onClick={handleExport}
              className="w-full py-2 bg-white border border-slate-300 hover:border-indigo-500 text-slate-700 hover:text-indigo-600 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              Download File
            </button>
          </div>

          {/* Import Section */}
          <div className="flex flex-col items-center text-center p-6 bg-slate-50 rounded-xl">
             <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm text-slate-600">
               <Upload size={20} />
            </div>
            <h3 className="font-bold text-slate-800 mb-1">Restore Backup</h3>
            <p className="text-xs text-slate-500 mb-4">Overwrite current data from file.</p>
            <input 
              type="file" 
              accept=".json" 
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2 bg-white border border-slate-300 hover:border-emerald-500 text-slate-700 hover:text-emerald-600 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              Select File
            </button>
             {importStatus === 'success' && <p className="text-xs text-emerald-600 mt-2 font-bold">Restore Successful!</p>}
             {importStatus === 'error' && <p className="text-xs text-red-600 mt-2 font-bold">Invalid File!</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;