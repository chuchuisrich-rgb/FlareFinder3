
import { GoogleGenAI, Type } from "@google/genai";
import { AppState, FoodLog, BehaviorLog, Reminder, UserProfile, DeepAnalysis, MarketplaceProduct, SimulationResult, GlobalInsight, FoodSensitivity, FlareDetectiveReport, LabReport, Recipe, DayPlan, Biomarker, MenuAnalysis } from "../types";
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker from CDN
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

/**
 * Executes a task with a preferred model, falling back to a secondary model on ANY failure.
 */
async function smartExecute<T>(
    preferredModel: string, 
    task: (model: string) => Promise<T>
): Promise<T> {
    try {
        // Try the preferred model (Pro) with minimal retries to avoid long hangs
        return await withRetry(() => task(preferredModel), 1);
    } catch (err: any) {
        // If the preferred model fails (Pro), instantly switch to Flash
        if (preferredModel === PRO_MODEL) {
            console.warn(`[Neural Engine] Pro Model unavailable or returned invalid data. Fallback to Flash.`, err);
            // Flash is tried with standard retries for maximum reliability
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
      // Retry on network errors or transient server errors
      if (status === 500 || status === 503 || (status === 429 && i < maxRetries - 1)) {
        const waitTime = Math.pow(2, i) * 1500 + (Math.random() * 500); 
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
        console.error("PDF Extraction failed:", e);
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
    2. For EACH item found, you MUST break it down into its constituent ingredients.
    3. Determine the safety level (safe, caution, avoid) for EVERY ingredient based on ${user?.condition}.
    4. Pay extreme attention to hidden triggers like Nightshades, Yeast, and Processed Oils.
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
                                name: { type: Type.STRING },
                                category: { type: Type.STRING },
                                ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                                reasoning: { type: Type.STRING },
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
    const result = safeJsonParse(response.text);
    if (!result) throw new Error("Invalid Analysis JSON");
    return result;
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
    const result = safeJsonParse(response.text);
    if (!result) throw new Error("Invalid Scan JSON");
    return { ...result, isGroceryScan: true };
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
        contents: `Analyze patterns for ${state.user?.condition}. ${goalContext} 
        Food Logs: ${JSON.stringify(state.foodLogs.slice(0, 15))}
        Flare Logs: ${JSON.stringify(state.flareLogs.slice(0, 10))}
        Behavior Logs: ${JSON.stringify(state.behaviorLogs.slice(0, 20))}
        Return DeepAnalysis JSON.`,
        config: { 
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 2048 } 
        }
    });
    const analysis = safeJsonParse(response.text);
    if (!analysis) throw new Error("Invalid Forecast JSON");
    return { ...analysis, id: crypto.randomUUID(), timestamp: new Date().toISOString() };
  });
};

export const chatWithCoach = async (message: string, state: AppState): Promise<{reply: string, suggestions: string[], richContent?: any}> => {
  const ai = getAiClient();
  if (!ai) return { reply: "AI Offline.", suggestions: [] };

  return smartExecute(PRO_MODEL, async (model) => {
      const response = await ai.models.generateContent({
          model: model,
          contents: `Neural Coach. Condition: ${state.user?.condition}. 
          History Snippet: ${JSON.stringify(state.flareLogs.slice(0, 3))}
          Message: ${message}. 
          Return JSON { "reply": "...", "suggestions": [...], "richContent": {...} }.`,
          config: { 
              responseMimeType: "application/json",
              thinkingConfig: { thinkingBudget: 1024 } 
          }
      });
      const result = safeJsonParse(response.text);
      if (!result) throw new Error("Invalid Coach JSON");
      return result;
  });
};

export const getSmartReminders = async (state: AppState): Promise<Reminder[]> => {
  const ai = getAiClient();
  if (!ai) return [];
  
  const user = state.user;
  const recentLogs = state.foodLogs.slice(0, 3);
  const recentFlares = state.flareLogs.slice(0, 3);

  const prompt = `Generate 3 proactive health reminders for a user with ${user?.condition}.
    Context:
    - Recent Meals: ${JSON.stringify(recentLogs.map(l => l.detectedItems.map(i => i.name)))}
    - Recent Flares: ${JSON.stringify(recentFlares.map(f => `Severity ${f.severity}`))}
    - Goals: ${user?.goals.join(', ')}
    JSON.`;

  try {
      const response = await ai.models.generateContent({
          model: FLASH_MODEL,
          contents: prompt,
          config: { 
              responseMimeType: "application/json",
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      reminders: {
                          type: Type.ARRAY,
                          items: {
                              type: Type.OBJECT,
                              properties: {
                                  text: { type: Type.STRING },
                                  type: { type: Type.STRING, enum: ['weather', 'cycle', 'habit', 'general'] },
                                  priority: { type: Type.STRING, enum: ['low', 'high'] },
                                  timestamp: { type: Type.STRING }
                              },
                              required: ["text", "type", "priority"]
                          }
                      }
                  },
                  required: ["reminders"]
              }
          }
      });
      
      const parsed = safeJsonParse(response.text);
      if (parsed && parsed.reminders) {
          return parsed.reminders.map((r: any) => ({
              ...r,
              id: crypto.randomUUID(),
              timestamp: r.timestamp || new Date().toISOString()
          }));
      }
      return [];
  } catch (err) {
      console.error("Failed to fetch smart reminders:", err);
      return [];
  }
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
            contents: { parts: [{ inlineData: { mimeType, data: base64Image } }, { text: `Menu Scan for ${user.condition}.` }] },
            config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 2048 } }
        });
        const result = safeJsonParse(response.text);
        if (!result) throw new Error("Invalid Menu JSON");
        return result;
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
      
      const prompt = `Analyze this clinical health report chunk: "${chunkText}".
      
      CRITICAL EXTRACTION RULES:
      1. Extract all Food Sensitivities into a list called "sensitivities". Each must have "food", "level" (high, medium, low), and "category".
      2. Extract all clinical biomarkers (like CRP, Vitamin D, Glucose) into a list called "biomarkers". Each must have "name", "value" (number), "unit", and "status" (normal, high, low).
      3. Provide a high-level biological "summary" of the findings.
      
      Return ONLY valid JSON using the exact keys above.`;

      return await smartExecute(PRO_MODEL, async (model) => {
          const response = await ai.models.generateContent({
              model: model, 
              contents: prompt,
              config: {
                  responseMimeType: "application/json",
                  thinkingConfig: { thinkingBudget: 2048 },
                  responseSchema: {
                      type: Type.OBJECT,
                      properties: {
                          sensitivities: {
                              type: Type.ARRAY,
                              items: {
                                  type: Type.OBJECT,
                                  properties: {
                                      food: { type: Type.STRING },
                                      level: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
                                      category: { type: Type.STRING }
                                  },
                                  required: ["food", "level"]
                              }
                          },
                          biomarkers: {
                              type: Type.ARRAY,
                              items: {
                                  type: Type.OBJECT,
                                  properties: {
                                      name: { type: Type.STRING },
                                      value: { type: Type.NUMBER },
                                      unit: { type: Type.STRING },
                                      status: { type: Type.STRING, enum: ['normal', 'high', 'low'] }
                                  },
                                  required: ["name", "value", "unit"]
                              }
                          },
                          summary: { type: Type.STRING }
                      },
                      required: ["summary"]
                  }
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
      const CHUNK_SIZE = 1; // 1 page at a time for highest precision
      for (let i = 0; i < pages.length; i += CHUNK_SIZE) {
          const chunk = pages.slice(i, i + CHUNK_SIZE).join('\n');
          const result = await processChunk(chunk, `page ${i + 1}`);
          if (result) {
              if (result.sensitivities) allSensitivities = [...allSensitivities, ...result.sensitivities];
              if (result.biomarkers) allBiomarkers = [...allBiomarkers, ...result.biomarkers];
              if (result.summary) combinedSummary += result.summary + " ";
          }
      }
  } else {
      const result = await processChunk(`[IMAGE DATA PROCESSED]`, "image report");
      if (result) {
          allSensitivities = result.sensitivities || [];
          allBiomarkers = result.biomarkers || [];
          combinedSummary = result.summary || "";
      }
  }

  return {
      sensitivities: allSensitivities.map((s: any) => ({ ...s, dateDetected: new Date().toISOString(), source: 'lab_result' })),
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
            contents: `Flare Detective Analysis for ${state.user?.condition}. 
            Recent Food Logs: ${JSON.stringify(state.foodLogs.slice(0, 10))}
            Recent Flare Logs: ${JSON.stringify(state.flareLogs.slice(0, 5))}
            Recent Behaviors: ${JSON.stringify(state.behaviorLogs.slice(0, 10))}
            Identify the most likely trigger suspects. JSON.`,
            config: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 2048 } }
        });
        const report = safeJsonParse(response.text);
        if (!report) throw new Error("Invalid Detective JSON");
        return { ...report, id: crypto.randomUUID(), dateGenerated: new Date().toISOString() };
    });
};

export const generateSafeMealPlan = async (user: UserProfile): Promise<DayPlan> => {
    const ai = getAiClient();
    if (!ai) throw new Error("AI Offline");

    return smartExecute(PRO_MODEL, async (model) => {
        const response = await ai.models.generateContent({
            model: model,
            contents: `Generate a safe meal plan for a user with ${user.condition}. Focus on high-nutrient, anti-inflammatory options. Return JSON { "breakfast": {...}, "lunch": {...}, "dinner": {...}, "snack": {...} }.`,
            config: { 
                responseMimeType: "application/json", 
                thinkingConfig: { thinkingBudget: 1024 } 
            }
        });
        const result = safeJsonParse(response.text);
        if (!result) throw new Error("Invalid Meal Plan JSON");
        return result;
    });
};
