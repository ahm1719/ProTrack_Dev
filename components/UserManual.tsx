import React from 'react';
import { LayoutDashboard, ListTodo, BookOpen, Sparkles, Download, Save, Server, Globe, Database, GitBranch, Smartphone, Wifi, AlertTriangle, CheckCircle2, XCircle, FileJson, HardDrive } from 'lucide-react';

const UserManual: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">User Manual & Guide</h1>
        <p className="text-slate-500 max-w-2xl mx-auto">
          Welcome to ProTrack AI. This comprehensive guide covers workflows, synchronization, and system limitations to help you get the most out of the tool.
        </p>
      </div>

      <div className="grid gap-8">
        {/* Section 1: Core Workflow */}
        <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <LayoutDashboard className="text-indigo-600" />
            Core Workflow
          </h2>
          <div className="space-y-4 text-slate-600 leading-relaxed">
            <p>
              ProTrack AI is built around a simple weekly workflow designed to save you time on reporting:
            </p>
            <ol className="list-decimal pl-5 space-y-2">
              <li><strong>Define Tasks:</strong> Set up your projects and deliverables in the <em>Task Board</em>.</li>
              <li><strong>Log Daily:</strong> Use the <em>Daily Journal</em> to jot down what you did each day. This is much faster than updating a spreadsheet cell.</li>
              <li><strong>Track Status:</strong> Update task status (In Progress, Completed) on the Task Board as you go.</li>
              <li><strong>Generate Report:</strong> At the end of the week, one click creates your formatted summary using AI.</li>
            </ol>
          </div>
        </section>

        {/* Section 2: Sync Guide */}
        <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-indigo-500">
           <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Smartphone className="text-indigo-600" />
            How to Sync Across Devices
          </h2>
          <div className="space-y-4 text-slate-600 leading-relaxed text-sm">
            <p>
              ProTrack AI allows you to work seamlessly between your Desktop, Laptop, and Mobile devices using Cloud Sync (Firebase). 
              Follow these steps to connect a new device to your account:
            </p>
            
            <div className="grid md:grid-cols-2 gap-6 mt-4">
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-3 border-b border-slate-200 pb-2">Step 1: Get Config from Main Device</h3>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>Open ProTrack on your primary computer (where your data currently exists).</li>
                        <li>Navigate to the <strong>Settings & Sync</strong> page via the sidebar.</li>
                        <li>Ensure the Cloud Sync status shows as <span className="text-emerald-600 font-bold text-xs bg-emerald-100 px-1.5 py-0.5 rounded">Connected</span>.</li>
                        <li>Scroll down to the <strong>Setup Mobile Sync</strong> box.</li>
                        <li>Click the <strong>Copy Config</strong> button. This copies your secure database keys to your clipboard.</li>
                        <li>Send this text to your second device (via email, Slack, WhatsApp, or a notes app).</li>
                    </ol>
                </div>

                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-3 border-b border-slate-200 pb-2">Step 2: Connect New Device</h3>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>Open ProTrack on your phone, tablet, or second computer.</li>
                        <li>Go to the <strong>Settings & Sync</strong> page.</li>
                        <li>Locate the large text box under "Firebase Configuration".</li>
                        <li>Paste the configuration text you copied from Step 1.</li>
                        <li>Click the purple <strong>Connect Cloud Sync</strong> button.</li>
                        <li>Wait for the confirmation. Your tasks and logs will download automatically!</li>
                    </ol>
                </div>
            </div>
             <div className="flex items-start gap-2 bg-blue-50 p-4 rounded-lg text-blue-800 text-xs mt-4">
                <Wifi size={16} className="mt-0.5 flex-shrink-0" />
                <p><strong>Note:</strong> Once connected, changes made on one device will appear on the other within seconds. You do not need to manually save.</p>
            </div>
          </div>
        </section>

        {/* Section 3: Limitations & Best Practices */}
        <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <AlertTriangle className="text-amber-500" />
            Limitations & Best Practices
          </h2>
           <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
              <div>
                  <h3 className="font-bold text-slate-700 mb-2">Data Storage & Images</h3>
                  <p className="text-sm text-slate-600 mb-2">
                      <strong>Observation Images:</strong> Images are stored directly inside the database document encoded as Base64 text.
                  </p>
                  <ul className="list-disc pl-5 text-xs text-slate-500 space-y-1">
                      <li><strong>Limitation:</strong> The cloud database has a strict limit of 1MB per document. Adding too many high-resolution images to a single observation card may prevent syncing.</li>
                      <li><strong>Best Practice:</strong> Use small screenshots or cropped images. Avoid uploading full-resolution photos from a phone camera. Delete images from "Resolved" observations if the app feels slow.</li>
                  </ul>
              </div>

               <div>
                  <h3 className="font-bold text-slate-700 mb-2">Offline vs. Online</h3>
                   <p className="text-sm text-slate-600 mb-2">
                      <strong>Local-First Architecture:</strong> The app runs primarily on your device's browser storage.
                  </p>
                  <ul className="list-disc pl-5 text-xs text-slate-500 space-y-1">
                      <li><strong>Limitation:</strong> If you clear your browser's "Site Data" or "Cache", you will lose any data that hasn't been synced to the cloud.</li>
                      <li><strong>Best Practice:</strong> Always keep Cloud Sync enabled (green status). Perform a manual JSON backup (Settings &gt; Manual Backup) once a week for extra safety.</li>
                  </ul>
              </div>

               <div>
                  <h3 className="font-bold text-slate-700 mb-2">AI Summary Quotas</h3>
                   <p className="text-sm text-slate-600 mb-2">
                      <strong>Gemini API:</strong> The reporting feature uses Google's Generative AI.
                  </p>
                  <ul className="list-disc pl-5 text-xs text-slate-500 space-y-1">
                      <li><strong>Limitation:</strong> Free API keys have rate limits (e.g., requests per minute). If you generate reports repeatedly in a short time, it may fail.</li>
                      <li><strong>Best Practice:</strong> Generate the summary once at the end of the week. If it fails, wait a minute and try again.</li>
                  </ul>
              </div>

              <div>
                  <h3 className="font-bold text-slate-700 mb-2">Conflict Resolution</h3>
                   <p className="text-sm text-slate-600 mb-2">
                      <strong>Simultaneous Edits:</strong>
                  </p>
                  <ul className="list-disc pl-5 text-xs text-slate-500 space-y-1">
                      <li><strong>Limitation:</strong> If two devices edit the <em>exact same task text</em> at the <em>exact same second</em>, the last save will overwrite the previous one.</li>
                      <li><strong>Best Practice:</strong> This tool is designed primarily for a single user syncing across their own devices, rather than a large team editing the same item simultaneously.</li>
                  </ul>
              </div>
           </div>
        </section>

        {/* Section 4: Features Breakdown */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <ListTodo size={20} className="text-blue-500"/> Task Management
            </h3>
            <p className="text-sm text-slate-600">
              Create tasks with Source IDs (e.g., CW02) and Display IDs. You can assign priorities and due dates. Use the search bar to quickly find tasks by any keyword.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <BookOpen size={20} className="text-emerald-500"/> Daily Journal
            </h3>
            <p className="text-sm text-slate-600">
              The heart of the automation. Select a task and write a quick note about your progress. These notes are automatically stamped with the date and linked to the task history.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <Sparkles size={20} className="text-purple-500"/> AI Summaries
            </h3>
            <p className="text-sm text-slate-600">
              The AI analyzes your <strong>Daily Logs</strong> and <strong>Task Updates</strong> from the current week. It filters out old data automatically to produce a "This Week" report.
            </p>
          </div>

           <div className="bg-white p-6 rounded-xl border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <Save size={20} className="text-orange-500"/> Auto-Save & Offline
            </h3>
            <p className="text-sm text-slate-600">
              Your data is saved instantly to your browser's local storage. You can close the tab and come back later. No internet is required except for generating the AI report.
            </p>
          </div>
        </div>

        {/* Section 5: Data Backup Detail */}
        <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 pb-6 mb-6">
            <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
                <FileJson className="text-indigo-600" />
                Data Backup & Recovery
            </h2>
            <p className="text-slate-600 text-sm">
                Since data is stored locally in your browser, performing regular backups is critical to prevent data loss if you clear your cache or change browsers.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
                <h3 className="text-sm font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                    <CheckCircle2 size={16} /> What is Backed Up
                </h3>
                <ul className="space-y-3 text-sm text-slate-600">
                    <li className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <div>
                            <strong className="text-slate-800">All Tasks:</strong>
                            <p className="text-xs text-slate-500">Every active, done, and archived task including IDs, descriptions, and deadlines.</p>
                        </div>
                    </li>
                    <li className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <div>
                            <strong className="text-slate-800">Task History:</strong>
                            <p className="text-xs text-slate-500">The complete timeline of comments, progress updates, and attachments linked to tasks.</p>
                        </div>
                    </li>
                    <li className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <div>
                            <strong className="text-slate-800">Daily Journal:</strong>
                            <p className="text-xs text-slate-500">All text entries made in the History & Calendar view.</p>
                        </div>
                    </li>
                    <li className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <div>
                            <strong className="text-slate-800">Observations:</strong>
                            <p className="text-xs text-slate-500">Kanban cards and their embedded images/screenshots.</p>
                        </div>
                    </li>
                    <li className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <div>
                            <strong className="text-slate-800">App Settings & Customization:</strong>
                            <p className="text-xs text-slate-500">Custom Status/Priority lists, custom colors, and Tags.</p>
                        </div>
                    </li>
                    <li className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <div>
                            <strong className="text-slate-800">Calendar Preferences:</strong>
                            <p className="text-xs text-slate-500">Days marked as "Off Days" in the calendar.</p>
                        </div>
                    </li>
                </ul>
            </div>

            <div className="space-y-4">
                <h3 className="text-sm font-black text-rose-700 uppercase tracking-widest flex items-center gap-2 bg-rose-50 p-2 rounded-lg border border-rose-100">
                    <XCircle size={16} /> What is NOT Backed Up
                </h3>
                <ul className="space-y-3 text-sm text-slate-600">
                    <li className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                        <div>
                            <strong className="text-slate-800">API Keys:</strong>
                            <p className="text-xs text-slate-500">Your Google Gemini and Firebase keys are excluded for security reasons.</p>
                        </div>
                    </li>
                </ul>
            </div>
          </div>
          
          <div className="mt-8 bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm flex items-start gap-3">
            <Download className="shrink-0 text-indigo-500 mt-0.5" size={18} />
            <div>
                <strong className="text-indigo-900 block mb-1">To Perform a Backup:</strong>
                <span className="text-slate-600">Go to <strong>Settings</strong> and scroll to the bottom. Click "Download Full System Backup (JSON)". Store this file in a secure location (e.g., Google Drive). To restore, simply upload this file using the "Restore" button next to it.</span>
            </div>
          </div>
        </section>

        {/* Section 6: Resource Health */}
        <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-rose-500">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <HardDrive className="text-rose-500" />
            Resource Health & Storage Limits
          </h2>
          <div className="space-y-4 text-slate-600 leading-relaxed text-sm">
            <p>
              To ensure fast and free cloud synchronization, ProTrack AI operates within specific data limits. 
              The <strong>Resource Health</strong> monitor in the Settings page helps you track your usage.
            </p>

            <div className="grid md:grid-cols-2 gap-6 mt-4">
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-3 border-b border-slate-200 pb-2">Reading the Bars</h3>
                    <ul className="list-disc pl-5 space-y-2">
                        <li><strong>Tasks Buffer:</strong> The storage space consumed by your task definitions, descriptions, and metadata.</li>
                        <li><strong>Logs Buffer:</strong> The space used by your daily journal entries and text history.</li>
                        <li><strong>Observations Buffer:</strong> The space taken by Kanban cards and—most importantly—attached images.</li>
                    </ul>
                </div>

                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-3 border-b border-slate-200 pb-2">Status Colors</h3>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-indigo-500 shrink-0"></div>
                            <span><strong>Healthy (Indigo):</strong> Usage is well within limits. Sync operates normally.</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-red-500 shrink-0"></div>
                            <span><strong>Critical (Red):</strong> Usage is over 85%. Cloud sync may fail if the limit (1MB) is reached.</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-rose-50 p-4 rounded-lg text-rose-800 text-xs mt-2 border border-rose-100">
                <strong>How to free up space?</strong>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>Use the <strong>Purge Inactive</strong> button in Settings to delete "Done" and "Archived" tasks permanently.</li>
                    <li>Delete old images from the "Resolved" column in Observations. Images take up the most space.</li>
                </ul>
            </div>
          </div>
        </section>

        {/* Section 7: System Architecture */}
        <section className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Server className="text-indigo-600" />
            System Architecture & Resources
          </h2>
          <p className="text-slate-600 mb-6 text-sm">
            ProTrack AI utilizes a modern stack to ensure your data is secure, accessible, and the application is always available.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {/* GitHub */}
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex flex-col items-center text-center p-5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:shadow-md transition-all group bg-slate-50 hover:bg-white"
            >
              <div className="p-3 bg-white border border-slate-200 text-slate-700 rounded-full mb-3 group-hover:bg-slate-800 group-hover:text-white transition-colors shadow-sm">
                <GitBranch size={24} />
              </div>
              <h3 className="font-bold text-slate-800 mb-1">GitHub</h3>
              <p className="text-xs text-slate-500 mb-3">Code Repository</p>
              <div className="text-[10px] text-slate-400 bg-white px-2 py-1 rounded border border-slate-100">
                Main Website Source
              </div>
            </a>

            {/* Vercel */}
            <a 
              href="https://vercel.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex flex-col items-center text-center p-5 rounded-xl border border-slate-200 hover:border-black hover:shadow-md transition-all group bg-slate-50 hover:bg-white"
            >
              <div className="p-3 bg-white border border-slate-200 text-slate-700 rounded-full mb-3 group-hover:bg-black group-hover:text-white transition-colors shadow-sm">
                <Globe size={24} />
              </div>
              <h3 className="font-bold text-slate-800 mb-1">Vercel</h3>
              <p className="text-xs text-slate-500 mb-3">Web Hosting</p>
              <div className="text-[10px] text-slate-400 bg-white px-2 py-1 rounded border border-slate-100">
                Website Host
              </div>
            </a>

            {/* Firebase */}
            <a 
              href="https://console.firebase.google.com/project/my-protrack-1693a/overview" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex flex-col items-center text-center p-5 rounded-xl border border-slate-200 hover:border-amber-500 hover:shadow-md transition-all group bg-slate-50 hover:bg-white"
            >
              <div className="p-3 bg-white border border-slate-200 text-slate-700 rounded-full mb-3 group-hover:bg-amber-500 group-hover:text-white transition-colors shadow-sm">
                <Database size={24} />
              </div>
              <h3 className="font-bold text-slate-800 mb-1">Firebase</h3>
              <p className="text-xs text-slate-500 mb-3">Cloud Database</p>
              <div className="text-[10px] text-slate-400 bg-white px-2 py-1 rounded border border-slate-100">
                Cloud Storage
              </div>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
};

export default UserManual;