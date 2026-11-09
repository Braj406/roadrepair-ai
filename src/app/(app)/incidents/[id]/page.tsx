"use client";

// One incident: before/after evidence, change history, details, and review actions.
// Ticket and review buttons only update this page for now; they will save to Supabase later.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCheck, ClipboardPlus, PlayCircle, TrendingUp } from "lucide-react";
import { RoadThumb, SeverityBadge, StatusBadge } from "@/components/ui";
import { DAMAGE_LABEL, RDD_CODE, getIncident } from "@/lib/data";

export default function IncidentPage() {
  const { id } = useParams<{ id: string }>();
  const incident = getIncident(id);
  const [ticketCreated, setTicketCreated] = useState(false);
  const [reviewed, setReviewed] = useState(false);

  if (!incident) {
    return (
      <div className="card p-10 text-center">
        <p className="text-lg font-bold">Incident not found</p>
        <Link href="/map" className="btn-secondary mt-4">Back to map</Link>
      </div>
    );
  }

  const i = incident;
  const seed = Number(i.id.slice(2)) % 50;
  const worse = i.changePct > 15;
  const details: [string, React.ReactNode][] = [
    ["Damage type", `${DAMAGE_LABEL[i.type]} (${RDD_CODE[i.type]})`],
    ["Severity", <SeverityBadge key="s" severity={i.severity} />],
    ["Priority score", `${i.priority} / 100`],
    ["AI confidence", `${Math.round(i.confidence * 100)}%`],
    ["Change", i.timesSeen > 1 ? <span key="c" className={worse ? "font-bold text-high" : ""}>{i.changePct > 0 ? "+" : ""}{i.changePct}% area</span> : "First sighting"],
    ["Location", <span key="l">{i.street}<br /><span className="text-xs text-muted">{i.lat.toFixed(4)}° N, {Math.abs(i.lng).toFixed(4)}° W</span></span>],
    ["Times detected", `${i.timesSeen} (across ${i.timesSeen} trip${i.timesSeen > 1 ? "s" : ""})`],
  ];

  return (
    <div>
      <Link href="/map" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to map
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Incident #{i.id}</h1>
        <SeverityBadge severity={i.severity} suffix=" priority" />
        {i.ticket && <StatusBadge status={i.ticket.status} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-4 font-bold">Evidence</h2>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
              <figure>
                <figcaption className="mb-2 text-xs"><span className="font-bold">First seen</span><br /><span className="text-muted">{i.firstSeen}</span></figcaption>
                <RoadThumb type={i.type} seed={seed} className="aspect-[4/3] w-full rounded-xl" />
              </figure>
              <ArrowRight className="mt-6 h-5 w-5 text-brand" />
              <figure>
                <figcaption className="mb-2 text-xs"><span className="font-bold">{worse ? "Latest (worsened)" : "Latest"}</span><br /><span className="text-muted">{i.lastSeen}</span></figcaption>
                <RoadThumb type={i.type} seed={seed} worse={worse} className={`aspect-[4/3] w-full rounded-xl ${worse ? "ring-2 ring-high" : ""}`} />
              </figure>
            </div>
            {/* Enabled once the pipeline stores video clips for each incident. */}
            <button disabled title="Available once video evidence is stored" className="mt-4 inline-flex cursor-not-allowed items-center gap-1.5 text-sm font-semibold text-muted">
              <PlayCircle className="h-4 w-4" /> Watch in video at {i.videoTime} (coming soon)
            </button>
          </section>

          <section className="card p-5">
            <h2 className="mb-4 font-bold">Change history</h2>
            <ol className="relative space-y-5 border-l-2 border-line pl-6">
              {i.history.map((h, n) => (
                <li key={n} className="relative">
                  <span className={`absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-surface ${n === 0 ? "bg-brand" : "bg-line"}`} />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm font-bold">{h.date}</span>
                    <span className={`text-sm ${h.note.startsWith("Worsened") ? "rounded-md bg-high-soft px-2 py-0.5 font-semibold text-high" : "text-muted"}`}>
                      {h.note.startsWith("Worsened") && <TrendingUp className="mr-1 inline h-3.5 w-3.5" />}
                      {h.note}
                    </span>
                  </div>
                  <p className="text-xs text-muted">{h.areaM2} m² · from {h.scan}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 font-bold">Details</h2>
            <dl className="divide-y divide-line">
              {details.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2.5 text-sm">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="card space-y-2 p-5">
            {i.ticket ? (
              <div className="mb-2 rounded-xl bg-surface-2 p-3 text-sm">
                <p className="font-semibold">Ticket assigned to {i.ticket.assignee}</p>
                <p className="text-muted">Due {i.ticket.due}</p>
              </div>
            ) : null}
            <button onClick={() => setTicketCreated(true)} disabled={!!i.ticket || ticketCreated} className="btn-primary w-full">
              {ticketCreated ? <><Check className="h-4 w-4" /> Ticket created</> : <><ClipboardPlus className="h-4 w-4" /> {i.ticket ? "Ticket exists" : "Create repair ticket"}</>}
            </button>
            <button onClick={() => setReviewed(true)} disabled={reviewed} className="btn-secondary w-full">
              <CheckCheck className="h-4 w-4" /> {reviewed ? "Marked as reviewed" : "Mark as reviewed"}
            </button>
            <p className="pt-1 text-xs text-muted">AI findings are suggestions. A person should confirm before crews are sent.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
