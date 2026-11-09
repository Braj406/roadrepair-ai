"use client";

// Repair tickets: summary counts, search, status filter, and CSV export of the filtered rows.

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ClipboardList, Download, Minus, Search, TriangleAlert } from "lucide-react";
import { PageHeader, SeverityBadge, StatusBadge } from "@/components/ui";
import { DAMAGE_LABEL, STATUS_LABEL, incidents, toCSV, type TicketStatus } from "@/lib/data";

const statuses: (TicketStatus | "all")[] = ["all", "open", "in_review", "scheduled", "resolved"];

export default function TicketsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<TicketStatus | "all">("all");

  const withTickets = incidents.filter((i) => i.ticket);
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return withTickets.filter(
      (i) =>
        (status === "all" || i.ticket!.status === status) &&
        (!term || [i.id, i.street, DAMAGE_LABEL[i.type], i.ticket!.assignee].some((v) => v.toLowerCase().includes(term))),
    );
  }, [q, status, withTickets]);

  function exportCSV() {
    const blob = new Blob([toCSV(rows)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "roadrepair-tickets.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const by = (s: string) => withTickets.filter((i) => i.severity === s).length;
  const cards = [
    { label: "Total tickets", value: withTickets.length, icon: ClipboardList, tint: "bg-brand-soft text-brand" },
    { label: "High priority", value: by("high"), icon: TriangleAlert, tint: "bg-high-soft text-high" },
    { label: "Medium", value: by("medium"), icon: Minus, tint: "bg-medium-soft text-medium" },
    { label: "Low", value: by("low"), icon: ArrowDown, tint: "bg-low-soft text-low" },
  ];

  return (
    <div>
      <PageHeader
        title="Repair tickets"
        subtitle="Prioritized list of road repairs for your crews."
        actions={<button onClick={exportCSV} className="btn-primary"><Download className="h-4 w-4" /> Export CSV</button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, tint }) => (
          <div key={label} className="card flex items-center gap-3 p-4">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}><Icon className="h-5 w-5" /></div>
            <div>
              <p className="text-2xl font-extrabold">{value}</p>
              <p className="text-xs text-muted">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} className="input pl-9" placeholder="Search ticket ID, street, damage type or crew" />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {statuses.map((s) => (
              <button key={s} onClick={() => setStatus(s)} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${status === s ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-2"}`}>
                {s === "all" ? "All" : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Damage</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((i) => (
                <tr key={i.id} className="hover:bg-surface-2">
                  <td className="px-4 py-3 font-bold"><Link href={`/incidents/${i.id}`} className="text-brand hover:underline">{i.id}</Link></td>
                  <td className="px-4 py-3">
                    {i.street}
                    <span className="block text-xs text-muted">{i.lat.toFixed(4)}, {i.lng.toFixed(4)}</span>
                  </td>
                  <td className="px-4 py-3">{DAMAGE_LABEL[i.type]}</td>
                  <td className="px-4 py-3"><SeverityBadge severity={i.severity} /></td>
                  <td className="px-4 py-3 font-semibold">{i.priority}</td>
                  <td className="px-4 py-3">{i.ticket!.assignee}</td>
                  <td className="px-4 py-3 text-muted">{i.ticket!.due}</td>
                  <td className="px-4 py-3"><StatusBadge status={i.ticket!.status} /></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted">No tickets match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
