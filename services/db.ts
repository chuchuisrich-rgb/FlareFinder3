
import { AppState, UserProfile, FoodLog, FlareLog, BehaviorLog, DeepAnalysis, FoodSensitivity, ShoppingListItem, LabReport, FlareDetectiveReport, Biomarker } from '../types';

const STORAGE_KEY = 'flarefinder_db_v3';

const initialDb: AppState = {
  user: null,
  foodLogs: [],
  flareLogs: [],
  behaviorLogs: [],
  currentAnalysis: null,
  shoppingList: [],
  flareDetectiveReports: [],
  biomarkers: []
};

// Fallback UUID for non-secure contexts
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const db = {
  getState: (): AppState => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : initialDb;
    } catch (e) {
      console.error("Failed to load DB", e);
      return initialDb;
    }
  },

  saveState: (state: AppState): boolean => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.error("Failed to save DB", e);
      // @ts-ignore
      if (e.name === 'QuotaExceededError' || e.code === 22) {
          alert("CRITICAL: Browser Storage Full! Your meal history is too large. Please delete some old logs with photos to make space for new ones.");
      }
      return false;
    }
  },

  updateUser: (user: UserProfile) => {
    const state = db.getState();
    state.user = user;
    return db.saveState(state);
  },

  updateUserSensitivities: (sensitivities: FoodSensitivity[]) => {
    const state = db.getState();
    if (state.user) {
        const existingSensitivities = state.user.foodSensitivities || [];
        const existingMap = new Map(existingSensitivities.map(s => [s.food.toLowerCase(), s]));
        
        sensitivities.forEach(s => {
            existingMap.set(s.food.toLowerCase(), s);
        });
        
        state.user.foodSensitivities = Array.from(existingMap.values());
        return db.saveState(state);
    }
    return false;
  },

  getSensitivities: (): FoodSensitivity[] => {
    const state = db.getState();
    return state.user?.foodSensitivities || [];
  },

  addLabReport: (report: LabReport) => {
      const state = db.getState();
      if (state.user) {
          state.user.labReports = [...(state.user.labReports || []), report];
          if (report.extractedBiomarkers) {
             state.biomarkers = [...(state.biomarkers || []), ...report.extractedBiomarkers];
          }
          return db.saveState(state);
      }
      return false;
  },

  addFoodLog: (log: FoodLog): boolean => {
    const state = db.getState();
    state.foodLogs = [log, ...state.foodLogs];
    return db.saveState(state);
  },

  updateFoodLog: (log: FoodLog): boolean => {
    const state = db.getState();
    state.foodLogs = state.foodLogs.map(l => l.id === log.id ? log : l);
    return db.saveState(state);
  },

  deleteFoodLog: (id: string) => {
    const state = db.getState();
    state.foodLogs = state.foodLogs.filter(l => String(l.id) !== String(id));
    return db.saveState(state);
  },

  addFlareLog: (log: FlareLog) => {
    const state = db.getState();
    state.flareLogs = [log, ...state.flareLogs];
    return db.saveState(state);
  },

  deleteFlareLog: (id: string) => {
    const state = db.getState();
    state.flareLogs = state.flareLogs.filter(l => String(l.id) !== String(id));
    return db.saveState(state);
  },

  addBehaviorLog: (log: BehaviorLog) => {
    const state = db.getState();
    state.behaviorLogs = [log, ...state.behaviorLogs];
    return db.saveState(state);
  },

  saveAnalysis: (analysis: DeepAnalysis) => {
    const state = db.getState();
    state.currentAnalysis = analysis;
    return db.saveState(state);
  },

  saveFlareDetectiveReport: (report: FlareDetectiveReport) => {
      const state = db.getState();
      state.flareDetectiveReports = [report, ...(state.flareDetectiveReports || [])];
      return db.saveState(state);
  },

  addToShoppingList: (item: ShoppingListItem) => {
    const state = db.getState();
    state.shoppingList = [item, ...(state.shoppingList || [])];
    return db.saveState(state);
  },

  removeFromShoppingList: (id: string) => {
    const state = db.getState();
    state.shoppingList = (state.shoppingList || []).filter(i => i.id !== id);
    return db.saveState(state);
  },
  
  toggleShoppingItem: (id: string) => {
    const state = db.getState();
    const list = state.shoppingList || [];
    const idx = list.findIndex(i => i.id === id);
    if (idx > -1) {
        list[idx].status = list[idx].status === 'bought' ? 'pending' : 'bought';
        state.shoppingList = list;
        return db.saveState(state);
    }
    return false;
  },
  
  addBiomarkers: (biomarkers: Biomarker[]) => {
      const state = db.getState();
      state.biomarkers = [...(state.biomarkers || []), ...biomarkers];
      return db.saveState(state);
  },

  exportData: () => {
    const state = db.getState();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flarefinder_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importData: (jsonData: string): boolean => {
    try {
      const parsed = JSON.parse(jsonData);
      if (parsed && (parsed.user || Array.isArray(parsed.foodLogs))) {
        db.saveState(parsed);
        return true;
      }
      return false;
    } catch (e) {
      console.error("Import failed", e);
      return false;
    }
  },

  clear: () => {
    localStorage.removeItem(STORAGE_KEY);
  }
};
