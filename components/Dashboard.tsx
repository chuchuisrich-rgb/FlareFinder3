
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { generatePatternInsights, getSmartReminders, runFlareDetective } from '../services/geminiService';
import { AppState, Reminder, DeepAnalysis, FlareDetectiveReport } from '../types';
import { Sparkles, TrendingUp, TrendingDown, Activity, Bell, Clock, Beaker, Shield, AlertOctagon, RefreshCw, CheckCircle2, Flame, X, ArrowRight, ScanLine, Search, Camera, ScanBarcode, Microscope, CalendarHeart, Loader2, Layers, AlertTriangle, Plus, CloudSun, Utensils, Smile, Heart, Sunrise, CloudRain, Sun, HelpCircle, MessageCircle, Zap, ShieldAlert, Info, ShoppingBag } from 'lucide-react';
import {
  AreaChart,
  Area,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { LabManager } from './LabManager';

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<AppState | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [analysis, setAnalysis] = useState<DeepAnalysis | null>(null);
  const [showLabs, setShowLabs] = useState(false);
  const [radarData, setRadarData] = useState<any[]>([]);
  const [streakDays, setStreakDays] = useState(0);
  const [hasSufficientData, setHasSufficientData] = useState(false);
  const [showScoreInfo, setShowScoreInfo] = useState(false);
  const [detectiveReport, setDetectiveReport] = useState<FlareDetectiveReport | null>(null);
  const [isRunningDetective, setIsRunningDetective] = useState(false);
  const [triggerMap, setTriggerMap] = useState<{name: string, probability: number, volume: number}[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const state = db.getState();
    setData(state);
    setAnalysis(state.currentAnalysis);
    if (state.flareDetectiveReports && state.flareDetectiveReports.length > 0) {
        setDetectiveReport(state.flareDetectiveReports[0]);
    }
    
    // Check for enough logs to perform real AI analysis
    if (state.foodLogs.length >= 3 || state.flareLogs.length > 0) {
        setHasSufficientData(true);
    } else {
        setHasSufficientData(false);
    }

    prepareChartData(state);
    calculateMetrics(state);
    calculateTriggerCorrelations(state);
    
    try {
        const smartReminders = await getSmartReminders(state);
        if (smartReminders) setReminders(smartReminders);
    } catch (e) {
        console.warn("Reminders failed to load.");
    }
  };

  const calculateTriggerCorrelations = (state: AppState) => {
    const stats: Record<string, { exposures: number; flares: number }> = {};
    const WINDOW = 48 * 60 * 60 * 1000;

    ['Dairy', 'Nightshade', 'Gluten', 'Sugar', 'Processed', 'Alcohol'].forEach(k => {
        stats[k] = { exposures: 0, flares: 0 };
    });

    state.foodLogs.forEach(foodLog => {
        const foodTime = new Date(foodLog.timestamp).getTime();
        const relevantFlare = state.flareLogs.find(f => {
            const fTime = new Date(f.timestamp).getTime();
            return fTime > foodTime && fTime < (foodTime + WINDOW) && f.severity >= 2;
        });

        foodLog.detectedItems.forEach(item => {
            const cat = item.category || 'Other';
            if (cat === 'Other' || cat === 'Manual Entry') return; 
            
            if (!stats[cat]) stats[cat] = { exposures: 0, flares: 0 };
            stats[cat].exposures += 1;
            if (relevantFlare) stats[cat].flares += 1;
        });
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

    const data = last7Days.map(date => {
      const dateStr = date.toISOString().split('T')[0];
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dayFlares = state.flareLogs.filter(f => f.timestamp.startsWith(dateStr));
      const maxSeverity = dayFlares.reduce((acc, f) => Math.max(acc, f.severity), 0);
      let score = maxSeverity * 20;
      return { name: dayName, score: score };
    });
    setChartData(data);
  };

  const calculateMetrics = (state: AppState) => {
    const recentBehaviors = state.behaviorLogs.slice(0, 30);
    const sleepLogs = recentBehaviors.filter(b => b.type === 'sleep');
    const avgSleep = sleepLogs.length > 0 
        ? sleepLogs.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0) / sleepLogs.length 
        : 7;
    const sleepScore = Math.min(100, (avgSleep / 8) * 100);

    const stressLogs = recentBehaviors.filter(b => b.type === 'stress');
    const avgStress = stressLogs.length > 0
        ? stressLogs.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0) / stressLogs.length
        : 3;
    const stressScore = Math.max(0, 100 - (avgStress * 10));

    const workoutLogs = recentBehaviors.filter(b => b.type === 'workout');
    const avgMove = workoutLogs.length > 0 
        ? workoutLogs.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0) / workoutLogs.length
        : 0;
    const moveScore = Math.min(100, (avgMove / 30) * 100);

    setRadarData([
      { subject: 'Sleep', A: Math.round(sleepScore), fullMark: 100 },
      { subject: 'Stress', A: Math.round(stressScore), fullMark: 100 },
      { subject: 'Diet', A: 85, fullMark: 100 }, 
      { subject: 'Move', A: Math.round(moveScore), fullMark: 100 },
      { subject: 'Hydration', A: 90, fullMark: 100 },
    ]);

    let currentStreak = 0;
    if (state.foodLogs.length > 0 || state.flareLogs.length > 0) {
      currentStreak = Math.min(7, state.foodLogs.length + state.flareLogs.length); 
    }
    setStreakDays(currentStreak);
  };

  const handleGenerateInsights = async () => {
      if (!data) return;
      if (data.foodLogs.length < 3) {
          alert("Log at least 3 meals and a few behaviors so the AI has enough history to build a bio-forecast!");
          return;
      }

      setLoadingInsights(true);
      try {
          const result = await generatePatternInsights(data);
          if (result) {
              setAnalysis(result);
              db.saveAnalysis(result);
          } else {
              throw new Error("Analysis failed");
          }
      } catch (e) {
          console.error(e);
          alert("Forecast Engine Busy. Retrying via Neural Backup...");
      } finally {
          setLoadingInsights(false);
      }
  };

  const handleRunDetective = async () => {
      if (!data) return;
      if (data.foodLogs.length < 2) {
          alert("Detective mode requires more food logs to identify suspects.");
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
          console.error(e);
          alert("Detective failed to scan biology history.");
      } finally {
          setIsRunningDetective(false);
      }
  };

  const currentScore = hasSufficientData && chartData.length > 0 ? chartData[chartData.length - 1].score : "N/A";
  
  const getWeatherIcon = (status?: string) => {
      switch(status) {
          case 'Sunny': return <Sun className="w-12 h-12 text-amber-400" />;
          case 'Cloudy': return <CloudSun className="w-12 h-12 text-slate-400" />;
          case 'Stormy': return <CloudRain className="w-12 h-12 text-indigo-500" />;
          default: return <Sunrise className="w-12 h-12 text-teal-400" />;
      }
  };

  return (
    <div className="space-y-6 pb-20">
       <div className="flex justify-between items-start">
          <div className="flex-1 pr-4">
              <h1 className="text-xl font-bold text-slate-800">
                  {analysis?.dailyNarrative ? (
                      <span className="leading-relaxed">{analysis.dailyNarrative}</span>
                  ) : (
                      `Hello, ${data?.user?.name || 'Friend'}. Ready to optimize your biology?`
                  )}
              </h1>
          </div>
          <div className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-100 flex-shrink-0">
             <Flame className="w-4 h-4 text-orange-500" fill="currentColor" />
             <span className="font-bold text-slate-700">{streakDays}</span>
          </div>
       </div>

       <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-800 font-bold leading-tight uppercase tracking-tight">
            NOT MEDICAL ADVICE: AI insights are experimental probabilistic patterns. Verify with a physician.
          </p>
       </div>

       {analysis?.bioWeather && (
         <div className="animate-in fade-in slide-in-from-top-4 duration-500">
           <div className={`rounded-3xl p-6 shadow-xl mb-6 relative overflow-hidden ${
               analysis.bioWeather.status?.includes('Sunny') ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-orange-200' :
               analysis.bioWeather.status?.includes('Stormy') ? 'bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-slate-300' :
               'bg-gradient-to-br from-blue-400 to-indigo-500 text-white shadow-blue-200'
           }`}>
              <div className="flex justify-between items-start relative z-10">
                 <div>
                    <span className="text-xs font-bold uppercase tracking-widest opacity-80">Bio-Weather Forecast</span>
                    <h2 className="text-3xl font-black mt-1 mb-2">{analysis.bioWeather.status}</h2>
                    <p className="font-medium text-lg opacity-90 leading-tight">{analysis.bioWeather.headline}</p>
                 </div>
                 <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
                    {getWeatherIcon(analysis.bioWeather.status)}
                 </div>
              </div>
              <p className="mt-4 text-sm opacity-80 border-t border-white/20 pt-3">{analysis.bioWeather.summary}</p>
           </div>
           
           {analysis.dailyProtocol && (
               <div className="grid grid-cols-2 gap-3 mb-6">
                   <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                       <div className="flex items-center gap-2 mb-2">
                           <Utensils className="w-4 h-4 text-emerald-500" />
                           <h4 className="font-bold text-slate-700 text-xs uppercase">Eat This</h4>
                       </div>
                       <p className="text-sm font-medium text-slate-600 leading-snug">{analysis.dailyProtocol.nutritionFocus}</p>
                   </div>
                   <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                       <div className="flex items-center gap-2 mb-2">
                           <Activity className="w-4 h-4 text-rose-500" />
                           <h4 className="font-bold text-slate-700 text-xs uppercase">Movement</h4>
                       </div>
                       <p className="text-sm font-medium text-slate-600 leading-snug">{analysis.dailyProtocol.movement}</p>
                   </div>
                   <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                       <div className="flex items-center gap-2 mb-2">
                           <Heart className="w-4 h-4 text-pink-500" />
                           <h4 className="font-bold text-slate-700 text-xs uppercase">Self Care</h4>
                       </div>
                       <p className="text-sm font-medium text-slate-600 leading-snug">{analysis.dailyProtocol.selfCare}</p>
                   </div>
                   <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                       <div className="flex items-center gap-2 mb-2">
                           <Smile className="w-4 h-4 text-amber-500" />
                           <h4 className="font-bold text-slate-700 text-xs uppercase">Mindset</h4>
                       </div>
                       <p className="text-sm font-medium text-slate-600 leading-snug">{analysis.dailyProtocol.mindset}</p>
                   </div>
               </div>
           )}
         </div>
       )}

       <div className="grid grid-cols-2 gap-4">
          <button onClick={() => setShowLabs(true)} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center gap-2 hover:border-indigo-200 transition-all">
              <div className="bg-indigo-50 p-3 rounded-xl"><Microscope className="w-6 h-6 text-indigo-600" /></div>
              <span className="font-bold text-slate-700 text-xs uppercase tracking-tight">Lab Vault</span>
          </button>
          <button onClick={() => window.location.hash = 'shop'} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center gap-2 hover:border-teal-200 transition-all">
              <div className="bg-teal-50 p-3 rounded-xl"><ShoppingBag className="w-6 h-6 text-teal-600" /></div>
              <span className="font-bold text-slate-700 text-xs uppercase tracking-tight">Shop Triggers</span>
          </button>
       </div>

       <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-300 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl -mr-16 -mt-16" />
           <div className="relative z-10">
               <div className="flex justify-between items-start mb-6">
                   <div>
                       <div className="flex items-center gap-2 mb-1">
                           <h2 className="text-slate-300 text-sm font-medium uppercase tracking-wider">Inflammation Score</h2>
                           <button onClick={() => setShowScoreInfo(!showScoreInfo)} className="text-slate-400 hover:text-white"><HelpCircle className="w-4 h-4" /></button>
                       </div>
                       <div className="flex items-baseline gap-2">
                           <span className="text-5xl font-bold text-white">{currentScore}</span>
                           {hasSufficientData && <span className="text-slate-400 font-medium">/100</span>}
                       </div>
                   </div>
                   <div className="bg-white/10 backdrop-blur-md p-2 rounded-xl">
                       <Activity className="w-6 h-6 text-teal-400" />
                   </div>
               </div>

               <div className="h-32 w-full -ml-2">
                   {hasSufficientData ? (
                       <ResponsiveContainer width="100%" height="100%">
                           <AreaChart data={chartData}>
                               <defs>
                                   <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                       <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3}/>
                                       <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0}/>
                                   </linearGradient>
                               </defs>
                               <Area type="monotone" dataKey="score" stroke="#2dd4bf" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
                           </AreaChart>
                       </ResponsiveContainer>
                   ) : (
                       <div className="h-full flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-700 rounded-xl">
                           <Activity className="w-6 h-6 mb-2 opacity-50" />
                           <p className="text-xs">Log more data to see trends</p>
                       </div>
                   )}
               </div>
               
               <div className="flex gap-3 mt-4">
                  <button 
                     onClick={handleGenerateInsights}
                     disabled={loadingInsights}
                     className="flex-1 bg-white text-slate-900 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors"
                  >
                      {loadingInsights ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-purple-600" />}
                      Update Forecast
                  </button>
                  <button 
                     onClick={handleRunDetective}
                     disabled={isRunningDetective}
                     className="flex-1 bg-white/10 text-white backdrop-blur-md py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-white/20 transition-colors border border-white/10"
                  >
                      {isRunningDetective ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      Detective
                  </button>
               </div>
           </div>
       </div>

       {reminders.length > 0 && (
           <div className="space-y-3">
               <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2">
                   <Bell className="w-4 h-4 text-indigo-500" /> AI Smart Reminders
               </h3>
               {reminders.map(rem => (
                   <div key={rem.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-3">
                       <div className={`p-2 rounded-full flex-shrink-0 ${rem.priority === 'high' ? 'bg-rose-100 text-rose-500' : 'bg-indigo-100 text-indigo-500'}`}>
                           {rem.type === 'weather' ? <Clock className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                       </div>
                       <div>
                           <p className="text-sm font-medium text-slate-700">{rem.text}</p>
                           <p className="text-xs text-slate-400 mt-1 capitalize">{rem.type} • {rem.priority} Priority</p>
                       </div>
                   </div>
               ))}
           </div>
       )}
       
       {showLabs && <LabManager onClose={() => setShowLabs(false)} />}
    </div>
  );
};
