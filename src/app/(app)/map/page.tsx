"use client";

// Full map of incidents with type, severity and text filters. Clicking a dot shows a preview card.

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Search, SlidersHorizontal, X } from "lucide-react";
import MapClient from "@/components/MapClient";
import { RoadThumb, SeverityBadge, SEVERITY_HEX } from "@/components/ui";
import { DAMAGE_LABEL, incidents, type DamageType, type Severity } from "@/lib/data";

const types: DamageType[] = ["pothole", "alligator", "longitudinal", "transverse"];
const severities: Severity[] = ["high", "medium", "low"];

export default function MapPage() {
  const [type, setType] = useState<DamageType | "all">("all");
  const [sev, setSev] = useState<Set<Severity>>(new Set(severities));
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return incidents.filter(
      (i) =>
        (type === "all" || i.type === type) &&
        sev.has(i.severity) &&
        (!term || i.id.toLowerCase().includes(term) || i.street.toLowerCase().includes(term) || DAMAGE_LABEL[i.type].toLowerCase().includes(term)),
    );
  }, [type, sev, q]);

  const sel = incidents.find((i) => i.id === selected);
  const count = (t: DamageType) => incidents.filter((i) => i.type === t).length;

  function toggleSev(s: Severity) {
    setSev((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Road incidents map</h1>
          <p className="mt-1 text-muted">{filtered.length} of {incidents.length} incidents shown</p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} className="input pl-9" placeholder="Search street, ticket ID or damage type" />
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setType("all")} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${type === "all" ? "bg-brand text-white" : "bg-surface text-ink ring-1 ring-line"}`}>
          All ({incidents.length})
        </button>
        {types.map((t) => (
          <button key={t} onClick={() => setType(t)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${type === t ? "bg-brand text-white" : "bg-surface text-ink ring-1 ring-line"}`}>
            {DAMAGE_LABEL[t]} ({count(t)})
          </button>
        ))}
        <button onClick={() => setShowFilters((s) => !s)} className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-3.5 py-1.5 text-sm font-semibold ring-1 ring-line lg:hidden">
          <SlidersHorizontal className="h-4 w-4" /> Severity
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        <div className="card relative h-[62vh] min-h-[420px] overflow-hidden">
          <MapClient items={filtered} onSelect={setSelected} className="h-full w-full" />

          {sel && (
            <div className="card absolute left-3 right-3 top-3 z-10 flex gap-3 p-3 sm:right-auto sm:w-80">
              <RoadThumb type={sel.type} seed={Number(sel.id.slice(2)) % 50} className="h-20 w-24 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold">{DAMAGE_LABEL[sel.type]}</p>
                  <button onClick={() => setSelected(null)} className="text-muted hover:text-ink" aria-label="Close"><X className="h-4 w-4" /></button>
                </div>
                <SeverityBadge severity={sel.severity} suffix=" priority" />
                <p className="mt-1 truncate text-xs text-muted">{sel.street} · seen {sel.timesSeen}×</p>
                <Link href={`/incidents/${sel.id}`} className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
                  View details <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>

        <aside className={`card h-fit space-y-5 p-5 ${showFilters ? "" : "hidden lg:block"}`}>
          <div>
            <h2 className="mb-3 text-sm font-bold">Severity</h2>
            <ul className="space-y-2">
              {severities.map((s) => (
                <li key={s}>
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                    <input type="checkbox" checked={sev.has(s)} onChange={() => toggleSev(s)} className="h-4 w-4 accent-[var(--brand)]" />
                    <span className="h-3 w-3 rounded-full" style={{ background: SEVERITY_HEX[s] }} />
                    <span className="flex-1 capitalize">{s}</span>
                    <span className="text-muted">{incidents.filter((i) => i.severity === s).length}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t border-line pt-4 text-xs text-muted">
            Click a purple cluster to zoom in. Click a dot to preview an incident.
          </div>
        </aside>
      </div>
    </div>
  );
}
