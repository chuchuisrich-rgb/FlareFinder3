
import React, { useState } from 'react';
import { db } from '../services/db';
import { Login } from './Login';
import { Signup } from './Signup';
import { DISCLOSURE_SECTIONS, CURRENT_DISCLOSURE_VERSION } from '../src/content/legal/disclosure_v1';
import { UserProfile } from '../types';
import { ChevronRight, ShieldAlert, Check, AlertTriangle, Info, Scale, ShieldCheck } from 'lucide-react';

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
  const [hasAcceptedDisclosure, setHasAcceptedDisclosure] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [consentError, setConsentError] = useState('');
  const [shakeConsent, setShakeConsent] = useState(false);

  const validateConsent = () => {
    if (hasAcceptedDisclosure) {
      setConsentError('');
      return true;
    }
    // show prominent error and shake the checkbox area
    setConsentError('Please acknowledge the Medical Disclosure above before creating an account.');
    setShakeConsent(true);
    setTimeout(() => setShakeConsent(false), 600);
    return false;
  };

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
            
              {/* show the disclosure only when the user hasn't proceeded to the signup form or login */}
              {!showSignup && !showLogin && (
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4 max-h-72 overflow-y-auto no-scrollbar text-[13px] text-slate-600 leading-relaxed font-medium">
                  {DISCLOSURE_SECTIONS.map((s, idx) => {
                    const Icon = [Scale, AlertTriangle, Info, Check, ShieldCheck][idx] || Scale;
                    return (
                      <section key={s.title}>
                        <h4 className="font-black text-slate-800 uppercase text-[10px] mb-1 flex items-center gap-1">
                          <Icon className="w-3 h-3" /> {s.title}
                        </h4>
                        <p>{s.body}</p>
                      </section>
                    );
                  })}
                </div>
              )}

            <div className="grid gap-3">
        <div>
        <style>{`
          @keyframes ff-shake { 0%{transform:translateX(0)}25%{transform:translateX(-6px)}50%{transform:translateX(6px)}75%{transform:translateX(-4px)}100%{transform:translateX(0)} }
          .ff-shake{animation:ff-shake 600ms ease-in-out}
        `}</style>
        <button 
          onClick={() => setHasAcceptedDisclosure(!hasAcceptedDisclosure)}
          className={`w-full p-4 rounded-2xl border-2 flex items-center gap-4 transition-all ${
            hasAcceptedDisclosure ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-100 text-slate-400'
          } ${shakeConsent ? 'ff-shake' : ''}`}
        >
          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center ${hasAcceptedDisclosure ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200'}`}>
            {hasAcceptedDisclosure && <Check className="w-4 h-4" />}
          </div>
          <span className="font-bold text-sm text-left leading-tight">I understand the medical limitations and that my data is stored locally.</span>
        </button>
        {consentError && <div role="alert" className="mt-2 text-sm text-red-600 font-bold">{consentError}</div>}
        </div>

              <button 
                onClick={() => hasAcceptedDisclosure && setShowSignup(true)}
                disabled={!hasAcceptedDisclosure}
                className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                Accept & Start Onboarding <ChevronRight className="w-6 h-6" />
              </button>

              <div className="pt-2 border-t border-slate-100" />

              <div className="text-sm text-slate-600">Already have an account? <button onClick={() => { setShowLogin(!showLogin); setShowSignup(false); }} className="text-teal-600 font-bold">Sign in</button> · <button onClick={() => {
                // gate Create account behind consent validation
                if (validateConsent()) {
                  setShowSignup(!showSignup);
                  setShowLogin(false);
                }
              }} className="text-teal-600 font-bold">Create account</button></div>

              <div className="mt-2">
                {showLogin && <Login onSuccess={() => onComplete()} />}
                {showSignup && <Signup onSuccess={() => setStep(1)} hasAcceptedTerms={hasAcceptedDisclosure} />}
              </div>
            </div>
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
