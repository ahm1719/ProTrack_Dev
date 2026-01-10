import React from 'react';
import { LayoutDashboard, ListTodo, BookOpen, Sparkles, Download, Save } from 'lucide-react';

const UserManual: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">User Manual & Guide</h1>
        <p className="text-slate-500 max-w-2xl mx-auto">
          Welcome to ProTrack AI. This tool is designed to replace your Excel tracker with a modern, intelligent, and offline-capable application.
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

        {/* Section 2: Features Breakdown */}
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

        {/* Section 3: Data Safety */}
        <section className="bg-slate-50 p-6 rounded-xl border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
            <Download size={20} className="text-slate-600"/> Data Backup
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            Since data is stored in your browser, clearing your cache will delete your tasks. 
            <strong> We highly recommend performing a weekly backup.</strong>
          </p>
          <div className="bg-white p-4 rounded-lg border border-slate-200 text-sm">
            <strong>How to Backup:</strong> Click the "Backup Data (JSON)" button in the sidebar. This downloads a file to your computer.
            <br/><br/>
            <em>(Note: Restore functionality can be added in future updates).</em>
          </div>
        </section>
      </div>
    </div>
  );
};

export default UserManual;