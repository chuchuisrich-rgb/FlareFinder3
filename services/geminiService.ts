
import { GoogleGenAI, Type } from "@google/genai";
import { AppState, FoodLog, BehaviorLog, Reminder, UserProfile, DeepAnalysis, MarketplaceProduct, SimulationResult, GlobalInsight, FoodSensitivity, FlareDetectiveReport, LabReport, Recipe, DayPlan, Biomarker, MenuAnalysis } from "../types";
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker with a specific version to ensure stability in browser environments
if (typeof window !== 'undefined') {
    // We use a fixed version string to match the imported library if possible, or a compatible stable version
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
}

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API Key not found in environment");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

// Helper to safely parse JSON
const safeJsonParse = (text: string | undefined | null) => {
    if (!text) return null;
    try {
        let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        if (!cleanText) throw new Error("Empty response from AI");
        return JSON.parse(cleanText);
    } catch (e) {
        console.warn("JSON Parse Warning, attempting repair:", e);
        const cleanText = text?.replace(/```json/g, '').replace(/```/g, '').trim() || "";
        const lastObjectEnd = cleanText.lastIndexOf('}');
        if (lastObjectEnd > -1) {
            const repairedText = cleanText.substring(0, lastObjectEnd + 1) + ']}';
            try {
                 if (repairedText.includes('sensitivities": [')) {
                      return JSON.parse(repairedText + '}');
                 }
                 return JSON.parse(repairedText);
            } catch (retryErr) {
                 if (cleanText.includes('[')) {
                     try {
                         const start = cleanText.indexOf('[');
                         const end = cleanText.lastIndexOf('}');
                         if (start > -1 && end > -1) {
                            const arrStr = cleanText.substring(start, end + 1) + ']';
                            const arr = JSON.parse(arrStr);
                            return { sensitivities: arr, summary: "Report analysis truncated but partial data recovered." };
                         }
                     } catch (finalErr) {}
                 }
            }
        }
        throw new Error("AI response was incomplete or invalid.");
    }
};

const extractPdfPages = async (base64Data: string): Promise<string[]> => {
    try {
        // Convert Base64 to Uint8Array
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Load the document
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;
        
        const pages: string[] = [];
        const maxPages = pdf.numPages; 
        
        // Extract text from each page
        for (let i = 1; i <= maxPages; i++) {
            try {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                // @ts-ignore
                const pageText = textContent.items.map((item) => item.str).join(' ');
                // Add page marker for context
                pages.push(`--- Page ${i} ---\n${pageText}\n`);
            } catch (pageErr) {
                console.warn(`Failed to extract text from page ${i}`, pageErr);
                pages.push(`--- Page ${i} ---\n[Text Extraction Failed]\n`);
            }
        }
        return pages;
    } catch (e) {
        console.error("PDF Text Extraction Critical Failure", e);
        // Throwing error allows the UI to catch it and suggest manual input
        throw new Error("Could not parse PDF. File might be encrypted or corrupted.");
    }
};

export const analyzeFoodImage = async (base64Image: string, mimeType: string = "image/jpeg", user?: UserProfile | null): Promise<Partial<FoodLog>> => {
  const ai = getAiClient();
  if (!ai) throw new Error("AI Client not initialized");

  const sensitivityContext = user?.foodSensitivities 
    ? `User Lab Sensitivities (CHECK CAREFULLY): ${JSON.stringify(user.foodSensitivities)}`
    : "No lab results available.";

  const manualTriggers = user?.knownTriggers?.join(', ') || "None";

  const userContext = user 
    ? `User Profile: ${user.name} has ${user.condition} (${user.conditionSeverity}).
       MANUAL KNOWN TRIGGERS: ${manualTriggers}.
       ${sensitivityContext}` 
    : "User has an autoimmune condition.";

  const prompt = `Analyze this food image acting as a specialized dietician for autoimmune conditions (HS/PCOS).
  
  Context: ${userContext}
  
  1. Identify the food name and ingredients.
  2. **Categorize** the food item (e.g. 'Dairy', 'Nightshade', 'Gluten', 'Processed', 'Meat', 'Vegetable', 'Fruit', 'Grain', 'Legume', 'Sugar', 'Other').
  3. **DETECT COOKING METHOD**: Analyze visual cues like char marks (Grilled), golden brown crust (Fried), moist/pale (Steamed/Boiled), raw freshness. BE SPECIFIC (e.g., 'Deep Fried', 'Raw', 'Steamed'). If uncertain, infer from dish type.
  4. **SENSITIVITY CHECK (CRITICAL)**:
     - Cross-reference detected ingredients with **User Lab Sensitivities**.
     - Cross-reference with **MANUAL KNOWN TRIGGERS** (treat as HIGH PRIORITY).
     - **HIDDEN INGREDIENTS**: Look for hidden sources (e.g. Nightshades in 'Spices', Gluten in 'Soy Sauce', Dairy in 'Whey' or 'Casein', Corn in 'Dextrose').
     - If ingredient matches a sensitivity or trigger (even hidden), create a sensitivityAlert.
       - Level: High (for manual triggers or high lab results), Medium, Low.
  5. Assign tags (inflammatory, etc).
  6. Provide reasoning.
  7. Suggest alternatives.
  8. Estimate nutrition (Calories, Protein, Carbs, Fat) as integers based on visible portion size. Provide realistic macronutrient breakdown.
  9. **INGREDIENT ANALYSIS**: Analyze EVERY ingredient. Mark High/Medium/Safe based on inflammation.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        { inlineData: { mimeType: mimeType, data: base64Image } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 4096,
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
                confidence: { type: Type.NUMBER },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                cookingMethod: { type: Type.STRING },
                reasoning: { type: Type.STRING },
                alternatives: { type: Type.ARRAY, items: { type: Type.STRING } },
                nutrition: {
                  type: Type.OBJECT,
                  properties: {
                    calories: { type: Type.INTEGER },
                    protein: { type: Type.INTEGER },
                    carbs: { type: Type.INTEGER },
                    fat: { type: Type.INTEGER }
                  }
                },
                sensitivityAlert: {
                  type: Type.OBJECT,
                  properties: {
                    level: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
                    triggerIngredient: { type: Type.STRING },
                    message: { type: Type.STRING }
                  },
                  description: "Only present if a specific sensitivity from profile is triggered."
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
              }
            }
          },
          manualNotes: { type: Type.STRING }
        }
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  return safeJsonParse(text);
};

export const scanGroceryProduct = async (base64Image: string, mimeType: string = "image/jpeg", user?: UserProfile | null): Promise<Partial<FoodLog>> => {
  const ai = getAiClient();
  if (!ai) throw new Error("AI Client not initialized");

  const sensitivityContext = user?.foodSensitivities 
    ? `User Lab Sensitivities (CHECK CAREFULLY): ${JSON.stringify(user.foodSensitivities)}`
    : "No lab results available.";

  const manualTriggers = user?.knownTriggers?.join(', ') || "None";

  const userContext = user 
    ? `User Profile: ${user.name} has ${user.condition} (${user.conditionSeverity}).
       MANUAL KNOWN TRIGGERS: ${manualTriggers}.
       ${sensitivityContext}` 
    : "User has an autoimmune condition.";

  const prompt = `Analyze this grocery product image (barcode, packaging, label).
  
  Context: ${userContext}
  
  1. Identify the product name and brand.
  2. **Categorize** the product (e.g. 'Dairy', 'Nightshade', 'Gluten', 'Processed', 'Snack', 'Beverage').
  3. Extract ingredients list.
  4. **SENSITIVITY CHECK (CRITICAL)**:
     - Cross-reference detected ingredients with **User Lab Sensitivities**.
     - Cross-reference with **MANUAL KNOWN TRIGGERS** (treat as HIGH PRIORITY).
     - **HIDDEN INGREDIENTS**: Look for hidden sources (e.g. Nightshades in 'Spices', Gluten in 'Soy Sauce', Dairy in 'Whey' or 'Casein', Corn in 'Dextrose').
     - If ingredient matches a sensitivity or trigger (even hidden), create a sensitivityAlert.
       - Level: High (for manual triggers or high lab results), Medium, Low.
  5. Assign tags (processed, inflammatory, etc).
  6. Provide reasoning.
  7. Suggest alternatives.
  8. Estimate nutrition (Calories, Protein, Carbs, Fat) as integers per serving.
  9. If cooking method is irrelevant (packaged food), use 'Processed' or 'Raw'.
  10. **INGREDIENT ANALYSIS**: Analyze EVERY ingredient. Mark High/Medium/Safe based on inflammation.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        { inlineData: { mimeType: mimeType, data: base64Image } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 4096,
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
                confidence: { type: Type.NUMBER },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                cookingMethod: { type: Type.STRING },
                reasoning: { type: Type.STRING },
                alternatives: { type: Type.ARRAY, items: { type: Type.STRING } },
                nutrition: {
                  type: Type.OBJECT,
                  properties: {
                    calories: { type: Type.INTEGER },
                    protein: { type: Type.INTEGER },
                    carbs: { type: Type.INTEGER },
                    fat: { type: Type.INTEGER }
                  }
                },
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
              }
            }
          },
          manualNotes: { type: Type.STRING }
        }
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  const result = safeJsonParse(text);
  return { ...result, isGroceryScan: true };
};

export const processVoiceCommand = async (text: string, user?: UserProfile | null): Promise<{ foodLogs: Partial<FoodLog>[], behaviorLogs: Partial<BehaviorLog>[] }> => {
  const ai = getAiClient();
  if (!ai) throw new Error("AI Client not initialized");

  const manualTriggers = user?.knownTriggers?.join(', ') || "None";
  const userContext = user 
    ? `User has ${user.condition} (${user.conditionSeverity}). Manual Triggers: ${manualTriggers}.` 
    : "User has an autoimmune condition.";

  const prompt = `Extract health logs from this voice command: "${text}".
  Context: ${userContext}
  
  For FOOD: Extract name, ingredients, and category (e.g. Dairy, Nightshade, Gluten, Processed, Meat, Veg). 
  - **DETECT COOKING METHOD**: Infer from description (e.g. "fried chicken" -> Fried, "sushi" -> Raw).
  - **SENSITIVITY CHECK**: Check against User Manual Triggers and common autoimmune triggers. Look for hidden ingredients.
  - Assign tags (inflammatory/neutral).
  - Provide reasoning.
  - Suggest alternatives if unhealthy.
  - Estimate nutrition stats (Calories, Protein, Carbs, Fat) as integers based on described portion.
  - If the user lists multiple items (e.g. "I had eggs and toast"), create multiple detectedItems.
  
  For BEHAVIORS: extract type (sleep, water, workout, stress, mood, energy, anxiety, symptom_pcos, symptom_hs), value, unit, and details.
  
  Current time: ${new Date().toISOString()}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 4096,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          foodLogs: {
            type: Type.ARRAY,
            items: {
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
                      confidence: { type: Type.NUMBER },
                      tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                      cookingMethod: { type: Type.STRING },
                      reasoning: { type: Type.STRING },
                      alternatives: { type: Type.ARRAY, items: { type: Type.STRING } },
                      nutrition: {
                        type: Type.OBJECT,
                        properties: {
                          calories: { type: Type.INTEGER },
                          protein: { type: Type.INTEGER },
                          carbs: { type: Type.INTEGER },
                          fat: { type: Type.INTEGER }
                        }
                      },
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
                },
                manualNotes: { type: Type.STRING }
              }
            }
          },
          behaviorLogs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                value: { type: Type.STRING },
                unit: { type: Type.STRING },
                details: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });

  const resText = response.text;
  if (!resText) return { foodLogs: [], behaviorLogs: [] };
  return safeJsonParse(resText);
};

export const generatePatternInsights = async (state: AppState): Promise<DeepAnalysis | null> => {
  const ai = getAiClient();
  if (!ai) return null;

  const user = state.user;
  const userContext = user 
    ? `${user.name} has ${user.condition} (${user.conditionSeverity}). Goals: ${user.goals.join(', ')}. Bio: ${user.bio}` 
    : "User has an autoimmune condition.";

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const cutoff = fourteenDaysAgo.toISOString();

  const dataContext = JSON.stringify({
    flares: state.flareLogs.filter(l => l.timestamp >= cutoff),
    foods: state.foodLogs.filter(l => l.timestamp >= cutoff),
    behaviors: state.behaviorLogs.filter(l => l.timestamp >= cutoff),
    biomarkers: state.biomarkers?.slice(0, 20) || [] 
  });

  const prompt = `Act as an AI Bio-Rhythm & Lifecycle Architect for Autoimmune Conditions (HS, PCOS). 
  You are analyzing data for: ${userContext}.
  
  DO NOT GIVE MEDICAL ADVICE. Focus on "Comfort Management", "Lifecycle Tracking", and "Bio-Rhythms".
  
  Task: Analyze the last 14 days of data to build a daily management plan.
  
  1. **Bio-Weather Forecast**:
     - Determine the user's internal weather based on Cycle + Inflammation + Stress.
     - Status: Sunny (Remission/Follicular), Cloudy (Prodrome/Luteal), Stormy (Flare/Menstrual).
     - Headline: Empathetic status update.
     
  2. **Daily Protocol (End-to-End Management)**:
     - Based on the Bio-Weather, create a protocol for TODAY.
     - Nutrition Focus: What to eat (e.g. "Cooling foods", "Iron-rich").
     - Movement: Suitable intensity (e.g. "Rest day", "HIIT").
     - Self-Care: Comfort measures for symptoms (e.g. "Warm compress", "Loose clothing", "Epsom salt bath").
     - Mindset: Affirmation or mental focus.
     
  3. **AFIR Score (0-100)**: 
     - 0 = Perfect health. 100 = Severe flare. Trend analysis.
  
  4. **Cycle-Synced Analysis**:
     - Determine current phase. Correlate with flares.
     
  5. **"Stacking" Trigger Detection**:
     - Find multi-variable triggers (e.g. "Stress + Dairy").
  
  6. **Forecast**: 48-hour flare risk prediction.
  
  7. **Daily Narrative (NEW)**:
     - Write a friendly "Daily Briefing" greeting (3-4 sentences) that synthesizes the weather, cycle, and advice into a natural paragraph. Speak like a caring friend.
  
  Data: ${dataContext}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          bioWeather: {
              type: Type.OBJECT,
              properties: {
                  status: { type: Type.STRING, enum: ['Sunny', 'Cloudy', 'Stormy'] },
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
          },
          afirScore: {
            type: Type.OBJECT,
            properties: {
              value: { type: Type.NUMBER },
              trend: { type: Type.STRING, enum: ['improving', 'worsening', 'stable'] },
              influencingFactors: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          },
          forecast: {
            type: Type.OBJECT,
            properties: {
              riskLevel: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
              explanation: { type: Type.STRING }
            }
          },
          stackingTriggers: {
             type: Type.ARRAY,
             items: {
                 type: Type.OBJECT,
                 properties: {
                     triggerA: { type: Type.STRING },
                     triggerB: { type: Type.STRING },
                     combinedEffect: { type: Type.STRING }
                 }
             }
          },
          cycleAnalysis: {
             type: Type.OBJECT,
             properties: {
                 currentPhase: { type: Type.STRING, enum: ['Follicular', 'Ovulation', 'Luteal', 'Menstrual', 'Unknown'] },
                 dayOfCycle: { type: Type.NUMBER },
                 hormonalContext: { type: Type.STRING },
                 flareRiskDueToHormones: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
                 specificAdvice: { type: Type.STRING }
             }
          },
          topTriggers: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                probability: { type: Type.NUMBER },
                reason: { type: Type.STRING }
              }
            }
          },
          protectiveBehaviors: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                impact: { type: Type.STRING }
              }
            }
          },
          dailySummary: { type: Type.STRING },
          clinicalSummary: { type: Type.STRING },
          dailyChecklist: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                task: { type: Type.STRING },
                completed: { type: Type.BOOLEAN },
                category: { type: Type.STRING, enum: ['diet', 'lifestyle', 'mindset'] }
              }
            }
          },
          recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
          experiments: { type: Type.ARRAY, items: { type: Type.STRING } },
          dailyNarrative: { type: Type.STRING }
        }
      }
    }
  });

  const text = response.text;
  if (!text) return null;
  const analysis = safeJsonParse(text);
  
  return {
    ...analysis,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString()
  };
};

export const chatWithCoach = async (message: string, state: AppState): Promise<{reply: string, suggestions: string[], richContent?: any}> => {
  const ai = getAiClient();
  if (!ai) return { reply: "I'm offline.", suggestions: [] };

  const user = state.user;
  const analysis = state.currentAnalysis;

  // Rich Context: Feed the AI everything about the user state
  const context = `
    User: ${user?.name}, Condition: ${user?.condition} (${user?.conditionSeverity}).
    Goals: ${user?.goals.join(', ')}.
    Known Triggers: ${user?.knownTriggers.join(', ')}.
    Bio-Weather: ${analysis?.bioWeather?.status} (${analysis?.bioWeather?.headline}).
    Cycle Phase: ${analysis?.cycleAnalysis?.currentPhase}.
    Recent Flares: ${state.flareLogs.slice(0, 3).map(f => `${f.severity}/5`).join(', ')}
  `;

  const prompt = `You are an Advanced Health AI Operating System for ${user?.name}.
  
  Context: ${context}
  User Message: "${message}"
  
  TASK:
  1. Reply conversationally and empathetically.
  2. Suggest 3 follow-up questions.
  3. **RICH CONTENT**: If the user asks for something specific (e.g. "Find me a supplement", "What should I eat?", "Log my pain"), GENERATE RICH CONTENT.
     - If asking for product/shopping: return 'product' type.
     - If asking for recipe/food: return 'recipe' type.
     - If asking to log/action: return 'action' type.
     
  Return JSON.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 2048,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
            reply: { type: Type.STRING },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            richContent: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, enum: ['product', 'recipe', 'action', 'insight'] },
                    data: { 
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            subtitle: { type: Type.STRING },
                            link: { type: Type.STRING }, // e.g. "shop" or "log"
                            actionLabel: { type: Type.STRING },
                            matchScore: { type: Type.NUMBER }
                        }
                    }
                },
                nullable: true
            }
        }
      }
    }
  });

  const text = response.text;
  const result = safeJsonParse(text);
  return result || { reply: "I'm thinking...", suggestions: [] };
};

export const getSmartReminders = async (state: AppState): Promise<Reminder[]> => {
  const ai = getAiClient();
  if (!ai) return [];

  const user = state.user;
  const analysis = state.currentAnalysis;

  const context = JSON.stringify({
    bioWeather: analysis?.bioWeather,
    cyclePhase: analysis?.cycleAnalysis?.currentPhase, 
    recentBehaviors: state.behaviorLogs.slice(0, 5),
    userCondition: user?.condition,
    goals: user?.goals
  });

  const prompt = `Generate 3 UNIQUE, FRESH, and TO-THE-POINT health reminders for ${user?.name || "Friend"}.
  
  Current Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}
  Deep Context: ${context}
  
  INSTRUCTIONS:
  1. **New Everyday**: Do not repeat generic "Drink water" advice. Be specific to today's Bio-Weather.
  2. **Bio-Synced**: 
     - If 'Stormy': Suggestions should be about rest, gentle care, cancelling plans.
     - If 'Sunny': Suggestions should be about activity, socializing, complex tasks.
  3. **Brevity**: Maximum 12 words per reminder. "Punchy and Direct."
  4. **Variety**: 
     - One Diet tip (based on recent logs)
     - One Lifestyle/Movement tip
     - One Mindset/Preparation tip
  
  Return exactly 3 reminders.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 1024,
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['weather', 'cycle', 'habit', 'general'] },
            text: { type: Type.STRING },
            priority: { type: Type.STRING, enum: ['low', 'high'] },
            timestamp: { type: Type.STRING }
          }
        }
      }
    }
  });

  const text = response.text;
  if (!text) return [];
  const reminders = safeJsonParse(text);
  return reminders.map((r: any) => ({ ...r, id: r.id || crypto.randomUUID(), timestamp: new Date().toISOString() }));
};

// ... (Rest of existing functions like simulateMealImpact, analyzeRestaurantMenu, etc. remain unchanged)
export const simulateMealImpact = async (base64Image: string, mimeType: string = "image/jpeg", user: UserProfile): Promise<SimulationResult> => {
  const ai = getAiClient();
  if (!ai) throw new Error("AI not initialized");

  const prompt = `Run a BIOLOGICAL SIMULATION for this user eating this food.
  User: ${user.name}, ${user.condition}, ${user.conditionSeverity}. Triggers: ${user.knownTriggers.join(', ')}.
  Sensitivities: ${JSON.stringify(user.foodSensitivities)}
  
  Predict:
  1. Risk Score (0-100).
  2. Biological mechanism (e.g. "Solanine content may trigger inflammation pathways").
  3. Verdict (Safe, Caution, Avoid).
  4. Better Option if risky.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
         { inlineData: { mimeType: mimeType, data: base64Image } },
         { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 2048,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          riskScore: { type: Type.NUMBER },
          prediction: { type: Type.STRING },
          biologicalMechanisms: { type: Type.ARRAY, items: { type: Type.STRING } },
          verdict: { type: Type.STRING, enum: ['Safe', 'Caution', 'Avoid'] },
          betterOption: { type: Type.STRING }
        }
      }
    }
  });

  const text = response.text;
  return safeJsonParse(text!);
};

export const analyzeRestaurantMenu = async (base64Image: string, mimeType: string = "image/jpeg", user: UserProfile): Promise<MenuAnalysis> => {
    const ai = getAiClient();
    if (!ai) throw new Error("AI not initialized");

    const manualTriggers = user.knownTriggers.join(', ');
    const sensitivityList = user.foodSensitivities
        ?.filter(s => s.level !== 'low')
        .map(s => `${s.food} (${s.level})`).join(', ');

    const prompt = `You are a Dining Concierge for someone with ${user.condition}.
    
    Task: Analyze this menu image.
    User Profile: 
    - Condition: ${user.condition}
    - Triggers to AVOID: ${manualTriggers}
    - Lab Sensitivities: ${sensitivityList}
    
    1. Scan the menu items.
    2. Categorize them into 'Safe', 'Caution', and 'Avoid'.
    3. For 'Caution' or 'Avoid', suggest a MODIFICATION (e.g. "Ask for no cheese").
    4. Generate a polite 'Chef Card' text the user can show the waiter (e.g. "I have a sensitivity to X, please ensure...").
    
    Return clean JSON.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                { inlineData: { mimeType: mimeType, data: base64Image } },
                { text: prompt }
            ]
        },
        config: {
            responseMimeType: "application/json",
            maxOutputTokens: 4096,
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    safeOptions: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                dishName: { type: Type.STRING },
                                description: { type: Type.STRING },
                                safetyLevel: { type: Type.STRING, enum: ['safe'] },
                                modification: { type: Type.STRING, nullable: true },
                                reason: { type: Type.STRING }
                            }
                        }
                    },
                    cautionOptions: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                dishName: { type: Type.STRING },
                                description: { type: Type.STRING },
                                safetyLevel: { type: Type.STRING, enum: ['caution'] },
                                modification: { type: Type.STRING },
                                reason: { type: Type.STRING }
                            }
                        }
                    },
                    avoidOptions: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                dishName: { type: Type.STRING },
                                description: { type: Type.STRING },
                                safetyLevel: { type: Type.STRING, enum: ['avoid'] },
                                modification: { type: Type.STRING, nullable: true },
                                reason: { type: Type.STRING }
                            }
                        }
                    },
                    chefCardText: { type: Type.STRING }
                }
            }
        }
    });

    return safeJsonParse(response.text!);
};

export const getMarketplaceRecommendations = async (user: UserProfile): Promise<MarketplaceProduct[]> => {
  const ai = getAiClient();
  if (!ai) return [];

  const prompt = `Act as a precision medicine shopping assistant for someone with ${user.condition}.
  Suggest 4 products (Supplements, Specialized Foods, or Skincare).
  They must be specific and safe for this user's profile (${user.knownTriggers.join(', ')}).
  
  Fields: Name, Brand, Price (estimate), MatchScore (0-100), MatchReason.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 2048,
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            brand: { type: Type.STRING },
            category: { type: Type.STRING, enum: ['supplement', 'food', 'skincare', 'device'] },
            price: { type: Type.STRING },
            matchScore: { type: Type.NUMBER },
            matchReason: { type: Type.STRING }
          }
        }
      }
    }
  });

  const text = response.text;
  const products = safeJsonParse(text!);
  return products.map((p: any) => ({ ...p, id: crypto.randomUUID() }));
};

export const getGlobalInsights = async (condition: string): Promise<GlobalInsight[]> => {
  const ai = getAiClient();
  if (!ai) return [];
  
  const prompt = `Generate 3 trending insights for the global community of ${condition} patients. 
  What are people avoiding? What is working? Use fake but realistic stats.`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 1024,
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
             topic: { type: Type.STRING },
             stat: { type: Type.STRING },
             trend: { type: Type.STRING, enum: ['up', 'down', 'neutral'] }
          }
        }
      }
    }
  });

  return safeJsonParse(response.text!);
};

export const parseLabResults = async (
    base64Data: string, 
    mimeType: string, 
    reportType: 'food_sensitivity' | 'microbiome' | 'hormonal' | 'bloodwork',
    onProgress?: (status: string) => void
): Promise<{sensitivities: FoodSensitivity[], summary: string, extractedBiomarkers?: Biomarker[]}> => {
  const ai = getAiClient();
  if (!ai) throw new Error("AI not initialized");

  const processChunk = async (chunkText: string, isFirstChunk: boolean) => {
      const prompt = `You are a specialized medical AI parser.
      Analyze this PARTIAL ${reportType} report text.
      
      TASK: Extract data into valid JSON.
      
      CRITICAL INSTRUCTIONS:
      1. Extract EVERY single food sensitivity item.
      2. **NEW**: Extract any NUMERICAL BIOMARKERS (e.g. "CRP: 5 mg/L", "Testosterone: 45 ng/dL", "Vitamin D: 30").
      3. Return ONLY valid JSON.
      
      Extraction Fields:
      - sensitivities: { food, level, category }
      - biomarkers: { name, value (number), unit, status (normal/high/low) }
      
      ${isFirstChunk ? "SUMMARY: Provide a brief summary (under 50 words) of the key findings from this report." : "SUMMARY: Leave empty string."}
      
      DATA CHUNK:
      ${chunkText}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
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
  let finalSummary = "";

  if (mimeType === 'application/pdf') {
      const pages = await extractPdfPages(base64Data);
      
      if (pages.length > 0) {
          const chunkSize = 10; 
          
          for (let i = 0; i < pages.length; i += chunkSize) {
              const currentChunkSize = Math.min(chunkSize, pages.length - i);
              const endPage = i + currentChunkSize;
              
              if (onProgress) {
                  onProgress(`Analyzing pages ${i + 1}-${endPage} of ${pages.length}...`);
              }
              
              const chunk = pages.slice(i, endPage).join('\n');
              
              try {
                  const result = await processChunk(chunk, i === 0);
                  if (result?.sensitivities) {
                      allSensitivities = [...allSensitivities, ...result.sensitivities];
                  }
                  if (result?.biomarkers) {
                      allBiomarkers = [...allBiomarkers, ...result.biomarkers];
                  }
                  if (i === 0 && result?.summary) {
                      finalSummary = result.summary;
                  }
              } catch (chunkErr) {
                  console.error(`Error processing chunk ${i}`, chunkErr);
              }
          }
          
          if (allSensitivities.length === 0 && allBiomarkers.length === 0) {
              throw new Error("No data extracted from PDF. The file might be scanned images without text layer.");
          }
          
          return { 
              sensitivities: allSensitivities.map(s => ({...s, source: 'lab_result', dateDetected: new Date().toISOString()})), 
              extractedBiomarkers: allBiomarkers.map(b => ({...b, date: new Date().toISOString()})),
              summary: finalSummary || "Report processed successfully." 
          };
      }
  }

  const visionPrompt = `You are a specialized medical AI parser. Analyze this ${reportType} report image. Extract ALL items visible. Do not summarize.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
        parts: [
            { inlineData: { mimeType: mimeType, data: base64Data } },
            { text: visionPrompt }
        ]
    },
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
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

  const raw = safeJsonParse(response.text);
  if (!raw) throw new Error("Empty response");
  
  return { 
      sensitivities: (raw.sensitivities || []).map((item: any) => ({
        ...item,
        source: 'lab_result',
        dateDetected: new Date().toISOString()
      })), 
      extractedBiomarkers: (raw.biomarkers || []).map((item: any) => ({
          ...item,
          date: new Date().toISOString()
      })),
      summary: raw.summary || "Image report analyzed." 
  };
};

export const runFlareDetective = async (state: AppState): Promise<FlareDetectiveReport> => {
    const ai = getAiClient();
    if (!ai) throw new Error("AI not initialized");

    const user = state.user;
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 72); 
    const recentLogs = JSON.stringify({
        foods: state.foodLogs.filter(l => new Date(l.timestamp) >= cutoff),
        behaviors: state.behaviorLogs.filter(l => new Date(l.timestamp) >= cutoff),
        user: { condition: user?.condition, triggers: user?.knownTriggers }
    });

    const prompt = `Act as a Medical Detective for ${user?.name}.
    A flare spike was reported. Analyze the LAST 72 HOURS of logs.
    Find the "Smoking Gun". Generate a report with 3 top suspects and a conclusion.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            maxOutputTokens: 2048,
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    spikeDetected: { type: Type.BOOLEAN },
                    conclusion: { type: Type.STRING },
                    suspects: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING },
                                reason: { type: Type.STRING },
                                confidence: { type: Type.NUMBER }
                            }
                        }
                    }
                }
            }
        }
    });

    const text = response.text;
    const report = safeJsonParse(text!);
    return {
        ...report,
        id: crypto.randomUUID(),
        dateGenerated: new Date().toISOString()
    };
};

export const generateSafeMealPlan = async (user: UserProfile): Promise<DayPlan> => {
    const ai = getAiClient();
    if (!ai) throw new Error("AI not initialized");

    const prompt = `Generate a safe 1-day meal plan for ${user.name}.
    AVOID: ${user.knownTriggers.join(', ')}.
    Create Breakfast, Lunch, Dinner, Snack.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            maxOutputTokens: 4096,
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    breakfast: {
                        type: Type.OBJECT,
                        properties: {
                             id: { type: Type.STRING },
                             title: { type: Type.STRING },
                             description: { type: Type.STRING },
                             ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                             prepTime: { type: Type.STRING },
                             tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                             matchScore: { type: Type.NUMBER }
                        }
                    },
                    lunch: {
                        type: Type.OBJECT,
                        properties: {
                             id: { type: Type.STRING },
                             title: { type: Type.STRING },
                             description: { type: Type.STRING },
                             ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                             prepTime: { type: Type.STRING },
                             tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                             matchScore: { type: Type.NUMBER }
                        }
                    },
                    dinner: {
                        type: Type.OBJECT,
                        properties: {
                             id: { type: Type.STRING },
                             title: { type: Type.STRING },
                             description: { type: Type.STRING },
                             ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                             prepTime: { type: Type.STRING },
                             tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                             matchScore: { type: Type.NUMBER }
                        }
                    },
                    snack: {
                        type: Type.OBJECT,
                        properties: {
                             id: { type: Type.STRING },
                             title: { type: Type.STRING },
                             description: { type: Type.STRING },
                             ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                             prepTime: { type: Type.STRING },
                             tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                             matchScore: { type: Type.NUMBER }
                        }
                    }
                }
            }
        }
    });

    const result = safeJsonParse(response.text!);
    return result;
};
