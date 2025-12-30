
export interface UserProfile {
  id: string;
  name: string;
  condition: string; // e.g., HS, Crohn's
  conditionSeverity: string; // e.g., "Stage 2", "Moderate", "In Remission"
  onboardingCompleted: boolean;
  knownTriggers: string[];
  goals: string[]; // e.g., "Reduce pain", "Identify food triggers", "Sleep better"
  bio?: string; // Optional context like "Night shift worker", "Vegetarian"
  foodSensitivities?: FoodSensitivity[]; // Digital twin of lab results
  labReports?: LabReport[]; // Storage for raw and parsed reports
}

export interface Biomarker {
    name: string; // e.g., "CRP", "Testosterone", "Vitamin D"
    value: number;
    unit: string;
    date: string;
    status: 'normal' | 'high' | 'low';
}

export interface LabReport {
  id: string;
  type: 'food_sensitivity' | 'microbiome' | 'hormonal' | 'bloodwork';
  dateUploaded: string;
  summary: string;
  imageUrl?: string;
  rawText?: string;
  extractedBiomarkers?: Biomarker[]; // New field for numerical trends
}

export interface FoodSensitivity {
  food: string;
  level: 'high' | 'medium' | 'low';
  source: 'lab_result' | 'manual';
  category?: string; // e.g., "Dairy", "Vegetable"
  dateDetected: string;
}

export interface ShoppingListItem {
  id: string;
  name: string;
  brand?: string;
  addedAt: string;
  status: 'pending' | 'bought';
  sensitivityAlert?: {
    level: 'high' | 'medium' | 'low';
    trigger: string;
  };
}

export interface FoodItem {
  name: string;
  category: string; // dairy, nightshade, processed, etc.
  ingredients: string[];
  confidence: number;
  tags?: ('inflammatory' | 'neutral' | 'anti-inflammatory' | 'potential trigger')[];
  cookingMethod?: string;
  reasoning?: string; // Explanation for the tags
  alternatives?: string[]; // AI suggested healthier alternatives
  nutrition?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  sensitivityAlert?: {
    level: 'high' | 'medium' | 'low';
    triggerIngredient: string;
    message: string;
  };
  ingredientAnalysis?: {
    name: string;
    safetyLevel: 'high' | 'medium' | 'safe';
    reason: string;
  }[];
}

export interface FoodLog {
  id: string;
  timestamp: string;
  imageUrl?: string;
  detectedItems: FoodItem[];
  manualNotes?: string;
  isGroceryScan?: boolean; // Distinguish between eating and shopping
}

export interface FlareLog {
  id: string;
  timestamp: string;
  severity: number; // 0-5
  location: string; // primary location or comma-joined list for backward compatibility
  locations?: string[]; // multiple selected locations
  bodyPoints?: { x: number; y: number }[]; // x,y coordinates on body map (0-100 scale)
  drawnPaths?: { x: number; y: number }[][]; // Array of paths (each path is array of points)
  notes: string;
  weather?: {
    temperature: number;
    humidity: number;
  };
  painLevel?: number; // Kept as optional for backward compatibility
}

export interface BehaviorLog {
  id: string;
  timestamp: string;
  type: 'sleep' | 'water' | 'workout' | 'stress' | 'menstrual' | 'weather' | 'mood' | 'anxiety' | 'energy' | 'symptom_pcos' | 'symptom_hs';
  value: number | string; // 8 (hours), 5 (cups), 'high' (stress)
  unit?: string;
  details?: string;
  quality?: number; // 1-5 for sleep quality, or stress level
}

export interface Reminder {
  id: string;
  type: 'weather' | 'cycle' | 'habit' | 'general';
  text: string;
  priority: 'low' | 'high';
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  suggestions?: string[];
  // Billion Dollar Upgrade: Rich Content Cards inside Chat
  richContent?: {
      type: 'product' | 'recipe' | 'action' | 'insight';
      data: any; // Flexible payload for MarketplaceProduct, Recipe, etc.
  };
}

// New Deep Analysis Types
export interface DeepAnalysis {
  id: string;
  timestamp: string;
  afirScore: {
    value: number; // 0-100
    trend: 'improving' | 'worsening' | 'stable';
    influencingFactors: string[];
  };
  forecast: {
    riskLevel: 'low' | 'medium' | 'high';
    explanation: string;
  };
  
  // Billion Dollar Lifecycle Features
  bioWeather?: {
      status: 'Sunny' | 'Cloudy' | 'Stormy';
      headline: string; // "Clear skies ahead"
      summary: string; // "Your hormones are stable and inflammation is low."
  };
  dailyProtocol?: {
      nutritionFocus: string; // "Focus on Omega-3s and Leafy Greens"
      movement: string; // "Gentle Yoga or Walking"
      selfCare: string; // "Warm compress on friction areas, loose clothing"
      mindset: string; // "Be patient with your body today"
  };

  topTriggers: {
    name: string;
    probability: number; // 0-100
    reason: string;
  }[];
  protectiveBehaviors: {
    name: string;
    impact: string;
  }[];
  dailySummary: string;
  recommendations: string[];
  experiments: string[]; // "Try eliminating nightshades for 3 days"
  
  clinicalSummary?: string; // Markdown formatted report for doctors
  dailyChecklist?: {
    task: string;
    completed: boolean;
    category: 'diet' | 'lifestyle' | 'mindset';
  }[];
  
  // Advanced Bio-Twin Features
  stackingTriggers?: {
      triggerA: string;
      triggerB: string;
      combinedEffect: string; // "High Sleep Debt + Sugar = 90% Flare Risk"
  }[];
  
  cycleAnalysis?: {
      currentPhase: 'Follicular' | 'Ovulation' | 'Luteal' | 'Menstrual' | 'Unknown';
      dayOfCycle: number;
      hormonalContext: string; // "Estrogen dropping, Progesterone peaking"
      flareRiskDueToHormones: 'low' | 'medium' | 'high';
      specificAdvice: string;
  };
  
  // Narrative Intelligence
  dailyNarrative?: string; // "Good morning! It's a Sunny biological day..."
}

export interface FlareDetectiveReport {
  id: string;
  dateGenerated: string;
  spikeDetected: boolean;
  suspects: {
    name: string;
    reason: string; // "Hidden yeast in the bread you ate 24h ago"
    confidence: number;
  }[];
  conclusion: string;
}

// --- SHARK TANK FEATURES ---

export interface MarketplaceProduct {
  id: string;
  name: string;
  brand: string;
  category: 'supplement' | 'food' | 'skincare' | 'device';
  price: string;
  imageUrl?: string;
  matchScore: number; // 0-100 match for this user
  matchReason: string; // "Free from your triggers: Dairy, Gluten"
  affiliateLink?: string;
}

export interface SimulationResult {
  riskScore: number; // 0-100
  prediction: string; // "High likelihood of inflammation within 6 hours."
  biologicalMechanisms: string[]; // "Spikes insulin", "Contains solanine"
  verdict: 'Safe' | 'Caution' | 'Avoid';
  betterOption?: string;
}

export interface GlobalInsight {
  topic: string;
  stat: string; // "84% of HS patients..."
  trend: 'up' | 'down' | 'neutral';
}

export interface Recipe {
    id: string;
    title: string;
    description: string;
    ingredients: string[];
    prepTime: string;
    tags: string[];
    matchScore: number;
}

export interface DayPlan {
    breakfast: Recipe;
    lunch: Recipe;
    dinner: Recipe;
    snack: Recipe;
}

// --- DINING CONCIERGE ---
export interface MenuAnalysisItem {
    dishName: string;
    description: string;
    safetyLevel: 'safe' | 'caution' | 'avoid';
    modification: string | null; // e.g. "Ask for no cheese"
    reason: string;
}

export interface MenuAnalysis {
    safeOptions: MenuAnalysisItem[];
    cautionOptions: MenuAnalysisItem[];
    avoidOptions: MenuAnalysisItem[];
    chefCardText: string; // Generated text to show waiter
}

export interface AppState {
  user: UserProfile | null;
  foodLogs: FoodLog[];
  flareLogs: FlareLog[];
  behaviorLogs: BehaviorLog[];
  currentAnalysis: DeepAnalysis | null;
  flareDetectiveReports?: FlareDetectiveReport[];
  chatHistory?: ChatMessage[];
  reminders?: Reminder[];
  shoppingList: ShoppingListItem[];
  marketplaceRecommendations?: MarketplaceProduct[];
  biomarkers?: Biomarker[]; // Global store for plotted data
}
