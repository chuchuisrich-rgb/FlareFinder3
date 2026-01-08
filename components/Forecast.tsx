import React from 'react';
import { CloudSun } from 'lucide-react';

export const Forecast: React.FC<{ items: any[] }> = ({ items }) => {
  return (
    <div className="space-y-4 pb-20">
      <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-white/10 p-3 rounded-xl"><CloudSun className="w-6 h-6 text-amber-200" /></div>
          <h2 className="text-lg font-black">Forecast</h2>
        </div>
        <p className="text-sm text-slate-300">Detailed neural forecasts and detective reports appear here. Tap an item to expand.</p>
      </div>

      <div className="space-y-3">
        {items && items.length > 0 ? (
          items.map((it, i) => (
            <div key={i} className="bg-slate-900 text-white p-4 rounded-2xl shadow-sm border border-slate-800">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-black text-white text-base">{it.title || (it.type === 'detective' ? 'Detective Report' : 'Forecast')}</h3>
                  <p className="text-xs text-slate-300 mt-1">{it.subtitle || ''}</p>
                </div>
                <div className="text-[10px] font-black text-teal-300">{it.date ? new Date(it.date).toLocaleString() : ''}</div>
              </div>
              <div className="mt-3 text-sm text-slate-200 leading-relaxed">
                {it.type === 'detective' ? (
                  // Render detective report in readable format
                  (() => {
                    const body = it.body || {};
                    const rc = body.rootCauseAnalysis || body; // support both shapes
                    return (
                      <div className="space-y-3">
                        {rc.overallRiskLevel && <div className="text-sm font-bold">Risk: <span className="font-black">{rc.overallRiskLevel}</span></div>}
                        {rc.summary && <div className="text-sm">{rc.summary}</div>}
                        {rc.identifiedTriggers && rc.identifiedTriggers.length > 0 && (
                          <div>
                            <h4 className="mt-2 text-xs font-black uppercase text-slate-300">Top Suspects</h4>
                            <ul className="mt-1 space-y-2">
                              {rc.identifiedTriggers.map((t: any, idx: number) => (
                                <li key={idx} className="bg-white/5 p-3 rounded-lg border border-white/5">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <div className="font-black text-sm">{t.ingredient}</div>
                                      <div className="text-xs text-slate-300">Source: {t.sourceFood || t.source || 'Unknown'}</div>
                                    </div>
                                    <div className="text-xs font-black uppercase text-rose-400">{t.sensitivityLevel}</div>
                                  </div>
                                  {t.reasoning && <div className="mt-2 text-xs text-slate-300">{t.reasoning}</div>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {rc.recommendation && (
                          <div>
                            <h4 className="mt-2 text-xs font-black uppercase text-slate-300">Recommendation</h4>
                            <p className="text-sm mt-1">{rc.recommendation}</p>
                          </div>
                        )}
                        {rc.safeFoods && rc.safeFoods.length > 0 && (
                          <div>
                            <h4 className="mt-2 text-xs font-black uppercase text-slate-300">Safe Foods</h4>
                            <p className="text-sm mt-1">{rc.safeFoods.join(', ')}</p>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  // Default forecast rendering
                  (typeof it.body === 'string') ? it.body : (it.body?.dailyNarrative || it.body?.bioWeather?.summary || JSON.stringify(it.body, null, 2))
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white/5 p-6 rounded-2xl text-center text-slate-400 border border-white/5">No forecast items yet. Run "Sync Forecast" or "Detective" to generate one.</div>
        )}
      </div>
    </div>
  );
};
