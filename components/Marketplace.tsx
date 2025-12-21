
import React, { useEffect, useState } from 'react';
import { ShoppingBag, Star, TrendingUp, Users, ShieldCheck, ExternalLink, RefreshCw, List, Trash2, CheckSquare, Square, ChefHat, ScanLine, ArrowRight, Loader2, Plus, Sparkles } from 'lucide-react';
import { db } from '../services/db';
import { getMarketplaceRecommendations, getGlobalInsights, generateSafeMealPlan, analyzeRestaurantMenu } from '../services/geminiService';
import { MarketplaceProduct, GlobalInsight, ShoppingListItem, DayPlan, MenuAnalysis } from '../types';

export const Marketplace: React.FC = () => {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [insights, setInsights] = useState<GlobalInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
  const [view, setView] = useState<'store' | 'list' | 'chef' | 'concierge'>('store');
  const [mealPlan, setMealPlan] = useState<DayPlan | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [menuAnalysis, setMenuAnalysis] = useState<MenuAnalysis | null>(null);
  const [analyzingMenu, setAnalyzingMenu] = useState(false);

  useEffect(() => {
    loadData();
    loadShoppingList();
  }, []);

  const loadData = async () => {
    const user = db.getState().user;
    if (!user) return;
    
    setLoading(true);
    try {
      const [recs, globalData] = await Promise.all([
        getMarketplaceRecommendations(user),
        getGlobalInsights(user.condition)
      ]);
      setProducts(recs);
      setInsights(globalData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadShoppingList = () => {
      const list = db.getState().shoppingList || [];
      setShoppingList(list);
  };

  const toggleItem = (id: string) => {
      db.toggleShoppingItem(id);
      loadShoppingList();
  };

  const deleteItem = (id: string) => {
      db.removeFromShoppingList(id);
      loadShoppingList();
  };

  const handleGenerateMealPlan = async () => {
      const user = db.getState().user;
      if (!user) return;
      setGeneratingPlan(true);
      try {
          const plan = await generateSafeMealPlan(user);
          setMealPlan(plan);
      } catch(e) {
          console.error(e);
          alert("Could not generate meal plan.");
      } finally {
          setGeneratingPlan(false);
      }
  };
  
  const addIngredientsToList = (ingredients: string[]) => {
      ingredients.forEach(ing => {
          db.addToShoppingList({
              id: crypto.randomUUID(),
              name: ing,
              addedAt: new Date().toISOString(),
              status: 'pending'
          });
      });
      loadShoppingList();
      alert("Ingredients added to shopping list!");
  };

  const handleMenuScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const user = db.getState().user;
      if (!user) return;

      setAnalyzingMenu(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
          try {
             const base64 = (reader.result as string).split(',')[1];
             const result = await analyzeRestaurantMenu(base64, file.type, user);
             setMenuAnalysis(result);
          } catch (e) {
              console.error(e);
              alert("Menu analysis failed.");
          } finally {
              setAnalyzingMenu(false);
          }
      };
      reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex justify-between items-center sticky top-0 bg-slate-50 z-10 pb-2">
        <div>
           <h1 className="text-2xl font-bold text-slate-800">Bio-Commerce</h1>
           <p className="text-slate-500 text-sm">Shop, Eat, & Live safely.</p>
        </div>
        <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
             <button 
                onClick={() => setView('store')}
                className={`p-2 rounded-lg transition-colors ${view === 'store' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}
             >
                 <ShoppingBag className="w-5 h-5" />
             </button>
             <button 
                onClick={() => setView('chef')}
                className={`p-2 rounded-lg transition-colors ${view === 'chef' ? 'bg-teal-50 text-teal-600' : 'text-slate-400'}`}
             >
                 <ChefHat className="w-5 h-5" />
             </button>
             <button 
                onClick={() => setView('concierge')}
                className={`p-2 rounded-lg transition-colors ${view === 'concierge' ? 'bg-purple-50 text-purple-600' : 'text-slate-400'}`}
             >
                 <ScanLine className="w-5 h-5" />
             </button>
             <button 
                onClick={() => setView('list')}
                className={`p-2 rounded-lg transition-colors ${view === 'list' ? 'bg-slate-900 text-white' : 'text-slate-400'}`}
             >
                 <List className="w-5 h-5" />
             </button>
        </div>
      </div>

      {view === 'list' && (
          <div className="animate-in fade-in slide-in-from-right duration-300">
             <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h2 className="font-bold text-slate-700">My Shopping List</h2>
                    <span className="text-xs bg-slate-200 px-2 py-1 rounded-full text-slate-600 font-bold">{shoppingList.length} Items</span>
                </div>
                {shoppingList.length === 0 ? (
                    <div className="p-10 text-center text-slate-400">
                        <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>Your list is empty.</p>
                        <p className="text-xs mt-1">Scan items or use Chef AI to add.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {shoppingList.map(item => (
                            <div key={item.id} className="p-4 flex items-center gap-3">
                                <button onClick={() => toggleItem(item.id)} className="text-slate-400 hover:text-teal-600">
                                    {item.status === 'bought' ? <CheckSquare className="w-6 h-6 text-teal-500" /> : <Square className="w-6 h-6" />}
                                </button>
                                <div className={`flex-1 ${item.status === 'bought' ? 'opacity-40 line-through' : ''}`}>
                                    <p className="font-bold text-slate-800">{item.name}</p>
                                    {item.sensitivityAlert && (
                                        <p className="text-xs text-rose-500 font-bold flex items-center gap-1">
                                            ⚠️ Contains: {item.sensitivityAlert.trigger}
                                        </p>
                                    )}
                                </div>
                                <button onClick={() => deleteItem(item.id)} className="text-slate-300 hover:text-rose-500">
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
             </div>
          </div>
      )}

      {view === 'chef' && (
          <div className="animate-in fade-in slide-in-from-right duration-300 space-y-4">
              <div className="bg-teal-50 p-6 rounded-3xl border border-teal-100 text-center">
                  <ChefHat className="w-12 h-12 text-teal-500 mx-auto mb-2" />
                  <h2 className="text-xl font-bold text-teal-900">Chef AI</h2>
                  <p className="text-teal-700 text-sm mb-4">Generate a meal plan 100% safe for your specific triggers.</p>
                  <button 
                    onClick={handleGenerateMealPlan}
                    disabled={generatingPlan}
                    className="bg-teal-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-teal-200 hover:bg-teal-700 transition-all flex items-center gap-2 mx-auto"
                  >
                      {generatingPlan ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                      Generate Safe Plan
                  </button>
              </div>

              {mealPlan && (
                  <div className="grid gap-4">
                      {['Breakfast', 'Lunch', 'Dinner', 'Snack'].map((type) => {
                          const key = type.toLowerCase() as keyof DayPlan;
                          const recipe = mealPlan[key];
                          return (
                              <div key={key} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                  <div className="flex justify-between items-start mb-2">
                                      <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">{type}</span>
                                      <span className="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-1 rounded-full font-bold">Match: {recipe.matchScore}%</span>
                                  </div>
                                  <h3 className="font-bold text-lg text-slate-800">{recipe.title}</h3>
                                  <p className="text-slate-500 text-sm mb-3">{recipe.description}</p>
                                  <div className="flex flex-wrap gap-1 mb-3">
                                      {recipe.tags.map(t => <span key={t} className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-600 font-medium">{t}</span>)}
                                  </div>
                                  <button 
                                    onClick={() => addIngredientsToList(recipe.ingredients)}
                                    className="w-full py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-50"
                                  >
                                      <Plus className="w-4 h-4" /> Add Ingredients
                                  </button>
                              </div>
                          )
                      })}
                  </div>
              )}
          </div>
      )}

      {view === 'concierge' && (
          <div className="animate-in fade-in slide-in-from-right duration-300 space-y-4">
               <div className="bg-purple-50 p-6 rounded-3xl border border-purple-100 text-center">
                  <ScanLine className="w-12 h-12 text-purple-500 mx-auto mb-2" />
                  <h2 className="text-xl font-bold text-purple-900">Dining Concierge</h2>
                  <p className="text-purple-700 text-sm mb-4">Scan a menu. We'll tell you what's safe and how to order.</p>
                  
                  <label className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-purple-200 hover:bg-purple-700 transition-all flex items-center gap-2 mx-auto w-fit cursor-pointer">
                      {analyzingMenu ? <Loader2 className="w-5 h-5 animate-spin" /> : <ScanLine className="w-5 h-5" />}
                      Scan Menu
                      <input type="file" accept="image/*" className="hidden" onChange={handleMenuScan} />
                  </label>
              </div>

              {menuAnalysis && (
                  <div className="space-y-4">
                      {/* Chef Card */}
                      <div className="bg-white border-2 border-slate-800 p-4 rounded-xl shadow-md">
                          <p className="text-xs text-slate-400 font-bold uppercase mb-2">Show this to your server</p>
                          <p className="text-lg font-serif italic text-slate-800 leading-relaxed">"{menuAnalysis.chefCardText}"</p>
                      </div>

                      <div className="space-y-2">
                          <h3 className="font-bold text-emerald-700">Safe Bets</h3>
                          {menuAnalysis.safeOptions.map((item, i) => (
                              <div key={i} className="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm flex justify-between">
                                  <div>
                                    <p className="font-bold text-slate-800">{item.dishName}</p>
                                    <p className="text-xs text-slate-500">{item.description}</p>
                                  </div>
                              </div>
                          ))}
                      </div>

                      <div className="space-y-2">
                          <h3 className="font-bold text-amber-600">Caution (Ask for Mods)</h3>
                          {menuAnalysis.cautionOptions.map((item, i) => (
                              <div key={i} className="bg-white p-3 rounded-xl border border-amber-100 shadow-sm">
                                  <div className="flex justify-between">
                                     <p className="font-bold text-slate-800">{item.dishName}</p>
                                     <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-bold">Mod Needed</span>
                                  </div>
                                  <p className="text-xs text-amber-700 mt-1 font-medium flex items-center gap-1">
                                      🔧 {item.modification}
                                  </p>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
          </div>
      )}

      {view === 'store' && (
          <div className="animate-in fade-in slide-in-from-right duration-300 space-y-6">
            {/* Global Community Pulse */}
            <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-200 relative overflow-hidden">
                <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl" />
                
                <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5 text-indigo-400" />
                    <h2 className="font-bold text-lg">Global Pulse</h2>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                    {insights.map((insight, i) => (
                    <div key={i} className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10">
                        <div>
                            <p className="text-sm font-medium text-slate-200">{insight.topic}</p>
                            <p className="text-xs text-slate-400 mt-1">{insight.stat}</p>
                        </div>
                        <div className={`p-2 rounded-lg ${insight.trend === 'up' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                            <TrendingUp className={`w-4 h-4 ${insight.trend === 'down' ? 'rotate-180' : ''}`} />
                        </div>
                    </div>
                    ))}
                    {insights.length === 0 && !loading && (
                    <p className="text-slate-500 text-sm">Loading community trends...</p>
                    )}
                </div>
                </div>
            </div>

            {/* Product Grid */}
            <div>
                <h2 className="font-bold text-xl text-slate-800 mb-4 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-teal-600" />
                Recommended For You
                </h2>
                
                {loading && products.length === 0 ? (
                <div className="grid grid-cols-2 gap-4">
                    {[1,2,3,4].map(i => (
                    <div key={i} className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
                    ))}
                </div>
                ) : (
                <div className="grid grid-cols-2 gap-4">
                    {products.map((p) => (
                    <div key={p.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full hover:border-teal-200 transition-all group">
                        <div className="flex justify-between items-start mb-2">
                            <span className="bg-slate-100 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide text-slate-500">{p.category}</span>
                            <div className="flex items-center gap-1 bg-teal-50 px-1.5 py-0.5 rounded-md">
                            <ShieldCheck className="w-3 h-3 text-teal-600" />
                            <span className="text-xs font-bold text-teal-700">{p.matchScore}%</span>
                            </div>
                        </div>
                        
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-800 leading-tight mb-1">{p.name}</h3>
                            <p className="text-xs text-slate-500 mb-2">{p.brand}</p>
                            <p className="text-xs text-teal-600 italic leading-snug mb-3">"{p.matchReason}"</p>
                        </div>
                        
                        <div className="mt-auto pt-3 border-t border-slate-50 flex items-center justify-between">
                            <span className="font-bold text-slate-900">{p.price}</span>
                            <button className="bg-slate-900 text-white p-2 rounded-lg group-hover:bg-teal-600 transition-colors">
                            <ExternalLink className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    ))}
                </div>
                )}
            </div>

            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white text-center">
                <Star className="w-8 h-8 text-yellow-300 mx-auto mb-2 fill-current" />
                <h3 className="font-bold text-lg mb-1">FlareFinder Premium</h3>
                <p className="text-sm text-indigo-100 mb-4">Get 20% off all supplements and access to the advanced Bio-Simulator.</p>
                <button className="bg-white text-indigo-600 px-6 py-2 rounded-xl font-bold text-sm shadow-lg hover:bg-indigo-50 transition-colors">
                    Upgrade Plan
                </button>
            </div>
          </div>
      )}
    </div>
  );
};
