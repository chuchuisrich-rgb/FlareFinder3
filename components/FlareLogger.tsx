
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { FlareLog } from '../types';
import { Flame, MapPin, Frown, Save, X, Plus, Clock, RotateCcw, CloudSun, Loader2, ShieldAlert, PhoneCall, ExternalLink, Thermometer, Droplets, StickyNote, ChevronRight, Trash2, ArrowLeft, History } from 'lucide-react';

export const FlareLogger: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [severity, setSeverity] = useState(0);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [customLocation, setCustomLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<FlareLog[]>([]);
  
  const commonLocations = ["Armpit", "Groin", "Inner Thigh", "Under Breast", "Neck", "Back", "Buttocks", "Face"];

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    const state = db.getState();
    const sorted = [...(state.flareLogs || [])].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    setHistory(sorted);
  };

  const toggleLocation = (loc: string) => {
    if (selectedLocations.includes(loc)) {
      setSelectedLocations(selectedLocations.filter(l => l !== loc));
    } else {
      setSelectedLocations([...selectedLocations, loc]);
    }
  };

  const addCustomLocation = () => {
    if (customLocation && !selectedLocations.includes(customLocation)) {
      setSelectedLocations([...selectedLocations, customLocation]);
      setCustomLocation('');
    }
  };

  const handleDeleteLog = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Delete this record permanently?")) {
        db.deleteFlareLog(id);
        loadHistory();
    }
  };

  const fetchWeatherData = async (): Promise<{temperature: number, humidity: number} | undefined> => {
    return new Promise((resolve) => {
        if (!navigator.geolocation) { resolve(undefined); return; }
        navigator.geolocation.getCurrentPosition(async (position) => {
            try {
                const { latitude, longitude } = position.coords;
                const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m&temperature_unit=fahrenheit`);
                const data = await response.json();
                if (data.current) resolve({ temperature: data.current.temperature_2m, humidity: data.current.relative_humidity_2m });
                else resolve(undefined);
            } catch (e) { resolve(undefined); }
        }, () => resolve(undefined));
    });
  };

  const handleSave = async () => {
    if (severity === 0) { alert("Please select severity"); return; }
    setIsSaving(true);
    const weather = await fetchWeatherData();
    const finalLocations = [...selectedLocations];
    const log: FlareLog = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36),
      timestamp: new Date().toISOString(),
      severity,
      location: finalLocations.join(', ') || "Unspecified",
      locations: finalLocations,
      notes,
      weather
    };
    db.addFlareLog(log);
    resetForm();
    loadHistory();
  };

  const resetForm = () => {
    setSeverity(0);
    setSelectedLocations([]);
    setNotes('');
    setIsSaving(false);
    setShowForm(false);
  };

  const getSeverityColor = (level: number) => {
    if (level <= 2) return 'bg-emerald-500';
    if (level <= 4) return 'bg-orange-500';
    return 'bg-rose-600';
  };

  if (showForm) {
    return (
      <div className="space-y-8 pb-24 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-4">
              <button onClick={() => setShowForm(false)} className="p-2 bg-slate-100 rounded-full text-slate-500"><ArrowLeft className="w-5 h-5" /></button>
              <h2 className="text-2xl font-black text-slate-800">Log Activity</h2>
          </div>
          <div className="space-y-6">
            <div className={`bg-white p-6 rounded-[2.5rem] shadow-sm border-2 transition-all ${severity === 5 ? 'border-rose-300 ring-4 ring-rose-50' : 'border-slate-100'}`}>
                <h3 className="font-black text-slate-800 uppercase tracking-widest text-[10px] mb-4">Severity (1-5)</h3>
                <div className="flex justify-between gap-2.5">
                {[1, 2, 3, 4, 5].map((level) => (
                    <button key={level} onClick={() => setSeverity(level)} className={`flex-1 aspect-square rounded-2xl font-black text-lg transition-all ${severity === level ? 'bg-rose-500 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>{level}</button>
                ))}
                </div>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100">
                <h3 className="font-black text-slate-800 uppercase tracking-widest text-[10px] mb-4">Locations</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                {commonLocations.map(loc => (
                    <button key={loc} onClick={() => toggleLocation(loc)} className={`px-4 py-2 rounded-xl text-xs font-bold border-2 ${selectedLocations.includes(loc) ? 'bg-teal-500 text-white border-teal-500' : 'bg-white text-slate-500 border-slate-100'}`}>{loc}</button>
                ))}
                </div>
                <div className="flex gap-2">
                <input type="text" placeholder="Other..." value={customLocation} onChange={(e) => setCustomLocation(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCustomLocation()} className="flex-1 p-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm text-slate-900" />
                <button onClick={addCustomLocation} className="bg-slate-900 text-white px-6 rounded-2xl"><Plus /></button>
                </div>
            </div>
            <textarea placeholder="Any additional notes or observations?" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-6 bg-white border border-slate-100 rounded-[2.5rem] h-32 outline-none text-slate-600 font-medium" />
            <button onClick={handleSave} disabled={isSaving} className="w-full bg-slate-900 text-white py-5 rounded-[2.5rem] font-black text-xl shadow-xl active:scale-95 transition-all">
                {isSaving ? <Loader2 className="animate-spin m-auto" /> : 'Commit Flare Entry'}
            </button>
          </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Flare Bio-Diary</h2>
        <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
            <History className="w-3 h-3" /> <span>Archive</span>
        </div>
      </div>
      <button 
        onClick={() => setShowForm(true)} 
        className="w-full bg-white border-2 border-dashed border-slate-200 p-8 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 group hover:border-rose-400 hover:bg-rose-50 transition-all shadow-sm"
      >
          <div className="bg-rose-500 text-white p-4 rounded-3xl shadow-lg shadow-rose-200 group-hover:scale-110 transition-transform">
              <Plus className="w-8 h-8" />
          </div>
          <span className="font-black text-slate-700 text-sm uppercase tracking-widest">Log New Flare</span>
      </button>
      <div className="space-y-5">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">Recent Inflammation Events</h3>
        <div className="space-y-4">
          {history.length === 0 ? (
              <div className="bg-white p-12 rounded-[2.5rem] border border-dashed border-slate-200 text-center">
                  <Flame className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">History is Empty</p>
              </div>
          ) : (
            history.map((log) => (
                <div key={log.id} className="bg-white rounded-[2.5rem] p-6 border border-slate-100 relative group overflow-visible shadow-sm hover:shadow-md transition-all">
                  <button 
                    type="button"
                    onClick={(e) => handleDeleteLog(e, log.id)} 
                    className="absolute top-6 right-6 p-3 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all z-[60] shadow-sm active:scale-90"
                    title="Delete Record"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <div className="pr-14">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-3 py-1 rounded-full text-[11px] font-black text-white ${getSeverityColor(log.severity)}`}>SEVERITY {log.severity}</span>
                      {log.weather && <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-full">{Math.round(log.weather.temperature)}°F • {log.weather.humidity}% Humidity</span>}
                    </div>
                    <h4 className="font-black text-slate-800 text-lg leading-tight">{log.locations?.length ? log.locations.join(', ') : log.location}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1.5 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {log.notes && (
                        <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                             <p className="text-xs text-slate-500 font-medium italic leading-relaxed">"{log.notes}"</p>
                        </div>
                    )}
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
};
