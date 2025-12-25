
import React, { useState } from 'react';
import { db } from '../services/db';
import { UserProfile } from '../types';
import { ChevronRight, ShieldAlert, Check, AlertTriangle, Info, Scale } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0); 
  const [name, setName] = useState('');
  const [condition, setCondition] = useState('HS');
  const [severity, setSeverity] = useState('');
  const [triggers, setTriggers] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const totalSteps = 5;

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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 relative overflow-hidden">
        
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-100">
            <div 
                className="h-full bg-teal-500 transition-all duration-500 ease-out"
                style={{ width: `${(step / (totalSteps - 1)) * 100}%` }}
            />
        </div>

        {step === 0 && (
          <div className="space-y-6 animate-in fade-in duration-500 mt-2">
            <div className="w-16 h-16 bg-rose-100 rounded-3xl flex items-center justify-center text-rose-600 mb-6">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Medical Disclosure</h1>
            
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4 max-h-72 overflow-y-auto no-scrollbar text-[13px] text-slate-600 leading-relaxed font-medium">
                <section>
                    <h4 className="font-black text-slate-800 uppercase text-[10px] mb-1 flex items-center gap-1">
                        <Scale className="w-3 h-3" /> 1. No Medical Advice
                    </h4>
                    <p>FlareFinder AI is a health-tracking diary intended for educational and personal organization purposes only. It does NOT provide medical advice, diagnosis, or treatment. It is not a substitute for clinical judgment.</p>
                </section>

                <section>
                    <h4 className="font-black text-slate-800 uppercase text-[10px] mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> 2. AI & Data Accuracy
                    </h4>
                    <p>This App uses Artificial Intelligence. AI can produce inaccurate results ("hallucinations"). Do not rely on "Safe" or "Unsafe" verdicts as absolute fact. Always read labels manually.</p>
                </section>

                <section>
                    <h4 className="font-black text-slate-800 uppercase text-[10px] mb-1 flex items-center gap-1">
                        <Info className="w-3 h-3" /> 3. Emergency Situations
                    </h4>
                    <p>If you have a fever, signs of infection, or intense pain, STOP using this app and seek immediate professional medical assistance or go to the nearest ER.</p>
                </section>

                <section>
                    <h4 className="font-black text-slate-800 uppercase text-[10px] mb-1 flex items-center gap-1">
                        <Check className="w-3 h-3" /> 4. Assumption of Risk
                    </h4>
                    <p>By proceeding, you agree that you are solely responsible for any lifestyle changes you make. The developers are not liable for any adverse health events.</p>
                </section>
            </div>
            
            <button 
                onClick={() => setAcceptedTerms(!acceptedTerms)}
                className={`w-full p-4 rounded-2xl border-2 flex items-center gap-4 transition-all ${
                    acceptedTerms ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-100 text-slate-400'
                }`}
            >
                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center ${acceptedTerms ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200'}`}>
                    {acceptedTerms && <Check className="w-4 h-4" />}
                </div>
                <span className="font-bold text-sm text-left leading-tight">I understand and accept all medical disclaimers and limitations.</span>
            </button>

            <button 
              onClick={() => acceptedTerms && setStep(1)}
              disabled={!acceptedTerms}
              className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50"
            >
              Accept & Start Onboarding <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300 mt-2">
            <div className="w-12 h-12 bg-teal-100 rounded-2xl flex items-center justify-center text-teal-600 font-bold text-xl mb-4">
              1
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Identity</h1>
            <p className="text-slate-500 text-lg">What should we call you in your Bio-Twin interface?</p>
            
            <div className="space-y-4">
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                className="w-full p-5 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-teal-500 font-bold text-slate-800" 
                placeholder="Your Name"
              />
            </div>

            <button 
              onClick={() => name && setStep(2)}
              className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
            >
              Next Step <ChevronRight />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300 mt-2">
             <div className="w-12 h-12 bg-teal-100 rounded-2xl flex items-center justify-center text-teal-600 font-bold text-xl mb-4">
              2
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Bio-Context</h1>
            <p className="text-slate-500">Which condition are we mapping?</p>
            
            <div className="grid grid-cols-1 gap-3">
              {['HS (Hidradenitis Suppurativa)', 'PCOS', 'Eczema', 'Other'].map(c => (
                <button
                  key={c}
                  onClick={() => setCondition(c)}
                  className={`p-4 rounded-2xl text-left font-black transition-all ${
                    condition === c 
                    ? 'bg-teal-500 text-white shadow-lg shadow-teal-200' 
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="mt-4">
               <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Current Severity / Stage</label>
               <input 
                  type="text" 
                  value={severity} 
                  onChange={(e) => setSeverity(e.target.value)}
                  className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-teal-500 font-bold" 
                  placeholder="e.g. Stage 2, Flare Active..."
                />
            </div>

            <button 
              onClick={() => setStep(3)}
              className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
            >
              Next Step <ChevronRight />
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300 mt-2">
             <div className="w-12 h-12 bg-teal-100 rounded-2xl flex items-center justify-center text-teal-600 font-bold text-xl mb-4">
              3
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Success Goals</h1>
            <p className="text-slate-500">What does relief look like for you?</p>
            
            <div className="flex flex-col gap-2">
              {['Identify Food Triggers', 'Reduce Flare Frequency', 'Improve Sleep Quality', 'Manage Stress', 'Lose Weight', 'Others'].map(g => (
                <button
                  key={g}
                  onClick={() => toggleGoal(g)}
                  className={`p-4 rounded-2xl text-left font-bold transition-all border-2 ${
                    goals.includes(g) 
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700' 
                    : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

             <button 
              onClick={() => setStep(4)}
              className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
            >
              Next Step <ChevronRight />
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300 mt-2">
             <div className="w-12 h-12 bg-teal-100 rounded-2xl flex items-center justify-center text-teal-600 font-bold text-xl mb-4">
              4
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Suspects</h1>
            <p className="text-slate-500">Any triggers you already suspect?</p>
            
            <div className="flex flex-wrap gap-2">
              {['Dairy', 'Nightshades', 'Gluten', 'Sugar', 'Stress', 'Heat/Sweat', 'Alcohol', 'Smoking', 'Yeast', 'Processed Oils'].map(t => (
                <button
                  key={t}
                  onClick={() => toggleTrigger(t)}
                  className={`px-5 py-3 rounded-full text-sm font-bold transition-all ${
                    triggers.includes(t) 
                    ? 'bg-rose-100 text-rose-600 border border-rose-300' 
                    : 'bg-slate-50 text-slate-400 border border-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <button 
              onClick={handleFinish}
              className="w-full bg-teal-600 text-white py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-2 hover:bg-teal-700 shadow-2xl shadow-teal-100 transition-all transform active:scale-95"
            >
              Start Personalizing
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
