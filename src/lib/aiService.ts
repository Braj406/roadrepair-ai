// Client for the Python video service in /ai-service.

import type { DamageType, Severity } from "./data";

export const AI_SERVICE_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL || "http://localhost:8000";

export type AiIncident = {
  type: DamageType;
  confidence: number;
  video_time: number;
  frame: number;
  frames_seen: number;
  bbox: [number, number, number, number]; // fractions of the frame
  size: number; // 0-1
  priority: number;
  severity: Severity;
  lat: number | null;
  lng: number | null;
  thumbnail: string | null; // JPEG data URL
};

export type AiResult = {
  video: { duration_s: number | null; fps: number; frames_total: number; frames_analyzed: number };
  has_gps: boolean;
  detections_total: number;
  duplicates_removed: number;
  incidents: AiIncident[];
};

export type AiJob = {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  filename: string;
  step: number;
  steps: string[];
  progress: number;
  frames_done?: number;
  frames_total?: number;
  detections?: number;
  unique?: number;
  preview?: string;
  error?: string;
  result?: AiResult;
};

export type ServiceStatus =
  | { state: "ready"; device: string; classes: string[] }
  | { state: "no-model"; message: string }
  | { state: "offline" };

export async function checkService(): Promise<ServiceStatus> {
  try {
    const res = await fetch(`${AI_SERVICE_URL}/health`, { cache: "no-store" });
    const body = await res.json();
    if (body.model_loaded) return { state: "ready", device: body.device, classes: body.classes };
    return { state: "no-model", message: body.error ?? "Model not installed" };
  } catch {
    return { state: "offline" };
  }
}

export async function startJob(video: File, gps: File | null, track: boolean): Promise<string> {
  const form = new FormData();
  form.append("video", video);
  if (gps) form.append("gps", gps);
  form.append("track", String(track));
  const res = await fetch(`${AI_SERVICE_URL}/jobs`, { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail ?? `Upload failed (${res.status})`);
  return body.id as string;
}

export async function getJob(id: string): Promise<AiJob> {
  const res = await fetch(`${AI_SERVICE_URL}/jobs/${id}`, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail ?? `Status check failed (${res.status})`);
  return body as AiJob;
}
