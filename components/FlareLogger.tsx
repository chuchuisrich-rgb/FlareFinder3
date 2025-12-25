
import React, { useState, useRef } from 'react';
import { db } from '../services/db';
import { FlareLog } from '../types';
import { Flame, MapPin, Frown, Save, X, Plus, Pencil, RotateCcw, CloudSun, Loader2, ShieldAlert, PhoneCall, ExternalLink } from 'lucide-react';

export const FlareLogger: React.FC = () => {
  const [severity, setSeverity] = useState(0);
  const [painLevel, setPainLevel] = useState(0);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [customLocation, setCustomLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Map state
  const [bodyPoints, setBodyPoints] = useState<{x: number, y: number}[]>([]);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [paths, setPaths] = useState<{x: number, y: number}[][]>([]);
  const [currentPath, setCurrentPath] = useState<{x: number, y: number}[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  
  const mapRef = useRef<HTMLDivElement>(null);

  const commonLocations = ["Armpit", "Groin", "Inner Thigh", "Under Breast", "Neck", "Back", "Buttocks", "Face"];

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

  const getCoordinates = (e: React.PointerEvent | React.MouseEvent) => {
    if (!mapRef.current) return { x: 0, y: 0 };
    const rect = mapRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isDrawingMode) return;
    
    e.preventDefault();
    setIsDrawing(true);
    const coords = getCoordinates(e);
    setCurrentPath([coords]);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawingMode || !isDrawing) return;
    
    e.preventDefault();
    const coords = getCoordinates(e);
    setCurrentPath(prev => [...prev, coords]);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDrawingMode) return;
    
    setIsDrawing(false);
    if (currentPath.length > 1) {
      setPaths(prev => [...prev, currentPath]);
    }
    setCurrentPath([]);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDrawingMode) return; // Ignore clicks in draw mode
    
    const { x, y } = getCoordinates(e);
    setBodyPoints([...bodyPoints, { x, y }]);
  };

  const removePoint = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setBodyPoints(bodyPoints.filter((_, i) => i !== index));
  };

  const clearMap = () => {
    setBodyPoints([]);
    setPaths([]);
    setCurrentPath([]);
  };

  const undoLastPath = () => {
    if (paths.length > 0) {
      setPaths(paths.slice(0, -1));
    }
  };

  const pointsToPath = (pts: {x: number, y: number}[]) => {
    if (pts.length === 0) return '';
    const start = pts[0];
    let d = `M ${start.x} ${start.y}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x} ${pts[i].y}`;
    }
    return d;
  };

  const fetchWeatherData = async (): Promise<{temperature: number, humidity: number} | undefined> => {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(undefined);
            return;
        }

        navigator.geolocation.getCurrentPosition(async (position) => {
            try {
                const { latitude, longitude } = position.coords;
                const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m&temperature_unit=fahrenheit`);
                const data = await response.json();
                
                if (data.current) {
                    resolve({
                        temperature: data.current.temperature_2m,
                        humidity: data.current.relative_humidity_2m
                    });
                } else {
                    resolve(undefined);
                }
            } catch (e) {
                console.error("Weather fetch failed", e);
                resolve(undefined);
            }
        }, (error) => {
            console.warn("Geolocation permission denied or error", error);
            resolve(undefined);
        });
    });
  };

  const handleSave = async () => {
    if (severity === 0) {
      alert("Please select a severity level");
      return;
    }
    
    setIsSaving(true);
    const weather = await fetchWeatherData();
    const finalLocations = [...selectedLocations];
    const locationString = finalLocations.join(', ');

    const log: FlareLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      severity,
      painLevel,
      location: locationString || "Unspecified",
      locations: finalLocations,
      bodyPoints,
      drawnPaths: paths,
      notes,
      weather
    };
    
    db.addFlareLog(log);
    
    setSeverity(0);
    setPainLevel(0);
    setSelectedLocations([]);
    setBodyPoints([]);
    setPaths([]);
    setNotes('');
    setIsSaving(false);
    alert(`Flare logged.${weather ? ` Weather recorded: ${weather.temperature}°F, ${weather.humidity}% humidity.` : ''}`);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Log Flare-up</h2>
        <div className="flex items-center gap-1 text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
            <CloudSun className="w-3 h-3" />
            <span>Auto-Weather</span>
        </div>
      </div>

      {/* EMERGENCY RED LINE LOGIC */}
      {severity === 5 && (
          <div className="bg-rose-600 text-white p-5 rounded-3xl shadow-2xl shadow-rose-200 border-4 border-rose-500 animate-pulse">
              <div className="flex items-start gap-4 mb-4">
                  <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                      <ShieldAlert className="w-8 h-8 text-white" />
                  </div>
                  <div>
                      <h3 className="text-xl font-black uppercase tracking-tight">Emergency Warning</h3>
                      <p className="text-sm font-bold opacity-90 leading-tight">Severity 5 requires immediate professional evaluation.</p>
                  </div>
              </div>
              <p className="text-xs font-medium mb-5 bg-black/10 p-3 rounded-xl border border-white/10">
                  If you have a fever, chills, spreading redness, or extreme pain, do not log this in the app. Please seek medical attention immediately.
              </p>
              <div className="grid grid-cols-2 gap-3">
                  <a 
                    href="tel:911" 
                    className="flex items-center justify-center gap-2 bg-white text-rose-600 py-3 rounded-xl font-black text-sm uppercase"
                  >
                      <PhoneCall className="w-4 h-4" /> Call 911
                  </a>
                  <button 
                    onClick={() => window.open('https://www.google.com/maps/search/emergency+room+near+me', '_blank')}
                    className="flex items-center justify-center gap-2 bg-rose-500 text-white border border-white/30 py-3 rounded-xl font-black text-sm uppercase"
                  >
                      <ExternalLink className="w-4 h-4" /> Find ER
                  </button>
              </div>
          </div>
      )}
      
      {/* Severity */}
      <div className={`bg-white p-5 rounded-2xl shadow-sm border transition-all duration-300 ${severity === 5 ? 'border-rose-300 ring-4 ring-rose-50' : 'border-slate-100'}`}>
        <div className="flex items-center gap-2 mb-4">
          <Flame className={`w-5 h-5 ${severity >= 4 ? 'text-rose-600' : 'text-rose-500'}`} />
          <h3 className="font-semibold text-slate-700">Severity (0-5)</h3>
        </div>
        <div className="flex justify-between gap-2 mb-3">
          {[0, 1, 2, 3, 4, 5].map((level) => (
            <button
              key={level}
              onClick={() => setSeverity(level)}
              className={`flex-1 aspect-square rounded-xl font-bold text-lg transition-all ${
                severity === level 
                ? level === 5 ? 'bg-rose-600 text-white shadow-lg shadow-rose-200 scale-105 animate-pulse' : 'bg-rose-500 text-white shadow-lg shadow-rose-200 scale-105' 
                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
        
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
            <div 
              className={`h-full transition-all duration-500 ease-out ${
                  severity === 0 ? 'w-0' : 
                  severity <= 2 ? 'bg-emerald-400' : 
                  severity <= 4 ? 'bg-orange-400' : 
                  'bg-rose-600 animate-pulse'
              }`}
              style={{ width: `${(severity / 5) * 100}%` }}
            />
        </div>

        <p className="text-xs text-center text-slate-400 font-bold uppercase tracking-widest mt-2">
            {severity === 5 ? 'STOP: Seek Help' : severity === 0 ? 'Baseline' : 'Flare Active'}
        </p>
      </div>

      {/* Body Map */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-700">
              {isDrawingMode ? 'Draw on Body' : 'Tap to Mark Points'}
            </h3>
          </div>
          <div className="flex gap-2">
             <button 
              onClick={() => setIsDrawingMode(!isDrawingMode)}
              className={`p-2 rounded-lg transition-colors ${isDrawingMode ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-500'}`}
              title={isDrawingMode ? "Switch to Tap Mode" : "Switch to Draw Mode"}
            >
              {isDrawingMode ? <MapPin className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
            </button>
            {isDrawingMode && (
              <button 
                onClick={undoLastPath}
                className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-700"
                title="Undo last line"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={clearMap}
              className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:text-rose-500"
              title="Clear all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div 
           className={`relative w-full max-w-[200px] mx-auto aspect-[1/2] bg-slate-50 rounded-xl border border-slate-100 overflow-hidden select-none ${isDrawingMode ? 'touch-none cursor-crosshair' : 'cursor-pointer'}`}
           ref={mapRef}
           onPointerDown={handlePointerDown}
           onPointerMove={handlePointerMove}
           onPointerUp={handlePointerUp}
           onPointerLeave={handlePointerUp}
           onClick={handleMapClick}
        >
          <svg viewBox="0 0 100 200" className="absolute inset-0 w-full h-full pointer-events-none">
            <path 
              d="M50,10 C55,10 60,15 60,22 C60,28 55,30 50,30 C45,30 40,28 40,22 C40,15 45,10 50,10 M50,30 C65,35 80,35 90,40 L90,90 C85,85 75,80 75,80 L75,120 L85,190 L60,190 L55,130 L45,130 L40,190 L15,190 L25,120 L25,80 C25,80 15,85 10,90 L10,40 C20,35 35,35 50,30 Z" 
              fill="#e2e8f0" 
              className="text-slate-200"
            />
            
            {paths.map((path, i) => (
              <path 
                key={i} 
                d={pointsToPath(path)} 
                stroke="rgba(244, 63, 94, 0.5)" 
                strokeWidth="3" 
                fill="none" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
            ))}
            
            {currentPath.length > 0 && (
              <path 
                d={pointsToPath(currentPath)} 
                stroke="rgba(244, 63, 94, 0.8)" 
                strokeWidth="3" 
                fill="none" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
            )}
          </svg>
          
          {bodyPoints.map((p, i) => (
            <div 
              key={i}
              className="absolute w-6 h-6 -ml-3 -mt-3 flex items-center justify-center animate-in fade-in zoom-in duration-200"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              onClick={(e) => removePoint(i, e)}
            >
              <div className="w-4 h-4 bg-rose-500 rounded-full border-2 border-white shadow-sm hover:scale-125 transition-transform" />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="font-semibold text-slate-700 mb-3">Location Tags</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {commonLocations.map(loc => (
            <button
              key={loc}
              onClick={() => toggleLocation(loc)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                selectedLocations.includes(loc) 
                ? 'bg-teal-500 text-white border-teal-500 shadow-md shadow-teal-100' 
                : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300 hover:bg-teal-50'
              }`}
            >
              {loc}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add custom location..."
            value={customLocation}
            onChange={(e) => setCustomLocation(e.target.value)}
            className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all text-sm"
          />
          <button 
            onClick={addCustomLocation}
            disabled={!customLocation}
            className="bg-slate-800 text-white p-3 rounded-xl disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <Frown className="w-5 h-5 text-indigo-500" />
          <h3 className="font-semibold text-slate-700">Pain Level (0-10): {painLevel}</h3>
        </div>
        <input 
          type="range" 
          min="0" 
          max="10" 
          value={painLevel} 
          onChange={(e) => setPainLevel(parseInt(e.target.value))}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
        />
        <div className="flex justify-between text-xs text-slate-400 mt-2">
          <span>No Pain</span>
          <span>Unbearable</span>
        </div>
      </div>

      <textarea
        placeholder="Any additional notes? (Stress, specific foods, clothing...)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="w-full p-4 bg-white border border-slate-200 rounded-2xl h-32 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 resize-none shadow-sm"
      />

      <button 
        onClick={handleSave}
        disabled={isSaving}
        className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-70 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-rose-200 transition-all flex items-center justify-center gap-2"
      >
        {isSaving ? (
             <>
               <Loader2 className="w-5 h-5 animate-spin" />
               Recording Context...
             </>
        ) : (
             <>
               <Save className="w-5 h-5" />
               Log Flare Status
             </>
        )}
      </button>
    </div>
  );
};
