// Saves one analyzed video to Supabase as the signed-in user.
// Incidents within MATCH_RADIUS_M of an existing one of the same type update that incident
// (times seen, growth since last trip) instead of creating a duplicate.

import { supabase } from "./supabase";
import { priorityScore, severityFor } from "./data";
import type { AiResult } from "./aiService";

const MATCH_RADIUS_M = 10;
const WORSENED_PCT = 15; // growth above this counts as "worsened"

export type SaveSummary = { scanId: string; created: number; updated: number; worsened: number };

function newCode() {
  return `R-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function point(lat: number, lng: number) {
  return `SRID=4326;POINT(${lng} ${lat})`;
}

/**
 * @param matchExisting  when false, every incident is saved as new (the "Monitor changes" option is off).
 */
export async function saveScan(result: AiResult, filename: string, userId: string, matchExisting = true): Promise<SaveSummary> {
  if (!supabase) throw new Error("Supabase is not connected.");
  const db = supabase;

  const { data: scan, error: scanError } = await db
    .from("scans")
    .insert({
      owner: userId,
      video_path: filename,
      filename,
      status: "completed",
      progress: 100,
      frames_total: result.video.frames_total,
      duration_s: result.video.duration_s,
      detections: result.detections_total,
      unique_incidents: result.incidents.length,
    })
    .select("id")
    .single();
  if (scanError) throw new Error(`Couldn't save the scan: ${scanError.message}`);

  const summary: SaveSummary = { scanId: scan.id, created: 0, updated: 0, worsened: 0 };
  const now = new Date().toISOString();

  for (const inc of result.incidents) {
    const hasLocation = inc.lat !== null && inc.lng !== null;

    // Was this defect already found on an earlier trip?
    let existingId: string | null = null;
    if (hasLocation && matchExisting) {
      const { data } = await db.rpc("nearby_incident", { p_type: inc.type, p_lng: inc.lng, p_lat: inc.lat, p_meters: MATCH_RADIUS_M });
      existingId = (data as string | null) ?? null;
    }

    let incidentId: string;
    if (existingId) {
      const { data: prev } = await db.from("incidents").select("times_seen, size").eq("id", existingId).single();
      const timesSeen = (prev?.times_seen ?? 1) + 1;
      const prevSize = prev?.size ?? inc.size;
      const changePct = prevSize > 0 ? Math.max(0, Math.round(((inc.size - prevSize) / prevSize) * 100)) : 0;
      const priority = priorityScore({ type: inc.type, confidence: inc.confidence, timesSeen, changePct }, inc.size);
      const { error } = await db
        .from("incidents")
        .update({
          times_seen: timesSeen,
          last_seen: now,
          size: inc.size,
          change_pct: changePct,
          confidence: inc.confidence,
          priority,
          severity: severityFor(priority),
          thumbnail: inc.thumbnail,
          video_time: inc.video_time,
          scan_id: scan.id,
        })
        .eq("id", existingId);
      if (error) throw new Error(`Couldn't update an incident: ${error.message}`);
      incidentId = existingId;
      summary.updated++;
      if (changePct > WORSENED_PCT) summary.worsened++;
    } else {
      const { data: created, error } = await db
        .from("incidents")
        .insert({
          code: newCode(),
          damage_type: inc.type,
          severity: inc.severity,
          priority: inc.priority,
          location: hasLocation ? point(inc.lat!, inc.lng!) : null,
          confidence: inc.confidence,
          size: inc.size,
          thumbnail: inc.thumbnail,
          video_time: inc.video_time,
          scan_id: scan.id,
        })
        .select("id")
        .single();
      if (error) throw new Error(`Couldn't save an incident: ${error.message}`);
      incidentId = created.id;
      summary.created++;
    }

    // Raw sighting, kept for history.
    await db.from("detections").insert({
      scan_id: scan.id,
      incident_id: incidentId,
      frame: inc.frame,
      video_time: inc.video_time,
      confidence: inc.confidence,
      bbox: inc.bbox,
      location: hasLocation ? point(inc.lat!, inc.lng!) : null,
    });
  }

  return summary;
}
