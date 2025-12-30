
import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, Loader2, CheckCircle, AlertCircle, Plus, Flame, Leaf, HelpCircle, Utensils, ArrowRight, Sparkles, Clock, Calendar, Trash2, X, ThumbsUp, ThumbsDown, Check, Edit2, Keyboard, FlaskConical, AlertTriangle, ShieldCheck, ScanBarcode, ShoppingCart, ListPlus, Activity, ChefHat, Droplet, Save, ShieldAlert, Shield, SearchX, Zap, Info } from 'lucide-react';
import { analyzeFoodImage, processVoiceCommand, simulateMealImpact, scanGroceryProduct, enrichManualFoodItem } from '../services/geminiService';
import { db } from '../services/db';
import { FoodLog, FoodItem, SimulationResult, ShoppingListItem } from '../types';
import { VoiceRecorder } from './VoiceRecorder';

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
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<Partial<FoodLog> | null>(null);
  const [history, setHistory] = useState<FoodLog[]>([]);
  const [manualAddInput, setManualAddInput] = useState('');
  const [isEnrichingManual, setIsEnrichingManual] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [mode, setMode] = useState<'meal' | 'grocery'>('meal');
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, action: 'log' | 'scan' = 'log') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const rawBase64 = reader.result as string;
      const compressed = await compressImage(rawBase64);
      setImagePreview(compressed);
      const dataPayload = compressed.split(',')[1];
      if (action === 'scan') processGroceryScan(dataPayload);
      else processImage(dataPayload);
    };
    reader.readAsDataURL(file);
  };

  const processImage = async (base64: string) => {
    setIsAnalyzing(true);
    setEditingLogId(null);
    setMode('meal');
    const user = db.getState().user;
    try {
      const result = await analyzeFoodImage(base64, "image/jpeg", user);
      if (result) setAnalysisResult(result);
      else throw new Error("AI returned no results.");
    } catch (err) {
      console.error(err);
      alert("Analysis failed. Please try again.");
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
          setAnalysisResult(prev => ({
              ...prev,
              detectedItems: [...(prev?.detectedItems || []), enrichedItem],
              timestamp: prev?.timestamp || new Date().toISOString()
          }));
      } catch (err) {
          console.error(err);
          setAnalysisResult(prev => ({
              ...prev,
              detectedItems: [...(prev?.detectedItems || []), {
                  name: itemToEnrich, category: 'Other', ingredients: [], confidence: 1, reasoning: 'Manual Add',
                  nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 }
              }],
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

  const handleTextAnalysis = async (text: string) => {
    if (!text.trim()) return;
    const originalText = text;
    setTextInput('');
    setIsAnalyzing(true);
    const user = db.getState().user;
    try {
      const result = await processVoiceCommand(originalText, user);
      if (result.foodLogs && result.foodLogs.length > 0) setAnalysisResult(result.foodLogs[0]);
      else {
          const enrichedItem = await enrichManualFoodItem(originalText, user!);
          setAnalysisResult({ detectedItems: [enrichedItem], timestamp: new Date().toISOString() });
      }
    } catch (err) { console.error(err); alert("Processing error."); } finally { setIsAnalyzing(false); }
  };

  const startEdit = (log: FoodLog) => {
    setAnalysisResult(log);
    setImagePreview(log.imageUrl || null);
    setEditingLogId(log.id);
    setMode(log.isGroceryScan ? 'grocery' : 'meal');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeItem = (index: number) => {
    setAnalysisResult(prev => ({
        ...prev,
        detectedItems: (prev?.detectedItems || []).filter((_, i) => i !== index)
    }));
  };

  const handleDeleteLog = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Delete this meal log permanently?")) {
        db.deleteFoodLog(id);
        loadHistory();
    }
  };

  const handleSave = async () => {
    if (!analysisResult?.detectedItems?.length || isEnrichingManual) return;
    setIsSavingStatus(true);
    await new Promise(r => setTimeout(r, 400));
    const log: FoodLog = {
      id: editingLogId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36)),
      timestamp: analysisResult.timestamp || new Date().toISOString(),
      imageUrl: imagePreview || undefined,
      detectedItems: analysisResult.detectedItems as FoodItem[],
      isGroceryScan: mode === 'grocery'
    };
    if (editingLogId) db.updateFoodLog(log);
    else db.addFoodLog(log);
    setSaveSuccess(true);
    setTimeout(() => {
        setSaveSuccess(false);
        resetForm();
        loadHistory();
    }, 1500);
    setIsSavingStatus(false);
  };

  const resetForm = () => {
    setImagePreview(null);
    setAnalysisResult(null);
    setIsAnalyzing(false);
    setEditingLogId(null);
    setManualAddInput('');
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
                <span className="flex items-center gap-1"><FlaskConical className="w-3 h-3" /> Safety Breakdown</span>
                {item.category && <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 uppercase font-black text-[9px]">{item.category}</span>}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {analysis.length > 0 ? (
                analysis.map((ing, i) => (
                    <div key={i} className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold shadow-sm flex items-center gap-1.5 ${
                        ing.safetyLevel === 'high' ? 'bg-rose-50 border-rose-200 text-rose-700' :
                        ing.safetyLevel === 'medium' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                        'bg-emerald-50 border-emerald-100 text-emerald-700'
                    }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${ing.safetyLevel === 'high' ? 'bg-rose-500' : ing.safetyLevel === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                        {ing.name}
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
        {item.reasoning && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex gap-3 items-start">
                <Info className="w-4 h-4 text-slate-300 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-slate-600 font-medium leading-relaxed italic">
                  {item.reasoning}
                </p>
            </div>
        )}
      </div>
    );
  };

  if (isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center py-24 animate-in fade-in">
        <div className="relative mb-8">
            <div className="absolute inset-0 bg-teal-200 rounded-full blur-2xl animate-pulse opacity-50"></div>
            <Loader2 className="w-16 h-16 text-teal-500 animate-spin relative z-10" />
        </div>
        <h2 className="text-xl font-black text-slate-800 tracking-tight">Dismantling Meal...</h2>
        <p className="text-slate-400 text-xs font-bold mt-2">Extracting biological data</p>
      </div>
    );
  }

  const verdict = getMealVerdict();

  return (
    <div className="space-y-8 pb-20">
      {!analysisResult ? (
        <div className="space-y-8">
           <div className="space-y-6">
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">New Food Log</h2>
              <div className="grid grid-cols-2 gap-4">
                <label className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] aspect-square flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-teal-400 hover:bg-teal-50 transition-all group shadow-sm">
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileChange(e, 'log')} />
                  <Camera className="w-10 h-10 text-teal-600 group-hover:scale-110 transition-transform" />
                  <span className="font-black text-slate-700 text-[10px] uppercase">Analyze Meal</span>
                </label>
                <label className="bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-[2.5rem] aspect-square flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-indigo-400 hover:bg-indigo-100 transition-all group shadow-sm">
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileChange(e, 'scan')} />
                  <ScanBarcode className="w-10 h-10 text-indigo-600 group-hover:scale-110 transition-transform" />
                  <span className="font-black text-slate-700 text-[10px] uppercase">Label Scan</span>
                </label>
              </div>
              <div className="bg-white p-2.5 rounded-[1.5rem] border border-slate-200 shadow-sm flex items-center gap-3 pr-2 transition-all">
                  <input type="text" value={textInput} onChange={(e) => setTextInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleTextAnalysis(textInput)} placeholder="Describe meal manually..." className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-semibold text-slate-700 focus:outline-none px-4" />
                  <button onClick={() => handleTextAnalysis(textInput)} className="p-4 bg-slate-900 text-white rounded-[1.2rem] transform active:scale-95 transition-all"><ArrowRight className="w-5 h-5" /></button>
              </div>
           </div>
           
           <div className="space-y-5">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Clock className="w-4 h-4" /> Bio-History</h3>
              <div className="space-y-4">
              {history.length === 0 ? (
                  <div className="bg-white p-10 rounded-3xl border border-dashed border-slate-200 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">No history yet.</div>
              ) : (
                history.map((log) => {
                  const items = log.detectedItems || [];
                  const totalCals = items.reduce((acc, i) => acc + (i.nutrition?.calories || 0), 0);
                  const totalProt = items.reduce((acc, i) => acc + (i.nutrition?.protein || 0), 0);
                  const totalCarb = items.reduce((acc, i) => acc + (i.nutrition?.carbs || 0), 0);
                  const totalFat = items.reduce((acc, i) => acc + (i.nutrition?.fat || 0), 0);

                  return (
                    <div key={log.id} className="relative group overflow-visible">
                        <div onClick={() => startEdit(log)} className="bg-white rounded-[2rem] p-4 shadow-sm border border-slate-100 flex gap-4 cursor-pointer hover:border-teal-200 hover:shadow-md transition-all relative">
                            <div className="w-24 h-24 bg-slate-100 rounded-2xl overflow-hidden flex-shrink-0 border border-slate-50 relative">
                                {log.imageUrl ? <img src={log.imageUrl} className="w-full h-full object-cover" /> : <Utensils className="w-8 h-8 m-auto text-slate-300" />}
                                <div className="absolute bottom-1 right-1 flex gap-0.5">
                                    {items.slice(0, 3).map((item, idx) => (
                                        <div key={idx} className={`w-1.5 h-1.5 rounded-full ${
                                            item.sensitivityAlert?.level === 'high' || item.ingredientAnalysis?.some(ia => ia.safetyLevel === 'high') ? 'bg-rose-500' :
                                            item.sensitivityAlert?.level === 'medium' || item.ingredientAnalysis?.some(ia => ia.safetyLevel === 'medium') ? 'bg-amber-500' :
                                            'bg-emerald-500'
                                        }`} />
                                    ))}
                                </div>
                            </div>
                            <div className="flex-1 py-1 pr-14 flex flex-col justify-between">
                                <div>
                                    <h4 className="font-black text-slate-800 text-base leading-tight line-clamp-1">{items.map(i => i.name).join(', ')}</h4>
                                    <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase">{new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                                <div className="flex items-center gap-3 mt-2">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-slate-400 uppercase">Energy</span>
                                        <span className="text-xs font-black text-teal-600 leading-none">{totalCals}kcal</span>
                                    </div>
                                    <div className="h-6 w-px bg-slate-100" />
                                    <div className="flex gap-2">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-slate-300 uppercase">P</span>
                                            <span className="text-[10px] font-bold text-slate-600 leading-none">{totalProt}g</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-slate-300 uppercase">C</span>
                                            <span className="text-[10px] font-bold text-slate-600 leading-none">{totalCarb}g</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-slate-300 uppercase">F</span>
                                            <span className="text-[10px] font-bold text-slate-600 leading-none">{totalFat}g</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button 
                                type="button"
                                onClick={(e) => handleDeleteLog(e, log.id)} 
                                className="absolute top-4 right-4 p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all z-[60] shadow-sm active:scale-90"
                                title="Delete Log"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                  );
                })
              )}
              </div>
           </div>
        </div>
      ) : (
        <div className="space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-300">
           <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-black text-slate-800">Meal Analysis</h2>
              <button onClick={resetForm} className="p-2 bg-slate-100 rounded-full text-slate-500"><X className="w-5 h-5" /></button>
           </div>
           {saveSuccess && (
                <div className="bg-emerald-500 text-white p-4 rounded-2xl flex items-center gap-3 animate-in zoom-in duration-300">
                    <CheckCircle className="w-6 h-6" />
                    <span className="font-bold">Log Committed Successfully!</span>
                </div>
            )}
           {verdict && (
                <div className={`${verdict.color} text-white p-5 rounded-3xl shadow-xl flex items-center gap-4 relative overflow-hidden`}>
                    <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">{verdict.icon}</div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 leading-none">Biological Verdict</span>
                        <p className="text-xl font-black tracking-tight">{verdict.label}: {verdict.text}</p>
                    </div>
                </div>
            )}
           {imagePreview && (
                <div className="rounded-3xl overflow-hidden shadow-lg aspect-video bg-slate-100 border-4 border-white">
                    <img src={imagePreview} alt="Analysis" className="w-full h-full object-cover" />
                </div>
            )}
           <div className="space-y-4">
                {analysisResult.detectedItems?.map((item, idx) => (
                <div key={idx} className={`bg-white p-6 rounded-3xl shadow-sm border-2 transition-all ${
                    item.sensitivityAlert?.level === 'high' || item.ingredientAnalysis?.some(i => i.safetyLevel === 'high') ? 'border-rose-200' : 
                    item.sensitivityAlert?.level === 'medium' || item.ingredientAnalysis?.some(i => i.safetyLevel === 'medium') ? 'border-amber-200' : 
                    'border-slate-100'
                }`}>
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="font-black text-xl text-slate-800 leading-none">{item.name}</h3>
                        <button onClick={() => removeItem(idx)} className="text-slate-300 hover:text-rose-500 transition-colors p-2">
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                    {renderIngredientAnalysis(item as FoodItem)}
                </div>
                ))}
           </div>
           <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] p-6 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <ListPlus className="w-4 h-4" /> Missing Item?
              </h3>
              <div className="flex gap-2">
                   <input 
                      type="text" 
                      placeholder="e.g. Avocado, Milk..." 
                      className="flex-1 bg-slate-50 border border-slate-200 p-4 rounded-2xl outline-none text-sm font-bold text-slate-800" 
                      value={manualAddInput}
                      onChange={(e) => setManualAddInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleManualItemAdd()}
                      disabled={isEnrichingManual}
                   />
                   <button 
                      onClick={handleManualItemAdd}
                      disabled={!manualAddInput.trim() || isEnrichingManual}
                      className="bg-slate-900 text-white px-6 rounded-2xl disabled:opacity-50"
                   >
                       {isEnrichingManual ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                   </button>
              </div>
          </div>
           <button onClick={handleSave} disabled={isSavingStatus || isEnrichingManual} className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black text-xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3">
             {isSavingStatus ? <Loader2 className="animate-spin" /> : <Save className="w-6 h-6" />}
             {isSavingStatus ? 'Syncing...' : 'Commit to Log'}
           </button>
        </div>
      )}
    </div>
  );
};
