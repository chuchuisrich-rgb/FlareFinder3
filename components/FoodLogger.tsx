
import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, Loader2, CheckCircle, AlertCircle, Plus, Flame, Leaf, HelpCircle, Utensils, ArrowRight, Sparkles, Clock, Calendar, Trash2, X, ThumbsUp, ThumbsDown, Check, Edit2, Keyboard, FlaskConical, AlertTriangle, ShieldCheck, ScanBarcode, ShoppingCart, ListPlus, Activity, ChefHat, Droplet, Save, ShieldAlert, Shield, SearchX } from 'lucide-react';
import { analyzeFoodImage, processVoiceCommand, simulateMealImpact, scanGroceryProduct } from '../services/geminiService';
import { db } from '../services/db';
import { FoodLog, FoodItem, SimulationResult, ShoppingListItem } from '../types';
import { VoiceRecorder } from './VoiceRecorder';

export const FoodLogger: React.FC = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<Partial<FoodLog> | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [history, setHistory] = useState<FoodLog[]>([]);
  const [manualAddInput, setManualAddInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [confirmedIndices, setConfirmedIndices] = useState<Set<number>>(new Set());
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [mode, setMode] = useState<'meal' | 'grocery'>('meal');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    const state = db.getState();
    const sorted = [...(state.foodLogs || [])].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    setHistory(sorted);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, action: 'log' | 'simulate' | 'scan' = 'log') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const rawBase64 = reader.result as string;
      setImagePreview(rawBase64);
      const dataPayload = rawBase64.split(',')[1];
      
      if (action === 'simulate') runSimulation(dataPayload);
      else if (action === 'scan') processGroceryScan(dataPayload);
      else processImage(dataPayload);
    };
    reader.readAsDataURL(file);
  };

  const processImage = async (base64: string) => {
    setIsAnalyzing(true);
    setSimulationResult(null); 
    setConfirmedIndices(new Set()); 
    setEditingLogId(null);
    setMode('meal');
    const user = db.getState().user;
    try {
      const result = await analyzeFoodImage(base64, "image/jpeg", user);
      if (result) setAnalysisResult(result);
      else throw new Error("AI returned no results.");
    } catch (err) {
      console.error(err);
      alert("Analysis failed. Please try a clearer photo.");
      resetForm();
    } finally {
      setIsAnalyzing(false);
    }
  };

  const processGroceryScan = async (base64: string) => {
    setIsAnalyzing(true);
    setMode('grocery');
    const user = db.getState().user;
    try {
      const result = await scanGroceryProduct(base64, "image/jpeg", user);
      if (result) setAnalysisResult(result);
    } catch (err) {
      console.error(err);
      alert("Grocery scan failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runSimulation = async (base64: string) => {
    setIsSimulating(true);
    const user = db.getState().user;
    if (!user) return;
    try {
      const result = await simulateMealImpact(base64, "image/jpeg", user);
      setSimulationResult(result);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleTextAnalysis = async (text: string) => {
    if (!text.trim()) return;
    setTextInput('');
    setIsAnalyzing(true);
    const user = db.getState().user;
    try {
      const result = await processVoiceCommand(text, user);
      if (result.foodLogs?.length) setAnalysisResult(result.foodLogs[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startEdit = (log: FoodLog) => {
    setAnalysisResult(log);
    setImagePreview(log.imageUrl || null);
    setEditingLogId(log.id);
    setMode(log.isGroceryScan ? 'grocery' : 'meal');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeItem = (index: number) => {
    if (!analysisResult?.detectedItems) return;
    const newItems = analysisResult.detectedItems.filter((_, i) => i !== index);
    setAnalysisResult({ ...analysisResult, detectedItems: newItems });
  };

  const handleSave = () => {
    if (!analysisResult?.detectedItems?.length) return;
    const log: FoodLog = {
      id: editingLogId || crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      imageUrl: imagePreview || undefined,
      detectedItems: analysisResult.detectedItems as FoodItem[],
      isGroceryScan: mode === 'grocery'
    };
    if (editingLogId) db.updateFoodLog(log);
    else db.addFoodLog(log);
    resetForm();
    loadHistory();
  };

  const resetForm = () => {
    setImagePreview(null);
    setAnalysisResult(null);
    setSimulationResult(null);
    setIsAnalyzing(false);
    setIsSimulating(false);
    setEditingLogId(null);
  };

  const getMealVerdict = () => {
    if (!analysisResult?.detectedItems || analysisResult.detectedItems.length === 0) return null;
    const items = analysisResult.detectedItems;
    
    // Check ingredient levels
    let maxLevel = 'low';
    items.forEach(item => {
        if (item.sensitivityAlert?.level === 'high') maxLevel = 'high';
        else if (item.sensitivityAlert?.level === 'medium' && maxLevel !== 'high') maxLevel = 'medium';
        
        item.ingredientAnalysis?.forEach(ing => {
            if (ing.safetyLevel === 'high') maxLevel = 'high';
            else if (ing.safetyLevel === 'medium' && maxLevel !== 'high') maxLevel = 'medium';
        });
    });

    if (maxLevel === 'high') return { label: 'AVOID', color: 'bg-rose-600', text: 'Critical Trigger Detected', icon: <ShieldAlert className="w-5 h-5" /> };
    if (maxLevel === 'medium') return { label: 'CAUTION', color: 'bg-amber-500', text: 'Contains Potential Triggers', icon: <AlertTriangle className="w-5 h-5" /> };
    return { label: 'SAFE', color: 'bg-emerald-600', text: 'Safe for your condition', icon: <ShieldCheck className="w-5 h-5" /> };
  };

  const renderIngredientAnalysis = (item: FoodItem) => {
    const analysis = item.ingredientAnalysis || [];
    
    return (
      <div className="mt-4 space-y-4">
        {/* The surgical list of what was actually found */}
        <div className="space-y-2">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <FlaskConical className="w-3 h-3" /> Detected Component Analysis
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {analysis.length > 0 ? (
                  analysis.map((ing, i) => (
                    <div key={i} className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex flex-col gap-0.5 shadow-sm transition-all ${
                        ing.safetyLevel === 'high' ? 'bg-rose-50 border-rose-200 text-rose-700 shadow-rose-100' :
                        ing.safetyLevel === 'medium' ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-amber-100' :
                        'bg-emerald-50 border-emerald-100 text-emerald-700 shadow-emerald-50'
                    }`}>
                      <span className="flex items-center gap-1">
                          {ing.safetyLevel === 'high' && <X className="w-3 h-3" />}
                          {ing.safetyLevel === 'medium' && <AlertTriangle className="w-3 h-3" />}
                          {ing.safetyLevel === 'safe' && <Check className="w-3 h-3" />}
                          {ing.name}
                      </span>
                      {ing.reason && <span className="opacity-70 font-medium text-[9px] leading-tight">{ing.reason}</span>}
                    </div>
                  ))
              ) : (
                  item.ingredients?.map((name, i) => (
                      <span key={i} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-medium border border-slate-200">{name}</span>
                  ))
              )}
            </div>
        </div>

        {/* The overall reasoning for the item */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <h5 className="text-[10px] font-bold text-slate-400 uppercase mb-1">AI Reasoning</h5>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">{item.reasoning}</p>
        </div>
      </div>
    );
  };

  if (isAnalyzing || isSimulating) {
    return (
        <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-300">
            <div className="relative mb-8">
                <div className="absolute inset-0 bg-teal-200 rounded-full blur-2xl animate-pulse opacity-50"></div>
                <Loader2 className="w-20 h-20 text-teal-500 animate-spin relative z-10" />
                <Sparkles className="w-8 h-8 text-purple-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Dismantling Meal...</h2>
            <p className="text-slate-400 text-sm mt-3 font-medium text-center px-8">Identifying constituent ingredients and checking for biological triggers.</p>
        </div>
    );
  }

  if (analysisResult) {
    const verdict = getMealVerdict();
    const items = analysisResult.detectedItems || [];

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-300">
                <div className="bg-slate-100 p-6 rounded-full mb-6">
                    <SearchX className="w-12 h-12 text-slate-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Scan Inconclusive</h2>
                <p className="text-slate-500 text-center px-10 mt-2 text-sm leading-relaxed">
                    The AI couldn't clearly identify ingredients. Please try taking a photo with better lighting or enter the meal details manually.
                </p>
                <button onClick={resetForm} className="mt-8 bg-slate-900 text-white px-8 py-3 rounded-xl font-bold">Try Again</button>
            </div>
        );
    }

    return (
      <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-800">Meal Analysis</h2>
            <button onClick={resetForm} className="p-2 bg-slate-100 rounded-full text-slate-500"><X className="w-5 h-5" /></button>
        </div>

        {verdict && (
            <div className={`${verdict.color} text-white p-5 rounded-3xl shadow-xl shadow-slate-200 flex items-center justify-between relative overflow-hidden`}>
                <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                <div className="flex items-center gap-4 relative z-10">
                    <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">{verdict.icon}</div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Biological Verdict</span>
                        <p className="text-xl font-black tracking-tight">{verdict.label}: {verdict.text}</p>
                    </div>
                </div>
            </div>
        )}

        {imagePreview && (
          <div className="rounded-3xl overflow-hidden shadow-lg aspect-video bg-slate-100 border-4 border-white">
             <img src={imagePreview} alt="Analysis" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="space-y-5">
          {items.map((item, idx) => (
             <div key={idx} className={`bg-white p-6 rounded-3xl shadow-sm border-2 transition-all ${
                 item.sensitivityAlert?.level === 'high' || item.ingredientAnalysis?.some(i => i.safetyLevel === 'high') ? 'border-rose-200 bg-rose-50/10' : 
                 item.sensitivityAlert?.level === 'medium' || item.ingredientAnalysis?.some(i => i.safetyLevel === 'medium') ? 'border-amber-200 bg-amber-50/10' : 
                 'border-slate-100'
             }`}>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="font-black text-xl text-slate-800 leading-none mb-1">{item.name}</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.category}</span>
                            <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
                            <span className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">{item.ingredients?.length || 0} Components</span>
                        </div>
                    </div>
                </div>
                
                {renderIngredientAnalysis(item as FoodItem)}

                <div className="flex gap-2 mt-6">
                    <button onClick={() => removeItem(idx)} className="flex-1 py-3 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all">Discard Item</button>
                </div>
             </div>
          ))}
        </div>
        
        <button onClick={handleSave} className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black text-xl shadow-2xl shadow-slate-300 transform active:scale-95 transition-all">Archive Log & Bio-Twin</button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="space-y-6">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">New Food Log</h2>
        <div className="grid grid-cols-2 gap-4">
          <label className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] aspect-square flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-teal-400 hover:bg-teal-50 transition-all group shadow-sm">
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileChange(e, 'log')} />
            <div className="bg-teal-100 p-6 rounded-3xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm shadow-teal-100"><Camera className="w-10 h-10 text-teal-600" /></div>
            <span className="font-black text-slate-700 text-xs uppercase tracking-widest">Analyze Meal</span>
          </label>
           <label className="bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-[2.5rem] aspect-square flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-indigo-400 hover:bg-indigo-100 transition-all group shadow-sm">
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileChange(e, 'scan')} />
            <div className="bg-white p-6 rounded-3xl group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300 shadow-sm shadow-indigo-100"><ScanBarcode className="w-10 h-10 text-indigo-600" /></div>
            <span className="font-black text-slate-700 text-xs uppercase tracking-widest">Label Scan</span>
          </label>
        </div>
        <div className="bg-white p-2.5 rounded-[1.5rem] border border-slate-200 shadow-sm flex items-center gap-3 pr-2 focus-within:ring-2 focus-within:ring-teal-500/20 transition-all">
            <input 
                type="text" 
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTextAnalysis(textInput)}
                placeholder="Describe your meal manually..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-semibold text-slate-700 focus:outline-none px-4"
            />
            <button onClick={() => handleTextAnalysis(textInput)} className="p-4 bg-slate-900 text-white rounded-[1.2rem] shadow-lg shadow-slate-200 transform active:scale-95 transition-all"><ArrowRight className="w-5 h-5" /></button>
        </div>
      </div>
      
      <div className="space-y-5">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Clock className="w-4 h-4" /> Recent History
        </h3>
        <div className="space-y-4">
          {history.length === 0 ? (
              <div className="bg-white p-10 rounded-3xl border border-dashed border-slate-200 text-center">
                  <p className="text-slate-400 text-xs font-bold">No history yet.</p>
              </div>
          ) : (
            history.slice(0, 10).map((log) => (
                <div key={log.id} onClick={() => startEdit(log)} className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 flex gap-4 cursor-pointer hover:border-teal-200 hover:shadow-md transition-all group">
                   <div className="w-20 h-20 bg-slate-100 rounded-2xl overflow-hidden flex-shrink-0 border border-slate-50">
                      {log.imageUrl ? <img src={log.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /> : <Utensils className="w-8 h-8 m-auto text-slate-300" />}
                   </div>
                   <div className="flex-1 py-1">
                      <h4 className="font-black text-slate-800 text-base leading-tight">{(log.detectedItems || []).map(i => i.name).join(', ')}</h4>
                      <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-wider">{new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      <div className="flex gap-1.5 mt-2">
                          {log.detectedItems?.slice(0, 3).map((item, i) => (
                              <span key={i} className={`w-1.5 h-1.5 rounded-full ${item.sensitivityAlert?.level === 'high' ? 'bg-rose-500' : item.sensitivityAlert?.level === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                          ))}
                      </div>
                   </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
};
