<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# FlareFinder — AI-assisted flare tracking & analysis

A single-page React + TypeScript application that helps people with autoimmune conditions log food, symptoms and labs, and uses AI-assisted analysis to surface likely triggers, safety guidance, and personalized insights.

This README provides a high-level overview, technical design, developer setup, and planned features for authentication and server-side persistence.

## Quick start (dev)

Prerequisites: Node 18+ (LTS recommended), npm

1. Install dependencies
```bash
npm install
```
2. Add local env (dev only)
```bash
# create .env with a development key for quick testing (do NOT commit)
echo 'VITE_API_KEY="your_dev_key_here"' > .env
```
3. Start dev server
```bash
npm run dev
```

Open http://localhost:5173 (Vite default) and use the app.

Security note: The repo currently contains client-side code that calls Google GenAI — do NOT use production API keys directly in `VITE_API_KEY` for a public site. Move keys to a server-side proxy before production.

## High-level purpose

- Log food, flares and other behaviors (sleep, water, mood).
- Upload lab reports (PDFs) and extract lab-based sensitivities.
- Use AI (Google GenAI / Gemini) to analyze food images, grocery packaging, voice commands, and lab PDF contents.
- Surface an Inflammation Index, Neural Forecast (DeepAnalysis) and Flare Detective reports to help users identify likely triggers.

## Core features & user workflows

1. Food logging
   - User can upload an image of a meal or enter text/voice. The app calls the image/voice analysis pipeline to identify items and ingredients. Results are annotated with nutrition and inferred safety levels.
   - The UI shows a Safety Breakdown per item and a top-level verdict (SAFE / CAUTION / AVOID) before committing the log.
   - When saved, logs are persisted to localStorage and influence downstream analyses (Inflammation Index and Neural Suspect Gallery).

2. Lab reports (LabManager)
   - Users upload lab PDFs. The app attempts to extract text using `pdfjs-dist` and then calls the AI to parse structured lab sensitivities and biomarkers.
   - Extracted `FoodSensitivity` entries are stored on the user profile and used to annotate food logs (auto-flagging triggers).

3. Neural Suspect Gallery & Flare Detective
   - Dashboard aggregates recent logs and flares to compute correlations between categories (or items) and subsequent flares within a 48-hour window.
   - The gallery shows top suspects with a probability % and exposure (volume). `runFlareDetective` triggers an AI root-cause analysis which returns an AI-authored report of suspects and reasoning.

4. Marketplace (Bio-Shop)
   - A component exists to surface marketplace recommendations from the AI. The dashboard previously linked to the Bio-Shop; the link/button can be conditionally shown or hidden.

## Technical design / architecture

- Frontend: React + TypeScript, built with Vite.
  - `index.tsx` / `App.tsx` mount the app and render top-level routes/components.
  - Components in `/components`: `Dashboard`, `FoodLogger`, `LabManager`, `AICoach`, `Marketplace`, etc.

- State & persistence
  - `services/db.ts` implements a simple localStorage-backed `AppState` with helpers to add/update logs, lab reports, and to save the AI analysis. No remote DB is currently configured.

- AI integration
  - `services/geminiService.ts` wraps Google GenAI calls for image analysis, grocery scan, voice processing, PDF lab parsing, pattern insights, and the flare detective. It expects an API key available at runtime (see environment handling notes below).

- PDF handling
  - `pdfjs-dist` is used in-browser to extract raw text from uploaded PDFs, then AI parses and structures the result. The worker script must match the installed `pdfjs-dist` version — the app prefers the package worker or a matched CDN worker.

- Types & domain model
  - `types.ts` defines `FoodLog`, `FoodItem`, `FoodSensitivity`, `LabReport`, `DeepAnalysis`, `FlareDetectiveReport` and other models used across the app.

- UX / visuals
  - Tailwind-like utility classes are used in components for layout and styling (project includes component-level classes). Icons use `lucide-react`. Charts use `recharts`.

## Key implementation details (where to look)

- Food logging and pre-save sensitivity checks: `components/FoodLogger.tsx`
  - `annotateWithSensitivities()` cross-references each detected item/ingredient with user `foodSensitivities` and adds `sensitivityAlert` and `ingredientAnalysis` entries used by the UI.

- PDF parsing and AI parsing: `services/geminiService.ts`
  - `extractPdfPages()` (pdfjs) and `parseLabResults()` (AI) handle lab PDF uploads.

- Neural suspect calculation: `components/Dashboard.tsx` → `calculateTriggerCorrelations()`
  - Uses a 48-hour WINDOW to associate exposures with subsequent flares and computes probability and volume per category.

- AI orchestration: `services/geminiService.ts` functions
  - `analyzeFoodImage`, `scanGroceryProduct`, `processVoiceCommand`, `generatePatternInsights`, `runFlareDetective`.

## Full tech stack

- Frameworks & libraries
  - React 19, TypeScript, Vite (dev/build), @vitejs/plugin-react
  - UI/Icons: lucide-react
  - Charts: recharts
  - PDF extraction: pdfjs-dist
  - AI: @google/genai (Gemini)

- Tooling
  - Node.js, npm, Vite dev server

## Environment variables & running notes

- Client dev env (for quick local testing)
  - `VITE_API_KEY` — if you must call AI from the client for testing (not recommended for production).
  - The code also looks for `process.env.API_KEY` for server-side usage.

- Production / Vercel notes
  - For production keep secrets server-side. Add `API_KEY` to Vercel Project Environment Variables and implement a serverless API route that proxies AI calls so the client never receives a secret.

## Planned features (short roadmap)

1. User Authentication
   - Implement secure user accounts (email/password or OAuth). Migrate `db` from localStorage to server-backed per-user storage.
   - Protect user-specific data and let users access their data across devices.

2. Database integration (server-side persistence)
   - Add a server or serverless functions (e.g., Vercel functions or Node/Express) with a database (Postgres, Supabase, or Firebase) to persist AppState, food logs, lab reports, biomarkers, and AI reports.
   - Benefits: cross-device sync, stronger analytics, and secure storage of lab reports.

Planned implementation notes
  - The server will expose API endpoints for: auth, food logs, lab upload (signed upload or direct), AI proxy endpoints, and reporting.
  - Serverless AI proxy will read `API_KEY` from server env and call Gemini; the frontend will call the proxy endpoint.

## Customization & tuning

- Neural Suspect Gallery tuning
  - Time window (currently 48 hours), minimum volume to show, and grouping key (category vs. item vs. ingredient) are easy to adjust in `components/Dashboard.tsx`.

- Inflammation Index
  - Currently maps daily max severity (0–5) to a 0–100 score. You can change mapping logic in `prepareChartData()`.

## How to contribute

- File structure to start in:
  - `/components` — UI components
  - `/services` — business logic, db and AI integrations
  - `/types.ts` — domain types

- Recommended contributor workflow
  - Create a feature branch, run `npm install` and `npm run dev`, make changes, add tests (if relevant), open a PR with a short description.

## Contact / next steps

If you want, I can implement the first two planned features as a minimal serverless example:
- A Vercel function that extracts text from PDF server-side (using `pdf-parse`) and proxies AI calls using `process.env.API_KEY`.
- A migration path for moving `db` to a Postgres or Supabase-backed implementation.

---
Generated by an automated code assistant reviewing this repository — edit as needed for tone and org branding.
<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1yDWbnD_irSZDbeZKY7ira25NVwqc6Eat

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
