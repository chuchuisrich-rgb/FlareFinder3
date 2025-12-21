
import React, { useState } from 'react';
import { db } from '../services/db';
import { processVoiceCommand } from '../services/geminiService';
import { BehaviorLog } from '../types';
import { Droplet, Moon, CloudSun, Dumbbell, Zap, Smile, Activity, Brain, UserPlus } from 'lucide-react';
import { VoiceRecorder } from './VoiceRecorder';

export const DailyTracker: React.FC = () => {
  const [waterCups, setWaterCups] = useState(0);
  const [sleepHours, setSleepHours] = useState(7);
  const [sleepQuality, setSleepQuality] = useState(3);
  const [stressLevel, setStressLevel] = useState(3);
  const [anxietyLevel, setAnxietyLevel] = useState(3);
  const [energyLevel, setEnergyLevel] = useState(5);
  const [mood, setMood] = useState(3);
  const [workoutMinutes, setWorkoutMinutes] = useState(0);
  const [pcosSymptoms, setPcosSymptoms] = useState<string[]>([]);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);

  const saveLog = (type: BehaviorLog['type'], value: number | string, quality?: number) => {
    db.addBehaviorLog({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      value,
      quality
    });
  };

  const handleWater = (increment: number) => {
    const newVal = Math.max(0, waterCups + increment);
    setWaterCups(newVal);
    if (increment > 0) saveLog('water', newVal);
  };

  const togglePcosSymptom = (symptom: string) => {
      const newSymptoms = pcosSymptoms.includes(symptom) 
        ? pcosSymptoms.filter(s => s !== symptom)
        : [...pcosSymptoms, symptom];
      
      setPcosSymptoms(newSymptoms);
      saveLog('symptom_pcos', newSymptoms.join(', '));
  };

  const handleVoiceLog = async (text: string) => {
    setIsProcessingVoice(true);
    const user = db.getState().user;
    try {
      const result = await processVoiceCommand(text, user);
      
      result.behaviorLogs.forEach(log => {
        if (log.type && log.value) {
           db.addBehaviorLog({
             id: crypto.randomUUID(),
             timestamp: new Date().toISOString(),
             type: log.type,
             value: log.value,
             details: log.details
           } as BehaviorLog);
        }
      });
      alert(`Processed ${result.behaviorLogs.length} updates from voice.`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessingVoice(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
       <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800">Daily Habits</h2>
          <div className="flex items-center gap-2">
             <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Quick Log</span>
             <VoiceRecorder onTranscription={handleVoiceLog} isProcessing={isProcessingVoice} />
          </div>
       </div>

       {/* PCOS / Hormonal Symptom Tracker */}
       <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
           <div className="flex items-center gap-2 mb-3">
               <UserPlus className="w-5 h-5 text-purple-500" />
               <h3 className="font-bold text-slate-700">PCOS / Hormonal Check</h3>
           </div>
           <div className="flex flex-wrap gap-2">
               {['Bloating', 'Acne', 'Fatigue', 'Cravings', 'Hair Loss', 'Pelvic Pain'].map(sym => (
                   <button
                        key={sym}
                        onClick={() => togglePcosSymptom(sym)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                            pcosSymptoms.includes(sym)
                            ? 'bg-purple-50 border-purple-200 text-purple-700'
                            : 'bg-slate-50 border-slate-100 text-slate-500'
                        }`}
                   >
                       {sym}
                   </button>
               ))}
           </div>
       </div>

       {/* Emotional & Energy Grid */}
       <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
             <div className="flex items-center gap-2 mb-3">
               <Smile className="w-5 h-5 text-indigo-500" />
               <h3 className="font-bold text-slate-700 text-sm">Mood</h3>
             </div>
             <input 
                type="range" min="1" max="5" step="1"
                value={mood} 
                onChange={(e) => setMood(parseInt(e.target.value))}
                onMouseUp={() => saveLog('mood', mood)}
                className="w-full h-2 bg-slate-200 rounded-lg accent-indigo-500 mb-2"
             />
             <div className="flex justify-between text-[10px] text-slate-400">
                <span>Low</span><span>Great</span>
             </div>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
             <div className="flex items-center gap-2 mb-3">
               <Activity className="w-5 h-5 text-amber-500" />
               <h3 className="font-bold text-slate-700 text-sm">Energy</h3>
             </div>
             <input 
                type="range" min="1" max="10" step="1"
                value={energyLevel} 
                onChange={(e) => setEnergyLevel(parseInt(e.target.value))}
                onMouseUp={() => saveLog('energy', energyLevel)}
                className="w-full h-2 bg-slate-200 rounded-lg accent-amber-500 mb-2"
             />
             <div className="flex justify-between text-[10px] text-slate-400">
                <span>Drained</span><span>Hyped</span>
             </div>
          </div>
       </div>

       {/* Stress & Anxiety */}
       <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-rose-100 p-3 rounded-full">
              <Brain className="w-6 h-6 text-rose-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-700">Mental Load</h3>
            </div>
          </div>
          
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-slate-600">Stress</label>
                <span className="text-sm text-slate-400">{stressLevel}/10</span>
              </div>
              <input 
                type="range" min="1" max="10" step="1"
                value={stressLevel} 
                onChange={(e) => setStressLevel(parseInt(e.target.value))}
                onMouseUp={() => saveLog('stress', stressLevel)}
                className="w-full h-2 bg-slate-200 rounded-lg accent-rose-500"
              />
            </div>

            <div>
               <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-slate-600">Anxiety</label>
                <span className="text-sm text-slate-400">{anxietyLevel}/10</span>
              </div>
              <input 
                type="range" min="1" max="10" step="1"
                value={anxietyLevel} 
                onChange={(e) => setAnxietyLevel(parseInt(e.target.value))}
                onMouseUp={() => saveLog('anxiety', anxietyLevel)}
                className="w-full h-2 bg-slate-200 rounded-lg accent-rose-500"
              />
            </div>
          </div>
       </div>

       {/* Water */}
       <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <Droplet className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h3 className="font-bold text-slate-700">Water Intake</h3>
              <p className="text-slate-400 text-sm">{waterCups} cups today</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => handleWater(-1)} className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xl font-bold">-</button>
             <button onClick={() => handleWater(1)} className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center text-xl font-bold shadow-md shadow-blue-200">+</button>
          </div>
       </div>

       {/* Sleep */}
       <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-indigo-100 p-3 rounded-full">
              <Moon className="w-6 h-6 text-indigo-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-700">Sleep</h3>
            </div>
          </div>
          
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-slate-600">Duration</label>
                <span className="text-sm text-slate-400">{sleepHours} hours</span>
              </div>
              <input 
                type="range" min="0" max="12" step="0.5"
                value={sleepHours} 
                onChange={(e) => setSleepHours(parseFloat(e.target.value))}
                onMouseUp={() => saveLog('sleep', sleepHours, sleepQuality)}
                className="w-full h-2 bg-slate-200 rounded-lg accent-indigo-500"
              />
            </div>

            <div>
               <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-slate-600">Quality</label>
                <span className="text-sm text-slate-400">{sleepQuality}/5</span>
              </div>
              <input 
                type="range" min="1" max="5" step="1"
                value={sleepQuality} 
                onChange={(e) => setSleepQuality(parseInt(e.target.value))}
                onMouseUp={() => saveLog('sleep', sleepHours, sleepQuality)}
                className="w-full h-2 bg-slate-200 rounded-lg accent-indigo-500"
              />
            </div>
          </div>
       </div>

       {/* Workout */}
       <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-emerald-100 p-3 rounded-full">
              <Dumbbell className="w-6 h-6 text-emerald-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-700">Movement</h3>
              <p className="text-slate-400 text-sm">{workoutMinutes} minutes</p>
            </div>
          </div>
          <div className="flex gap-2">
            {[0, 15, 30, 45, 60].map(mins => (
              <button 
                key={mins}
                onClick={() => { setWorkoutMinutes(mins); saveLog('workout', mins); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  workoutMinutes === mins 
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' 
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>
       </div>

       {/* Weather (Simulated) */}
       <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-6 rounded-2xl border border-amber-100 flex items-center justify-between opacity-80">
          <div className="flex items-center gap-4">
            <div className="bg-white p-3 rounded-full shadow-sm">
              <CloudSun className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Weather Data</h3>
              <p className="text-slate-500 text-sm">78°F • High Humidity</p>
            </div>
          </div>
          <span className="text-xs font-semibold bg-white text-slate-500 px-2 py-1 rounded">Auto-synced</span>
       </div>
    </div>
  );
};
