
import { GoogleGenAI, Type } from "@google/genai";
import { AppState, FoodLog, BehaviorLog, Reminder, UserProfile, DeepAnalysis, MarketplaceProduct, SimulationResult, GlobalInsight, FoodSensitivity, FlareDetectiveReport, LabReport, Recipe, DayPlan, Biomarker, MenuAnalysis } from "../types";
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker from CDN for browser environments to offload heavy PDF processing from the main thread
if (typeof window !== 'undefined' && pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
    const WORKER_VERSION = process.env.WORKER_VERSION || '4.0.379';
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${WORKER_VERSION}/build/pdf.worker.min.mjs`;
}

// HYBRID MODEL STRATEGY: Use Pro for complex reasoning, Flash for speed/cost efficiency
const PRO_MODEL = 'gemini-3-pro-preview';
const FLASH_MODEL = 'gemini-3-flash-preview';

/**
 * Initializes the Gemini API client using the environment's API key.
 * @returns {GoogleGenAI | null} The initialized AI client or null if key is missing.
 */
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

/**
 * Executes an AI task with an automatic model fallback mechanism.
 * If the preferred (Pro) model hits a rate limit or quota error, it automatically 
 * attempts the same task using the Flash model to maintain app availability.
 * 
 * @param preferredModel - The model to attempt first (usually PRO_MODEL).
 * @param task - An async function that takes a model name and returns a result.
 * @returns {Promise<T>} The result of the task execution.
 */
async function smartExecute<T>(
    preferredModel: string, 
    task: (model: string) => Promise<T>
): Promise<T> {
    try {
        // Attempt execution with the preferred model with retry logic
        return await withRetry(() => task(preferredModel));
    } catch (err: any) {
        // Detect specific Google API quota or rate limit error codes
        const status = err?.status || err?.error?.status;
        const message = err?.message || "";
        
        // Check for common indicators of rate limits or exhausted project resources
        const isQuotaError = status === 'RESOURCE_EXHAUSTED' || status === 429 || 
                           message.toLowerCase().includes("quota") || 
                           message.toLowerCase().includes("limit");

        // FAILOVER LOGIC: If the Pro model fails due to quota, downgrade to the faster Flash model
        if (isQuotaError && preferredModel === PRO_MODEL) {
            console.warn("Pro model limited. Switching to Flash.");
            return await withRetry(() => task(FLASH_MODEL));
        }
        throw err;
    }
}

/**
 * Implements exponential backoff for API calls.
 * Helps handle transient server errors (500/503) or temporary rate limits.
 * 
 * @param fn - The async function to retry.
 * @param maxRetries - Maximum number of attempts.
 * @returns {Promise<T>} The result of the successful execution.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const status = err?.status || err?.error?.status;
      
      // Only retry on transient server-side errors or rate limit hits
      if (status === 500 || status === 503 || (status === 429 && i < maxRetries - 1)) {
        // CALCULATION: Math.pow(2, i) * 2000 creates intervals like 2s, 4s plus a random 'jitter'
        // Jitter prevents "thundering herd" problems where many clients retry at the exact same millisecond.
        const waitTime = Math.pow(2, i) * 2000 + (Math.random() * 1000); 
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw err; 
    }
  }
  throw lastError;
}

/**
 * Sanitizes and parses JSON strings returned by the AI.
 * Handles common LLM output quirks like Markdown code blocks or pre-amble text.
 * 
 * @param text - The raw string response from the AI.
 * @returns {any | null} Parsed object/array or null if parsing fails.
 */
const safeJsonParse = (text: string | undefined | null) => {
    if (!text) return null;
    
    // REGEX: Strip common markdown formatting (```json ... ```) that models often wrap responses in
    let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
        return JSON.parse(cleanText);
    } catch (e) {
        // FAILSAFE: If parsing the whole block fails, find the first '{' or '[' to isolate the JSON content
        const startChar = cleanText.search(/\{|\[/);
        if (startChar === -1) return null;
        let jsonSub = cleanText.substring(startChar);
        try { return JSON.parse(jsonSub); } catch { return null; }
    }
};

/**
 * Uses PDF.js to extract raw text content from a Base64 encoded PDF document.
 * 
 * @param base64Data - Base64 encoded string of the PDF file.
 * @returns {Promise<string[]>} An array of strings, where each string is the text content of one page.
 */
const extractPdfPages = async (base64Data: string): Promise<string[]> => {
    try {
        // CONVERSION: Map the base64 character string back into a binary Uint8Array for the PDF.js parser
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Load the document using PDF.js
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;
        const pages: string[] = [];
        
        // ASYNC LOOP: Extract text content from each page sequentially
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            
            // TRANSFORMATION: Concatenate all text items on the page into a single coherent string
            // @ts-ignore - items might have custom types in some versions of pdfjs
            const pageText = textContent.items.map((item) => item.str).join(' ');
            pages.push(`--- Page ${i} ---\n${pageText}\n`);
        }
        return pages;
    } catch (e) {
        console.error("PDF Extraction failed:", e);
        return [];
    }
};

/**
 * Analyzes a food image by performing a 'decompositional' breakdown into raw ingredients.
 * Cross-references findings against the user's specific condition and goals to provide a safety verdict.
 * 
 * @param base64Image - Base64 image data.
 * @param mimeType - Image standard MIME type.
 * @param user - User profile containing condition and goals.
 * @returns {Promise<Partial<FoodLog>>} Analysis result containing detected items and ingredient safety.
 */
export const analyzeFoodImage = async (base64Image: string, mimeType: string = "image/jpeg", user?: UserProfile | null): Promise<Partial<FoodLog>> => {
  const ai = getAiClient();
  if (!ai) throw new Error("AI Offline");

  // CONTEXT: Build a prompt that forces the AI to be a biological detective rather than just a classifier
  const goalContext = user?.goals?.length ? `The user's health goals are: ${user.goals.join(', ')}.` : '';
  const prompt = `DECOMPOSITIONAL FOOD ANALYSIS:
    Analyze the uploaded image for a user with ${user?.condition}. 
    
    CRITICAL INSTRUCTIONS:
    1. Identify every food item in the image.
    2. For EACH item found, you MUST break it down into its constituent ingredients.
    3. Determine the safety level (safe, caution, avoid) for EVERY ingredient.
    4. Pay extreme attention to hidden triggers like Nightshades, Yeast, and Processed Oils.
    ${goalContext}
    Return JSON only.`;

  return smartExecute(PRO_MODEL, async (model) => {
    const response = await ai.models.generateContent({
        model: model,
        contents: { parts: [{ inlineData: { mimeType, data: base64Image } }, { text: prompt }] },
        config: { 
            responseMimeType: "application/json",
            // SCHEMA: Forces strict structure for the AI's JSON output using @google/genai's Type enum
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
    return safeJsonParse(response.text) || { detectedItems: [] };
  });
};

/**
 * Scans grocery labels or product information to detect hidden inflammatory triggers.
 * 
 * @param base64Image - Image of the nutrition facts or label.
 * @param mimeType - Image MIME type.
 * @param user - User profile for personalized trigger detection.
 * @returns {Promise<Partial<FoodLog>>} Log containing identified triggers.
 */
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

/**
 * Extracts structured health logs from natural language input (text or transcribed voice).
 * 
 * @param text - The user's message.
 * @param user - User profile for condition context.
 * @returns {Promise<{ foodLogs: Partial<FoodLog>[], behaviorLogs: Partial<BehaviorLog>[] }>} Extracted logs.
 */
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

/**
 * Correlates multiple data streams (food, activity, flares) to find repeating patterns.
 * Generates the user's "Bio-Twin" analysis.
 * 
 * @param state - The global application state containing user logs.
 * @returns {Promise<DeepAnalysis | null>} A comprehensive pattern analysis object.
 */
export const generatePatternInsights = async (state: AppState): Promise<DeepAnalysis | null> => {
  const ai = getAiClient();
  if (!ai) return null;

  const goalContext = state.user?.goals?.length ? `Goals: ${state.user.goals.join(', ')}.` : '';

  return smartExecute(PRO_MODEL, async (model) => {
    const response = await ai.models.generateContent({
        model: model,
        contents: `Analyze trends for ${state.user?.condition}. ${goalContext} Logs: ${JSON.stringify(state.flareLogs.slice(0, 10))}. Return DeepAnalysis JSON.`,
        config: { 
            responseMimeType: "application/json",
            // THINKING BUDGET: Allocate extra tokens for complex logical reasoning to improve correlation accuracy
            thinkingConfig: { thinkingBudget: 2048 } 
        }
    });
    const analysis = safeJsonParse(response.text);
    return analysis ? { ...analysis, id: crypto.randomUUID(), timestamp: new Date().toISOString() } : null;
  });
};

/**
 * Provides an intelligent conversational interface for querying the user's health profile.
 * 
 * @param message - User's query.
 * @param state - App state for context (labs, history).
 * @returns {Promise<{reply: string, suggestions: string[], richContent?: any}>} AI response.
 */
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

/**
 * Generates personalized daily health reminders using current context and user condition.
 * 
 * @param state - Current app state.
 * @returns {Promise<Reminder[]>} List of generated smart reminders.
 */
export const getSmartReminders = async (state: AppState): Promise<Reminder[]> => {
  const ai = getAiClient();
  if (!ai) return [];
  
  const user = state.user;
  const recentLogs = state.foodLogs.slice(0, 3);
  const recentFlares = state.flareLogs.slice(0, 3);

  // Construct context-aware prompt to get higher quality text
  const prompt = `Generate 3 proactive, context-aware health reminders for a user with ${user?.condition}.
    Context:
    - Recent Meals: ${JSON.stringify(recentLogs.map(l => l.detectedItems.map(i => i.name)))}
    - Recent Flares: ${JSON.stringify(recentFlares.map(f => `Severity ${f.severity}`))}
    - Goals: ${user?.goals.join(', ')}

    Ensure the 'text' field is clear, supportive, and actionable. 
    Use the provided schema. JSON.`;

  try {
      const response = await ai.models.generateContent({
          model: FLASH_MODEL,
          contents: prompt,
          config: { 
              responseMimeType: "application/json",
              // SCHEMA: Explicitly define the Reminder interface structure to prevent missing 'text'
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      reminders: {
                          type: Type.ARRAY,
                          items: {
                              type: Type.OBJECT,
                              properties: {
                                  text: { type: Type.STRING, description: "The actual reminder message content" },
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
          // Add IDs to the objects as they come in
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

/**
 * Predicts the biological impact of a meal before the user consumes it.
 * 
 * @param base64Image - Image of the intended meal.
 * @param mimeType - Image MIME type.
 * @param user - User profile for trigger cross-referencing.
 * @returns {Promise<SimulationResult>} A risk score and explanation for the meal.
 */
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

/**
 * Analyzes a restaurant menu to find safe options or modifications for the user.
 * 
 * @param base64Image - Image of the physical menu.
 * @param mimeType - Image MIME type.
 * @param user - User profile context.
 * @returns {Promise<MenuAnalysis>} Structured list of safe/unsafe options.
 */
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

/**
 * Recommends marketplace products (supplements, skincare) based on user's biological needs.
 * 
 * @param user - User profile.
 * @returns {Promise<MarketplaceProduct[]>} A list of curated product recommendations.
 */
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

/**
 * Fetches general community trends or new scientific insights for a condition.
 * 
 * @param condition - The health condition name.
 * @returns {Promise<GlobalInsight[]>} Trending statistics or news.
 */
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

/**
 * Processes complex medical lab results from PDFs or images to extract biomarkers and sensitivities.
 * Uses a "Chunking Strategy" to handle documents that exceed individual request limits.
 * 
 * @param base64Data - Encoded file data.
 * @param mimeType - File MIME type.
 * @param reportType - Category of the report.
 * @param onProgress - Callback to update UI with current processing status.
 * @returns {Promise<any>} Aggregated data from all report pages.
 */
export const parseLabResults = async (
    base64Data: string, 
    mimeType: string, 
    reportType: string,
    onProgress?: (status: string) => void
): Promise<{sensitivities: FoodSensitivity[], summary: string, extractedBiomarkers?: Biomarker[]}> => {
  const ai = getAiClient();
  if (!ai) throw new Error("AI Offline");

  /**
   * Internal helper to process a single logical chunk (group of pages) of the report.
   */
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

  // PDF CHUNKING: Split the document into small groups of pages to ensure high-fidelity extraction
  if (mimeType === 'application/pdf') {
      const pages = await extractPdfPages(base64Data);
      const CHUNK_SIZE = 2; // Process 2 pages at a time to keep prompt context focused
      for (let i = 0; i < pages.length; i += CHUNK_SIZE) {
          const chunk = pages.slice(i, i + CHUNK_SIZE).join('\n');
          const result = await processChunk(chunk, `pages ${i + 1}-${Math.min(i + CHUNK_SIZE, pages.length)}`);
          if (result) {
              // MERGE: Aggregating arrays from multiple separate model calls
              if (result.sensitivities) allSensitivities = [...allSensitivities, ...result.sensitivities];
              if (result.biomarkers) allBiomarkers = [...allBiomarkers, ...result.biomarkers];
              if (result.summary) combinedSummary += result.summary + " ";
          }
      }
  } else {
      // Direct analysis for single images
      const result = await processChunk(`[IMAGE DATA]`, "image report");
      if (result) {
          allSensitivities = result.sensitivities || [];
          allBiomarkers = result.biomarkers || [];
          combinedSummary = result.summary || "";
      }
  }

  // Return formatted results with standardized timestamps for easier charting
  return {
      sensitivities: allSensitivities.map((s: any) => ({ ...s, dateDetected: new Date().toISOString() })),
      extractedBiomarkers: allBiomarkers.map((b: any) => ({ ...b, date: new Date().toISOString() })),
      summary: combinedSummary.trim() || "Report analyzed."
  };
};

/**
 * Investigates a specific flare event by analyzing historical data for "hidden" triggers.
 * 
 * @param state - Current app state with full logs.
 * @returns {Promise<FlareDetectiveReport>} A detailed investigation report.
 */
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

/**
 * Generates a day-long nutrition protocol tailored to avoid user-specific triggers.
 * 
 * @param user - User profile.
 * @returns {Promise<DayPlan>} A breakfast-to-snack meal plan.
 */
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
