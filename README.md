# RoadRepair AI

AI-powered road inspection and repair prioritization. Built for SlayHacks.

**Detect damage. Track changes. Repair smarter.**

RoadRepair AI turns ordinary dashcam footage into a map of road damage (potholes, longitudinal,
transverse and alligator cracks), merges duplicate sightings, flags damage that is getting worse
between trips, and ranks repairs so crews know what to fix first.

> Hackathon project in progress. The web app, sign-in, database and AI video analysis work.
> The dashboard, map and tickets pages still show sample incidents around Austin, TX.

## Run it locally

Needs Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase keys (see below)
npm run dev
```

Open http://localhost:3000.

To analyze real videos, also start the AI service (setup in [ai-service/README.md](ai-service/README.md)):

```bash
cd ai-service && .venv/bin/uvicorn app.main:app --port 8000
```

If `.env.local` is left empty, the app runs in **demo mode**: accounts are saved in your browser only
and a "Try the demo account" button appears on the sign-in page.

## Connect Supabase (real accounts)

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor** → New query → paste `supabase/schema.sql` → **Run and enable RLS**.
   Then run each file in `supabase/migrations/` the same way, in order.
3. **Authentication → URL Configuration**: Site URL `http://localhost:3000`, Redirect URL `http://localhost:3000/**`.
4. **Project Settings → API Keys**: copy the Project URL and the **Publishable key** into `.env.local`.
   Never put the secret / service_role key in this app.
5. Restart `npm run dev`.

Optional: turn off **Confirm email** (Authentication → Sign In / Providers → Email) while developing,
and enable Google under Providers.

## Project layout

| What | Where |
|---|---|
| Sign in, create account, reset password | `src/app/(auth)/` |
| Dashboard, Analyze, Map, Incident, Tickets, Reports, Settings | `src/app/(app)/` |
| Sidebar, top bar and mobile tabs | `src/components/AppShell.tsx` |
| Sign-in logic (Supabase or demo mode) | `src/lib/auth.tsx` |
| Supabase connection | `src/lib/supabase.ts` |
| Sample data and the priority formula | `src/lib/data.ts` |
| Map (MapLibre + free OpenFreeMap tiles) | `src/components/IncidentMap.tsx` |
| Talks to the AI service; saves results to Supabase | `src/lib/aiService.ts`, `src/lib/saveScan.ts` |
| AI video service (Python: YOLO, linking, GPS) | `ai-service/` |
| Database tables, security rules, location search | `supabase/schema.sql`, `supabase/migrations/` |
| Copies the map worker into `public/` on install | `scripts/copy-map-worker.mjs` |

## Tech stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Auth, Postgres + PostGIS) ·
MapLibre GL · lucide icons. Installable on phones as a PWA.

AI service: Python · FastAPI · Ultralytics YOLO26s trained on RDD2022
([TamAko783/YOLO26s_RDD_Base](https://huggingface.co/TamAko783/YOLO26s_RDD_Base), AGPL-3.0) · OpenCV.

## Priority score

Each incident gets a 0–100 score from: damage type weight × AI confidence × (size, times seen,
and how much it grew since the last trip). See `priorityScore` in `src/lib/data.ts`.
High ≥ 45, Medium ≥ 28, otherwise Low.

## Roadmap

- [x] Web app, sign-in, sign-up, password reset
- [x] Supabase database with location search
- [x] Python AI service: video → frames → YOLO → linked, de-duplicated incidents → Supabase
- [x] Live upload progress on the Analyze page
- [x] Accuracy scoring script (`ai-service/scripts/evaluate.py`)
- [ ] Replace sample data with Supabase queries
- [ ] Save tickets and reviews

Damage classes follow the [RDD2022 dataset](https://github.com/sekilab/RoadDamageDetector):
D00 longitudinal crack, D10 transverse crack, D20 alligator crack, D40 pothole.
