import React, { useState } from 'react';
import { Observation, ObservationStatus } from '../types';
import { StickyNote, Plus, Trash2, Save, Edit2, X, Circle, Clock, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface ObservationsLogProps {
  observations: Observation[];
  onAddObservation: (obs: Observation) => void;
  onEditObservation: (obs: Observation) => void;
  onDeleteObservation: (id: string) => void;
}

const ObservationsLog: React.FC<ObservationsLogProps> = ({ observations, onAddObservation, onEditObservation, onDeleteObservation }) => {
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<ObservationStatus>(ObservationStatus.NEW);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    if (editingId) {
      // Find original to preserve timestamp
      const original = observations.find(o => o.id === editingId);
      onEditObservation({
        id: editingId,
        timestamp: original?.timestamp || new Date().toISOString(),
        content: content.trim(),
        status
      });
      setEditingId(null);
    } else {
      onAddObservation({
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        content: content.trim(),
        status
      });
    }
    
    // Reset Form
    setContent('');
    setStatus(ObservationStatus.NEW);
  };

  const handleEditClick = (obs: Observation) => {
    setEditingId(obs.id);
    setContent(obs.content);
    setStatus(obs.status);
    // No need to scroll if form is sticky or compact, but nice to have focus
    const formElement = document.getElementById('obs-form');
    if (formElement) formElement.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setContent('');
    setStatus(ObservationStatus.NEW);
  };

  // Helper to move card to next status
  const advanceStatus = (obs: Observation) => {
      let nextStatus = obs.status;
      if (obs.status === ObservationStatus.NEW) nextStatus = ObservationStatus.REVIEWING;
      else if (obs.status === ObservationStatus.REVIEWING) nextStatus = ObservationStatus.RESOLVED;
      
      if (nextStatus !== obs.status) {
          onEditObservation({ ...obs, status: nextStatus });
      }
  };

  // Helper to move card to previous status
  const regressStatus = (obs: Observation) => {
      let prevStatus = obs.status;
      if (obs.status === ObservationStatus.RESOLVED) prevStatus = ObservationStatus.REVIEWING;
      else if (obs.status === ObservationStatus.REVIEWING) prevStatus = ObservationStatus.NEW;
      
      if (prevStatus !== obs.status) {
          onEditObservation({ ...obs, status: prevStatus });
      }
  };

  const columns = [
    { status: ObservationStatus.NEW, label: 'New', icon: Circle, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { status: ObservationStatus.REVIEWING, label: 'WIP', icon: Clock, color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { status: ObservationStatus.RESOLVED, label: 'Resolved', icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] animate-fade-in space-y-4">
      
      {/* Header & Input - Fixed Height Area */}
      <div className="flex-none space-y-4" id="obs-form">
        <div className="flex items-center justify-between">
            <div>
                 <h1 className="text-2xl font-bold text-slate-900">Observations</h1>
                 <p className="text-sm text-slate-500">Kanban board for feedback & notes.</p>
            </div>
        </div>

        <div className={`bg-white p-4 rounded-xl border shadow-sm transition-all duration-300 ${editingId ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'}`}>
             <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    {editingId ? <Edit2 size={14}/> : <Plus size={14}/>}
                    {editingId ? 'Edit Card' : 'Add Card'}
                </h3>
                {editingId && (
                    <button onClick={handleCancelEdit} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded">
                        Cancel
                    </button>
                )}
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-3">
                <select 
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ObservationStatus)}
                    className="w-full md:w-48 p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 cursor-pointer"
                >
                    {Object.values(ObservationStatus).filter(s => s !== ObservationStatus.ARCHIVED).map(s => (
                    <option key={s} value={s}>{s}</option>
                    ))}
                </select>
                <div className="flex-1 flex gap-2">
                    <input
                        type="text"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Describe observation..."
                        className="flex-1 p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900"
                        required
                    />
                    <button
                        type="submit"
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                    >
                        {editingId ? 'Save Changes' : 'Add Card'}
                    </button>
                </div>
            </form>
        </div>
      </div>

      {/* Kanban Columns - Flex Grow to Fill Rest */}
      <div className="flex-1 min-h-0 overflow-x-auto">
        <div className="flex h-full gap-4 min-w-[800px] md:min-w-0 pb-2">
            {columns.map((col) => {
                const colObs = observations.filter(o => o.status === col.status);
                const Icon = col.icon;
                
                return (
                    <div key={col.status} className="flex-1 flex flex-col bg-slate-100/50 rounded-xl border border-slate-200 overflow-hidden min-w-[250px]">
                        {/* Column Header */}
                        <div className={`p-3 border-b border-slate-200 flex items-center justify-between ${col.color} bg-opacity-40 backdrop-blur-sm`}>
                            <div className="flex items-center gap-2 font-bold text-sm">
                                <Icon size={16} />
                                {col.label}
                            </div>
                            <span className="bg-white/60 px-2 py-0.5 rounded text-xs font-bold border border-slate-100">
                                {colObs.length}
                            </span>
                        </div>

                        {/* Drop Zone / List */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                            {colObs.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                                    <Icon size={24} className="opacity-20"/>
                                    <span className="text-xs italic">Empty</span>
                                </div>
                            )}
                            {colObs.slice().reverse().map(obs => (
                                <div 
                                    key={obs.id} 
                                    className={`bg-white p-3 rounded-lg border shadow-sm group hover:shadow-md transition-all ${editingId === obs.id ? 'ring-2 ring-indigo-400 border-indigo-400' : 'border-slate-200'}`}
                                >
                                    <p className="text-sm text-slate-700 mb-2 leading-snug break-words">{obs.content}</p>
                                    
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-50 mt-2">
                                        <span className="text-[10px] text-slate-400 font-mono">
                                            {new Date(obs.timestamp).toLocaleDateString()}
                                        </span>
                                        
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => handleEditClick(obs)}
                                                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 size={12} />
                                            </button>
                                            <button 
                                                onClick={() => onDeleteObservation(obs.id)}
                                                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-600 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                            
                                            {/* Action Buttons Container */}
                                            <div className="flex items-center gap-1 ml-1 pl-1 border-l border-slate-100">
                                                {obs.status !== ObservationStatus.NEW && (
                                                    <button 
                                                        onClick={() => regressStatus(obs)}
                                                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-amber-600 transition-colors"
                                                        title="Move Back"
                                                    >
                                                        <ArrowLeft size={12} />
                                                    </button>
                                                )}
                                                {obs.status !== ObservationStatus.RESOLVED && (
                                                    <button 
                                                        onClick={() => advanceStatus(obs)}
                                                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-emerald-600 transition-colors"
                                                        title="Move Next"
                                                    >
                                                        <ArrowRight size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
};

export default ObservationsLog;