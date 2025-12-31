
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { generatePatternInsights, getSmartReminders, runFlareDetective } from '../services/geminiService';
import { AppState, Reminder, DeepAnalysis, FlareDetectiveReport } from '../types';
import { Sparkles, TrendingUp, TrendingDown, Activity, Bell, Clock, Beaker, Shield, AlertOctagon, RefreshCw, CheckCircle2, Flame, X, ArrowRight, ScanLine, Search, Camera, ScanBarcode, Microscope, CalendarHeart, Loader2, Layers, AlertTriangle, Plus, CloudSun, Utensils, Smile, Heart, Sunrise, CloudRain, Sun, HelpCircle, MessageCircle, Zap, ShieldAlert, Info, ShoppingBag, Fingerprint, BrainCircuit, BarChart, Database } from 'lucide-react';
import {
  AreaChart,
  Area,
  Tooltip,
  ResponsiveContainer,
  XAxis
} from 'recharts';
import { LabManager } from './LabManager';

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<AppState | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [analysis, setAnalysis] = useState<DeepAnalysis | null>(null);
  const [showLabs, setShowLabs] = useState(false);
  const [streakDays, setStreakDays] = useState(0);
  const [hasSufficientData, setHasSufficientData] = useState(false);
  const [detectiveReport, setDetectiveReport] = useState<FlareDetectiveReport | null>(null);
  const [isRunningDetective, setIsRunningDetective] = useState(false);
  const [triggerMap, setTriggerMap] = useState<{name: string, probability: number, volume: number}[]>([]);
  const [showIndexInfo, setShowIndexInfo] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const state = db.getState();
    setData(state);
    setAnalysis(state.currentAnalysis || null);
    if (state.flareDetectiveReports && state.flareDetectiveReports.length > 0) {
        setDetectiveReport(state.flareDetectiveReports[0]);
    }
    
    if ((state.foodLogs?.length || 0) >= 3 || (state.flareLogs?.length || 0) > 0) {
        setHasSufficientData(true);
    }

    prepareChartData(state);
    calculateMetrics(state);
    calculateTriggerCorrelations(state);
    
    try {
        const smartReminders = await getSmartReminders(state);
        if (smartReminders) setReminders(smartReminders);
    } catch (e) {
        console.warn("Reminders offline.");
    }
  };

  const calculateTriggerCorrelations = (state: AppState) => {
    if (!state.foodLogs) return;
    const stats: Record<string, { exposures: number; flares: number }> = {};
    const WINDOW = 48 * 60 * 60 * 1000;

    state.foodLogs.forEach(foodLog => {
        const foodTime = new Date(foodLog.timestamp).getTime();
        const relevantFlare = (state.flareLogs || []).find(f => {
            const fTime = new Date(f.timestamp).getTime();
            return fTime > foodTime && fTime < (foodTime + WINDOW) && f.severity >= 2;
        });

        if (foodLog.detectedItems) {
            foodLog.detectedItems.forEach(item => {
                const cat = item.category || 'Other';
                if (cat === 'Other' || cat === 'Manual Entry') return; 
                if (!stats[cat]) stats[cat] = { exposures: 0, flares: 0 };
                stats[cat].exposures += 1;
                if (relevantFlare) stats[cat].flares += 1;
            });
        }
    });

    const mapData = Object.entries(stats)
        .map(([name, data]) => ({
            name,
            probability: data.exposures > 0 ? Math.round((data.flares / data.exposures) * 100) : 0,
            volume: data.exposures
        }))
        .filter(item => item.volume > 0) 
        .sort((a, b) => b.probability - a.probability);

    setTriggerMap(mapData);
  };

  const prepareChartData = (state: AppState) => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    const dataArr = last7Days.map(date => {
      const dateStr = date.toISOString().split('T')[0];
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dayFlares = (state.flareLogs || []).filter(f => f.timestamp.startsWith(dateStr));
      const maxSeverity = dayFlares.reduce((acc, f) => Math.max(acc, f.severity), 0);
      return { name: dayName, score: maxSeverity * 20 };
    });
    setChartData(dataArr);
  };

  const calculateMetrics = (state: AppState) => {
    let currentStreak = 0;
    const foodCount = state.foodLogs?.length || 0;
    const flareCount = state.flareLogs?.length || 0;
    if (foodCount > 0 || flareCount > 0) {
      currentStreak = Math.min(30, foodCount + flareCount); 
    }
    setStreakDays(currentStreak);
  };

  const handleGenerateInsights = async () => {
      if (!data) return;
      if (!data.foodLogs || data.foodLogs.length < 3) {
          alert("Log at least 3 meals to generate a Bio-Forecast.");
          return;
      }
      setLoadingInsights(true);
      try {
          const result = await generatePatternInsights(data);
          if (result) {
              setAnalysis(result);
              db.saveAnalysis(result);
          }
      } catch (e) {
          alert("Neural engine busy. Retrying...");
      } finally {
          setLoadingInsights(false);
      }
  };

  const handleRunDetective = async () => {
      if (!data || !data.foodLogs || data.foodLogs.length < 2) {
          alert("Detective mode requires more history.");
          return;
      }
      setIsRunningDetective(true);
      try {
          const report = await runFlareDetective(data);
          if (report) {
            setDetectiveReport(report);
            db.saveFlareDetectiveReport(report);
          }
      } catch (e) {
          alert("Detective analysis failed.");
      } finally {
          setIsRunningDetective(false);
      }
  };

  const currentScore = chartData.length > 0 ? chartData[chartData.length - 1].score : 0;
  
  const getWeatherIcon = (status?: string) => {
      if (status?.includes('Sunny')) return <Sun className="w-10 h-10 text-amber-200" />;
      if (status?.includes('Stormy')) return <CloudRain className="w-10 h-10 text-blue-200" />;
      return <CloudSun className="w-10 h-10 text-teal-100" />;
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
       <div className="flex justify-between items-start">
          <div className="flex-1 pr-4">
              <h1 className="text-xl font-black text-slate-800 leading-tight">
                  {analysis?.dailyNarrative || `Synchronizing biology... Welcome back, ${data?.user?.name || 'User'}.`}
              </h1>
          </div>
          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-100">
             <Flame className="w-4 h-4 text-orange-500" fill="currentColor" />
             <span className="font-black text-slate-700 text-sm">{streakDays}</span>
          </div>
       </div>

       {analysis?.bioWeather && (
         <div className="relative group">
           <div className={`rounded-[2.5rem] p-7 shadow-2xl relative overflow-hidden transition-all duration-500 ${
               analysis.bioWeather.status?.includes('Sunny') ? 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-emerald-200' :
               analysis.bioWeather.status?.includes('Stormy') ? 'bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-slate-400' :
               'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-indigo-200'
           }`}>
              <div className="flex justify-between items-start relative z-10">
                 <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70">Neural Forecast</span>
                    <h2 className="text-4xl font-black tracking-tight">{analysis.bioWeather.status}</h2>
                    <p className="font-bold text-lg leading-tight opacity-90">{analysis.bioWeather.headline}</p>
                 </div>
                 <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-md border border-white/20">
                    {getWeatherIcon(analysis.bioWeather.status)}
                 </div>
              </div>
              <div className="mt-6 pt-5 border-t border-white/10 relative z-10">
                  <p className="text-sm font-medium opacity-80 leading-relaxed">{analysis.bioWeather.summary}</p>
              </div>
              <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
           </div>

           {analysis.dailyProtocol && (
               <div className="grid grid-cols-2 gap-3 mt-4">
                   {[
                       { icon: <Utensils className="w-4 h-4 text-emerald-500" />, label: 'Fuel', text: analysis.dailyProtocol.nutritionFocus },
                       { icon: <Activity className="w-4 h-4 text-rose-500" />, label: 'Biokinetics', text: analysis.dailyProtocol.movement },
                       { icon: <Shield className="w-4 h-4 text-indigo-500" />, label: 'Defense', text: analysis.dailyProtocol.selfCare },
                       { icon: <BrainCircuit className="w-4 h-4 text-amber-500" />, label: 'Neural', text: analysis.dailyProtocol.mindset }
                   ].map((item, i) => (
                       <div key={i} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                           <div className="flex items-center gap-2 mb-2">
                               {item.icon}
                               <h4 className="font-black text-slate-400 text-[10px] uppercase tracking-widest">{item.label}</h4>
                           </div>
                           <p className="text-xs font-bold text-slate-700 leading-snug">{item.text}</p>
                       </div>
                   ))}
               </div>
           )}
         </div>
       )}

       <div className="bg-slate-900 rounded-[2.5rem] p-7 text-white shadow-2xl shadow-slate-200 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl -mr-20 -mt-20" />
           <div className="relative z-10">
               <div className="flex justify-between items-start mb-8">
                   <div>
                       <div className="flex items-center gap-2 mb-1">
                           <h2 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Inflammation Index</h2>
                           <button onClick={() => setShowIndexInfo(!showIndexInfo)} className="p-1 text-slate-600 hover:text-white transition-colors">
                              <HelpCircle className="w-3.5 h-3.5" />
                           </button>
                       </div>
                       {showIndexInfo && (
                          <div className="absolute top-12 left-0 z-50 bg-slate-800 border border-slate-700 p-4 rounded-2xl shadow-xl w-64 text-xs font-medium text-slate-300 animate-in fade-in zoom-in duration-200">
                             This index (0-100) scales your highest recorded flare severity today. 100 represents a peak (Severity 5) crisis.
                          </div>
                       )}
                       <div className="flex items-baseline gap-2">
                           <span className="text-6xl font-black text-white tabular-nums">{currentScore}</span>
                           <span className="text-slate-500 font-bold text-sm tracking-widest">/100</span>
                       </div>
                   </div>
                   <div className="flex flex-col items-end gap-2">
                        <div className="bg-white/5 backdrop-blur-xl p-3 rounded-2xl border border-white/10">
                            <Fingerprint className="w-6 h-6 text-teal-400" />
                        </div>
                        <span className="text-[10px] font-black text-teal-400 uppercase tracking-widest">Secure Link</span>
                   </div>
               </div>

               <div className="h-32 w-full -ml-2 mb-6">
                   {hasSufficientData ? (
                       <ResponsiveContainer width="100%" height="100%">
                           <AreaChart data={chartData}>
                               <defs>
                                   <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                       <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.4}/>
                                       <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0}/>
                                   </linearGradient>
                               </defs>
                               <Area type="monotone" dataKey="score" stroke="#2dd4bf" strokeWidth={4} fill="url(#chartGradient)" />
                           </AreaChart>
                       </ResponsiveContainer>
                   ) : (
                       <div className="h-full flex flex-col items-center justify-center border border-dashed border-slate-700 rounded-3xl">
                           <Activity className="w-6 h-6 mb-2 text-slate-700" />
                           <p className="text-[10px] font-bold text-slate-500 uppercase">Insufficient Bio-Data</p>
                       </div>
                   )}
               </div>
               
               <div className="flex gap-3">
                  <button onClick={handleGenerateInsights} disabled={loadingInsights} className="flex-1 bg-white text-slate-900 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all">
                      {loadingInsights ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-purple-600" />}
                      Sync Forecast
                  </button>
                  <button onClick={handleRunDetective} disabled={isRunningDetective} className="flex-1 bg-slate-800 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all border border-slate-700">
                      {isRunningDetective ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      Detective
                  </button>
               </div>
           </div>
       </div>

       {triggerMap.length > 0 && (
           <div className="space-y-4">
               <div className="flex items-center justify-between px-1">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" /> Neural Suspect Gallery
                  </h3>
                  <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase">
                     <Database className="w-3 h-3" /> Statistical Match
                  </div>
               </div>
               <div className="grid grid-cols-1 gap-3">
                   {triggerMap.slice(0, 4).map((suspect, i) => (
                       <div key={i} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 group hover:border-rose-200 transition-all relative overflow-hidden">
                           {suspect.volume < 3 && (
                               <div className="absolute top-0 right-0 bg-slate-900 text-white px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-bl-xl border-l border-b border-slate-800">
                                  Low Confidence (Data Needed)
                               </div>
                           )}
                           <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${suspect.probability > 60 ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                               {suspect.probability}%
                           </div>
                           <div className="flex-1">
                               <h4 className="font-black text-slate-800 text-base">{suspect.name}</h4>
                               <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                                   <div className={`h-full rounded-full transition-all duration-1000 ${suspect.probability > 60 ? 'bg-rose-500' : 'bg-amber-500'}`} style={{ width: `${suspect.probability}%` }} />
                               </div>
                           </div>
                           <div className="text-right">
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Exposures</p>
                               <p className="text-xs font-black text-slate-700">{suspect.volume}x</p>
                           </div>
                       </div>
                   ))}
               </div>
               <p className="text-[10px] text-center text-slate-400 font-medium px-4 leading-relaxed italic">
                 "100% correlation means every recorded exposure preceded a flare within 48h. More data volume increases suspect reliability."
               </p>
           </div>
       )}

       {detectiveReport && (
           <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-[2.5rem] shadow-sm animate-in slide-in-from-bottom-4 duration-500">
               <div className="flex items-center gap-3 mb-5">
                   <div className="bg-indigo-600 p-2.5 rounded-xl"><Microscope className="w-5 h-5 text-white" /></div>
                   <h3 className="font-black text-indigo-900 uppercase tracking-widest text-xs">Detective Audit Report</h3>
               </div>
               <p className="text-sm font-bold text-indigo-900 leading-relaxed mb-6 italic">"{detectiveReport.conclusion}"</p>
               <div className="space-y-3">
                   {detectiveReport.suspects.map((s, i) => (
                       <div key={i} className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-indigo-200 flex justify-between items-center">
                           <div className="flex-1 pr-4">
                               <p className="text-xs font-black text-slate-800">{s.name}</p>
                               <p className="text-[10px] text-slate-500 font-medium tight mt-1">{s.reason}</p>
                           </div>
                           <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100 uppercase">{Math.round(s.confidence * 100)}% Conf.</span>
                       </div>
                   ))}
               </div>
           </div>
       )}

       <div className="w-full">
          <button onClick={() => setShowLabs(true)} className="w-full bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center gap-6 hover:border-indigo-200 active:scale-95 transition-all">
              <div className="bg-indigo-50 p-5 rounded-3xl flex-shrink-0"><Microscope className="w-10 h-10 text-indigo-600" /></div>
              <div className="text-left">
                  <span className="font-black text-slate-800 text-lg block leading-none">Lab Vault</span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 block">Manage clinical results & sensitivities</span>
              </div>
          </button>
       </div>

       {showLabs && <LabManager onClose={() => setShowLabs(false)} />}
    </div>
  );
};
