"use client";

// Printable road condition summary. Use the browser's print dialog to save it as a PDF.

import { Printer } from "lucide-react";
import { PageHeader, SEVERITY_HEX } from "@/components/ui";
import { DAMAGE_LABEL, incidents, scans, stats, type DamageType, type Severity } from "@/lib/data";

const types: DamageType[] = ["pothole", "alligator", "longitudinal", "transverse"];
const sevs: Severity[] = ["high", "medium", "low"];

export default function ReportsPage() {
  const s = stats();
  const max = Math.max(...types.map((t) => incidents.filter((i) => i.type === t).length));
  const streets = Object.entries(
    incidents.reduce<Record<string, number>>((acc, i) => ((acc[i.street] = (acc[i.street] ?? 0) + i.priority), acc), {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const streetMax = streets[0]?.[1] ?? 1;
  const km = scans.reduce((a, x) => a + x.distanceKm, 0);
  const dedupeRate = Math.round((1 - s.unique / s.totalDetections) * 100);

  return (
    <div>
      <PageHeader
        title="Road condition report"
        subtitle="Summary across all scans. Share it with your council or team."
        actions={<button onClick={() => window.print()} className="btn-secondary"><Printer className="h-4 w-4" /> Print / PDF</button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Road surveyed", `${km.toFixed(1)} km`],
          ["Unique incidents", s.unique],
          ["Duplicates removed", `${dedupeRate}%`],
          ["Getting worse", s.worsened],
        ].map(([k, v]) => (
          <div key={k} className="card p-4">
            <p className="text-2xl font-extrabold">{v}</p>
            <p className="text-xs text-muted">{k}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 font-bold">Incidents by damage type</h2>
          <ul className="space-y-3">
            {types.map((t) => {
              const n = incidents.filter((i) => i.type === t).length;
              return (
                <li key={t}>
                  <div className="mb-1 flex justify-between text-sm"><span>{DAMAGE_LABEL[t]}</span><span className="font-bold">{n}</span></div>
                  <div className="h-2.5 rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand" style={{ width: `${(n / max) * 100}%` }} /></div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-bold">Severity mix</h2>
          <div className="flex h-5 overflow-hidden rounded-full">
            {sevs.map((v) => (
              <div key={v} style={{ width: `${(incidents.filter((i) => i.severity === v).length / incidents.length) * 100}%`, background: SEVERITY_HEX[v] }} />
            ))}
          </div>
          <ul className="mt-4 grid grid-cols-3 gap-2 text-sm">
            {sevs.map((v) => (
              <li key={v} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: SEVERITY_HEX[v] }} />
                <span className="capitalize">{v}</span>
                <span className="ml-auto font-bold">{incidents.filter((i) => i.severity === v).length}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-1 font-bold">Streets needing the most attention</h2>
          <p className="mb-4 text-sm text-muted">Sum of priority scores for incidents on each street.</p>
          <ul className="space-y-3">
            {streets.map(([name, score]) => (
              <li key={name} className="grid grid-cols-[140px_1fr_40px] items-center gap-3 text-sm">
                <span className="truncate font-semibold">{name}</span>
                <div className="h-2.5 rounded-full bg-surface-2"><div className="h-full rounded-full bg-gradient-to-r from-brand to-accent" style={{ width: `${(score / streetMax) * 100}%` }} /></div>
                <span className="text-right font-bold">{score}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
