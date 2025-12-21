
import { GoogleGenAI, Type } from "@google/genai";
import { AppState, FoodLog, BehaviorLog, Reminder, UserProfile, DeepAnalysis, MarketplaceProduct, SimulationResult, GlobalInsight, FoodSensitivity, FlareDetectiveReport, LabReport, Recipe, DayPlan, Biomarker, MenuAnalysis } from "../types";
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';

// Synchronize PDF.js worker with the exact version in index.html to prevent mismatch errors.
if (typeof window !== 'undefined' && pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
    const WORKER_VERSION = '4.0.379';
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${WORKER_VERSION}/build/pdf.worker.min.mjs`;
}

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API Key not found in environment");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Enhanced robust JSON parser that handles markdown blocks and attempts to 
 * repair truncated JSON by closing open brackets/braces.
 */
const safeJsonParse = (text: string | undefined | null) => {
    if (!text) return null;
    let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
        return JSON.parse(cleanText);
    } catch (e) {
        console.warn("Initial JSON parse failed, attempting deep recovery...");
        
        // Strategy 1: Find the actual JSON substring
        const startChar = cleanText.search(/\{|\[/);
        const endChar = Math.max(cleanText.lastIndexOf('}'), cleanText.lastIndexOf(']'));
        
        if (startChar !== -1 && endChar !== -1 && endChar > startChar) {
            const substring = cleanText.substring(startChar, endChar + 1);
            try {
                return JSON.parse(substring);
            } catch (innerE) {
                // Strategy 2: Attempt to fix truncation by appending closing tags
                // This handles the "Expected ',' or ']'" error when the model cuts off mid-array
                let attempt = substring;
                const stack = [];
                for (const char of attempt) {
                    if (char === '{' || char === '[') stack.push(char === '{' ? '}' : ']');
                    else if (char === '}' || char === ']') stack.pop();
                }
                
                // Try closing in reverse order of stack
                while (stack.length > 0) {
                    attempt += stack.pop();
                    try {
                        return JSON.parse(attempt);
                    } catch (finalE) { /* continue until exhausted */ }
                }
                
                // Strategy 3: Hard-truncate to last valid object in an array if it looks like an array
                if (substring.startsWith('[') || substring.includes('"sensitivities": [')) {
                    const lastValidObject = substring.lastIndexOf('}');
                    if (lastValidObject !== -1) {
                        let partial = substring.substring(0, lastValidObject + 1);
                        if (!partial.endsWith(']')) partial += ']';
                        if (substring.includes('{') && !partial.endsWith('}')) partial += '}';
                        try {
                           return JSON.parse(partial);
                        } catch (lastE) {}
                    }
                }
            }
        }
        throw new Error("AI returned invalid data format. Please try again with a smaller or clearer file.");
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
            try {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                // @ts-ignore
                const pageText = textContent.items.map((item) => item.str).join(' ');
                pages.push(`--- Page ${i} ---\n${pageText}\n`);
            } catch (pageErr) {
                pages.push(`--- Page ${i} ---\n[Text Extraction Failed]\n`);
            }
        }
        return pages;
    } catch (e) {
        console.error("PDF Extraction Error:", e);
        throw new Error("Failed to parse PDF. The file might be corrupted or protected.");
    }
};

export const analyzeFoodImage = async (base64Image: string, mimeType: string = "image/jpeg", user?: UserProfile | null): Promise<Partial<FoodLog>> => {
  const ai = getAiClient();
  if (!ai) throw new Error("AI Client not initialized");

  const prompt = `Analyze this food image for someone with ${user?.condition || 'autoimmune issues'}. 
  Identify ingredients, cooking method, and potential triggers. 
  Check against known user triggers: ${user?.knownTriggers?.join(', ') || 'None'}.
  Return nutrition estimates and safer alternatives.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { mimeType, data: base64Image } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingBudget: 1024 },
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
                cookingMethod: { type: Type.STRING },
                nutrition: {
                  type: Type.OBJECT,
                  properties: {
                    calories: { type: Type.INTEGER },
                    protein: { type: Type.INTEGER },
                    carbs: { type: Type.INTEGER },
                    fat: { type: Type.INTEGER }
                  }
                },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                sensitivityAlert: {
                  type: Type.OBJECT,
                  properties: {
                    level: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
                    triggerIngredient: { type: Type.STRING },
                    message: { type: Type.STRING }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  return safeJsonParse(response.text) || { detectedItems: [] };
};

export const scanGroceryProduct = async (base64Image: string, mimeType: string = "image/jpeg", user?: UserProfile | null): Promise<Partial<FoodLog>> => {
  const ai = getAiClient();
  if (!ai) throw new Error("AI Client not initialized");

  const prompt = `Scan this product label. Extract ingredients and highlight triggers for ${user?.condition}.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { mimeType, data: base64Image } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingBudget: 1024 }
    }
  });

  return { ...safeJsonParse(response.text), isGroceryScan: true };
};

export const processVoiceCommand = async (text: string, user?: UserProfile | null): Promise<{ foodLogs: Partial<FoodLog>[], behaviorLogs: Partial<BehaviorLog>[] }> => {
  const ai = getAiClient();
  if (!ai) throw new Error("AI Client not initialized");

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Extract health logs from: "${text}". User has ${user?.condition}.`,
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingBudget: 1024 }
    }
  });

  return safeJsonParse(response.text) || { foodLogs: [], behaviorLogs: [] };
};

export const generatePatternInsights = async (state: AppState): Promise<DeepAnalysis | null> => {
  const ai = getAiClient();
  if (!ai) return null;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Analyze health logs and generate a Bio-Weather forecast. Data: ${JSON.stringify(state.flareLogs.slice(0, 5))}`,
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 4096,
      thinkingConfig: { thinkingBudget: 2048 }
    }
  });

  const analysis = safeJsonParse(response.text);
  return analysis ? { ...analysis, id: crypto.randomUUID(), timestamp: new Date().toISOString() } : null;
};

export const chatWithCoach = async (message: string, state: AppState): Promise<{reply: string, suggestions: string[], richContent?: any}> => {
  const ai = getAiClient();
  if (!ai) return { reply: "Offline.", suggestions: [] };

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Health coach for ${state.user?.name}. Message: ${message}`,
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingBudget: 1024 }
    }
  });

  return safeJsonParse(response.text) || { reply: "I'm processing that...", suggestions: [] };
};

export const getSmartReminders = async (state: AppState): Promise<Reminder[]> => {
  const ai = getAiClient();
  if (!ai) return [];

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: "Generate 3 daily health reminders.",
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingBudget: 512 }
    }
  });

  const reminders = safeJsonParse(response.text);
  return Array.isArray(reminders) ? reminders.map(r => ({ ...r, id: crypto.randomUUID(), timestamp: new Date().toISOString() })) : [];
};

export const simulateMealImpact = async (base64Image: string, mimeType: string = "image/jpeg", user: UserProfile): Promise<SimulationResult> => {
  const ai = getAiClient();
  if (!ai) throw new Error("AI not initialized");

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
         { inlineData: { mimeType, data: base64Image } },
         { text: "Predict inflammatory risk." }
      ]
    },
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingBudget: 512 }
    }
  });

  return safeJsonParse(response.text);
};

export const analyzeRestaurantMenu = async (base64Image: string, mimeType: string = "image/jpeg", user: UserProfile): Promise<MenuAnalysis> => {
    const ai = getAiClient();
    if (!ai) throw new Error("AI not initialized");

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
            parts: [
                { inlineData: { mimeType, data: base64Image } },
                { text: "Find safe menu options." }
            ]
        },
        config: {
            responseMimeType: "application/json",
            maxOutputTokens: 2048,
            thinkingConfig: { thinkingBudget: 1024 }
        }
    });

    return safeJsonParse(response.text);
};

export const getMarketplaceRecommendations = async (user: UserProfile): Promise<MarketplaceProduct[]> => {
  const ai = getAiClient();
  if (!ai) return [];

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: "Suggest safe health products.",
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingBudget: 512 }
    }
  });

  return safeJsonParse(response.text) || [];
};

export const getGlobalInsights = async (condition: string): Promise<GlobalInsight[]> => {
  const ai = getAiClient();
  if (!ai) return [];
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Trending insights for ${condition}.`,
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingBudget: 512 }
    }
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
  if (!ai) throw new Error("AI not initialized");

  const processChunk = async (chunkText: string, chunkInfo: string) => {
      if (onProgress) onProgress(`Analyzing ${chunkInfo}...`);
      const response = await ai.models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: `Extract food sensitivities and biomarkers from this report segment: ${chunkText}`,
          config: {
              responseMimeType: "application/json",
              maxOutputTokens: 4096,
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
                              }
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
                              }
                          }
                      },
                      summary: { type: Type.STRING }
                  }
              }
          }
      });
      return safeJsonParse(response.text);
  };

  let allSensitivities: FoodSensitivity[] = [];
  let allBiomarkers: Biomarker[] = [];
  let combinedSummary = "";

  if (mimeType === 'application/pdf') {
      const pages = await extractPdfPages(base64Data);
      const CHUNK_SIZE = 5; // Process in 5-page chunks to avoid output truncation
      for (let i = 0; i < pages.length; i += CHUNK_SIZE) {
          const chunk = pages.slice(i, i + CHUNK_SIZE).join('\n');
          const result = await processChunk(chunk, `pages ${i + 1} to ${Math.min(i + CHUNK_SIZE, pages.length)}`);
          if (result) {
              if (result.sensitivities) allSensitivities = [...allSensitivities, ...result.sensitivities];
              if (result.biomarkers) allBiomarkers = [...allBiomarkers, ...result.biomarkers];
              if (result.summary) combinedSummary += result.summary + " ";
          }
      }
  } else {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
            parts: [
                { inlineData: { mimeType, data: base64Data } },
                { text: "Extract food sensitivities and biomarkers from this lab image." }
            ]
        },
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: 4096,
          thinkingConfig: { thinkingBudget: 2048 }
        }
      });
      const raw = safeJsonParse(response.text);
      if (raw) {
          allSensitivities = raw.sensitivities || [];
          allBiomarkers = raw.biomarkers || [];
          combinedSummary = raw.summary || "";
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
    if (!ai) throw new Error("AI not initialized");

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: "Analyze recent logs for flare causes.",
        config: {
            responseMimeType: "application/json",
            maxOutputTokens: 2048,
            thinkingConfig: { thinkingBudget: 1024 }
        }
    });

    const report = safeJsonParse(response.text);
    return { ...report, id: crypto.randomUUID(), dateGenerated: new Date().toISOString() };
};

export const generateSafeMealPlan = async (user: UserProfile): Promise<DayPlan> => {
    const ai = getAiClient();
    if (!ai) throw new Error("AI not initialized");

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: "Generate a 1-day meal plan safe for the user's triggers.",
        config: {
            responseMimeType: "application/json",
            maxOutputTokens: 4096,
            thinkingConfig: { thinkingBudget: 2048 }
        }
    });

    return safeJsonParse(response.text);
};
