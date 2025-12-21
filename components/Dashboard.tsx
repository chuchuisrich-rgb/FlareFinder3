
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { generatePatternInsights, getSmartReminders, runFlareDetective } from '../services/geminiService';
import { AppState, Reminder, DeepAnalysis, FlareDetectiveReport } from '../types';
import { Sparkles, TrendingUp, TrendingDown, Activity, Bell, Clock, Beaker, Shield, AlertOctagon, RefreshCw, CheckCircle2, Flame, X, ArrowRight, ScanLine, Search, Camera, ScanBarcode, Microscope, CalendarHeart, Loader2, Layers, AlertTriangle, Plus, CloudSun, Utensils, Smile, Heart, Sunrise, CloudRain, Sun, HelpCircle, MessageCircle, Zap } from 'lucide-react';
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
    
    if (state.flareLogs.length > 0) {
        setHasSufficientData(true);
    } else {
        setHasSufficientData(false);
    }

    prepareChartData(state);
    calculateMetrics(state);
    calculateTriggerCorrelations(state);
    
    const smartReminders = await getSmartReminders(state);
    setReminders(smartReminders);
  };

  const calculateTriggerCorrelations = (state: AppState) => {
    const stats: Record<string, { exposures: number; flares: number }> = {};
    const WINDOW = 48 * 60 * 60 * 1000; // 48 hours lookback window

    // Pre-fill common categories to ensure map isn't empty for new users
    ['Dairy', 'Nightshade', 'Gluten', 'Sugar', 'Processed', 'Alcohol'].forEach(k => {
        stats[k] = { exposures: 0, flares: 0 };
    });

    // Analyze history
    state.foodLogs.forEach(foodLog => {
        const foodTime = new Date(foodLog.timestamp).getTime();
        
        // Check if a flare occurred within 48h AFTER this meal
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
        .filter(item => item.volume > 0) // Only show items present in logs
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
      currentStreak = 3; 
    }
    setStreakDays(currentStreak);
  };

  const handleGenerateInsights = async () => {
      if (!data) return;
      setLoadingInsights(true);
      try {
          const result = await generatePatternInsights(data);
          if (result) {
              setAnalysis(result);
              db.saveAnalysis(result);
          }
      } catch (e) {
          console.error(e);
          alert("Failed to generate insights.");
      } finally {
          setLoadingInsights(false);
      }
  };

  const handleRunDetective = async () => {
      if (!data) return;
      setIsRunningDetective(true);
      try {
          const report = await runFlareDetective(data);
          setDetectiveReport(report);
          db.saveFlareDetectiveReport(report);
      } catch (e) {
          console.error(e);
          alert("Detective failed to run.");
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
       {/* Greeting Narrative */}
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

       {/* BIO-RHYTHM COMMAND CENTER */}
       {analysis?.bioWeather && (
         <div className="animate-in fade-in slide-in-from-top-4 duration-500">
           {/* Weather Card */}
           <div className={`rounded-3xl p-6 shadow-xl mb-6 relative overflow-hidden ${
               analysis.bioWeather.status === 'Sunny' ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-orange-200' :
               analysis.bioWeather.status === 'Stormy' ? 'bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-slate-300' :
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
           
           {/* Daily Protocol Grid */}
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
                           <h4 className="font-bold text-slate-700 text-xs uppercase">Move Like This</h4>
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

       {/* Trigger Probability Map (NEW FEATURE) */}
       <div className="space-y-3">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2">
               <Zap className="w-4 h-4 text-amber-500" /> Trigger Probability Map
            </h3>
            
            {triggerMap.length === 0 ? (
               <div className="bg-white p-6 rounded-2xl border border-dashed border-slate-200 text-center">
                   <p className="text-slate-500 text-sm mb-1">No trigger patterns detected yet.</p>
                   <p className="text-xs text-slate-400">Log more meals and flares to build your probability map.</p>
               </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                {triggerMap.map(item => (
                    <div key={item.name} className={`p-4 rounded-2xl border flex flex-col items-center text-center transition-all ${
                        item.probability > 75 ? 'bg-rose-50 border-rose-200' :
                        item.probability > 40 ? 'bg-orange-50 border-orange-200' :
                        'bg-white border-slate-100'
                    }`}>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{item.name}</span>
                        <div className="flex items-baseline justify-center gap-1 mb-2">
                            <span className={`text-3xl font-black ${
                                item.probability > 75 ? 'text-rose-600' :
                                item.probability > 40 ? 'text-orange-600' :
                                'text-emerald-600'
                            }`}>{item.probability}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-2">
                            <div className={`h-full rounded-full ${
                                item.probability > 75 ? 'bg-rose-500' :
                                item.probability > 40 ? 'bg-orange-500' :
                                'bg-emerald-500'
                            }`} style={{width: `${item.probability}%`}} />
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">{item.volume} logs analyzed</span>
                    </div>
                ))}
                </div>
            )}
       </div>

       {/* Wellness Score Card */}
       <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-300 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl -mr-16 -mt-16" />
           <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl -ml-10 -mb-10" />
           
           <div className="relative z-10">
               <div className="flex justify-between items-start mb-6">
                   <div>
                       <div className="flex items-center gap-2 mb-1">
                           <h2 className="text-slate-300 text-sm font-medium uppercase tracking-wider">Inflammation Score</h2>
                           <button onClick={() => setShowScoreInfo(!showScoreInfo)} className="text-slate-400 hover:text-white"><HelpCircle className="w-4 h-4" /></button>
                       </div>
                       {showScoreInfo && (
                           <div className="mb-3 bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/20 text-xs text-slate-200">
                               <p className="mb-1"><strong>0 = No Inflammation</strong></p>
                               <p className="mb-1"><strong>100 = Severe Inflammation</strong></p>
                           </div>
                       )}
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
                               <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px'}} itemStyle={{color: '#2dd4bf', fontWeight: 'bold'}} labelStyle={{color: '#94a3b8'}} />
                               <Area type="monotone" dataKey="score" stroke="#2dd4bf" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
                           </AreaChart>
                       </ResponsiveContainer>
                   ) : (
                       <div className="h-full flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-700 rounded-xl">
                           <Activity className="w-6 h-6 mb-2 opacity-50" />
                           <p className="text-xs">Log a flare to see trends</p>
                       </div>
                   )}
               </div>
               
               <div className="flex gap-3 mt-2">
                  <button 
                     onClick={handleGenerateInsights}
                     disabled={loadingInsights}
                     className="flex-1 bg-white text-slate-900 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors"
                  >
                      {loadingInsights ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-purple-600" />}
                      {loadingInsights ? "Scanning..." : "Update Forecast"}
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

       {/* Smart Reminders */}
       {reminders.length > 0 && (
           <div className="space-y-3">
               <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2">
                   <Bell className="w-4 h-4 text-indigo-500" /> Smart Reminders
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
       
       {/* Quick Actions */}
       <button onClick={() => setShowLabs(true)} className="w-full bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between gap-3 hover:border-indigo-200 transition-all group">
           <div className="flex items-center gap-4">
               <div className="bg-indigo-50 p-3 rounded-full group-hover:scale-110 transition-transform"><Microscope className="w-6 h-6 text-indigo-600" /></div>
               <div className="text-left">
                  <span className="font-bold text-slate-700 text-sm block">Lab Vault</span>
                  <span className="text-xs text-slate-400">Manage reports & sensitivities</span>
               </div>
           </div>
           <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
       </button>

       {/* Analysis Result */}
       {analysis && (
           <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6">
               <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                   <h3 className="font-bold text-slate-800 flex items-center gap-2"><Sparkles className="w-5 h-5 text-purple-500" /> Daily Bio-Twin</h3>
                   <span className="text-xs text-slate-400">{new Date(analysis.timestamp).toLocaleDateString()}</span>
               </div>
               
               {analysis.cycleAnalysis && analysis.cycleAnalysis.currentPhase !== 'Unknown' && (
                   <div className="bg-gradient-to-r from-pink-50 to-rose-50 p-4 rounded-2xl border border-pink-100">
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-rose-800 flex items-center gap-2 text-sm"><CalendarHeart className="w-4 h-4 text-rose-500" /> Hormonal Forecast</h4>
                            <span className="text-[10px] bg-white px-2 py-0.5 rounded-full text-rose-600 font-bold uppercase tracking-wide">{analysis.cycleAnalysis.currentPhase} Phase</span>
                        </div>
                        <p className="text-xs text-rose-700 mb-2 font-medium">{analysis.cycleAnalysis.hormonalContext}</p>
                        <p className="text-xs text-slate-600">{analysis.cycleAnalysis.specificAdvice}</p>
                   </div>
               )}
               
               {analysis.stackingTriggers && analysis.stackingTriggers.length > 0 && (
                   <div className="space-y-3">
                       <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wide flex items-center gap-2"><Layers className="w-4 h-4 text-orange-500" /> Stacking Triggers Detected</h4>
                       {analysis.stackingTriggers.map((stack, i) => (
                           <div key={i} className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                               <div className="bg-white px-2 py-1 rounded-md text-xs font-bold text-slate-600 border border-slate-200 shadow-sm">{stack.triggerA}</div>
                               <Plus className="w-3 h-3 text-slate-400" />
                               <div className="bg-white px-2 py-1 rounded-md text-xs font-bold text-slate-600 border border-slate-200 shadow-sm">{stack.triggerB}</div>
                               <ArrowRight className="w-4 h-4 text-rose-500" />
                               <div className="flex-1 text-xs text-rose-600 font-bold text-right leading-tight">{stack.combinedEffect}</div>
                           </div>
                       ))}
                   </div>
               )}

               <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar name="User" dataKey="A" stroke="#6366f1" strokeWidth={2} fill="#6366f1" fillOpacity={0.3} />
                        </RadarChart>
                    </ResponsiveContainer>
               </div>
           </div>
       )}
       
       {detectiveReport && (
           <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
               <div className="flex items-center gap-3 mb-4">
                   <div className="bg-amber-100 p-2 rounded-lg"><Search className="w-5 h-5 text-amber-600" /></div>
                   <h3 className="font-bold text-slate-800">Flare Detective Report</h3>
               </div>
               <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 mb-4">
                   <h4 className="font-bold text-amber-800 text-sm mb-1">Conclusion</h4>
                   <p className="text-sm text-amber-700 leading-relaxed">{detectiveReport.conclusion}</p>
               </div>
           </div>
       )}
       
       {showLabs && <LabManager onClose={() => setShowLabs(false)} />}
    </div>
  );
};
