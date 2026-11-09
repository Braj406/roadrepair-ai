// Shared display pieces: severity and status badges, page headings, placeholder road images.
import { AlertTriangle, ArrowDown, Minus } from "lucide-react";
import { type DamageType, type Severity, type TicketStatus, SEVERITY_LABEL, STATUS_LABEL } from "@/lib/data";

const sevStyles: Record<Severity, string> = {
  high: "bg-high-soft text-high",
  medium: "bg-medium-soft text-medium",
  low: "bg-low-soft text-low",
};
const sevIcon = { high: AlertTriangle, medium: Minus, low: ArrowDown };

// Severity uses an icon as well as color so it reads without color vision.
export function SeverityBadge({ severity, suffix = "" }: { severity: Severity; suffix?: string }) {
  const Icon = sevIcon[severity];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${sevStyles[severity]}`}>
      <Icon className="h-3 w-3" strokeWidth={3} />
      {SEVERITY_LABEL[severity]}{suffix}
    </span>
  );
}

const statusStyles: Record<TicketStatus, string> = {
  open: "bg-brand-soft text-brand",
  in_review: "bg-medium-soft text-medium",
  scheduled: "bg-surface-2 text-ink",
  resolved: "bg-ok-soft text-ok",
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${statusStyles[status]}`}>{STATUS_LABEL[status]}</span>;
}

export const SEVERITY_HEX: Record<Severity, string> = { high: "#e5484d", medium: "#f08c1a", low: "#d6a700" };

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

// Placeholder road photo drawn in SVG until real frame snapshots come from the pipeline.
export function RoadThumb({ type, seed = 1, worse = false, className = "" }: { type: DamageType; seed?: number; worse?: boolean; className?: string }) {
  const s = 1 + (worse ? 0.45 : 0);
  const dx = (seed * 37) % 30 - 15;
  return (
    <svg viewBox="0 0 160 110" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`sky${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9d6e8" />
          <stop offset="1" stopColor="#e8edf2" />
        </linearGradient>
        <linearGradient id={`asph${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6d6f75" />
          <stop offset="1" stopColor="#3f4146" />
        </linearGradient>
        <filter id={`n${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed={seed} />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
      <rect width="160" height="110" fill={`url(#sky${seed})`} />
      <rect y="30" width="160" height="12" fill="#8fa47a" />
      <path d="M62 34 L98 34 L170 110 L-10 110 Z" fill={`url(#asph${seed})`} />
      <path d="M62 34 L98 34 L170 110 L-10 110 Z" fill="#000" filter={`url(#n${seed})`} />
      <path d="M80 36 L80 44 M80 52 L80 64 M80 76 L80 96" stroke="#e9e3c4" strokeWidth="2" />
      <g transform={`translate(${80 + dx} 80) scale(${s})`}>
        {type === "pothole" && (
          <>
            <ellipse rx="22" ry="9" fill="#1d1e21" />
            <ellipse rx="18" ry="6.5" cy="1.5" fill="#2a2b2f" />
            <path d="M-22 0 L-28 -3 M22 1 L29 4 M5 -9 L8 -14" stroke="#1d1e21" strokeWidth="1.2" />
          </>
        )}
        {type === "alligator" && (
          <path d="M-26 -6 L-14 -9 L-4 -3 L8 -8 L20 -4 L27 3 M-14 -9 L-12 2 L-24 6 M-12 2 L0 4 L-4 -3 M0 4 L10 9 L20 -4 M10 9 L-2 12 L-14 9 M8 -8 L10 9" stroke="#18191c" strokeWidth="1.6" fill="none" strokeLinejoin="round" />
        )}
        {type === "longitudinal" && <path d="M-2 -22 L1 -12 L-2 -3 L2 7 L0 16 L3 26" stroke="#18191c" strokeWidth="1.8" fill="none" />}
        {type === "transverse" && <path d="M-34 0 L-22 -2 L-12 2 L0 -1 L12 2 L24 -1 L36 1" stroke="#18191c" strokeWidth="1.8" fill="none" />}
      </g>
    </svg>
  );
}
