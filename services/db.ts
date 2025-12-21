
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

export const db = {
  getState: (): AppState => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : initialDb;
    } catch (e) {
      console.error("Failed to load DB - possibly corrupt or quota exceeded. Resetting.", e);
      // If we can't parse, we must reset or the app will never load.
      try {
          localStorage.removeItem(STORAGE_KEY);
      } catch(resetErr) {
          console.error("Could not reset DB", resetErr);
      }
      return initialDb;
    }
  },

  saveState: (state: AppState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save DB", e);
      // @ts-ignore
      if (e.name === 'QuotaExceededError' || e.code === 22) {
          alert("Storage full! Please delete some old food logs or history to make space.");
      }
    }
  },

  updateUser: (user: UserProfile) => {
    const state = db.getState();
    state.user = user;
    db.saveState(state);
    return user;
  },

  updateUserSensitivities: (sensitivities: FoodSensitivity[]) => {
    const state = db.getState();
    if (state.user) {
        const existingSensitivities = state.user.foodSensitivities || [];
        const existingMap = new Map(existingSensitivities.map(s => [s.food.toLowerCase(), s]));
        
        // Merge: Add new ones or update existing if source is lab_result (higher authority than manual?)
        // For simplicity, we assume new lab results overwrite or add.
        sensitivities.forEach(s => {
            existingMap.set(s.food.toLowerCase(), s);
        });
        
        state.user.foodSensitivities = Array.from(existingMap.values());
        db.saveState(state);
    }
  },

  getSensitivities: (): FoodSensitivity[] => {
    const state = db.getState();
    return state.user?.foodSensitivities || [];
  },

  addLabReport: (report: LabReport) => {
      const state = db.getState();
      if (state.user) {
          state.user.labReports = [...(state.user.labReports || []), report];
          
          // Also extract and save biomarkers globally for easier charting
          if (report.extractedBiomarkers) {
             state.biomarkers = [...(state.biomarkers || []), ...report.extractedBiomarkers];
          }
          
          db.saveState(state);
      }
  },

  getLabReports: (): LabReport[] => {
      const state = db.getState();
      return state.user?.labReports || [];
  },

  addFoodLog: (log: FoodLog) => {
    const state = db.getState();
    state.foodLogs = [log, ...state.foodLogs];
    db.saveState(state);
    return log;
  },

  updateFoodLog: (log: FoodLog) => {
    const state = db.getState();
    state.foodLogs = state.foodLogs.map(l => l.id === log.id ? log : l);
    db.saveState(state);
    return log;
  },

  deleteFoodLog: (id: string) => {
    const state = db.getState();
    state.foodLogs = state.foodLogs.filter(l => l.id !== id);
    db.saveState(state);
  },

  addFlareLog: (log: FlareLog) => {
    const state = db.getState();
    state.flareLogs = [log, ...state.flareLogs];
    db.saveState(state);
    return log;
  },

  addBehaviorLog: (log: BehaviorLog) => {
    const state = db.getState();
    state.behaviorLogs = [log, ...state.behaviorLogs];
    db.saveState(state);
    return log;
  },

  saveAnalysis: (analysis: DeepAnalysis) => {
    const state = db.getState();
    state.currentAnalysis = analysis;
    db.saveState(state);
    return analysis;
  },

  saveFlareDetectiveReport: (report: FlareDetectiveReport) => {
      const state = db.getState();
      state.flareDetectiveReports = [report, ...(state.flareDetectiveReports || [])];
      db.saveState(state);
  },

  // Shopping List
  addToShoppingList: (item: ShoppingListItem) => {
    const state = db.getState();
    state.shoppingList = [item, ...(state.shoppingList || [])];
    db.saveState(state);
  },

  removeFromShoppingList: (id: string) => {
    const state = db.getState();
    state.shoppingList = (state.shoppingList || []).filter(i => i.id !== id);
    db.saveState(state);
  },
  
  toggleShoppingItem: (id: string) => {
    const state = db.getState();
    const list = state.shoppingList || [];
    const idx = list.findIndex(i => i.id === id);
    if (idx > -1) {
        list[idx].status = list[idx].status === 'bought' ? 'pending' : 'bought';
        state.shoppingList = list;
        db.saveState(state);
    }
  },
  
  addBiomarkers: (biomarkers: Biomarker[]) => {
      const state = db.getState();
      state.biomarkers = [...(state.biomarkers || []), ...biomarkers];
      db.saveState(state);
  },

  clear: () => {
    localStorage.removeItem(STORAGE_KEY);
  }
};
