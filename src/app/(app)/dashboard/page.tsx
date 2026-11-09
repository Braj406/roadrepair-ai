"use client";

// Home screen after sign-in: greeting, headline numbers, top-priority repairs, map preview and recent scans.

import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardList, Maximize2, MapPin, Play, ScanSearch, TrendingUp, TriangleAlert, Wrench } from "lucide-react";
import MapClient from "@/components/MapClient";
import { RoadThumb, SeverityBadge } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { DAMAGE_LABEL, incidents, scans, stats } from "@/lib/data";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const s = stats();
  const first = user?.fullName.split(" ")[0] ?? "";
  const top = incidents.slice(0, 5);

  const cards = [
    { label: "Defects detected", value: s.totalDetections, sub: `from ${s.scanCount} scans`, icon: ScanSearch, tint: "text-brand bg-brand-soft" },
    { label: "Unique incidents", value: s.unique, sub: "after removing duplicates", icon: MapPin, tint: "text-brand bg-brand-soft" },
    { label: "High priority", value: s.high, sub: `${s.worsened} getting worse`, icon: TriangleAlert, tint: "text-high bg-high-soft" },
    { label: "Tickets created", value: s.tickets, sub: `across ${s.crewCount} crews`, icon: CheckCircle2, tint: "text-ok bg-ok-soft" },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(120deg,#ffffff_0%,#f1ecff_55%,#ffe7cc_100%)] p-6 ring-1 ring-line sm:p-8 dark:bg-[linear-gradient(120deg,#1a1536_0%,#2a2163_100%)]">
        <div className="relative z-10 max-w-xl">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{greeting()}, {first} 👋</h1>
          <p className="mt-2 text-muted">Inspect roads with AI, find damage, and prioritize repairs, all in one place.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/analyze" className="btn-primary">Analyze new video <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/map" className="btn-secondary"><MapPin className="h-4 w-4" /> View map</Link>
          </div>
        </div>
        <svg className="pointer-events-none absolute -right-10 bottom-0 hidden h-full sm:block" viewBox="0 0 420 220" aria-hidden="true">
          <path d="M120 230 C200 160 300 160 330 90 C350 40 300 20 340 -10" fill="none" stroke="#6d5be0" strokeOpacity=".18" strokeWidth="70" />
          <path d="M120 230 C200 160 300 160 330 90 C350 40 300 20 340 -10" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="14 14" />
          <circle cx="330" cy="88" r="9" fill="#f59e2c" />
        </svg>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {cards.map(({ label, value, sub, icon: Icon, tint }) => (
          <div key={label} className="card p-4 sm:p-5">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${tint}`}>
              <Icon className="h-5 w-5" />
            </div>
            <p className="text-3xl font-extrabold tracking-tight">{value}</p>
            <p className="text-sm font-semibold">{label}</p>
            <p className="mt-0.5 text-xs text-muted">{sub}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Priority queue */}
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">Fix these first</h2>
            <Link href="/tickets" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">All tickets <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <ul className="divide-y divide-line">
            {top.map((i, n) => (
              <li key={i.id}>
                <Link href={`/incidents/${i.id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-surface-2">
                  <span className="w-5 text-center text-sm font-bold text-muted">{n + 1}</span>
                  <RoadThumb type={i.type} seed={n + 3} className="h-12 w-16 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{DAMAGE_LABEL[i.type]} · {i.street}</p>
                    <p className="text-xs text-muted">
                      {i.id} · seen {i.timesSeen}×{i.changePct > 15 && <span className="font-semibold text-high"> · <TrendingUp className="inline h-3 w-3" /> +{i.changePct}% area</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <SeverityBadge severity={i.severity} />
                    <p className="mt-1 text-xs font-semibold text-muted">Score {i.priority}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6">
          {/* Map preview */}
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between p-5 pb-3">
              <h2 className="font-bold">Incident map</h2>
              <Link href="/map" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink" aria-label="Open full map">
                <Maximize2 className="h-4 w-4" />
              </Link>
            </div>
            <Link href="/map" className="block h-56">
              <MapClient items={incidents} interactive={false} className="h-full w-full" />
            </Link>
          </section>

          {/* Recent scans */}
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">Recent scans</h2>
              <Link href="/analyze" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">New scan <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
            <ul className="space-y-2">
              {scans.slice(0, 3).map((sc, n) => (
                <li key={sc.id} className="flex items-center gap-3">
                  <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded-lg">
                    <RoadThumb type="pothole" seed={n + 11} className="h-full w-full" />
                    <Play className="absolute inset-0 m-auto h-4 w-4 fill-white text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{sc.file}</p>
                    <p className="text-xs text-muted">{sc.when} · {sc.distanceKm} km</p>
                  </div>
                  <span className="rounded-full bg-ok-soft px-2 py-0.5 text-xs font-bold text-ok">Done</span>
                  <span className="hidden w-20 text-right text-sm font-semibold sm:block">{sc.detections} defects</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { href: "/analyze", icon: ScanSearch, title: "Upload dashcam video", text: "Detect potholes and cracks automatically." },
          { href: "/tickets", icon: Wrench, title: "Assign repairs", text: "Send prioritized tickets to crews." },
          { href: "/reports", icon: ClipboardList, title: "Export a report", text: "Share road condition with your council." },
        ].map(({ href, icon: Icon, title, text }) => (
          <Link key={href} href={href} className="card group flex items-start gap-3 p-4 transition hover:-translate-y-0.5">
            <Icon className="mt-0.5 h-5 w-5 text-brand" />
            <div>
              <p className="font-semibold">{title}</p>
              <p className="text-sm text-muted">{text}</p>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
