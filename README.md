# RoadRepair AI

AI-powered road inspection and repair prioritization. Built for SlayHacks.

**Detect damage. Track changes. Repair smarter.**

RoadRepair AI turns ordinary dashcam footage into a map of road damage (potholes, longitudinal,
transverse and alligator cracks), merges duplicate sightings, flags damage that is getting worse
between trips, and ranks repairs so crews know what to fix first.

> Hackathon project in progress. The web app, sign-in and database are working. Pages currently show
> sample incidents around Austin, TX until the AI video pipeline is connected.

## Run it locally

Needs Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase keys (see below)
npm run dev
```

Open http://localhost:3000.

If `.env.local` is left empty, the app runs in **demo mode**: accounts are saved in your browser only
and a "Try the demo account" button appears on the sign-in page.

## Connect Supabase (real accounts)

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor** → New query → paste `supabase/schema.sql` → **Run and enable RLS**.
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
| Database tables, security rules, location search | `supabase/schema.sql` |
| Copies the map worker into `public/` on install | `scripts/copy-map-worker.mjs` |

## Tech stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Auth, Postgres + PostGIS) ·
MapLibre GL · lucide icons. Installable on phones as a PWA.

## Priority score

Each incident gets a 0–100 score from: damage type weight × AI confidence × (size, times seen,
and how much it grew since the last trip). See `priorityScore` in `src/lib/data.ts`.
High ≥ 45, Medium ≥ 28, otherwise Low.

## Roadmap

- [x] Web app, sign-in, sign-up, password reset
- [x] Supabase database with location search
- [ ] Python FastAPI service: video → frames → YOLO (fine-tuned on RDD2022) → tracking → Supabase
- [ ] Live upload progress on the Analyze page
- [ ] Replace sample data with Supabase queries
- [ ] Save tickets and reviews

Damage classes follow the [RDD2022 dataset](https://github.com/sekilab/RoadDamageDetector):
D00 longitudinal crack, D10 transverse crack, D20 alligator crack, D40 pothole.
