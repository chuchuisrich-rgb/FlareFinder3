
import React, { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle2, AlertTriangle, X, Loader2, Scan, BarChart3, PieChart, Info, Search, FlaskConical, Dna, Activity, ChevronDown, ChevronUp, Plus, TrendingUp, Tag, Save } from 'lucide-react';
import { db } from '../services/db';
import { parseLabResults } from '../services/geminiService';
import { FoodSensitivity, AppState, LabReport, Biomarker } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export const LabManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [sensitivities, setSensitivities] = useState<FoodSensitivity[]>([]);
  const [reports, setReports] = useState<LabReport[]>([]);
  const [biomarkers, setBiomarkers] = useState<Biomarker[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [activeTab, setActiveTab] = useState<'search' | 'reports' | 'list' | 'trends'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadType, setUploadType] = useState<'food_sensitivity' | 'microbiome' | 'hormonal' | 'bloodwork'>('food_sensitivity');
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  
  // Manual Input State (Reports)
  const [manualMode, setManualMode] = useState(false);
  const [manualText, setManualText] = useState('');

  // Manual Trigger Entry State
  const [showAddTrigger, setShowAddTrigger] = useState(false);
  const [newTriggerName, setNewTriggerName] = useState('');
  const [newTriggerLevel, setNewTriggerLevel] = useState<'high' | 'medium' | 'low'>('high');
  const [newTriggerCategory, setNewTriggerCategory] = useState('Other');
  
  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const state = db.getState();
    if (state.user?.foodSensitivities) {
      setSensitivities(state.user.foodSensitivities);
    }
    if (state.user?.labReports) {
        setReports(state.user.labReports);
    }
    if (state.biomarkers) {
        setBiomarkers(state.biomarkers);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    let successCount = 0;
    let failCount = 0;
    let totalNewSensitivities = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProcessingStatus(`Initializing analysis for ${file.name}...`);

        try {
            await new Promise<void>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = async () => {
                    const base64Raw = reader.result as string;
                    const base64Data = base64Raw.split(',')[1];
                    
                    try {
                        // Pass a callback to update status granularly (e.g., page 5 of 200)
                        const { sensitivities: newSensitivities, summary, extractedBiomarkers } = await parseLabResults(
                            base64Data, 
                            file.type, 
                            uploadType, 
                            (status) => setProcessingStatus(status)
                        );
                        
                        // Save parsed food sensitivities
                        if (newSensitivities.length > 0) {
                            db.updateUserSensitivities(newSensitivities);
                            totalNewSensitivities += newSensitivities.length;
                        }

                        // Save Biomarkers
                        if (extractedBiomarkers && extractedBiomarkers.length > 0) {
                            db.addBiomarkers(extractedBiomarkers);
                        }
                        
                        // Save Report Summary
                        const newReport: LabReport = {
                            id: crypto.randomUUID(),
                            type: uploadType,
                            dateUploaded: new Date().toISOString(),
                            summary: summary,
                            extractedBiomarkers: extractedBiomarkers // Store locally in report too
                        };
                        db.addLabReport(newReport);
                        successCount++;
                        resolve();
                    } catch (err) {
                        console.error(`Error processing file ${file.name}:`, err);
                        failCount++;
                        // Don't reject, just let the loop continue
                        resolve();
                    }
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        } catch (e) {
            console.error("File read error", e);
            failCount++;
        }
    }

    // Refresh local state
    const updatedState = db.getState();
    setSensitivities(updatedState.user?.foodSensitivities || []);
    setReports(updatedState.user?.labReports || []);
    setBiomarkers(updatedState.biomarkers || []);

    setIsProcessing(false);
    setProcessingStatus('');
    
    if (successCount > 0) {
        alert(`Batch Complete! Processed ${successCount} files. Archived ${totalNewSensitivities} new data points.${failCount > 0 ? ` (${failCount} files failed)` : ''}`);
        setActiveTab('list');
    } else {
        alert("Failed to process uploaded files. Please check if the file is a standard PDF or Image.");
    }
  };
  
  const handleManualSubmit = async () => {
      if (!manualText.trim()) return;
      setIsProcessing(true);
      setProcessingStatus("Analyzing text...");
      try {
          const newReport: LabReport = {
            id: crypto.randomUUID(),
            type: uploadType,
            dateUploaded: new Date().toISOString(),
            summary: "Manual Entry: " + manualText.substring(0, 100) + "...",
            rawText: manualText
          };
          db.addLabReport(newReport);
          setReports(prev => [newReport, ...prev]);
          setManualText('');
          setManualMode(false);
          alert("Manual entry saved to reports.");
      } catch (e) {
          console.error(e);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleSaveManualTrigger = () => {
      if (!newTriggerName.trim()) return;
      
      const newSensitivity: FoodSensitivity = {
          food: newTriggerName.trim(),
          level: newTriggerLevel,
          category: newTriggerCategory,
          source: 'manual',
          dateDetected: new Date().toISOString()
      };
      
      db.updateUserSensitivities([newSensitivity]);
      
      // Refresh local state
      const state = db.getState();
      setSensitivities(state.user?.foodSensitivities || []);
      
      setNewTriggerName('');
      setShowAddTrigger(false);
  };
  
  // Safe Search Logic
  const filteredSensitivities = sensitivities.filter(s => 
      s.food.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const getSafeStatus = () => {
      if (!searchQuery) return null;
      if (filteredSensitivities.some(s => s.level === 'high')) return 'unsafe';
      if (filteredSensitivities.some(s => s.level === 'medium')) return 'caution';
      // If found in list but low, or not found (assuming user has uploaded exhaustive list)
      if (filteredSensitivities.length > 0) return 'safe';
      return 'unknown';
  };
  
  const status = getSafeStatus();

  // Helper for List View Grouping
  const renderGroup = (level: 'high' | 'medium' | 'low', title: string, colorClass: string, icon: React.ReactNode) => {
    const items = sensitivities.filter(s => s.level === level);
    if (items.length === 0) return null;
    return (
        <div className="mb-6">
            <h4 className={`font-bold mb-3 flex items-center gap-2 ${colorClass}`}>
                {icon} {title} <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">{items.length}</span>
            </h4>
            <div className="grid grid-cols-2 gap-2">
                {items.map((s, i) => (
                    <div key={i} className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm text-sm font-medium text-slate-700 flex justify-between items-center group relative overflow-hidden">
                        <span>{s.food}</span>
                        {s.source === 'manual' && (
                            <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded flex items-center gap-0.5" title="Manually Added">
                                <Tag className="w-3 h-3" />
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
  };
  
  // Group biomarkers for charts
  const getGroupedBiomarkers = () => {
      const grouped: {[key: string]: any[]} = {};
      biomarkers.forEach(b => {
          if (!grouped[b.name]) grouped[b.name] = [];
          grouped[b.name].push({ ...b, dateStr: new Date(b.date).toLocaleDateString() });
      });
      // Sort by date
      Object.keys(grouped).forEach(k => {
          grouped[k].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      });
      return grouped;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
       <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
             <h2 className="font-bold text-slate-800 flex items-center gap-2">
               <FlaskConical className="w-5 h-5 text-indigo-600" />
               Lab Vault
             </h2>
             <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200">
               <X className="w-5 h-5 text-slate-500" />
             </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100 overflow-x-auto">
              <button 
                onClick={() => setActiveTab('search')}
                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap px-4 ${activeTab === 'search' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400'}`}
              >
                  Safe Search
              </button>
              <button 
                onClick={() => setActiveTab('reports')}
                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap px-4 ${activeTab === 'reports' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400'}`}
              >
                  My Reports
              </button>
              <button 
                onClick={() => setActiveTab('list')}
                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap px-4 ${activeTab === 'list' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400'}`}
              >
                  All Items
              </button>
              <button 
                onClick={() => setActiveTab('trends')}
                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap px-4 ${activeTab === 'trends' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400'}`}
              >
                  Trends
              </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
             
             {activeTab === 'trends' ? (
                 <div className="space-y-6 animate-in fade-in">
                     <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                         <h3 className="font-bold text-indigo-900 mb-1 flex items-center gap-2">
                             <TrendingUp className="w-4 h-4" /> Longitudinal Insights
                         </h3>
                         <p className="text-xs text-indigo-700">
                             Upload multiple lab reports over time to see how your key biomarkers (CRP, Hormones, etc.) are changing.
                         </p>
                     </div>
                     
                     {biomarkers.length === 0 ? (
                         <div className="text-center py-10 opacity-50">
                             <BarChart3 className="w-12 h-12 mx-auto mb-2 text-slate-400" />
                             <p>No biomarker data found yet.</p>
                         </div>
                     ) : (
                         Object.entries(getGroupedBiomarkers()).map(([name, data]) => (
                             <div key={name} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                                 <h4 className="font-bold text-slate-700 mb-2 text-sm">{name} <span className="text-slate-400 text-xs font-normal">({data[0].unit})</span></h4>
                                 <div className="h-40 w-full">
                                     <ResponsiveContainer width="100%" height="100%">
                                         <LineChart data={data}>
                                             <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                             <XAxis dataKey="dateStr" tick={{fontSize: 10}} stroke="#94a3b8" />
                                             <YAxis tick={{fontSize: 10}} stroke="#94a3b8" />
                                             <Tooltip 
                                                contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                                itemStyle={{fontSize: '12px', fontWeight: 'bold', color: '#4f46e5'}}
                                             />
                                             <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{fill: '#6366f1', r: 4}} activeDot={{r: 6}} />
                                         </LineChart>
                                     </ResponsiveContainer>
                                 </div>
                             </div>
                         ))
                     )}
                 </div>
             ) : activeTab === 'search' ? (
                 <div className="space-y-6">
                     <div className="text-center mb-4">
                         <h3 className="font-bold text-slate-800 text-lg">Global Trigger Search</h3>
                         <p className="text-slate-500 text-sm">Search your complete sensitivity database.</p>
                     </div>
                     
                     <div className="relative">
                         <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                         <input 
                            type="text" 
                            placeholder="Type food (e.g. Garlic, Yeast)..." 
                            className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                         />
                     </div>
                     
                     {searchQuery && (
                         <div className="animate-in fade-in slide-in-from-bottom-2">
                             {status === 'unsafe' && (
                                 <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-center">
                                     <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
                                     <h3 className="text-xl font-black text-rose-600">UNSAFE</h3>
                                     <p className="text-rose-800">Found in your HIGH sensitivity list.</p>
                                 </div>
                             )}
                             {status === 'caution' && (
                                 <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl text-center">
                                     <AlertTriangle className="w-10 h-10 text-orange-500 mx-auto mb-2" />
                                     <h3 className="text-xl font-black text-orange-600">CAUTION</h3>
                                     <p className="text-orange-800">Found in your MEDIUM sensitivity list.</p>
                                 </div>
                             )}
                             {status === 'safe' && (
                                 <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center">
                                     <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                                     <h3 className="text-xl font-black text-emerald-600">LIKELY SAFE</h3>
                                     <p className="text-emerald-800">Found in your LOW sensitivity list.</p>
                                 </div>
                             )}
                             {status === 'unknown' && (
                                 <div className="bg-slate-100 p-4 rounded-xl text-center">
                                     <p className="text-slate-500 font-medium">Not found in your uploaded reports.</p>
                                 </div>
                             )}
                             
                             {/* Matches List */}
                             <div className="mt-4 space-y-2">
                                 {filteredSensitivities.map((s, i) => (
                                     <div key={i} className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border border-slate-100">
                                         <span className="font-medium text-slate-700">{s.food}</span>
                                         <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase ${
                                             s.level === 'high' ? 'bg-rose-100 text-rose-600' : 
                                             s.level === 'medium' ? 'bg-orange-100 text-orange-600' : 
                                             'bg-emerald-100 text-emerald-600'
                                         }`}>{s.level}</span>
                                     </div>
                                 ))}
                             </div>
                         </div>
                     )}
                     
                     {!searchQuery && (
                         <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                             <div className="flex gap-2 items-start">
                                 <Info className="w-4 h-4 text-indigo-500 mt-0.5" />
                                 <p className="text-xs text-indigo-700">
                                     Pro Tip: Before ordering at a restaurant, type ingredients here to check against your entire lab history.
                                 </p>
                             </div>
                         </div>
                     )}
                 </div>
             ) : activeTab === 'list' ? (
                 <div className="space-y-4">
                     <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-700">Your Sensitivity Profile</h3>
                        <button 
                            onClick={() => setShowAddTrigger(!showAddTrigger)}
                            className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-slate-800"
                        >
                            {showAddTrigger ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                            {showAddTrigger ? 'Cancel' : 'Add Custom'}
                        </button>
                     </div>

                     {/* Manual Add Form */}
                     {showAddTrigger && (
                         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-2">
                             <h4 className="font-bold text-slate-700 mb-3 text-sm">Add New Sensitivity</h4>
                             <div className="space-y-3">
                                 <div>
                                     <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Food / Ingredient</label>
                                     <input 
                                        type="text" 
                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                                        placeholder="e.g. Strawberries"
                                        value={newTriggerName}
                                        onChange={(e) => setNewTriggerName(e.target.value)}
                                     />
                                 </div>
                                 <div className="flex gap-2">
                                     <div className="flex-1">
                                         <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Sensitivity Level</label>
                                         <select 
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                                            value={newTriggerLevel}
                                            onChange={(e) => setNewTriggerLevel(e.target.value as any)}
                                         >
                                             <option value="high">High (Avoid)</option>
                                             <option value="medium">Medium (Limit)</option>
                                             <option value="low">Low (Safe-ish)</option>
                                         </select>
                                     </div>
                                     <div className="flex-1">
                                         <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Category</label>
                                         <select 
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                                            value={newTriggerCategory}
                                            onChange={(e) => setNewTriggerCategory(e.target.value)}
                                         >
                                             <option value="Dairy">Dairy</option>
                                             <option value="Gluten">Gluten</option>
                                             <option value="Nightshade">Nightshade</option>
                                             <option value="Fruit">Fruit</option>
                                             <option value="Vegetable">Vegetable</option>
                                             <option value="Grain">Grain</option>
                                             <option value="Other">Other</option>
                                         </select>
                                     </div>
                                 </div>
                                 <button 
                                    onClick={handleSaveManualTrigger}
                                    disabled={!newTriggerName.trim()}
                                    className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold text-sm disabled:opacity-50 hover:bg-indigo-700 flex items-center justify-center gap-2"
                                 >
                                     <Save className="w-4 h-4" /> Save Trigger
                                 </button>
                             </div>
                         </div>
                     )}
                     
                     {sensitivities.length === 0 ? (
                         <div className="text-center py-10 bg-white rounded-xl border border-slate-100 border-dashed">
                             <p className="text-slate-400 italic">No sensitivities logged yet.</p>
                             <button onClick={() => setActiveTab('reports')} className="mt-2 text-indigo-600 text-sm font-bold">Upload a report to populate</button>
                         </div>
                     ) : (
                         <div className="animate-in fade-in slide-in-from-bottom-2">
                            {renderGroup('high', 'High Priority (Avoid)', 'text-rose-600', <AlertTriangle className="w-4 h-4" />)}
                            {renderGroup('medium', 'Medium Priority (Limit)', 'text-orange-600', <Info className="w-4 h-4" />)}
                            {renderGroup('low', 'Low Priority (Safe-ish)', 'text-emerald-600', <CheckCircle2 className="w-4 h-4" />)}
                         </div>
                     )}
                 </div>
             ) : (
                 <div className="space-y-6">
                    {/* Upload Section */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-bold text-slate-700">Add New Data</h3>
                            <button onClick={() => setManualMode(!manualMode)} className="text-xs text-indigo-600 font-bold">
                                {manualMode ? 'Cancel Manual Input' : 'Type Manually'}
                            </button>
                        </div>
                        
                        <div className="flex gap-2 mb-3 overflow-x-auto pb-2 no-scrollbar">
                            {['food_sensitivity', 'microbiome', 'hormonal', 'bloodwork'].map((t) => (
                                <button 
                                    key={t}
                                    onClick={() => setUploadType(t as any)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition-colors ${
                                        uploadType === t 
                                        ? 'bg-indigo-600 text-white border-indigo-600' 
                                        : 'bg-slate-50 text-slate-500 border-slate-200'
                                    }`}
                                >
                                    {t.replace('_', ' ').toUpperCase()}
                                </button>
                            ))}
                        </div>
                        
                        {manualMode ? (
                            <div className="space-y-3">
                                <textarea 
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-32"
                                    placeholder="Paste text from your report here..."
                                    value={manualText}
                                    onChange={(e) => setManualText(e.target.value)}
                                />
                                <button 
                                    onClick={handleManualSubmit}
                                    disabled={!manualText.trim() || isProcessing}
                                    className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50"
                                >
                                    {isProcessing ? 'Saving...' : 'Save Manual Entry'}
                                </button>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 hover:border-indigo-400 transition-colors relative overflow-hidden">
                                {isProcessing ? (
                                    <div className="text-center relative z-10 bg-white/80 p-4 rounded-xl backdrop-blur-sm w-full h-full flex flex-col items-center justify-center">
                                        <div className="w-full max-w-[200px] bg-slate-200 rounded-full h-2 mb-3">
                                            <div className="bg-indigo-500 h-2 rounded-full animate-pulse" style={{width: '100%'}}></div>
                                        </div>
                                        <p className="text-sm font-bold text-indigo-600">{processingStatus || "Processing..."}</p>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                        <p className="text-sm font-bold text-slate-600">Tap to Upload Pages</p>
                                        <p className="text-xs text-slate-400">PDFs, Images • Select Multiple Files</p>
                                    </div>
                                )}
                                <input 
                                    type="file" 
                                    accept="image/*,application/pdf" 
                                    multiple 
                                    className="hidden" 
                                    onChange={handleFileUpload} 
                                    disabled={isProcessing} 
                                />
                            </label>
                        )}
                    </div>

                    {/* Reports List */}
                    <div className="space-y-3">
                        <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Saved Reports</h3>
                        {reports.length === 0 ? (
                            <p className="text-center text-slate-400 text-sm italic py-4">No reports uploaded yet.</p>
                        ) : (
                            reports.map((report) => (
                                <div key={report.id} className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm transition-all hover:border-indigo-100">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            {report.type === 'microbiome' ? <Dna className="w-4 h-4 text-purple-500" /> : 
                                             report.type === 'hormonal' ? <Activity className="w-4 h-4 text-rose-500" /> :
                                             <FileText className="w-4 h-4 text-teal-500" />}
                                            <span className="font-bold text-slate-800 capitalize">{report.type.replace('_', ' ')}</span>
                                        </div>
                                        <span className="text-xs text-slate-400">{new Date(report.dateUploaded).toLocaleDateString()}</span>
                                    </div>
                                    
                                    <div className={`text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 relative ${expandedReportId === report.id ? '' : 'max-h-24 overflow-hidden'}`}>
                                        <p className="whitespace-pre-wrap">{report.summary}</p>
                                        
                                        {expandedReportId !== report.id && (
                                            <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-slate-50 to-transparent" />
                                        )}
                                    </div>
                                    
                                    <button 
                                        onClick={() => setExpandedReportId(expandedReportId === report.id ? null : report.id)}
                                        className="w-full mt-2 text-xs font-bold text-indigo-600 flex items-center justify-center gap-1 hover:text-indigo-800 py-1"
                                    >
                                        {expandedReportId === report.id ? (
                                            <>Show Less <ChevronUp className="w-3 h-3" /></>
                                        ) : (
                                            <>Read Full Analysis <ChevronDown className="w-3 h-3" /></>
                                        )}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                 </div>
             )}
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50">
             <button onClick={onClose} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800">
               Done
             </button>
          </div>
       </div>
    </div>
  );
};
