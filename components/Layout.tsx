
import { LayoutDashboard, Camera, Flame, Activity, Settings, ShoppingBag } from 'lucide-react';
import React from 'react';
import { DISCLOSURE_SECTIONS } from '../src/content/legal/disclosure_v1';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between max-w-md mx-auto w-full">
          <div className="flex items-center gap-2">
            <div className="bg-teal-500 p-1.5 rounded-lg">
              <Flame className="w-5 h-5 text-white" fill="white" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">FlareFinder<span className="text-teal-500">.ai</span></h1>
          </div>
          <button 
            onClick={() => onTabChange('settings')} 
            className={`p-2 rounded-xl transition-all ${
                activeTab === 'settings' 
                ? 'bg-slate-100 text-slate-900 shadow-inner' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Settings className={`w-6 h-6 ${activeTab === 'settings' ? 'rotate-90' : ''} transition-transform duration-500`} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-md mx-auto w-full p-4">
          {/* top disclosure banner on Home for transparency */}
          {/** show a small persistent disclosure banner on Home/Landing */}
          {/** Layout doesn't render during Onboarding (App shows Onboarding earlier), so this is fine */}
          <div className="mb-4">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-800">
              <strong>Medical Disclosure:</strong> {DISCLOSURE_SECTIONS && DISCLOSURE_SECTIONS[0]?.body}
            </div>
          </div>
          {children}
        </div>
      </main>

      <nav className="bg-white border-t border-slate-200 fixed bottom-0 w-full z-40 pb-safe">
        <div className="max-w-md mx-auto flex justify-around items-center h-16 px-1">
          <NavButton 
            active={activeTab === 'dashboard'} 
            onClick={() => onTabChange('dashboard')} 
            icon={<LayoutDashboard />} 
            label="Home" 
          />
          <NavButton 
            active={activeTab === 'food'} 
            onClick={() => onTabChange('food')} 
            icon={<Camera />} 
            label="Food" 
          />
          <NavButton 
            active={activeTab === 'flare'} 
            onClick={() => onTabChange('flare')} 
            icon={<Flame />} 
            label="Flare" 
          />
          <NavButton 
            active={activeTab === 'daily'} 
            onClick={() => onTabChange('daily')} 
            icon={<Activity />} 
            label="Daily" 
          />
        </div>
      </nav>
    </div>
  );
};

const NavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center w-full h-full transition-all ${
      active ? 'text-teal-600 scale-110' : 'text-slate-400 hover:text-slate-600'
    }`}
  >
    {React.cloneElement(icon as React.ReactElement<any>, { 
      className: `w-6 h-6 ${active ? 'fill-current opacity-20' : ''}`, 
      strokeWidth: active ? 2.5 : 2
    })}
    <span className="text-[10px] font-bold mt-1 tracking-tight">{label}</span>
  </button>
);
