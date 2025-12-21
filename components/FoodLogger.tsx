
import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, Loader2, CheckCircle, AlertCircle, Plus, Flame, Leaf, HelpCircle, Utensils, ArrowRight, Sparkles, Clock, Calendar, Trash2, X, ThumbsUp, ThumbsDown, Check, Edit2, Keyboard, FlaskConical, AlertTriangle, ShieldCheck, ScanBarcode, ShoppingCart, ListPlus, Activity, ChefHat, Droplet, Save } from 'lucide-react';
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

  // Edit Item State
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editFormState, setEditFormState] = useState<FoodItem | null>(null);
  
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    const state = db.getState();
    const sorted = [...state.foodLogs].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    setHistory(sorted);
  };

  const compressImage = (base64Str: string, maxWidth = 1024, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
            resolve(base64Str); // Fallback if context fails
        }
      };
      img.onerror = () => {
          resolve(base64Str); // Fallback
      };
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, action: 'log' | 'simulate' | 'scan' = 'log') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const rawBase64 = reader.result as string;
      // Compress the image before processing to avoid payload limits and save DB space
      const compressedBase64 = await compressImage(rawBase64);
      setImagePreview(compressedBase64);
      
      const dataPayload = compressedBase64.split(',')[1];
      
      if (action === 'simulate') {
        runSimulation(dataPayload);
      } else if (action === 'scan') {
        processGroceryScan(dataPayload);
      } else {
        processImage(dataPayload);
      }
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
      setAnalysisResult(result);
    } catch (err) {
      console.error(err);
      alert("Analysis failed. The image might be too large or the network request failed.");
      setImagePreview(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const processGroceryScan = async (base64: string) => {
    setIsAnalyzing(true);
    setSimulationResult(null);
    setConfirmedIndices(new Set());
    setEditingLogId(null);
    setMode('grocery');
    const user = db.getState().user;
    if (!user) return;

    try {
      const result = await scanGroceryProduct(base64, "image/jpeg", user);
      setAnalysisResult(result);
    } catch (err) {
      console.error(err);
      alert("Scan failed. Try a clearer image.");
      setImagePreview(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runSimulation = async (base64: string) => {
    setIsSimulating(true);
    setAnalysisResult(null); 
    const user = db.getState().user;
    if (!user) return;

    try {
      const result = await simulateMealImpact(base64, "image/jpeg", user);
      setSimulationResult(result);
    } catch (err) {
      console.error(err);
      alert("Simulation failed.");
    } finally {
      setIsSimulating(false);
    }
  };

  const handleTextAnalysis = async (text: string) => {
    if (!text.trim()) return;
    setTextInput('');
    setIsAnalyzing(true);
    setConfirmedIndices(new Set());
    setEditingLogId(null);
    setMode('meal');
    const user = db.getState().user;
    try {
      const result = await processVoiceCommand(text, user);
      if (result.foodLogs && result.foodLogs.length > 0) {
        setAnalysisResult(result.foodLogs[0]);
      } else {
        alert("No food items detected.");
      }
    } catch (err) {
      console.error(err);
      alert("Processing failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startEdit = (log: FoodLog) => {
    setAnalysisResult(log);
    setImagePreview(log.imageUrl || null);
    setEditingLogId(log.id);
    setConfirmedIndices(new Set(log.detectedItems.map((_, i) => i)));
    setSimulationResult(null);
    setMode(log.isGroceryScan ? 'grocery' : 'meal');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Item Editing Functions
  const startEditingItem = (index: number, item: FoodItem) => {
      setEditingItemIndex(index);
      setEditFormState(JSON.parse(JSON.stringify(item))); // Deep copy
  };

  const cancelEditingItem = () => {
      setEditingItemIndex(null);
      setEditFormState(null);
  };

  const saveEditedItem = () => {
      if (!analysisResult?.detectedItems || editingItemIndex === null || !editFormState) return;
      const newItems = [...analysisResult.detectedItems];
      newItems[editingItemIndex] = editFormState;
      setAnalysisResult({ ...analysisResult, detectedItems: newItems });
      setEditingItemIndex(null);
      setEditFormState(null);
  };

  const addManualItem = () => {
    if (!manualAddInput.trim() || !analysisResult) return;
    const newItem: FoodItem = {
      name: manualAddInput,
      category: 'Manual Entry',
      ingredients: [],
      confidence: 1,
      tags: ['neutral'],
      cookingMethod: 'Unknown',
      nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 }
    };
    const newItems = [...(analysisResult.detectedItems || []), newItem];
    setAnalysisResult({ ...analysisResult, detectedItems: newItems });
    const newSet = new Set(confirmedIndices);
    newSet.add(newItems.length - 1);
    setConfirmedIndices(newSet);
    setManualAddInput('');
  };

  const removeItem = (index: number) => {
    if (!analysisResult?.detectedItems) return;
    const newItems = analysisResult.detectedItems.filter((_, i) => i !== index);
    setAnalysisResult({ ...analysisResult, detectedItems: newItems });
    const newConfirmed = new Set<number>();
    Array.from(confirmedIndices).forEach((i: number) => {
      if (i < index) newConfirmed.add(i);
      if (i > index) newConfirmed.add(i - 1);
    });
    setConfirmedIndices(newConfirmed);
  };

  const confirmItem = (index: number) => {
    const newSet = new Set(confirmedIndices);
    newSet.add(index);
    setConfirmedIndices(newSet);
  };

  const addToShoppingList = (item: FoodItem) => {
    const listItem: ShoppingListItem = {
        id: crypto.randomUUID(),
        name: item.name,
        addedAt: new Date().toISOString(),
        status: 'pending',
        sensitivityAlert: item.sensitivityAlert ? {
            level: item.sensitivityAlert.level,
            trigger: item.sensitivityAlert.triggerIngredient
        } : undefined
    };
    db.addToShoppingList(listItem);
    alert(`${item.name} added to Shopping List`);
  };

  const handleSave = () => {
    if (!analysisResult || !analysisResult.detectedItems || analysisResult.detectedItems.length === 0) {
      alert("Please add at least one food item.");
      return;
    }

    if (editingLogId) {
      const log: FoodLog = {
        id: editingLogId,
        timestamp: analysisResult.timestamp || new Date().toISOString(),
        imageUrl: imagePreview || undefined,
        detectedItems: analysisResult.detectedItems,
        manualNotes: analysisResult.manualNotes,
        isGroceryScan: mode === 'grocery'
      };
      db.updateFoodLog(log);
    } else {
      const log: FoodLog = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        imageUrl: imagePreview || undefined,
        detectedItems: analysisResult.detectedItems,
        manualNotes: analysisResult.manualNotes,
        isGroceryScan: mode === 'grocery'
      };
      db.addFoodLog(log);
    }
    resetForm();
    loadHistory();
  };

  const handleDelete = () => {
    if (!editingLogId) {
      handleDiscard(); 
      return;
    }
    if (window.confirm("Delete this log?")) {
      db.deleteFoodLog(editingLogId);
      resetForm();
      loadHistory();
    }
  };

  const handleDiscard = () => {
    resetForm();
  };

  const resetForm = () => {
    setImagePreview(null);
    setAnalysisResult(null);
    setSimulationResult(null);
    setConfirmedIndices(new Set());
    setEditingLogId(null);
    setMode('meal');
    setEditingItemIndex(null);
    setEditFormState(null);
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getTagColor = (tag: string) => {
    const t = tag.toLowerCase();
    if (t.includes('anti-inflammatory')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (t.includes('inflammatory')) return 'bg-rose-100 text-rose-700 border-rose-200';
    if (t.includes('trigger')) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const getSensitivityColor = (ingredient: string, userSensitivities: any[]) => {
      if (!userSensitivities) return 'text-slate-600';
      const match = userSensitivities.find((s: any) => ingredient.toLowerCase().includes(s.food.toLowerCase()));
      if (match) {
          if (match.level === 'high') return 'text-rose-600 font-bold bg-rose-50 px-1 rounded';
          if (match.level === 'medium') return 'text-orange-600 font-bold bg-orange-50 px-1 rounded';
          return 'text-emerald-600 font-bold bg-emerald-50 px-1 rounded';
      }
      return 'text-slate-600';
  };

  const getCookingMethodConfig = (method: string) => {
    const m = method.toLowerCase();
    if (m.includes('fried') || m.includes('deep')) return { color: 'text-orange-800', bg: 'bg-orange-100', border: 'border-orange-200', icon: <Flame className="w-3 h-3" /> };
    if (m.includes('grilled') || m.includes('roasted') || m.includes('baked')) return { color: 'text-amber-800', bg: 'bg-amber-100', border: 'border-amber-200', icon: <Flame className="w-3 h-3" /> };
    if (m.includes('steamed') || m.includes('boiled') || m.includes('poached')) return { color: 'text-blue-800', bg: 'bg-blue-100', border: 'border-blue-200', icon: <Droplet className="w-3 h-3" /> };
    if (m.includes('raw') || m.includes('fresh')) return { color: 'text-emerald-800', bg: 'bg-emerald-100', border: 'border-emerald-200', icon: <Leaf className="w-3 h-3" /> };
    return { color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200', icon: <ChefHat className="w-3 h-3" /> };
  };

  const renderIngredientList = (item: FoodItem) => {
      const user = db.getState().user;
      const sensitivities = user?.foodSensitivities || [];
      
      // If we have granular AI analysis, prioritize that for coloring
      if (item.ingredientAnalysis && item.ingredientAnalysis.length > 0) {
          return (
              <div className="mt-2 text-xs leading-relaxed">
                  <span className="font-bold text-slate-500 mr-1 block mb-1">Detected Ingredients:</span>
                  <div className="flex flex-wrap gap-1.5">
                      {item.ingredientAnalysis.map((ing, i) => {
                          let colorClass = 'bg-slate-100 text-slate-600 border-slate-200';
                          if (ing.safetyLevel === 'high') colorClass = 'bg-rose-100 text-rose-700 border-rose-200';
                          else if (ing.safetyLevel === 'medium') colorClass = 'bg-orange-100 text-orange-700 border-orange-200';
                          else if (ing.safetyLevel === 'safe') colorClass = 'bg-emerald-100 text-emerald-700 border-emerald-200';
                          
                          return (
                              <span key={i} className={`px-2 py-1 rounded-md border ${colorClass} font-medium`}>
                                  {ing.name}
                              </span>
                          );
                      })}
                  </div>
              </div>
          );
      }

      // Fallback for manual edits or older logs: Parse string array and match against profile
      return (
          <div className="mt-2 text-xs leading-relaxed">
              <span className="font-bold text-slate-500 mr-1">Ingredients:</span>
              {item.ingredients.map((ing, i) => (
                  <span key={i} className={getSensitivityColor(ing, sensitivities)}>
                      {ing}{i < item.ingredients.length - 1 ? ', ' : ''}
                  </span>
              ))}
          </div>
      );
  };

  // --- Render Simulation Result ---
  if (simulationResult) {
    return (
      <div className="space-y-6 pb-20 animate-in fade-in zoom-in duration-300">
         <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-800">Bio-Simulation Result</h2>
            <button onClick={resetForm} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X className="w-5 h-5" /></button>
         </div>

         {imagePreview && (
          <div className="relative rounded-2xl overflow-hidden shadow-md aspect-video bg-slate-100">
             <img src={imagePreview} alt="Simulated food" className="w-full h-full object-cover" />
             <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent flex items-end p-4">
                <span className="text-white font-bold flex items-center gap-2"><FlaskConical className="w-5 h-5 text-purple-400" /> Bio-Sim v1.0</span>
             </div>
          </div>
        )}

         <div className={`p-6 rounded-2xl text-center border-2 ${
            simulationResult.verdict === 'Safe' ? 'bg-emerald-50 border-emerald-200' :
            simulationResult.verdict === 'Caution' ? 'bg-amber-50 border-amber-200' :
            'bg-rose-50 border-rose-200'
         }`}>
            <div className="text-sm font-bold uppercase tracking-widest mb-2 opacity-60">Predicted Impact</div>
            <div className={`text-4xl font-black mb-1 ${
                simulationResult.verdict === 'Safe' ? 'text-emerald-600' :
                simulationResult.verdict === 'Caution' ? 'text-amber-600' :
                'text-rose-600'
            }`}>{simulationResult.verdict}</div>
            <div className="text-xs font-medium text-slate-500">Risk Score: {simulationResult.riskScore}/100</div>
         </div>
         
         {/* Mechanisms */}
          <div className="bg-white p-4 rounded-xl border border-slate-100">
             <h3 className="font-bold text-slate-700 mb-2">Biological Impact</h3>
             <ul className="list-disc pl-5 space-y-1">
                {simulationResult.biologicalMechanisms.map((mech, i) => (
                    <li key={i} className="text-sm text-slate-600">{mech}</li>
                ))}
             </ul>
          </div>
          
          {simulationResult.betterOption && (
             <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex gap-3 items-start">
                <Sparkles className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                <div>
                    <h3 className="font-bold text-indigo-900 text-sm">Better Option</h3>
                    <p className="text-sm text-indigo-700">{simulationResult.betterOption}</p>
                </div>
             </div>
          )}

         <div className="flex gap-3">
            <button onClick={resetForm} className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200">
               Discard
            </button>
            <button onClick={() => processImage(imagePreview!.split(',')[1])} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800">
               Log Anyway
            </button>
         </div>
      </div>
    );
  }

  // --- Render Analysis Result (Review/Edit Mode) ---
  if (analysisResult) {
    const totalNutrition = analysisResult?.detectedItems?.reduce((acc, item) => ({
        calories: acc.calories + (item.nutrition?.calories || 0),
        protein: acc.protein + (item.nutrition?.protein || 0),
        carbs: acc.carbs + (item.nutrition?.carbs || 0),
        fat: acc.fat + (item.nutrition?.fat || 0)
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    return (
      <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {editingLogId ? 'Edit Log' : 'Review'}
            </h2>
            {mode === 'grocery' && <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full uppercase tracking-wide">Grocery Scan Mode</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={handleDiscard} className="text-slate-400 hover:text-slate-600 p-2 bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            <button onClick={handleDelete} className="text-rose-400 hover:text-rose-600 p-2 bg-rose-50 rounded-lg"><Trash2 className="w-5 h-5" /></button>
          </div>
        </div>

        {imagePreview && (
          <div className="relative rounded-2xl overflow-hidden shadow-md aspect-video bg-slate-100">
             <img src={imagePreview} alt="Food analysis" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Total Nutrition Summary */}
        {totalNutrition && totalNutrition.calories > 0 && mode !== 'grocery' && (
            <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg shadow-slate-200 mb-4">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold flex items-center gap-2 text-sm"><Activity className="w-4 h-4 text-teal-400" /> Meal Totals</h3>
                    <span className="text-xl font-black text-teal-400">{totalNutrition.calories} <span className="text-xs text-slate-400 font-medium">Kcal</span></span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-white/10 rounded-xl p-2">
                        <div className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Protein</div>
                        <div className="font-bold text-lg">{totalNutrition.protein}g</div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-2">
                        <div className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Carbs</div>
                        <div className="font-bold text-lg">{totalNutrition.carbs}g</div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-2">
                        <div className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Fat</div>
                        <div className="font-bold text-lg">{totalNutrition.fat}g</div>
                    </div>
                </div>
            </div>
        )}

        <div className="space-y-4">
          {analysisResult.detectedItems?.map((item, idx) => {
             // Render Edit Form if this item is being edited
             if (editingItemIndex === idx && editFormState) {
                 return (
                     <div key={idx} className="bg-white p-5 rounded-2xl shadow-lg border-2 border-teal-500 relative">
                         <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-teal-700 flex items-center gap-2"><Edit2 className="w-4 h-4" /> Edit Item</h3>
                         </div>
                         <div className="space-y-4">
                             <div>
                                 <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Name</label>
                                 <input
                                    type="text"
                                    value={editFormState.name}
                                    onChange={(e) => setEditFormState({...editFormState, name: e.target.value})}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none font-medium"
                                 />
                             </div>
                             <div>
                                 <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Category</label>
                                 <select
                                     value={editFormState.category || 'Other'}
                                     onChange={(e) => setEditFormState({...editFormState, category: e.target.value})}
                                     className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none font-medium appearance-none"
                                 >
                                     <option value="Dairy">Dairy</option>
                                     <option value="Nightshade">Nightshade</option>
                                     <option value="Gluten">Gluten</option>
                                     <option value="Processed">Processed</option>
                                     <option value="Meat">Meat</option>
                                     <option value="Vegetable">Vegetable</option>
                                     <option value="Fruit">Fruit</option>
                                     <option value="Grain">Grain</option>
                                     <option value="Legume">Legume</option>
                                     <option value="Sugar">Sugar</option>
                                     <option value="Other">Other</option>
                                 </select>
                             </div>
                             
                             {/* Editable Nutrition Fields */}
                             <div>
                                 <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Nutrition (per serving)</label>
                                 <div className="grid grid-cols-4 gap-2">
                                     <div>
                                         <label className="text-[9px] text-slate-400 font-bold block mb-0.5 text-center">Kcal</label>
                                         <input
                                            type="number"
                                            value={editFormState.nutrition?.calories || 0}
                                            onChange={(e) => setEditFormState({
                                                ...editFormState, 
                                                nutrition: { 
                                                    protein: 0, carbs: 0, fat: 0, ...editFormState.nutrition,
                                                    calories: parseInt(e.target.value) || 0 
                                                }
                                            })}
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-center focus:ring-2 focus:ring-teal-500 outline-none"
                                         />
                                     </div>
                                     <div>
                                         <label className="text-[9px] text-slate-400 font-bold block mb-0.5 text-center">Prot (g)</label>
                                         <input
                                            type="number"
                                            value={editFormState.nutrition?.protein || 0}
                                            onChange={(e) => setEditFormState({
                                                ...editFormState, 
                                                nutrition: { 
                                                    calories: 0, carbs: 0, fat: 0, ...editFormState.nutrition,
                                                    protein: parseInt(e.target.value) || 0 
                                                }
                                            })}
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-center focus:ring-2 focus:ring-teal-500 outline-none"
                                         />
                                     </div>
                                     <div>
                                         <label className="text-[9px] text-slate-400 font-bold block mb-0.5 text-center">Carb (g)</label>
                                         <input
                                            type="number"
                                            value={editFormState.nutrition?.carbs || 0}
                                            onChange={(e) => setEditFormState({
                                                ...editFormState, 
                                                nutrition: { 
                                                    calories: 0, protein: 0, fat: 0, ...editFormState.nutrition,
                                                    carbs: parseInt(e.target.value) || 0 
                                                }
                                            })}
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-center focus:ring-2 focus:ring-teal-500 outline-none"
                                         />
                                     </div>
                                     <div>
                                         <label className="text-[9px] text-slate-400 font-bold block mb-0.5 text-center">Fat (g)</label>
                                         <input
                                            type="number"
                                            value={editFormState.nutrition?.fat || 0}
                                            onChange={(e) => setEditFormState({
                                                ...editFormState, 
                                                nutrition: { 
                                                    calories: 0, protein: 0, carbs: 0, ...editFormState.nutrition,
                                                    fat: parseInt(e.target.value) || 0 
                                                }
                                            })}
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-center focus:ring-2 focus:ring-teal-500 outline-none"
                                         />
                                     </div>
                                 </div>
                             </div>

                             <div>
                                 <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Ingredients (comma separated)</label>
                                 <textarea
                                    value={editFormState.ingredients.join(', ')}
                                    onChange={(e) => setEditFormState({
                                        ...editFormState, 
                                        ingredients: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                                        // Clear previous AI ingredient analysis if user manually edits ingredients
                                        ingredientAnalysis: undefined 
                                    })}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none font-medium h-24 resize-none text-sm"
                                 />
                                 <p className="text-[10px] text-slate-400 mt-1 italic">Note: Editing ingredients manually will remove AI safety classification for them.</p>
                             </div>
                             <div className="flex gap-3 pt-2">
                                 <button onClick={saveEditedItem} className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-teal-700">
                                     <Save className="w-4 h-4" /> Save
                                 </button>
                                 <button onClick={cancelEditingItem} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200">
                                     Cancel
                                 </button>
                             </div>
                         </div>
                     </div>
                 );
             }

             // Standard Render
             return (
                <div key={idx} className={`bg-white p-5 rounded-2xl shadow-sm border transition-all relative ${confirmedIndices.has(idx) ? 'border-teal-200 bg-teal-50/30' : 'border-slate-100'}`}>
                
                {/* Edit Button */}
                <button 
                    onClick={() => startEditingItem(idx, item)} 
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                    title="Edit Item Details"
                >
                    <Edit2 className="w-4 h-4" />
                </button>

                {/* Sensitivity Alert Banner */}
                {item.sensitivityAlert && (
                    <div className={`mb-4 p-3 rounded-xl flex items-start gap-3 border ${
                        item.sensitivityAlert.level === 'high' ? 'bg-rose-50 border-rose-200 text-rose-800' :
                        item.sensitivityAlert.level === 'medium' ? 'bg-orange-50 border-orange-200 text-orange-800' :
                        'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}>
                        <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
                        item.sensitivityAlert.level === 'high' ? 'text-rose-600' :
                        item.sensitivityAlert.level === 'medium' ? 'text-orange-600' :
                        'text-emerald-600'
                        }`} />
                        <div>
                        <p className="font-bold text-sm">Sensitivity Warning: {item.sensitivityAlert.triggerIngredient}</p>
                        <p className="text-xs mt-1 opacity-90">{item.sensitivityAlert.message}</p>
                        </div>
                    </div>
                )}

                {/* Item Details */}
                <div className="flex justify-between items-start mb-2 pr-8">
                    <div>
                    <h3 className="font-bold text-lg text-slate-800 leading-tight">{item.name}</h3>
                    {item.category && <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">{item.category}</span>}
                    </div>
                </div>
                
                <span className="text-sm font-bold text-slate-600 block mb-2">{item.nutrition?.calories} Kcal</span>
                
                {/* Ingredient List (Highlighted) */}
                {renderIngredientList(item)}
                
                <div className="flex flex-wrap gap-2 mb-3 mt-3">
                    {item.tags?.map(t => <span key={t} className={`text-[9px] px-2 py-1 rounded-full border uppercase font-bold ${getTagColor(t)}`}>{t}</span>)}
                </div>
                
                {item.cookingMethod && (
                    (() => {
                        const config = getCookingMethodConfig(item.cookingMethod);
                        return (
                            <div className={`mb-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${config.bg} ${config.border} ${config.color}`}>
                            {config.icon}
                            <span className="text-xs font-bold uppercase tracking-wide">{item.cookingMethod}</span>
                            </div>
                        );
                    })()
                )}
                
                {item.reasoning && <p className="text-xs text-slate-500 italic mb-3">"{item.reasoning}"</p>}
                
                {/* Nutrition Grid */}
                {item.nutrition && (
                    <div className="mb-3">
                    <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 p-2 rounded-xl mb-2">
                        <div><div className="text-[10px] text-slate-400 uppercase font-bold">Protein</div><div className="font-bold text-slate-700">{item.nutrition.protein}g</div></div>
                        <div><div className="text-[10px] text-slate-400 uppercase font-bold">Carbs</div><div className="font-bold text-slate-700">{item.nutrition.carbs}g</div></div>
                        <div><div className="text-[10px] text-slate-400 uppercase font-bold">Fat</div><div className="font-bold text-slate-700">{item.nutrition.fat}g</div></div>
                    </div>
                    {/* Visual Macro Bar */}
                    <div className="h-2 w-full rounded-full overflow-hidden flex bg-slate-100">
                        {/* Calculate total to ensure clean percentages */}
                        {(() => {
                            const total = item.nutrition.protein + item.nutrition.carbs + item.nutrition.fat;
                            if (total === 0) return <div className="w-full h-full bg-slate-200"></div>;
                            return (
                                <>
                                    <div className="h-full bg-emerald-400" style={{ width: `${(item.nutrition.protein / total) * 100}%` }} />
                                    <div className="h-full bg-amber-400" style={{ width: `${(item.nutrition.carbs / total) * 100}%` }} />
                                    <div className="h-full bg-rose-400" style={{ width: `${(item.nutrition.fat / total) * 100}%` }} />
                                </>
                            )
                        })()}
                    </div>
                    <div className="flex justify-between text-[8px] text-slate-400 mt-1 px-1">
                        <span>Protein</span>
                        <span>Carbs</span>
                        <span>Fat</span>
                    </div>
                    </div>
                )}

                {/* Alternatives */}
                {item.alternatives && item.alternatives.length > 0 && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mb-3">
                    <h4 className="font-bold text-indigo-800 text-xs flex items-center gap-1 mb-1">
                        <Sparkles className="w-3 h-3" /> Healthier Swap
                    </h4>
                    <p className="text-indigo-700 text-xs">{item.alternatives[0]}</p>
                    </div>
                )}
                
                {/* Add to List Button (Grocery Mode) */}
                {mode === 'grocery' && (
                    <button onClick={() => addToShoppingList(item)} className="w-full mt-2 border border-slate-200 text-slate-600 py-2 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50">
                        <ListPlus className="w-4 h-4" /> Add to Shopping List
                    </button>
                )}

                <div className="flex gap-3 mt-4 pt-3 border-t border-slate-100/50">
                    {confirmedIndices.has(idx) ? (
                    <div className="flex-1 text-center py-2 text-teal-600 font-bold text-sm bg-teal-50 rounded-lg flex items-center justify-center gap-2">
                        <Check className="w-4 h-4" /> Verified
                    </div>
                    ) : (
                    <>
                        <button onClick={() => confirmItem(idx)} className="flex-1 flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 py-2 rounded-xl text-sm font-bold"><ThumbsUp className="w-4 h-4" /> Correct</button>
                        <button onClick={() => removeItem(idx)} className="flex-1 flex items-center justify-center gap-2 bg-rose-50 text-rose-700 py-2 rounded-xl text-sm font-bold"><ThumbsDown className="w-4 h-4" /> Incorrect</button>
                    </>
                    )}
                </div>
                </div>
             );
          })}
        </div>
        
        {/* Manual Add Input */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex gap-2">
           <input type="text" value={manualAddInput} onChange={(e) => setManualAddInput(e.target.value)} placeholder="Add missed item..." className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
           <button onClick={addManualItem} disabled={!manualAddInput} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold">Add</button>
        </div>

        <button onClick={handleSave} className="w-full bg-teal-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-teal-200">
          {mode === 'grocery' ? 'Save Scan to History' : 'Confirm & Save Log'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800">Log Meal</h2>
          <div className="flex items-center gap-2">
              <VoiceRecorder onTranscription={handleTextAnalysis} isProcessing={isAnalyzing} />
          </div>
        </div>
        
        {/* Action Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Standard Log */}
          <label className="bg-white border-2 border-dashed border-slate-200 rounded-2xl aspect-square flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-teal-400 hover:bg-teal-50 transition-all group relative overflow-hidden">
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileChange(e, 'log')} />
            <div className="bg-teal-100 p-4 rounded-full group-hover:scale-110 transition-transform relative z-10">
              <Camera className="w-8 h-8 text-teal-600" />
            </div>
            <span className="font-semibold text-slate-600 text-sm relative z-10 text-center px-2">Take Photo / Upload</span>
          </label>

           {/* Grocery Scanner */}
           <label className="bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-2xl aspect-square flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-indigo-400 hover:bg-indigo-100 transition-all group relative overflow-hidden">
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileChange(e, 'scan')} />
            <div className="bg-white p-4 rounded-full shadow-sm group-hover:scale-110 transition-transform relative z-10">
              <ScanBarcode className="w-8 h-8 text-indigo-600" />
            </div>
            <div className="text-center relative z-10">
               <span className="font-bold text-slate-700 text-sm block">Scan Barcode</span>
               <span className="text-[10px] text-slate-500">or Ingredients Label</span>
            </div>
          </label>
        </div>

        {/* Bio-Simulate Button (Full Width) */}
         <label className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-4 flex items-center justify-between cursor-pointer shadow-lg shadow-indigo-200 hover:scale-[1.02] transition-transform group relative overflow-hidden">
             <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'simulate')} />
            <div className="flex items-center gap-4">
               <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl group-hover:rotate-12 transition-transform">
                 <FlaskConical className="w-6 h-6 text-white" />
               </div>
               <div className="text-left">
                  <span className="font-bold text-white text-lg block">Simulate Impact</span>
                  <span className="text-xs text-indigo-100 block">Pre-Eat Check (Bio-Simulation)</span>
               </div>
            </div>
            <ArrowRight className="text-white w-5 h-5 opacity-70" />
          </label>

        {/* Text Input */}
        <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2 pr-2">
            <div className="p-3 bg-slate-100 rounded-xl text-slate-500"><Keyboard className="w-5 h-5" /></div>
            <input 
                type="text" 
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTextAnalysis(textInput)}
                placeholder="Type meal (e.g. Oatmeal)..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-700 focus:outline-none"
            />
            <button onClick={() => handleTextAnalysis(textInput)} disabled={!textInput.trim() || isAnalyzing} className="p-3 bg-slate-900 text-white rounded-xl disabled:opacity-50"><ArrowRight className="w-4 h-4" /></button>
        </div>

        {(isAnalyzing || isSimulating) && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center animate-pulse">
            <Loader2 className="w-8 h-8 text-teal-500 animate-spin mx-auto mb-3" />
            <h3 className="font-bold text-slate-800">{isSimulating ? 'Running Bio-Simulation...' : 'Analyzing Image...'}</h3>
            <p className="text-slate-400 text-sm">
               {isSimulating ? 'Predicting inflammatory response' : 'Checking sensitivities & ingredients'}
            </p>
          </div>
        )}
      </div>

      {/* History Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-slate-400" />
          <h3 className="text-lg font-bold text-slate-700">Recent Logs</h3>
        </div>

        {history.length === 0 ? (
           <div className="text-center py-10 opacity-50"><Utensils className="w-10 h-10 mx-auto mb-2 text-slate-400" /><p className="text-slate-500">No logs yet.</p></div>
        ) : (
          <div className="space-y-4">
            {history.map((log) => (
              <div key={log.id} onClick={() => startEdit(log)} className={`bg-white rounded-2xl p-3 shadow-sm border flex gap-3 cursor-pointer hover:border-teal-200 transition-colors group relative ${log.isGroceryScan ? 'border-indigo-100' : 'border-slate-100'}`}>
                 <div className="w-20 h-20 bg-slate-100 rounded-xl flex-shrink-0 overflow-hidden relative">
                    {log.imageUrl ? <img src={log.imageUrl} alt="Meal" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><Utensils className="w-6 h-6" /></div>}
                    {log.isGroceryScan && <div className="absolute top-1 right-1 bg-indigo-600 text-white p-0.5 rounded-md"><ScanBarcode className="w-3 h-3" /></div>}
                 </div>
                 <div className="flex-1 min-w-0 py-1">
                    <div className="flex justify-between items-start">
                       <div>
                         <h4 className="font-bold text-slate-800 truncate leading-tight pr-6">{log.detectedItems.map(i => i.name).join(', ')}</h4>
                         <p className="text-xs text-slate-400 flex items-center gap-1 mt-1"><Clock className="w-3 h-3" /> {formatDate(log.timestamp)}</p>
                       </div>
                       {/* UPDATED NUTRITION SUMMARY */}
                       <div className="text-right">
                           {(() => {
                               const stats = log.detectedItems.reduce((acc, i) => ({
                                   cals: acc.cals + (i.nutrition?.calories || 0),
                                   pro: acc.pro + (i.nutrition?.protein || 0),
                                   carb: acc.carb + (i.nutrition?.carbs || 0),
                                   fat: acc.fat + (i.nutrition?.fat || 0),
                               }), { cals: 0, pro: 0, carb: 0, fat: 0 });

                               if (stats.cals > 0) {
                                   return (
                                       <div className="flex flex-col items-end gap-1">
                                            <span className="text-sm font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">{stats.cals} kcal</span>
                                            <div className="flex gap-2 text-[10px] font-bold text-slate-400">
                                                <span className="text-slate-600">{stats.pro}p</span>
                                                <span className="text-slate-600">{stats.carb}c</span>
                                                <span className="text-slate-600">{stats.fat}f</span>
                                            </div>
                                       </div>
                                   );
                               }
                               return null;
                           })()}
                       </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                       {/* Show categories */}
                       {log.detectedItems.map((i, idx) => i.category && (
                          <span key={`cat-${idx}`} className="text-[9px] px-1.5 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase">{i.category}</span>
                       ))}
                       {log.detectedItems.some(i => i.sensitivityAlert) && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md border border-rose-200 bg-rose-100 text-rose-700 font-bold uppercase">Sensitivity Alert</span>
                       )}
                       {log.detectedItems.flatMap(i => i.tags || []).slice(0, 3).map((tag, idx) => (
                         <span key={idx} className={`text-[9px] px-1.5 py-0.5 rounded-md border uppercase font-bold ${getTagColor(tag)}`}>{tag}</span>
                       ))}
                    </div>
                 </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
