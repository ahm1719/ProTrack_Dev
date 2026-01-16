import React, { useState, useRef } from 'react';
import { Observation, ObservationStatus } from '../types';
import { StickyNote, Plus, Trash2, Edit2, X, Circle, Clock, CheckCircle2, ArrowRight, ArrowLeft, Image as ImageIcon, XCircle, Maximize2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface ObservationsLogProps {
  observations: Observation[];
  onAddObservation: (obs: Observation) => void;
  onEditObservation: (obs: Observation) => void;
  onDeleteObservation: (id: string) => void;
  columns?: string[];
  itemColors?: Record<string, string>;
}

const ObservationsLog: React.FC<ObservationsLogProps> = ({ 
    observations, 
    onAddObservation, 
    onEditObservation, 
    onDeleteObservation,
    columns = Object.values(ObservationStatus),
    itemColors = {}
}) => {
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<string>(columns[0] || ObservationStatus.NEW);
  const [images, setImages] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_DIMENSION = 800;
        if (width > height) {
          if (width > MAX_DIMENSION) { height *= MAX_DIMENSION / width; width = MAX_DIMENSION; }
        } else {
          if (height > MAX_DIMENSION) { width *= MAX_DIMENSION / height; height = MAX_DIMENSION; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setImages(prev => [...prev, dataUrl]);
        }
      };
      if (typeof e.target?.result === 'string') img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (blob) processImageFile(blob);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) Array.from(e.target.files).forEach(processImageFile);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => setImages(prev => prev.filter((_, i) => i !== index));

  const handleSubmit = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (!content.trim() && images.length === 0) return;
    if (editingId) {
      const original = observations.find(o => o.id === editingId);
      onEditObservation({ id: editingId, timestamp: original?.timestamp || new Date().toISOString(), content: content.trim(), status, images });
      setEditingId(null);
    } else {
      onAddObservation({ id: uuidv4(), timestamp: new Date().toISOString(), content: content.trim(), status, images });
    }
    setContent('');
    setImages([]);
    setStatus(columns[0] || ObservationStatus.NEW);
  };

  const handleEditClick = (obs: Observation) => {
    setEditingId(obs.id);
    setContent(obs.content);
    setStatus(obs.status);
    setImages(obs.images || []);
    document.getElementById('obs-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setContent('');
    setImages([]);
    setStatus(columns[0] || ObservationStatus.NEW);
  };

  const advanceStatus = (obs: Observation) => {
      const currentIndex = columns.indexOf(obs.status as any);
      if (currentIndex !== -1 && currentIndex < columns.length - 1) {
          onEditObservation({ ...obs, status: columns[currentIndex + 1] as any });
      }
  };

  const regressStatus = (obs: Observation) => {
      const currentIndex = columns.indexOf(obs.status as any);
      if (currentIndex > 0) onEditObservation({ ...obs, status: columns[currentIndex - 1] as any });
  };

  const getColumnHeaderStyle = (colName: string) => {
    const customColor = itemColors[colName];
    if (customColor) {
        return { backgroundColor: `${customColor}15`, color: customColor, borderColor: `${customColor}30` };
    }
    return { backgroundColor: '#f8fafc', color: '#64748b', borderColor: '#e2e8f0' };
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] animate-fade-in space-y-4 relative">
      {lightboxImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer" onClick={() => setLightboxImage(null)}>
          <div className="relative max-w-full max-h-full">
            <button className="absolute -top-10 right-0 text-white hover:text-red-400 transition-colors" onClick={() => setLightboxImage(null)}><X size={24} /></button>
            <img src={lightboxImage} alt="Full size" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
          </div>
        </div>
      )}

      <div className="flex-none space-y-4" id="obs-form">
        <div>
             <h1 className="text-2xl font-bold text-slate-900">Observations</h1>
             <p className="text-sm text-slate-500">Kanban board for feedback & notes.</p>
        </div>

        <div className={`bg-white p-4 rounded-xl border shadow-sm transition-all duration-300 ${editingId ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'}`}>
             <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    {editingId ? <Edit2 size={14}/> : <Plus size={14}/>}
                    {editingId ? 'Edit Card' : 'Add Card'}
                </h3>
                {editingId && (
                    <button onClick={handleCancelEdit} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded">Cancel</button>
                )}
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div className="flex flex-col md:flex-row gap-3">
                  <select 
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full md:w-48 p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 cursor-pointer h-10"
                  >
                      {columns.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <div className="flex-1 flex gap-2">
                      <div className="relative flex-1">
                        <textarea 
                            value={content} 
                            onChange={(e) => setContent(e.target.value)} 
                            onPaste={handlePaste} 
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    handleSubmit(e);
                                }
                            }}
                            placeholder="Describe observation... (Ctrl+Enter to save)" 
                            className="w-full p-3 pr-10 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-900 resize-none h-20 custom-scrollbar" 
                        />
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute right-2 bottom-2 text-slate-400 hover:text-indigo-600 p-1" title="Attach Image"><ImageIcon size={18} /></button>
                      </div>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileSelect} />
                      <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap h-20">{editingId ? 'Save' : 'Add'}</button>
                  </div>
                </div>
                {images.length > 0 && (
                  <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                    {images.map((img: string, idx: number) => (
                      <div key={idx} className="relative flex-shrink-0 group">
                        <img src={img} alt="Preview" className="h-16 w-16 object-cover rounded-lg border border-slate-200" />
                        <button type="button" onClick={() => removeImage(idx)} className="absolute -top-1.5 -right-1.5 bg-white text-red-500 rounded-full shadow-sm hover:scale-110 transition-transform"><XCircle size={16} fill="white" /></button>
                      </div>
                    ))}
                  </div>
                )}
            </form>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-x-auto">
        <div className="flex h-full gap-4 min-w-[800px] md:min-w-0 pb-2">
            {columns.map((colName) => {
                const colObs = observations.filter(o => o.status === colName);
                const headerStyle = getColumnHeaderStyle(colName);
                return (
                    <div key={colName} className="flex-1 flex flex-col bg-slate-100/50 rounded-xl border border-slate-200 overflow-hidden min-w-[250px]">
                        <div className="p-3 border-b flex items-center justify-between backdrop-blur-sm" style={headerStyle}>
                            <div className="flex items-center gap-2 font-bold text-sm">
                                <StickyNote size={16} />
                                {colName}
                            </div>
                            <span className="bg-white/60 px-2 py-0.5 rounded text-xs font-bold border border-white/40">{colObs.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                            {colObs.slice().reverse().map(obs => (
                                <div key={obs.id} className={`bg-white p-3 rounded-lg border shadow-sm group hover:shadow-md transition-all ${editingId === obs.id ? 'ring-2 ring-indigo-400 border-indigo-400' : 'border-slate-200'}`}>
                                    {obs.images && obs.images.length > 0 && (
                                      <div className="flex gap-2 mb-2 overflow-x-auto custom-scrollbar pb-1">
                                        {obs.images.map((img: string, i: number) => (
                                          <div key={i} className="relative flex-shrink-0 cursor-pointer hover:opacity-90" onClick={() => setLightboxImage(img)}>
                                            <img src={img} alt="Attachment" className="h-12 w-12 object-cover rounded-md border border-slate-100" />
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/20 rounded-md transition-opacity"><Maximize2 size={10} className="text-white drop-shadow-md" /></div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    <p className="text-sm text-slate-700 mb-2 leading-snug break-words whitespace-pre-wrap">{obs.content}</p>
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-50 mt-2">
                                        <span className="text-[10px] text-slate-400 font-mono">{new Date(obs.timestamp).toLocaleDateString()}</span>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEditClick(obs)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 transition-colors" title="Edit"><Edit2 size={12} /></button>
                                            <button onClick={() => onDeleteObservation(obs.id)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-600 transition-colors" title="Delete"><Trash2 size={12} /></button>
                                            <div className="flex items-center gap-1 ml-1 pl-1 border-l border-slate-100">
                                                {columns.indexOf(obs.status as any) > 0 && <button onClick={() => regressStatus(obs)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-amber-600 transition-colors" title="Move Back"><ArrowLeft size={12} /></button>}
                                                {columns.indexOf(obs.status as any) < columns.length - 1 && <button onClick={() => advanceStatus(obs)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-emerald-600 transition-colors" title="Move Next"><ArrowRight size={12} /></button>}
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