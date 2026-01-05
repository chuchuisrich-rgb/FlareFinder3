
import { GoogleGenAI, Type } from "@google/genai";
import { AppState, FoodLog, BehaviorLog, Reminder, UserProfile, DeepAnalysis, MarketplaceProduct, SimulationResult, GlobalInsight, FoodSensitivity, FlareDetectiveReport, LabReport, Recipe, DayPlan, Biomarker, MenuAnalysis, FoodItem } from "../types";
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';
// import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry';

// Define strict schemas for clinical data extraction
const LAB_RESULT_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        sensitivities: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                required: ["food", "level"],
                properties: {
                    food: { type: Type.STRING, description: "The specific food or ingredient identified." },
                    level: { type: Type.STRING, enum: ["high", "medium", "low"], description: "The level of sensitivity or reactivity." },
                    category: { type: Type.STRING, description: "Biological category (e.g. Dairy, Nightshade)." }
                }
            }
        },
        biomarkers: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                required: ["name", "value", "unit"],
                properties: {
                    name: { type: Type.STRING, description: "Biomarker name like CRP, Glucose, etc." },
                    value: { type: Type.NUMBER, description: "Numerical value." },
                    unit: { type: Type.STRING, description: "Measurement unit (mg/L, mmol, etc.)." },
                    status: { type: Type.STRING, enum: ["normal", "high", "low"] }
                }
            }
        },
        summary: { type: Type.STRING, description: "A brief clinical summary of the findings." }
    }
};

const PRO_MODEL = 'gemini-3-pro-preview';
const FLASH_MODEL = 'gemini-3-flash-preview';

let proModelLockUntil = 0;
let lastRequestTime = 0;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

const prepareLogsForAi = (logs: any[]) => {
    return logs.map(log => {
        const { imageUrl, ...rest } = log;
        return rest;
    });
};

async function smartExecute<T>(
    preferredModel: string, 
    task: (model: string) => Promise<T>
): Promise<T> {
    const now = Date.now();
    const timeSinceLastReq = now - lastRequestTime;
    if (timeSinceLastReq < 1000) {
        await delay(1000 - timeSinceLastReq);
    }
    lastRequestTime = Date.now();

    if (preferredModel === PRO_MODEL && Date.now() < proModelLockUntil) {
        return await withRetry(() => task(FLASH_MODEL), 2);
    }

    try {
        return await task(preferredModel);
    } catch (err: any) {
        const status = err?.status || err?.error?.status;
        if (status === 429 && preferredModel === PRO_MODEL) {
            proModelLockUntil = Date.now() + 60000;
        }
        if (preferredModel === PRO_MODEL) {
            return await withRetry(() => task(FLASH_MODEL), 2);
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
      if (status === 500 || status === 503 || status === 429) {
        if (i < maxRetries - 1) {
          const wait = Math.pow(3, i + 1) * 1000; 
          await delay(wait);
          continue;
        }
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
        // Initialize worker only when needed to prevent blocking
        if (typeof window !== 'undefined' && pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
            // const WORKER_VERSION = '4.0.379';
            const WORKER_VERSION = process.env.WORKER_VERSION;
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${WORKER_VERSION}/build/pdf.worker.min.mjs`;
        }

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
        console.error("PDF Extraction failed:", e);
        return [];
    }
};

export const parseLabResults = async (
    base64Data: string, 
    mimeType: string, 
    reportType: string,
    onProgress?: (status: string) => void
): Promise<{sensitivities: FoodSensitivity[], summary: string, extractedBiomarkers?: Biomarker[]}> => {
  const ai = getAiClient();
  if (!ai) throw new Error("AI Offline");

  const processChunk = async (chunkText: string) => {
      await delay(1000);
      return await smartExecute(PRO_MODEL, async (model) => {
          const response = await ai.models.generateContent({
              model: model, 
              contents: `Carefully extract all clinical data from this medical report text. Identify food sensitivities with their reactive levels (high, medium, low) and any biomarkers (CRP, Vitamin D, Glucose, etc.) with their values and units. Report text: "${chunkText}".`,
              config: { 
                  responseMimeType: "application/json",
                  responseSchema: LAB_RESULT_SCHEMA
              }
          });
          const result = safeJsonParse(response.text);
          if (!result) throw new Error("Invalid Lab JSON");
          return result;
      });
  };

  let allSensitivities: FoodSensitivity[] = [];
  let allBiomarkers: Biomarker[] = [];
  let combinedSummary = "";

  if (mimeType === 'application/pdf') {
      const pages = await extractPdfPages(base64Data);
      for (let i = 0; i < pages.length; i++) {
          if (onProgress) onProgress(`Analyzing page ${i+1}/${pages.length}...`);
          try {
              const result = await processChunk(pages[i]);
              if (result) {
                  if (result.sensitivities) allSensitivities = [...allSensitivities, ...result.sensitivities];
                  if (result.biomarkers) allBiomarkers = [...allBiomarkers, ...result.biomarkers];
                  if (result.summary) combinedSummary += result.summary + " ";
              }
          } catch (e) {
              console.error(`Failed to process page ${i+1}. Skipping.`, e);
          }
      }
  } else {
      const result = await processChunk(`[CLINICAL DATA FROM IMAGE]`);
      if (result) {
          allSensitivities = result.sensitivities || [];
          allBiomarkers = result.biomarkers || [];
          combinedSummary = result.summary || "";
      }
  }

  return {
      sensitivities: allSensitivities.map((s: any) => ({ ...s, dateDetected: new Date().toISOString(), source: 'lab_result' })),
      extractedBiomarkers: allBiomarkers.map((b: any) => ({ ...b, date: new Date().toISOString() })),
      summary: combinedSummary.trim() || "Clinical report analysis completed successfully."
  };
};

export const analyzeFoodImage = async (base64Image: string, mimeType: string = "image/jpeg", user?: UserProfile | null): Promise<Partial<FoodLog>> => {
  const ai = getAiClient();
  if (!ai) throw new Error("AI Offline");

  return smartExecute(PRO_MODEL, async (model) => {
    const response = await ai.models.generateContent({
        model: model,
        contents: { parts: [{ inlineData: { mimeType, data: base64Image } }, { text: `Analyze this meal image for a user with ${user?.condition}. Break down into items with full nutrition.` }] },
        config: { 
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                required: ["detectedItems"],
                properties: {
                    detectedItems: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            required: ["name", "category", "ingredients", "reasoning", "nutrition"],
                            properties: {
                                name: { type: Type.STRING },
                                category: { type: Type.STRING },
                                ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                                reasoning: { type: Type.STRING },
                                nutrition: {
                                    type: Type.OBJECT,
                                    properties: {
                                        calories: { type: Type.NUMBER },
                                        protein: { type: Type.NUMBER },
                                        carbs: { type: Type.NUMBER },
                                        fat: { type: Type.NUMBER }
                                    }
                                },
                                ingredientAnalysis: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            name: { type: Type.STRING },
                                            safetyLevel: { type: Type.STRING },
                                            reason: { type: Type.STRING }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });
    const result = safeJsonParse(response.text);
    if (!result) throw new Error("Invalid Food Analysis JSON");
    return result;
  });
};

export const enrichManualFoodItem = async (foodName: string, user: UserProfile): Promise<FoodItem> => {
  const ai = getAiClient();
  if (!ai) throw new Error("AI Offline");

  return smartExecute(PRO_MODEL, async (model) => {
    const response = await ai.models.generateContent({
        model: model,
        contents: `Biological analysis for: "${foodName}" for a person with ${user.condition}. JSON.`,
        config: { 
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                required: ["name", "category", "ingredients", "reasoning", "nutrition"],
                properties: {
                    name: { type: Type.STRING },
                    category: { type: Type.STRING },
                    ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                    reasoning: { type: Type.STRING },
                    nutrition: {
                        type: Type.OBJECT,
                        properties: {
                            calories: { type: Type.NUMBER },
                            protein: { type: Type.NUMBER },
                            carbs: { type: Type.NUMBER },
                            fat: { type: Type.NUMBER }
                        }
                    }
                }
            }
        }
    });
    const result = safeJsonParse(response.text);
    if (!result) throw new Error("Invalid Enrichment JSON");
    return result;
  });
};

export const generatePatternInsights = async (state: AppState): Promise<DeepAnalysis | null> => {
  const ai = getAiClient();
  if (!ai) return null;

  const cleanFoodLogs = prepareLogsForAi(state.foodLogs.slice(0, 15));
  const cleanFlareLogs = prepareLogsForAi(state.flareLogs.slice(0, 10));

  return smartExecute(PRO_MODEL, async (model) => {
    const response = await ai.models.generateContent({
        model: model,
        contents: `Pattern Analysis. Condition: ${state.user?.condition}. Logs: ${JSON.stringify({ meals: cleanFoodLogs, flares: cleanFlareLogs })}. JSON.`,
        config: { 
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    dailyNarrative: { type: Type.STRING },
                    bioWeather: {
                        type: Type.OBJECT,
                        properties: {
                            status: { type: Type.STRING },
                            headline: { type: Type.STRING },
                            summary: { type: Type.STRING }
                        }
                    },
                    dailyProtocol: {
                        type: Type.OBJECT,
                        properties: {
                            nutritionFocus: { type: Type.STRING },
                            movement: { type: Type.STRING },
                            selfCare: { type: Type.STRING },
                            mindset: { type: Type.STRING }
                        }
                    }
                }
            }
        }
    });
    const analysis = safeJsonParse(response.text);
    if (!analysis) throw new Error("Invalid Analysis JSON");
    return { ...analysis, id: crypto.randomUUID(), timestamp: new Date().toISOString() };
  });
};

export const chatWithCoach = async (message: string, state: AppState): Promise<{reply: string, suggestions: string[], richContent?: any}> => {
  const ai = getAiClient();
  if (!ai) return { reply: "AI Offline.", suggestions: [] };
  return smartExecute(PRO_MODEL, async (model) => {
      const response = await ai.models.generateContent({
          model: model,
          contents: `Coach mode. Condition: ${state.user?.condition}. Message: ${message}. JSON.`,
          config: { responseMimeType: "application/json" }
      });
      return safeJsonParse(response.text) || { reply: "Bio-Twin engine busy.", suggestions: [] };
  });
};

export const getSmartReminders = async (state: AppState): Promise<Reminder[]> => {
  const ai = getAiClient();
  if (!ai) return [];
  try {
      const response = await ai.models.generateContent({
          model: FLASH_MODEL,
          contents: `Personalized reminders for ${state.user?.condition} based on history. JSON.`,
          config: { responseMimeType: "application/json" }
      });
      const parsed = safeJsonParse(response.text);
      return (parsed?.reminders || []).map((r: any) => ({ ...r, id: crypto.randomUUID(), timestamp: new Date().toISOString() }));
  } catch { return []; }
};

export const runFlareDetective = async (state: AppState): Promise<FlareDetectiveReport> => {
    const ai = getAiClient();
    if (!ai) throw new Error("AI Offline");
    const cleanFoodLogs = prepareLogsForAi(state.foodLogs.slice(0, 10));
    return smartExecute(PRO_MODEL, async (model) => {
        const response = await ai.models.generateContent({
            model: model,
            contents: `Root cause detective. Condition: ${state.user?.condition}. Food History: ${JSON.stringify(cleanFoodLogs)}. JSON.`,
            config: { responseMimeType: "application/json" }
        });
        const report = safeJsonParse(response.text);
        if (!report) throw new Error("Invalid Detective JSON");
        return { ...report, id: crypto.randomUUID(), dateGenerated: new Date().toISOString() };
    });
};

export const scanGroceryProduct = async (base64Image: string, mimeType: string = "image/jpeg", user?: UserProfile | null): Promise<Partial<FoodLog>> => {
  const ai = getAiClient();
  if (!ai) throw new Error("AI Offline");
  return smartExecute(PRO_MODEL, async (model) => {
    const response = await ai.models.generateContent({
        model: model,
        contents: { parts: [{ inlineData: { mimeType, data: base64Image } }, { text: `Grocery scan for ${user?.condition}. Safety check. JSON.` }] },
        config: { 
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                required: ["detectedItems"],
                properties: {
                    detectedItems: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING },
                                category: { type: Type.STRING },
                                nutrition: {
                                    type: Type.OBJECT,
                                    properties: {
                                        calories: { type: Type.NUMBER }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });
    const result = safeJsonParse(response.text);
    if (!result) throw new Error("Invalid Scan JSON");
    return { ...result, isGroceryScan: true };
  });
};

export const simulateMealImpact = async (base64Image: string, mimeType: string = "image/jpeg", user: UserProfile): Promise<SimulationResult> => {
  const ai = getAiClient();
  if (!ai) throw new Error("AI Offline");
  return smartExecute(PRO_MODEL, async (model) => {
    const response = await ai.models.generateContent({
        model: model,
        contents: { parts: [{ inlineData: { mimeType, data: base64Image } }, { text: `Simulate impact for ${user.condition}. JSON.` }] },
        config: { responseMimeType: "application/json" }
    });
    const result = safeJsonParse(response.text);
    if (!result) throw new Error("Invalid Simulation JSON");
    return result;
  });
};

export const analyzeRestaurantMenu = async (base64Image: string, mimeType: string = "image/jpeg", user: UserProfile): Promise<MenuAnalysis> => {
    const ai = getAiClient();
    if (!ai) throw new Error("AI Offline");
    return smartExecute(PRO_MODEL, async (model) => {
        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [{ inlineData: { mimeType, data: base64Image } }, { text: `Analyze menu for safety with ${user.condition}. JSON.` }] },
            config: { responseMimeType: "application/json" }
        });
        const result = safeJsonParse(response.text);
        if (!result) throw new Error("Invalid Menu JSON");
        return result;
    });
};

export const getMarketplaceRecommendations = async (user: UserProfile): Promise<MarketplaceProduct[]> => {
  const ai = getAiClient();
  if (!ai) return [];
  try {
    const response = await ai.models.generateContent({
        model: FLASH_MODEL,
        contents: `Safe products for ${user.condition}. JSON.`,
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text) || [];
  } catch { return []; }
};

export const getGlobalInsights = async (condition: string): Promise<GlobalInsight[]> => {
  const ai = getAiClient();
  if (!ai) return [];
  try {
    const response = await ai.models.generateContent({
        model: FLASH_MODEL,
        contents: `Aggregated data trends for ${condition}. JSON.`,
        config: { responseMimeType: "application/json" }
    });
    return safeJsonParse(response.text) || [];
  } catch { return []; }
};

export const processVoiceCommand = async (text: string, user?: UserProfile | null): Promise<{ foodLogs: Partial<FoodLog>[], behaviorLogs: Partial<BehaviorLog>[] }> => {
  const ai = getAiClient();
  if (!ai) throw new Error("AI Offline");
  
  return smartExecute(FLASH_MODEL, async (model) => {
    const response = await ai.models.generateContent({
        model: model,
        contents: `The user says: "${text}". Extract any food mentioned and convert to a food log. For each food item, include nutrition data (calories, protein, carbs, fat) and analyze if it triggers ${user?.condition}. Return a JSON object with 'foodLogs' and 'behaviorLogs' keys.`,
        config: { 
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                required: ["foodLogs", "behaviorLogs"],
                properties: {
                    foodLogs: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            required: ["detectedItems"],
                            properties: {
                                detectedItems: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        required: ["name", "category", "ingredients", "reasoning", "nutrition"],
                                        properties: {
                                            name: { type: Type.STRING },
                                            category: { type: Type.STRING },
                                            ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                                            reasoning: { type: Type.STRING },
                                            nutrition: {
                                                type: Type.OBJECT,
                                                properties: {
                                                    calories: { type: Type.NUMBER },
                                                    protein: { type: Type.NUMBER },
                                                    carbs: { type: Type.NUMBER },
                                                    fat: { type: Type.NUMBER }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    behaviorLogs: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                type: { type: Type.STRING },
                                value: { type: Type.NUMBER },
                                details: { type: Type.STRING }
                            }
                        }
                    }
                }
            }
        }
    });
    return safeJsonParse(response.text) || { foodLogs: [], behaviorLogs: [] };
  });
};

export const generateSafeMealPlan = async (user: UserProfile): Promise<DayPlan> => {
    const ai = getAiClient();
    if (!ai) throw new Error("AI Offline");
    return smartExecute(PRO_MODEL, async (model) => {
        const response = await ai.models.generateContent({
            model: model,
            contents: `Meal plan for ${user.condition}. JSON.`,
            config: { responseMimeType: "application/json" }
        });
        const result = safeJsonParse(response.text);
        if (!result) throw new Error("Invalid Meal Plan JSON");
        return result;
    });
};
