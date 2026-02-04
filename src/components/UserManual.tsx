
import React from 'react';
import { LayoutDashboard, ListTodo, BookOpen, Sparkles, Download, Save, Server, Globe, Database, GitBranch, Smartphone, Wifi, AlertTriangle } from 'lucide-react';

const UserManual: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">User Manual & Guide</h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
          Welcome to ProTrack AI. This comprehensive guide covers workflows, synchronization, and system limitations to help you get the most out of the tool.
        </p>
      </div>

      <div className="grid gap-8">
        {/* Section 1: Core Workflow */}
        <section className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <LayoutDashboard className="text-indigo-600 dark:text-indigo-400" />
            Core Workflow
          </h2>
          <div className="space-y-4 text-slate-600 dark:text-slate-400 leading-relaxed">
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
        <section className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm border-l-4 border-l-indigo-500">
           <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <Smartphone className="text-indigo-600 dark:text-indigo-400" />
            How to Sync Across Devices
          </h2>
          <div className="space-y-4 text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
            <p>
              ProTrack AI allows you to work seamlessly between your Desktop, Laptop, and Mobile devices using Cloud Sync (Firebase). 
              Follow these steps to connect a new device to your account:
            </p>
            
            <div className="grid md:grid-cols-2 gap-6 mt-4">
                <div className="bg-slate-50 dark:bg-slate-700/50 p-5 rounded-xl border border-slate-200 dark:border-slate-600">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 border-b border-slate-200 dark:border-slate-600 pb-2">Step 1: Get Config from Main Device</h3>
                    <ol className="list-decimal pl-5 space-y-2">
                        <li>Open ProTrack on your primary computer (where your data currently exists).</li>
                        <li>Navigate to the <strong>Settings & Sync</strong> page via the sidebar.</li>
                        <li>Ensure the Cloud Sync status shows as <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">Connected</span>.</li>
                        <li>Scroll down to the <strong>Setup Mobile Sync</strong> box.</li>
                        <li>Click the <strong>Copy Config</strong> button. This copies your secure database keys to your clipboard.</li>
                        <li>Send this text to your second device (via email, Slack, WhatsApp, or a notes app).</li>
                    </ol>
                </div>

                <div className="bg-slate-50 dark:bg-slate-700/50 p-5 rounded-xl border border-slate-200 dark:border-slate-600">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 border-b border-slate-200 dark:border-slate-600 pb-2">Step 2: Connect New Device</h3>
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
             <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-blue-800 dark:text-blue-300 text-xs mt-4">
                <Wifi size={16} className="mt-0.5 flex-shrink-0" />
                <p><strong>Note:</strong> Once connected, changes made on one device will appear on the other within seconds. You do not need to manually save.</p>
            </div>
          </div>
        </section>

        {/* Section 3: Limitations & Best Practices */}
        <section className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm border-l-4 border-l-amber-500">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
            <AlertTriangle className="text-amber-500" />
            Limitations & Best Practices
          </h2>
           <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
              <div>
                  <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-2">Data Storage & Images</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                      <strong>Observation Images:</strong> Images are stored directly inside the database document encoded as Base64 text.
                  </p>
                  <ul className="list-disc pl-5 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                      <li><strong>Limitation:</strong> The cloud database has a strict limit of 1MB per document. Adding too many high-resolution images to a single observation card may prevent syncing.</li>
                      <li><strong>Best Practice:</strong> Use small screenshots or cropped images. Avoid uploading full-resolution photos from a phone camera. Delete images from "Resolved" observations if the app feels slow.</li>
                  </ul>
              </div>

               <div>
                  <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-2">Offline vs. Online</h3>
                   <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                      <strong>Local-First Architecture:</strong> The app runs primarily on your device's browser storage.
                  </p>
                  <ul className="list-disc pl-5 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                      <li><strong>Limitation:</strong> If you clear your browser's "Site Data" or "Cache", you will lose any data that hasn't been synced to the cloud.</li>
                      <li><strong>Best Practice:</strong> Always keep Cloud Sync enabled (green status). Perform a manual JSON backup (Settings &gt; Manual Backup) once a week for extra safety.</li>
                  </ul>
              </div>

               <div>
                  <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-2">AI Summary Quotas</h3>
                   <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                      <strong>Gemini API:</strong> The reporting feature uses Google's Generative AI.
                  </p>
                  <ul className="list-disc pl-5 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                      <li><strong>Limitation:</strong> Free API keys have rate limits (e.g., requests per minute). If you generate reports repeatedly in a short time, it may fail.</li>
                      <li><strong>Best Practice:</strong> Generate the summary once at the end of the week. If it fails, wait a minute and try again.</li>
                  </ul>
              </div>

              <div>
                  <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-2">Conflict Resolution</h3>
                   <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                      <strong>Simultaneous Edits:</strong>
                  </p>
                  <ul className="list-disc pl-5 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                      <li><strong>Limitation:</strong> If two devices edit the <em>exact same task text</em> at the <em>exact same second</em>, the last save will overwrite the previous one.</li>
                      <li><strong>Best Practice:</strong> This tool is designed primarily for a single user syncing across their own devices, rather than a large team editing the same item simultaneously.</li>
                  </ul>
              </div>
           </div>
        </section>

        {/* Section 4: Features Breakdown */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
              <ListTodo size={20} className="text-blue-500"/> Task Management
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Create tasks with Source IDs (e.g., CW02) and Display IDs. You can assign priorities and due dates. Use the search bar to quickly find tasks by any keyword.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
              <BookOpen size={20} className="text-emerald-500"/> Daily Journal
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              The heart of the automation. Select a task and write a quick note about your progress. These notes are automatically stamped with the date and linked to the task history.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
              <Sparkles size={20} className="text-purple-500"/> AI Summaries
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              The AI analyzes your <strong>Daily Logs</strong> and <strong>Task Updates</strong> from the current week. It filters out old data automatically to produce a "This Week" report.
            </p>
          </div>

           <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
              <Save size={20} className="text-orange-500"/> Auto-Save & Offline
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Your data is saved instantly to your browser's local storage. You can close the tab and come back later. No internet is required except for generating the AI report.
            </p>
          </div>
        </div>

        {/* Section 5: Data Safety */}
        <section className="bg-slate-50 dark:bg-slate-700/30 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
            <Download size={20} className="text-slate-600 dark:text-slate-400"/> Data Backup
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Since data is stored in your browser, clearing your cache will delete your tasks. 
            <strong> We highly recommend performing a weekly backup.</strong>
          </p>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-600 text-sm dark:text-slate-300">
            <strong>How to Backup:</strong> Click the "Backup Data (JSON)" button in the Settings page. This downloads a file to your computer.
            <br/><br/>
            <strong>How to Restore:</strong> Use the "Restore Backup" button in Settings to load a previously saved JSON file.
          </div>
        </section>

        {/* Section 6: System Architecture */}
        <section className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <Server className="text-indigo-600 dark:text-indigo-400" />
            System Architecture & Resources
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
            ProTrack AI utilizes a modern stack to ensure your data is secure, accessible, and the application is always available.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {/* GitHub */}
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex flex-col items-center text-center p-5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:shadow-md transition-all group bg-slate-50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-800"
            >
              <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-full mb-3 group-hover:bg-slate-800 dark:group-hover:bg-slate-700 group-hover:text-white transition-colors shadow-sm">
                <GitBranch size={24} />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">GitHub</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Code Repository</p>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-100 dark:border-slate-700">
                Main Website Source
              </div>
            </a>

            {/* Vercel */}
            <a 
              href="https://vercel.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex flex-col items-center text-center p-5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-black dark:hover:border-white hover:shadow-md transition-all group bg-slate-50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-800"
            >
              <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-full mb-3 group-hover:bg-black dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-black transition-colors shadow-sm">
                <Globe size={24} />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Vercel</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Web Hosting</p>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-100 dark:border-slate-700">
                Website Host
              </div>
            </a>

            {/* Firebase */}
            <a 
              href="https://console.firebase.google.com/project/my-protrack-1693a/overview" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex flex-col items-center text-center p-5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-500 hover:shadow-md transition-all group bg-slate-50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-800"
            >
              <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-full mb-3 group-hover:bg-amber-500 group-hover:text-white transition-colors shadow-sm">
                <Database size={24} />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Firebase</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Cloud Database</p>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-100 dark:border-slate-700">
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
