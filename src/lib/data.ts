// Sample data for the demo. Replace with Supabase queries once the AI pipeline writes real incidents.

export type DamageType = "pothole" | "alligator" | "longitudinal" | "transverse";
export type Severity = "high" | "medium" | "low";
export type TicketStatus = "open" | "in_review" | "scheduled" | "resolved";

export const DAMAGE_LABEL: Record<DamageType, string> = {
  pothole: "Pothole",
  alligator: "Alligator crack",
  longitudinal: "Longitudinal crack",
  transverse: "Transverse crack",
};

// RDD2022 class codes, for matching model output later.
export const RDD_CODE: Record<DamageType, string> = {
  longitudinal: "D00",
  transverse: "D10",
  alligator: "D20",
  pothole: "D40",
};

export const SEVERITY_LABEL: Record<Severity, string> = { high: "High", medium: "Medium", low: "Low" };
export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Open",
  in_review: "In review",
  scheduled: "Scheduled",
  resolved: "Resolved",
};

// One observation of an incident on one trip.
export type Sighting = { date: string; areaM2: number; note: string; scan: string };

// One real-world defect, after duplicate detections are merged.
export type Incident = {
  id: string;
  type: DamageType;
  severity: Severity;
  lat: number;
  lng: number;
  street: string;
  confidence: number;
  timesSeen: number;
  firstSeen: string;
  lastSeen: string;
  changePct: number; // area change between first and latest sighting
  priority: number; // 0-100
  history: Sighting[];
  ticket?: { status: TicketStatus; assignee: string; due: string };
  videoTime: string;
};

const streets = [
  "E 7th St", "Congress Ave", "Lamar Blvd", "Guadalupe St", "S 1st St", "Cesar Chavez St",
  "Riverside Dr", "Burnet Rd", "Airport Blvd", "Manor Rd", "Red River St", "Barton Springs Rd",
  "MLK Jr Blvd", "E 11th St", "Pleasant Valley Rd", "Oltorf St", "William Cannon Dr", "Duval St",
  "Enfield Rd", "N Loop Blvd", "Koenig Ln", "E 51st St", "Springdale Rd", "Montopolis Dr",
];

const types: DamageType[] = ["pothole", "alligator", "longitudinal", "transverse"];
const crews = ["Crew A · Ortiz", "Crew B · Chen", "Crew C · Patel", "Unassigned"];

// Small seeded random so the demo data is the same on every load.
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const TYPE_WEIGHT: Record<DamageType, number> = { pothole: 1, alligator: 0.85, transverse: 0.55, longitudinal: 0.5 };

// Priority formula shown to judges: type weight x confidence x size x repeat sightings x worsening.
export function priorityScore(i: Pick<Incident, "type" | "confidence" | "timesSeen" | "changePct">, areaM2: number) {
  const size = Math.min(1, areaM2 / 1.2);
  const repeat = Math.min(1, i.timesSeen / 4);
  const worse = Math.min(1, Math.max(0, i.changePct) / 60);
  const raw = TYPE_WEIGHT[i.type] * (0.35 + 0.65 * i.confidence) * (0.15 + 0.4 * size + 0.2 * repeat + 0.25 * worse);
  return Math.round(Math.min(100, raw * 100));
}

function severityFor(score: number): Severity {
  return score >= 45 ? "high" : score >= 28 ? "medium" : "low";
}

const DAY_MS = 86_400_000;
const SAMPLE_TODAY = new Date("2026-11-08T12:00:00Z");

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function pick<T>(list: T[], r: () => number): T {
  return list[Math.floor(r() * list.length)];
}

function ticketStatusFor(roll: number): TicketStatus | null {
  if (roll < 0.25) return null; // no ticket yet
  if (roll < 0.6) return "open";
  if (roll < 0.75) return "in_review";
  if (roll < 0.88) return "scheduled";
  return "resolved";
}

// Generates 48 believable incidents around downtown Austin. The first 16 are potholes.
function buildIncidents(): Incident[] {
  const r = rng(42);
  const out: Incident[] = [];

  for (let n = 0; n < 48; n++) {
    const typeRoll = r();
    const type: DamageType = n < 16 ? "pothole" : types[Math.floor(typeRoll * 4)];
    const timesSeen = 1 + Math.floor(r() * 4);
    const daysTracked = 10 + Math.floor(r() * 50);
    const firstDate = new Date(SAMPLE_TODAY.getTime() - daysTracked * DAY_MS);
    const confidence = 0.62 + r() * 0.36;
    const firstArea = 0.15 + r() * 0.9;
    // Damage only grows (or stays the same) between trips.
    const changePct = timesSeen > 1 ? Math.max(0, Math.round((r() - 0.2) * 70)) : 0;

    // One sighting per trip, spread evenly from the first trip to today, oldest first.
    const history: Sighting[] = [];
    for (let s = 0; s < timesSeen; s++) {
      const isLast = s === timesSeen - 1;
      const progress = timesSeen === 1 ? 0 : s / (timesSeen - 1);
      const date = timesSeen > 1 && isLast ? SAMPLE_TODAY : new Date(firstDate.getTime() + progress * daysTracked * DAY_MS);
      let note = "Seen again, no major change";
      if (s === 0) note = "First detected";
      else if (isLast && changePct > 15) note = `Worsened (+${changePct}% area)`;
      history.push({
        date: fmt(date),
        areaM2: Math.round(firstArea * (1 + (changePct / 100) * progress) * 100) / 100,
        note,
        scan: `scan_${100 + Math.floor(r() * 40)}.mp4`,
      });
    }

    const first = history[0];
    const latest = history[history.length - 1];
    const priority = priorityScore({ type, confidence, timesSeen, changePct }, latest.areaM2);
    const status = ticketStatusFor(r());
    const due = new Date(SAMPLE_TODAY.getTime() + (3 + Math.floor(r() * 20)) * DAY_MS);
    const videoSec = Math.floor(r() * 134);

    out.push({
      id: `A-${1043 + n}`,
      type,
      severity: severityFor(priority),
      lat: 30.2672 + (r() - 0.5) * 0.11,
      lng: -97.7431 + (r() - 0.5) * 0.12,
      street: pick(streets, r),
      confidence: Math.round(confidence * 100) / 100,
      timesSeen,
      firstSeen: first.date,
      lastSeen: latest.date,
      changePct,
      priority,
      history: [...history].reverse(), // newest first for display
      ticket: status ? { status, assignee: pick(crews, r), due: fmt(due) } : undefined,
      videoTime: `${Math.floor(videoSec / 60)}:${String(videoSec % 60).padStart(2, "0")}`,
    });
  }

  return out.sort((a, b) => b.priority - a.priority);
}

export const incidents: Incident[] = buildIncidents();

export function getIncident(id: string) {
  return incidents.find((i) => i.id === id);
}

// One uploaded dashcam video.
export type Scan = {
  id: string;
  file: string;
  when: string;
  distanceKm: number;
  durationSec: number;
  detections: number;
  unique: number;
  status: "completed" | "processing" | "failed";
};

export const scans: Scan[] = [
  { id: "s1", file: "city_drive_01.mp4", when: "2 min ago", distanceKm: 4.2, durationSec: 134, detections: 37, unique: 14, status: "completed" },
  { id: "s2", file: "highway_north.mp4", when: "12 min ago", distanceKm: 8.7, durationSec: 402, detections: 29, unique: 11, status: "completed" },
  { id: "s3", file: "eastside_loop.mov", when: "Yesterday", distanceKm: 6.1, durationSec: 288, detections: 41, unique: 17, status: "completed" },
  { id: "s4", file: "riverside_am.mp4", when: "Nov 5", distanceKm: 3.4, durationSec: 151, detections: 17, unique: 9, status: "completed" },
];

// Headline numbers for the dashboard and reports.
export function stats() {
  const totalDetections = scans.reduce((sum, scan) => sum + scan.detections, 0);
  const high = incidents.filter((i) => i.severity === "high").length;
  const tickets = incidents.filter((i) => i.ticket).length;
  const worsened = incidents.filter((i) => i.changePct > 15).length;
  const crewCount = new Set(incidents.map((i) => i.ticket?.assignee).filter((a) => a && a !== "Unassigned")).size;
  return { totalDetections, unique: incidents.length, high, tickets, worsened, crewCount, scanCount: scans.length };
}

// Spreadsheet export for the tickets page. Every value is quoted so commas in street names are safe.
export function toCSV(rows: Incident[]) {
  const head = ["ticket_id", "damage_type", "rdd_code", "severity", "priority", "latitude", "longitude", "street", "confidence", "times_seen", "change_pct", "status", "assignee", "due"];
  const lines = rows.map((i) =>
    [i.id, DAMAGE_LABEL[i.type], RDD_CODE[i.type], i.severity, i.priority, i.lat.toFixed(5), i.lng.toFixed(5), i.street, i.confidence, i.timesSeen, i.changePct, i.ticket?.status ?? "", i.ticket?.assignee ?? "", i.ticket?.due ?? ""]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [head.join(","), ...lines].join("\n");
}
