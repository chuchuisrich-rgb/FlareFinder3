import React, { useState } from 'react';
import { db } from '../services/db';
import { UserProfile } from '../types';
import { ChevronRight } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [condition, setCondition] = useState('HS');
  const [severity, setSeverity] = useState('');
  const [triggers, setTriggers] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);

  const toggleTrigger = (t: string) => {
    if (triggers.includes(t)) {
      setTriggers(triggers.filter(x => x !== t));
    } else {
      setTriggers([...triggers, t]);
    }
  };

  const toggleGoal = (g: string) => {
    if (goals.includes(g)) {
      setGoals(goals.filter(x => x !== g));
    } else {
      setGoals([...goals, g]);
    }
  };

  const handleFinish = () => {
    const user: UserProfile = {
      id: crypto.randomUUID(),
      name,
      condition,
      conditionSeverity: severity || "Not specified",
      onboardingCompleted: true,
      knownTriggers: triggers,
      goals: goals,
      bio: "New user" 
    };
    db.updateUser(user);
    onComplete();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50">
        
        {step === 1 && (
          <div className="space-y-6">
            <div className="w-12 h-12 bg-teal-100 rounded-2xl flex items-center justify-center text-teal-600 font-bold text-xl mb-4">
              1
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Welcome to FlareFinder</h1>
            <p className="text-slate-500 text-lg">Let's build a personalized profile to understand your unique biology.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">What should we call you?</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-4 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-teal-500" 
                  placeholder="Your Name"
                />
              </div>
            </div>

            <button 
              onClick={() => name && setStep(2)}
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
            >
              Next Step <ChevronRight />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
             <div className="w-12 h-12 bg-teal-100 rounded-2xl flex items-center justify-center text-teal-600 font-bold text-xl mb-4">
              2
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Your Condition</h1>
            <p className="text-slate-500">Which condition are you managing?</p>
            
            <div className="grid grid-cols-1 gap-3">
              {['HS (Hidradenitis Suppurativa)', 'Crohn\'s Disease', 'PCOS', 'Eczema', 'Other'].map(c => (
                <button
                  key={c}
                  onClick={() => setCondition(c)}
                  className={`p-4 rounded-xl text-left font-medium transition-all ${
                    condition === c 
                    ? 'bg-teal-500 text-white shadow-lg shadow-teal-200' 
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="mt-4">
               <label className="block text-sm font-medium text-slate-700 mb-2">Severity / Stage (Optional)</label>
               <input 
                  type="text" 
                  value={severity} 
                  onChange={(e) => setSeverity(e.target.value)}
                  className="w-full p-4 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-teal-500" 
                  placeholder="e.g. Stage 2, Moderate, Mild..."
                />
            </div>

            <button 
              onClick={() => setStep(3)}
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
            >
              Next Step <ChevronRight />
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
             <div className="w-12 h-12 bg-teal-100 rounded-2xl flex items-center justify-center text-teal-600 font-bold text-xl mb-4">
              3
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Your Goals</h1>
            <p className="text-slate-500">What do you want to achieve?</p>
            
            <div className="flex flex-col gap-2">
              {['Identify Food Triggers', 'Reduce Flare Frequency', 'Improve Sleep Quality', 'Manage Stress', 'Lose Weight'].map(g => (
                <button
                  key={g}
                  onClick={() => toggleGoal(g)}
                  className={`p-4 rounded-xl text-left font-medium transition-all ${
                    goals.includes(g) 
                    ? 'bg-indigo-500 text-white' 
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

             <button 
              onClick={() => setStep(4)}
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
            >
              Next Step <ChevronRight />
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
             <div className="w-12 h-12 bg-teal-100 rounded-2xl flex items-center justify-center text-teal-600 font-bold text-xl mb-4">
              4
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Suspected Triggers</h1>
            <p className="text-slate-500">Select any triggers you already suspect.</p>
            
            <div className="flex flex-wrap gap-2">
              {['Dairy', 'Nightshades', 'Gluten', 'Sugar', 'Stress', 'Heat/Sweat', 'Alcohol', 'Smoking', 'Yeast', 'Processed Oils'].map(t => (
                <button
                  key={t}
                  onClick={() => toggleTrigger(t)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                    triggers.includes(t) 
                    ? 'bg-rose-100 text-rose-600 border border-rose-200' 
                    : 'bg-slate-50 text-slate-400 border border-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <button 
              onClick={handleFinish}
              className="w-full bg-teal-600 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-teal-700 shadow-xl shadow-teal-200 transition-all"
            >
              Start Personalizing
            </button>
          </div>
        )}
      </div>
    </div>
  );
};