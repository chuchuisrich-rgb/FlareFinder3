
import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, Loader2, CheckCircle, AlertCircle, Plus, Flame, Leaf, HelpCircle, Utensils, ArrowRight, Sparkles, Clock, Calendar, Trash2, X, ThumbsUp, ThumbsDown, Check, Edit2, Keyboard, FlaskConical, AlertTriangle, ShieldCheck, ScanBarcode, ShoppingCart, ListPlus, Activity, ChefHat, Droplet, Save, ShieldAlert, Shield, SearchX, Zap } from 'lucide-react';
import { analyzeFoodImage, processVoiceCommand, simulateMealImpact, scanGroceryProduct, enrichManualFoodItem } from '../services/geminiService';
import { db } from '../services/db';
import { FoodLog, FoodItem, SimulationResult, ShoppingListItem } from '../types';
import { VoiceRecorder } from './VoiceRecorder';

// Utility to compress images to save localStorage space
const compressImage = (base64Str: string, maxWidth = 1024, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
  });
};

export const FoodLogger: React.FC = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<Partial<FoodLog> | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [history, setHistory] = useState<FoodLog[]>([]);
  const [manualAddInput, setManualAddInput] = useState('');
  const [isEnrichingManual, setIsEnrichingManual] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [mode, setMode] = useState<'meal' | 'grocery'>('meal');
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (analysisResult?.detectedItems && analysisResult.detectedItems.length > 0) {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [analysisResult?.detectedItems?.length]);

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
      
      // Compress immediately before processing/storing
      const compressed = await compressImage(rawBase64);
      setImagePreview(compressed);
      
      const dataPayload = compressed.split(',')[1];
      
      if (action === 'simulate') runSimulation(dataPayload);
      else if (action === 'scan') processGroceryScan(dataPayload);
      else processImage(dataPayload);
    };
    reader.readAsDataURL(file);
  };

  const processImage = async (base64: string) => {
    setIsAnalyzing(true);
    setSimulationResult(null); 
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

  const handleManualItemAdd = async () => {
      const itemToEnrich = manualAddInput.trim();
      if (!itemToEnrich) return;
      
      setIsEnrichingManual(true);
      setManualAddInput(''); 

      const user = db.getState().user;
      if (!user) return;

      try {
          const enrichedItem = await enrichManualFoodItem(itemToEnrich, user);
          // Use functional state update to prevent losing items when adding quickly
          setAnalysisResult(prev => {
              const currentItems = prev?.detectedItems || [];
              return {
                  ...prev,
                  detectedItems: [...currentItems, enrichedItem],
                  timestamp: prev?.timestamp || new Date().toISOString()
              };
          });
      } catch (err) {
          console.error(err);
          const genericItem: FoodItem = {
              name: itemToEnrich,
              category: 'Other',
              ingredients: [],
              confidence: 1,
              reasoning: 'Manually added by user.',
              nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 }
          };
          setAnalysisResult(prev => ({
              ...prev,
              detectedItems: [...(prev?.detectedItems || []), genericItem],
              timestamp: prev?.timestamp || new Date().toISOString()
          }));
      } finally {
          setIsEnrichingManual(false);
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
    setAnalysisResult(prev => {
        if (!prev?.detectedItems) return prev;
        return {
            ...prev,
            detectedItems: prev.detectedItems.filter((_, i) => i !== index)
        };
    });
  };

  const handleSave = async () => {
    if (!analysisResult?.detectedItems?.length || isEnrichingManual) return;
    setIsSavingStatus(true);
    
    // Minimal UI delay for perceived performance
    await new Promise(r => setTimeout(r, 400));

    const log: FoodLog = {
      id: editingLogId || crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      imageUrl: imagePreview || undefined,
      detectedItems: analysisResult.detectedItems as FoodItem[],
      isGroceryScan: mode === 'grocery'
    };
    
    let success = false;
    if (editingLogId) success = db.updateFoodLog(log);
    else success = db.addFoodLog(log);
    
    if (success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        resetForm();
        loadHistory();
    } else {
        alert("SAVE FAILED: Your storage is full. Please go to Settings and purge old data.");
    }
    setIsSavingStatus(false);
  };

  const resetForm = () => {
    setImagePreview(null);
    setAnalysisResult(null);
    setSimulationResult(null);
    setIsAnalyzing(false);
    setIsSimulating(false);
    setEditingLogId(null);
    setManualAddInput('');
  };

  const calculateTotalCalories = () => {
      if (!analysisResult?.detectedItems) return 0;
      return analysisResult.detectedItems.reduce((acc, item) => acc + (item.nutrition?.calories || 0), 0);
  };

  const getMealVerdict = () => {
    if (!analysisResult?.detectedItems || analysisResult.detectedItems.length === 0) return null;
    const items = analysisResult.detectedItems;
    
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
        <div className="space-y-2">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                <span className="flex items-center gap-1"><FlaskConical className="w-3 h-3" /> Component Analysis</span>
                {item.nutrition?.calories !== undefined && <span className="text-teal-600 flex items-center gap-0.5"><Zap className="w-3 h-3" /> {item.nutrition.calories} kcal</span>}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {analysis.length > 0 ? (
                  analysis.map((ing, i) => (
                    <div key={i} className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex flex-col gap-0.5 shadow-sm transition-all ${
                        ing.safetyLevel === 'high' ? 'bg-rose-50 border-rose-200 text-rose-700' :
                        ing.safetyLevel === 'medium' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                        'bg-emerald-50 border-emerald-100 text-emerald-700'
                    }`}>
                      <span className="flex items-center gap-1">
                          {ing.safetyLevel === 'high' && <X className="w-3 h-3" />}
                          {ing.safetyLevel === 'medium' && <AlertTriangle className="w-3 h-3" />}
                          {ing.safetyLevel === 'safe' && <Check className="w-3 h-3" />}
                          {ing.name}
                      </span>
                    </div>
                  ))
              ) : (
                  item.ingredients?.map((name, i) => (
                      <span key={i} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-medium border border-slate-200">{name}</span>
                  ))
              )}
            </div>
        </div>

        {item.nutrition && (
            <div className="grid grid-cols-4 gap-2 text-[10px] font-bold">
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                    <p className="text-slate-400 uppercase mb-0.5">Prot</p>
                    <p className="text-slate-700">{item.nutrition.protein || 0}g</p>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                    <p className="text-slate-400 uppercase mb-0.5">Carb</p>
                    <p className="text-slate-700">{item.nutrition.carbs || 0}g</p>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                    <p className="text-slate-400 uppercase mb-0.5">Fat</p>
                    <p className="text-slate-700">{item.nutrition.fat || 0}g</p>
                </div>
                <div className="bg-teal-50 p-2 rounded-lg border border-teal-100 text-center">
                    <p className="text-teal-500 uppercase mb-0.5">Kcal</p>
                    <p className="text-teal-700">{item.nutrition.calories || 0}</p>
                </div>
            </div>
        )}

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
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Neural Dismantling...</h2>
            <p className="text-slate-400 text-sm mt-3 font-medium text-center px-8">Extracting biological data from your meal input.</p>
        </div>
    );
  }

  if (analysisResult || isEnrichingManual) {
    const verdict = getMealVerdict();
    const items = analysisResult?.detectedItems || [];
    const totalCals = calculateTotalCalories();

    return (
      <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between">
            <div>
                <h2 className="text-2xl font-black text-slate-800">Meal Analysis</h2>
                {totalCals > 0 && <p className="text-teal-600 text-xs font-black uppercase tracking-widest mt-0.5 flex items-center gap-1"><Zap className="w-3 h-3" /> {totalCals} Total Calories</p>}
            </div>
            <button onClick={resetForm} className="p-2 bg-slate-100 rounded-full text-slate-500"><X className="w-5 h-5" /></button>
        </div>

        {saveSuccess && (
            <div className="bg-emerald-500 text-white p-4 rounded-2xl flex items-center gap-3 animate-in zoom-in duration-300">
                <CheckCircle className="w-6 h-6" />
                <span className="font-bold">Bio-Log Committed Successfully!</span>
            </div>
        )}

        {verdict && items.length > 0 && (
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
             <div key={`${idx}-${item.name}`} className={`bg-white p-6 rounded-3xl shadow-sm border-2 transition-all animate-in slide-in-from-right-4 duration-300 ${
                 item.sensitivityAlert?.level === 'high' || item.ingredientAnalysis?.some(i => i.safetyLevel === 'high') ? 'border-rose-200 bg-rose-50/10' : 
                 item.sensitivityAlert?.level === 'medium' || item.ingredientAnalysis?.some(i => i.safetyLevel === 'medium') ? 'border-amber-200 bg-amber-50/10' : 
                 'border-slate-100 shadow-slate-200/50'
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
                    <button onClick={() => removeItem(idx)} className="p-2 hover:bg-rose-100 hover:text-rose-600 rounded-xl transition-colors text-slate-300">
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
                
                {renderIngredientAnalysis(item as FoodItem)}
             </div>
          ))}

          <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] p-6 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <ListPlus className="w-4 h-4" /> Add Missing Ingredient
              </h3>
              <div className="flex gap-2">
                   <input 
                      type="text" 
                      placeholder="e.g. Avocado, Whole Milk..." 
                      className="flex-1 bg-slate-50 border border-slate-200 p-4 rounded-2xl outline-none text-sm font-bold text-black placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500/20" 
                      value={manualAddInput}
                      onChange={(e) => setManualAddInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleManualItemAdd()}
                      disabled={isEnrichingManual}
                   />
                   <button 
                      onClick={handleManualItemAdd}
                      disabled={!manualAddInput.trim() || isEnrichingManual}
                      className="bg-slate-900 text-white px-6 rounded-2xl shadow-lg disabled:opacity-50 active:scale-95 transition-all"
                   >
                       {isEnrichingManual ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
                   </button>
              </div>
              {isEnrichingManual && (
                  <p className="text-[10px] text-teal-600 mt-2 font-black animate-pulse flex items-center gap-2">
                      <Sparkles className="w-3 h-3" /> Analyzing Biological Markers...
                  </p>
              )}
          </div>
          <div ref={listEndRef} />
        </div>
        
        <button 
            onClick={handleSave} 
            disabled={isSavingStatus || items.length === 0 || isEnrichingManual}
            className={`w-full py-5 rounded-3xl font-black text-xl shadow-2xl transition-all flex items-center justify-center gap-3 ${
                isSavingStatus || items.length === 0 || isEnrichingManual ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50' : 'bg-slate-900 text-white shadow-slate-300 hover:bg-slate-800 active:scale-95'
            }`}
        >
            {isSavingStatus ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
            {isSavingStatus ? 'Committing Log...' : 'Save to Food Log'}
        </button>
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
        
        <button 
           onClick={() => setAnalysisResult({ detectedItems: [], timestamp: new Date().toISOString() })}
           className="w-full bg-slate-100 border border-slate-200 text-slate-600 py-4 rounded-3xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-all"
        >
            <Plus className="w-5 h-5" /> Start Empty Log
        </button>
      </div>
      
      <div className="space-y-5">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Clock className="w-4 h-4" /> Bio-History
        </h3>
        <div className="space-y-4">
          {history.length === 0 ? (
              <div className="bg-white p-10 rounded-3xl border border-dashed border-slate-200 text-center">
                  <p className="text-slate-400 text-xs font-bold">No history yet.</p>
              </div>
          ) : (
            history.map((log) => {
                const totalCals = log.detectedItems?.reduce((acc, item) => acc + (item.nutrition?.calories || 0), 0);
                return (
                    <div key={log.id} onClick={() => startEdit(log)} className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 flex gap-4 cursor-pointer hover:border-teal-200 hover:shadow-md transition-all group">
                    <div className="w-20 h-20 bg-slate-100 rounded-2xl overflow-hidden flex-shrink-0 border border-slate-50">
                        {log.imageUrl ? <img src={log.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /> : <Utensils className="w-8 h-8 m-auto text-slate-300" />}
                    </div>
                    <div className="flex-1 py-1">
                        <div className="flex justify-between items-start">
                            <h4 className="font-black text-slate-800 text-base leading-tight">{(log.detectedItems || []).map(i => i.name).join(', ')}</h4>
                            {totalCals > 0 && <span className="text-[10px] font-black text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded ml-2 whitespace-nowrap">{totalCals} cal</span>}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-wider">{new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        <div className="flex gap-1.5 mt-2">
                            {log.detectedItems?.slice(0, 3).map((item, i) => (
                                <span key={`${log.id}-${i}`} className={`w-1.5 h-1.5 rounded-full ${item.sensitivityAlert?.level === 'high' ? 'bg-rose-500' : item.sensitivityAlert?.level === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                            ))}
                        </div>
                    </div>
                    </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
};
