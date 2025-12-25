
import React, { useState } from 'react';
import { db } from '../services/db';
import { ShieldAlert, FileText, User, LogOut, Heart, Trash2, Info, ExternalLink, ShieldCheck, Scale } from 'lucide-react';

export const Settings: React.FC = () => {
  const state = db.getState();
  const user = state.user;
  const [showTerms, setShowTerms] = useState(false);

  const handleClearData = () => {
    if (confirm("Are you sure? This will delete all your food logs, flares, and bio-data forever. This cannot be undone.")) {
      db.clear();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-800">Account & Safety</h2>
      </div>

      {/* Profile Summary */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
        <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center text-teal-600">
          <User className="w-8 h-8" />
        </div>
        <div>
          <h3 className="font-bold text-slate-800 text-lg">{user?.name}</h3>
          <p className="text-sm text-slate-400 font-medium">{user?.condition} • {user?.conditionSeverity}</p>
        </div>
      </div>

      {/* Legal & Medical Section */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Legal & Medical</h4>
        
        <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex items-start gap-3">
           <ShieldAlert className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
           <p className="text-xs text-rose-700 font-medium leading-relaxed">
             <strong>CRITICAL:</strong> If you are experiencing a severe flare with signs of infection (fever, spreading redness, intense pain), please contact your doctor or visit an ER immediately.
           </p>
        </div>

        <button 
          onClick={() => setShowTerms(!showTerms)}
          className="w-full bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <Scale className="w-5 h-5 text-indigo-500" />
            <span className="font-bold text-slate-700">Terms & Disclaimer</span>
          </div>
          <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-indigo-500" />
        </button>

        {showTerms && (
          <div className="bg-slate-100 p-5 rounded-2xl text-xs text-slate-600 leading-relaxed space-y-4 animate-in slide-in-from-top-2 border border-slate-200">
            <div className="flex items-center gap-2 text-slate-800 font-black">
              <FileText className="w-4 h-4" />
              <span>DETAILED TERMS</span>
            </div>
            
            <section>
                <h5 className="font-bold text-slate-800 mb-1">1. Experimental Tool</h5>
                <p>FlareFinder AI is an experimental platform for personal tracking. It uses Artificial Intelligence to decompose ingredients and predict patterns. AI output is probabilistic and may be incorrect.</p>
            </section>

            <section>
                <h5 className="font-bold text-slate-800 mb-1">2. No Medical Relationship</h5>
                <p>Your use of this app does not create a doctor-patient relationship. All insights provided by the "Neural Coach" or "Flare Detective" must be verified by a licensed medical professional before taking action.</p>
            </section>

            <section>
                <h5 className="font-bold text-slate-800 mb-1">3. Liability Release</h5>
                <p>By using FlareFinder AI, you release the developers from any and all liability related to health complications, missed diagnoses, or allergic reactions resulting from the use of this software.</p>
            </section>

            <section>
                <h5 className="font-bold text-slate-800 mb-1">4. Data Processing</h5>
                <p>Images and text are processed via Google Gemini API. While we do not store PII on our servers, these third parties receive the data for processing.</p>
            </section>
          </div>
        )}
      </div>

      {/* App Info */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">App Status</h4>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4">
           <div className="flex justify-between items-center text-sm">
             <span className="text-slate-500 font-medium">Stage</span>
             <span className="text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded-md text-[10px] uppercase">Alpha MVP</span>
           </div>
           <div className="flex justify-between items-center text-sm">
             <span className="text-slate-500 font-medium">Neural Engine</span>
             <span className="text-teal-600 font-bold">Gemini 3.0 Pro</span>
           </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="pt-6">
        <button 
          onClick={handleClearData}
          className="w-full bg-slate-100 text-rose-600 py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex flex-col items-center justify-center gap-1 hover:bg-rose-50 transition-all border border-slate-200"
        >
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Purge Local Bio-Data
          </div>
          <span className="text-[9px] font-medium text-slate-400 normal-case tracking-normal">Wipes all logs and profile data from your browser storage.</span>
        </button>
      </div>

      <div className="text-center py-4">
        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.3em]">Privacy-First Autoimmune Tracker</p>
      </div>
    </div>
  );
};
