
import { GoogleGenAI, Type } from "@google/genai";
import { AppState, FoodLog, BehaviorLog, Reminder, UserProfile, DeepAnalysis, MarketplaceProduct, SimulationResult, GlobalInsight, FoodSensitivity, FlareDetectiveReport, LabReport, Recipe, DayPlan, Biomarker, MenuAnalysis } from "../types";
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';

if (typeof window !== 'undefined' && pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
    const WORKER_VERSION = process.env.WORKER_VERSION || '4.0.379';
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${WORKER_VERSION}/build/pdf.worker.min.mjs`;
}

const PRO_MODEL = 'gemini-3-pro-preview';
const FLASH_MODEL = 'gemini-3-flash-preview';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

async function smartExecute<T>(
    preferredModel: string, 
    task: (model: string) => Promise<T>
): Promise<T> {
    try {
        return await withRetry(() => task(preferredModel));
    } catch (err: any) {
        const status = err?.status || err?.error?.status;
        const message = err?.message || "";
        const isQuotaError = status === 'RESOURCE_EXHAUSTED' || status === 429 || message.toLowerCase().includes("quota") || message.toLowerCase().includes("limit");

        if (isQuotaError && preferredModel === PRO_MODEL) {
            console.warn("Pro model limited. Switching to Flash.");
            return await withRetry(() => task(FLASH_MODEL));
        }
        throw err;
    }
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const status = err?.status || err?.error?.status;
      if (status === 500 || status === 503 || (status === 429 && i < maxRetries - 1)) {
        const waitTime = Math.pow(2, i) * 2000 + (Math.random() * 1000); 
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw err; 
    }
  }
  throw lastError;
}

const safeJsonParse = (text: string | undefined | null) => {
    if (!text) return null;
    let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
        return JSON.parse(cleanText);
    } catch (e) {
        const startChar = cleanText.search(/\{|\[/);
        if (startChar === -1) return null;
        let jsonSub = cleanText.substring(startChar);
        try { return JSON.parse(jsonSub); } catch { return null; }
    }
};

const extractPdfPages = async (base64Data: string): Promise<string[]> => {
    try {
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;
        const pages: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            // @ts-ignore
            const pageText = textContent.items.map((item) => item.str).join(' ');
            pages.push(`--- Page ${i} ---\n${pageText}\n`);
        }
        return pages;
    } catch (e) {
        return [];
    }
};

export const analyzeFoodImage = async (base64Image: string, mimeType: string = "image/jpeg", user?: UserProfile | null): Promise<Partial<FoodLog>> => {
  const ai = getAiClient();
  if (!ai) throw new Error("AI Offline");

  const goalContext = user?.goals?.length ? `The user's health goals are: ${user.goals.join(', ')}.` : '';
  const prompt = `DECOMPOSITIONAL FOOD ANALYSIS:
    Analyze the uploaded image for a user with ${user?.condition}. 
    
    CRITICAL INSTRUCTIONS:
    1. Identify every food item in the image.
    2. For EACH item found, you MUST break it down into its constituent ingredients (e.g., if you see bread, ingredients should list flour, yeast, sugar, etc.).
    3. Determine the safety level (safe, caution, avoid) for EVERY ingredient based on the user's condition (${user?.condition}).
    4. Pay extreme attention to hidden triggers: Nightshades (tomatoes, peppers, potatoes), Yeast, Dairy, Sugar, and Processed Oils.
    5. If you see something that looks like a sauce, identify potential hidden thickeners or triggers.

    ${goalContext}
    
    Return JSON only.`;

  return smartExecute(PRO_MODEL, async (model) => {
    const response = await ai.models.generateContent({
        model: model,
        contents: { parts: [{ inlineData: { mimeType, data: base64Image } }, { text: prompt }] },
        config: { 
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    detectedItems: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING, description: "Common name of the dish or item" },
                                category: { type: Type.STRING, description: "e.g. Grain, Dairy, Nightshade, Protein" },
                                ingredients: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Complete list of identified constituent ingredients" },
                                reasoning: { type: Type.STRING, description: "Why this item as a whole is rated this way for the user's specific condition" },
                                sensitivityAlert: {
                                    type: Type.OBJECT,
                                    properties: {
                                        level: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
                                        triggerIngredient: { type: Type.STRING },
                                        message: { type: Type.STRING }
                                    }
                                },
                                ingredientAnalysis: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            name: { type: Type.STRING },
                                            safetyLevel: { type: Type.STRING, enum: ['high', 'medium', 'safe'] },
                                            reason: { type: Type.STRING }
                                        }
                                    }
                                },
                                nutrition: {
                                    type: Type.OBJECT,
                                    properties: {
                                        calories: { type: Type.NUMBER },
                                        protein: { type: Type.NUMBER },
                                        carbs: { type: Type.NUMBER },
                                        fat: { type: Type.NUMBER }
                                    }
                                }
                            },
                            required: ["name", "category", "ingredients", "reasoning", "ingredientAnalysis"]
                        }
                    }
                },
                required: ["detectedItems"]
            }
        }
    });
    return safeJsonParse(response.text) || { detectedItems: [] };
  });
};

export const scanGroceryProduct = async (base64Image: string, mimeType: string = "image/jpeg", user?: UserProfile | null): Promise<Partial<FoodLog>> => {
  const ai = getAiClient();
  if (!ai) throw new Error("AI Offline");

  return smartExecute(PRO_MODEL, async (model) => {
    const response = await ai.models.generateContent({
        model: model,
        contents: { parts: [{ inlineData: { mimeType, data: base64Image } }, { text: `Examine this grocery label for inflammatory triggers related to ${user?.condition}. Highlight additives like Maltodextrin, Carrageenan, or Nightshade derivatives.` }] },
        config: { responseMimeType: "application/json" }
    });
    return { ...safeJsonParse(response.text), isGroceryScan: true };
  });
};

export const processVoiceCommand = async (text: string, user?: UserProfile | null): Promise<{ foodLogs: Partial<FoodLog>[], behaviorLogs: Partial<BehaviorLog>[] }> => {
  const ai = getAiClient();
  if (!ai) throw new Error("AI Offline");

  const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: `Extract health logs from text: "${text}". User: ${user?.condition}. JSON.`,
      config: { responseMimeType: "application/json" }
  });
  return safeJsonParse(response.text) || { foodLogs: [], behaviorLogs: [] };
};

export const generatePatternInsights = async (state: AppState): Promise<DeepAnalysis | null> => {
  const ai = getAiClient();
  if (!ai) return null;

  const goalContext = state.user?.goals?.length ? `Goals: ${state.user.goals.join(', ')}.` : '';

  return smartExecute(PRO_MODEL, async (model) => {
    const response = await ai.models.generateContent({
        model: model,
        contents: `Analyze trends for ${state.user?.condition}. ${goalContext} Logs: ${JSON.stringify(state.flareLogs.slice(0, 10))}. Return DeepAnalysis JSON.`,
        config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 2048 } }
    });
    const analysis = safeJsonParse(response.text);
    return analysis ? { ...analysis, id: crypto.randomUUID(), timestamp: new Date().toISOString() } : null;
  });
};

export const chatWithCoach = async (message: string, state: AppState): Promise<{reply: string, suggestions: string[], richContent?: any}> => {
  const ai = getAiClient();
  if (!ai) return { reply: "AI Offline.", suggestions: [] };

  const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: `Neural Coach. Condition: ${state.user?.condition}. Message: ${message}`,
      config: { responseMimeType: "application/json" }
  });
  return safeJsonParse(response.text) || { reply: "I'm processing...", suggestions: [] };
};

export const getSmartReminders = async (state: AppState): Promise<Reminder[]> => {
  const ai = getAiClient();
  if (!ai) return [];
  try {
      const response = await ai.models.generateContent({
          model: FLASH_MODEL,
          contents: `Generate reminders for ${state.user?.condition}. JSON.`,
          config: { responseMimeType: "application/json" }
      });
      return safeJsonParse(response.text) || [];
  } catch { return []; }
};

export const simulateMealImpact = async (base64Image: string, mimeType: string = "image/jpeg", user: UserProfile): Promise<SimulationResult> => {
  const ai = getAiClient();
  if (!ai) throw new Error("AI Offline");

  return smartExecute(PRO_MODEL, async (model) => {
    const response = await ai.models.generateContent({
        model: model,
        contents: { parts: [{ inlineData: { mimeType, data: base64Image } }, { text: `Simulate impact for ${user.condition}.` }] },
        config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 1024 } }
    });
    return safeJsonParse(response.text);
  });
};

export const analyzeRestaurantMenu = async (base64Image: string, mimeType: string = "image/jpeg", user: UserProfile): Promise<MenuAnalysis> => {
    const ai = getAiClient();
    if (!ai) throw new Error("AI Offline");

    return smartExecute(PRO_MODEL, async (model) => {
        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [{ inlineData: { mimeType, data: base64Image } }, { text: `Menu Scan for ${user.condition}.` }] },
            config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 2048 } }
        });
        return safeJsonParse(response.text);
    });
};

export const getMarketplaceRecommendations = async (user: UserProfile): Promise<MarketplaceProduct[]> => {
  const ai = getAiClient();
  if (!ai) return [];
  const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: `Recommend products for ${user.condition}. JSON.`,
      config: { responseMimeType: "application/json" }
  });
  return safeJsonParse(response.text) || [];
};

export const getGlobalInsights = async (condition: string): Promise<GlobalInsight[]> => {
  const ai = getAiClient();
  if (!ai) return [];
  const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: `Trends for ${condition}.`,
      config: { responseMimeType: "application/json" }
  });
  return safeJsonParse(response.text) || [];
};

export const parseLabResults = async (
    base64Data: string, 
    mimeType: string, 
    reportType: string,
    onProgress?: (status: string) => void
): Promise<{sensitivities: FoodSensitivity[], summary: string, extractedBiomarkers?: Biomarker[]}> => {
  const ai = getAiClient();
  if (!ai) throw new Error("AI Offline");

  const processChunk = async (chunkText: string, chunkInfo: string) => {
      if (onProgress) onProgress(`Analyzing ${chunkInfo}...`);
      const response = await ai.models.generateContent({
          model: FLASH_MODEL, 
          contents: `Extract bio-data: ${chunkText}. JSON.`,
          config: {
              responseMimeType: "application/json",
              thinkingConfig: { thinkingBudget: 2048 }
          }
      });
      return safeJsonParse(response.text);
  };

  let allSensitivities: FoodSensitivity[] = [];
  let allBiomarkers: Biomarker[] = [];
  let combinedSummary = "";

  if (mimeType === 'application/pdf') {
      const pages = await extractPdfPages(base64Data);
      const CHUNK_SIZE = 2; 
      for (let i = 0; i < pages.length; i += CHUNK_SIZE) {
          const chunk = pages.slice(i, i + CHUNK_SIZE).join('\n');
          const result = await processChunk(chunk, `pages ${i + 1}-${Math.min(i + CHUNK_SIZE, pages.length)}`);
          if (result) {
              if (result.sensitivities) allSensitivities = [...allSensitivities, ...result.sensitivities];
              if (result.biomarkers) allBiomarkers = [...allBiomarkers, ...result.biomarkers];
              if (result.summary) combinedSummary += result.summary + " ";
          }
      }
  } else {
      const result = await processChunk(`[IMAGE DATA]`, "image report");
      if (result) {
          allSensitivities = result.sensitivities || [];
          allBiomarkers = result.biomarkers || [];
          combinedSummary = result.summary || "";
      }
  }

  return {
      sensitivities: allSensitivities.map((s: any) => ({ ...s, dateDetected: new Date().toISOString() })),
      extractedBiomarkers: allBiomarkers.map((b: any) => ({ ...b, date: new Date().toISOString() })),
      summary: combinedSummary.trim() || "Report analyzed."
  };
};

export const runFlareDetective = async (state: AppState): Promise<FlareDetectiveReport> => {
    const ai = getAiClient();
    if (!ai) throw new Error("AI Offline");

    return smartExecute(PRO_MODEL, async (model) => {
        const response = await ai.models.generateContent({
            model: model,
            contents: `Investigate flare for ${state.user?.condition}. JSON.`,
            config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 2048 } }
        });
        const report = safeJsonParse(response.text);
        return { ...report, id: crypto.randomUUID(), dateGenerated: new Date().toISOString() };
    });
};

export const generateSafeMealPlan = async (user: UserProfile): Promise<DayPlan> => {
    const ai = getAiClient();
    if (!ai) throw new Error("AI Offline");

    const response = await ai.models.generateContent({
        model: FLASH_MODEL,
        contents: `Safe meal plan for ${user.condition}.`,
        config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 1024 } }
    });
    return safeJsonParse(response.text);
};
