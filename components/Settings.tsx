
import React, { useState } from 'react';
import { db } from '../services/db';
import { Login } from './Login';
import { Signup } from './Signup';
import { ShieldAlert, FileText, User, LogOut, Heart, Trash2, Info, ExternalLink, ShieldCheck, Scale, Download, Upload, RefreshCw, Database } from 'lucide-react';

export const Settings: React.FC = () => {
  const state = db.getState();
  const user = state.user;
  const [showTerms, setShowTerms] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);

  const handleClearData = () => {
    if (confirm("Are you sure? This will delete all your food logs, flares, and bio-data forever. This cannot be undone.")) {
      db.clear();
      window.location.reload();
    }
  };

  const handleSignOut = () => {
    // clear user session but keep health logs
    db.updateUser(null);
    // remove any stored auth tokens / sessions
    try { localStorage.removeItem('auth_token'); } catch (e) {}
    try { localStorage.removeItem('session'); } catch (e) {}
    // navigate back to landing
    try { window.history.pushState({}, '', '/'); } catch (e) {}
    window.location.reload();
  };

  const handleExport = () => {
    db.exportData();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = db.importData(content);
      setIsImporting(false);
      if (success) {
        alert("Data imported successfully! The app will now reload.");
        window.location.reload();
      } else {
        alert("Invalid backup file. Please ensure you selected a FlareFinder JSON file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-800">Account & Safety</h2>
      </div>

      {/* If no user - show signup / login */}
      {!user && (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <p className="font-bold text-slate-800 mb-3">Sign in or create an account to sync across devices (demo).</p>
          <div className="flex gap-3">
            <button onClick={() => { setShowLogin(!showLogin); setShowSignup(false); }} className="flex-1 bg-teal-600 text-white p-3 rounded-xl font-bold">Sign in</button>
            <button onClick={() => { setShowSignup(!showSignup); setShowLogin(false); }} className="flex-1 bg-white border border-teal-600 text-teal-600 p-3 rounded-xl font-bold">Create account</button>
          </div>

          <div className="mt-4">
            {showLogin && <Login onSuccess={() => window.location.reload()} />}
            {showSignup && <Signup onSuccess={() => window.location.reload()} />}
          </div>
        </div>
      )}

      {/* Profile Summary */}
      {user && (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center text-teal-600">
            <User className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-lg">{user?.name}</h3>
            <p className="text-sm text-slate-400 font-medium">{user?.condition} • {user?.conditionSeverity}</p>
          </div>
        </div>
      )}

      {/* Data Portability - HIGHLIGHTED SECTION */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-black text-teal-600 uppercase tracking-widest px-1 flex items-center gap-2">
            <Database className="w-3 h-3" /> Data Portability & Backups
        </h4>
        
        <div className="bg-white p-6 rounded-[2rem] border-2 border-teal-50 shadow-xl shadow-teal-900/5 space-y-6">
          <div className="flex items-start gap-4">
            <div className="bg-teal-100 p-3 rounded-2xl">
                <RefreshCw className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800">Updating the App</p>
              <p className="text-xs text-slate-500 leading-relaxed mt-1">To get the latest code updates, simply <strong>Refresh</strong> this page in your browser. Your data is stored safely on your device and is not lost during updates.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={handleExport}
              className="flex flex-col items-center justify-center gap-3 p-5 bg-indigo-50 border border-indigo-100 rounded-2xl hover:bg-indigo-100 transition-all group shadow-sm"
            >
              <div className="bg-white p-2.5 rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                <Download className="w-6 h-6 text-indigo-600" />
              </div>
              <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider">Export Backup</span>
            </button>
            
            <label className="flex flex-col items-center justify-center gap-3 p-5 bg-teal-50 border border-teal-100 rounded-2xl hover:bg-teal-100 transition-all group cursor-pointer shadow-sm">
              <input type="file" accept=".json" className="hidden" onChange={handleImport} disabled={isImporting} />
              <div className="bg-white p-2.5 rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                <Upload className={`w-6 h-6 text-teal-600 ${isImporting ? 'animate-bounce' : ''}`} />
              </div>
              <span className="text-[10px] font-black uppercase text-teal-700 tracking-wider">Import Data</span>
            </label>
          </div>
          
          <div className="bg-slate-50 p-3 rounded-xl">
            <p className="text-[10px] text-center text-slate-500 font-medium leading-normal italic">
              "Data is stored in your browser's local memory. Use these tools to move your bio-history to a new phone or browser."
            </p>
          </div>
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
        {user && (
          <button
            onClick={handleSignOut}
            className="mt-3 w-full bg-white text-slate-700 py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-all border border-slate-200"
          >
            <div className="flex items-center gap-2">
              <LogOut className="w-4 h-4" /> Sign Out
            </div>
            <span className="text-[9px] font-medium text-slate-400 normal-case tracking-normal">Ends your session on this device.</span>
          </button>
        )}
      </div>

      <div className="text-center py-4">
        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.3em]">Privacy-First Autoimmune Tracker</p>
      </div>
    </div>
  );
};
