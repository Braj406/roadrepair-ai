"""Video -> road damage incidents.

Steps:
  1. Read the video and keep SAMPLE_FPS frames per second.
  2. Run YOLO on each kept frame and link each box to the same defect in earlier frames
     (same type, seen within JOIN_GAP_S, overlapping or nearby on screen), so one pothole
     seen in 20 frames becomes one incident instead of 20.
  3. Keep the clearest sighting of each defect (highest confidence) with a cropped photo.
  4. If a GPS track was given, place each defect on the map and merge defects of the
     same type that are within MERGE_RADIUS_M of each other.
"""

from __future__ import annotations

import base64
import time
from dataclasses import dataclass, field
from typing import Callable

import cv2
import numpy as np

from .damage import priority_score, severity_for, to_damage_type
from .gps import GpsTrack, distance_m

# Tuned with scripts/evaluate.py on real dashcam clips: potholes are mostly detected while
# still far ahead (small boxes, 20-35% confidence) and hidden under the hood up close.
# Off-the-shelf trackers (ByteTrack) drop those brief, small sightings, so we link boxes ourselves.
SAMPLE_FPS = 10              # frames per second sent to the model
MIN_CONFIDENCE = 0.2         # ignore weaker detections
MIN_FRAMES = 2               # normally a defect must appear in at least this many frames...
SINGLE_SIGHTING_CONF = 0.45  # ...unless one sighting is at least this confident
JOIN_GAP_S = 0.6             # a box links to a same-type defect last seen this recently...
JOIN_DISTANCE = 0.15         # ...if it overlaps it or its center is this close (fraction of frame)
MAX_SPAN_S = 3.0             # start a new defect after this long (long cracks along the road)
MERGE_RADIUS_M = 8.0         # with GPS: same-type defects closer than this are one incident
FULL_SIZE_AREA = 0.04        # a box covering 4% of the frame counts as "very large"
PREVIEW_EVERY_S = 0.7        # how often to refresh the live preview image

ProgressFn = Callable[[dict], None]


@dataclass
class Options:
    track: bool = True        # link the same defect across frames (False: every box is its own incident)
    sample_fps: float = SAMPLE_FPS
    min_confidence: float = MIN_CONFIDENCE


@dataclass
class Sighting:
    frame: int
    seconds: float
    confidence: float
    bbox: list[float]  # x1, y1, x2, y2 as fractions of the frame (0-1)
    area: float        # box area as a fraction of the frame


@dataclass
class Defect:
    damage_type: str
    sightings: list[Sighting] = field(default_factory=list)
    best: Sighting | None = None
    thumbnail: str | None = None  # JPEG data URL of the best sighting
    lat: float | None = None
    lng: float | None = None

    def add(self, s: Sighting, frame_img: np.ndarray) -> None:
        self.sightings.append(s)
        if self.best is None or s.confidence > self.best.confidence:
            self.best = s
            self.thumbnail = crop_thumbnail(frame_img, s.bbox)


def jpeg_data_url(img: np.ndarray, max_width: int, quality: int = 80) -> str:
    h, w = img.shape[:2]
    if w > max_width:
        img = cv2.resize(img, (max_width, round(h * max_width / w)), interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode() if ok else ""


def crop_thumbnail(img: np.ndarray, bbox: list[float]) -> str:
    """Crop around the defect with some surrounding road for context."""
    h, w = img.shape[:2]
    x1, y1, x2, y2 = bbox[0] * w, bbox[1] * h, bbox[2] * w, bbox[3] * h
    pad_x, pad_y = (x2 - x1) * 0.6 + 20, (y2 - y1) * 0.6 + 20
    cx1, cy1 = int(max(0, x1 - pad_x)), int(max(0, y1 - pad_y))
    cx2, cy2 = int(min(w, x2 + pad_x)), int(min(h, y2 + pad_y))
    crop = img[cy1:cy2, cx1:cx2].copy()
    # Outline the defect inside the crop.
    cv2.rectangle(crop, (int(x1 - cx1), int(y1 - cy1)), (int(x2 - cx1), int(y2 - cy1)), (214, 63, 91), 2)
    return jpeg_data_url(crop, 360)


def draw_preview(img: np.ndarray, boxes: list[tuple[list[float], str, float]]) -> str:
    """Small frame with labeled boxes, shown live on the Analyze page."""
    out = img.copy()
    h, w = out.shape[:2]
    for bbox, label, conf in boxes:
        p1 = (int(bbox[0] * w), int(bbox[1] * h))
        p2 = (int(bbox[2] * w), int(bbox[3] * h))
        cv2.rectangle(out, p1, p2, (255, 123, 157), 3)
        text = f"{label} {conf:.2f}"
        (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
        cv2.rectangle(out, (p1[0], p1[1] - th - 10), (p1[0] + tw + 8, p1[1]), (214, 63, 91), -1)
        cv2.putText(out, text, (p1[0] + 4, p1[1] - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    return jpeg_data_url(out, 640, 70)


def _center(bbox: list[float]) -> tuple[float, float]:
    return (bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2


def _overlaps(a: list[float], b: list[float]) -> bool:
    return min(a[2], b[2]) > max(a[0], b[0]) and min(a[3], b[3]) > max(a[1], b[1])


def find_link(defects: list[Defect], dtype: str, s: Sighting, taken: set[int]) -> Defect | None:
    """The defect this sighting continues, or None if it's a new one.

    Candidates: same type, last seen within JOIN_GAP_S, not older than MAX_SPAN_S, not already
    given a box in this frame, and overlapping or close on screen. The nearest one wins.
    """
    sx, sy = _center(s.bbox)
    best, best_dist = None, float("inf")
    for d in defects:
        if id(d) in taken or d.damage_type != dtype:
            continue
        last = d.sightings[-1]
        if not (0 < s.seconds - last.seconds <= JOIN_GAP_S) or s.seconds - d.sightings[0].seconds > MAX_SPAN_S:
            continue
        lx, ly = _center(last.bbox)
        dist = ((sx - lx) ** 2 + (sy - ly) ** 2) ** 0.5
        if (dist <= JOIN_DISTANCE or _overlaps(s.bbox, last.bbox)) and dist < best_dist:
            best, best_dist = d, dist
    return best


def merge_nearby(defects: list[Defect]) -> list[Defect]:
    """Merge same-type defects within MERGE_RADIUS_M (only those with a GPS position)."""
    merged: list[Defect] = []
    for d in sorted(defects, key=lambda d: d.best.confidence if d.best else 0, reverse=True):
        twin = None
        if d.lat is not None:
            twin = next(
                (m for m in merged if m.damage_type == d.damage_type and m.lat is not None
                 and distance_m(m.lat, m.lng, d.lat, d.lng) <= MERGE_RADIUS_M),  # type: ignore[arg-type]
                None,
            )
        if twin:
            twin.sightings.extend(d.sightings)  # keep the more confident one as the photo
        else:
            merged.append(d)
    return merged


def analyze_video(path: str, model, device: str, gps: GpsTrack | None, opts: Options, report: ProgressFn) -> dict:
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise ValueError("Could not open the video. Try MP4 (H.264) or MOV.")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    stride = max(1, round(fps / opts.sample_fps))
    names: dict[int, str] = model.names

    defects: list[Defect] = []
    raw_detections = 0
    frames_done = 0
    last_preview = 0.0
    frame_idx = -1

    report({"step": 0, "frames_total": total_frames})

    while True:
        ok = cap.grab()
        if not ok:
            break
        frame_idx += 1
        if frame_idx % stride:
            continue
        ok, img = cap.retrieve()
        if not ok:
            break

        seconds = frame_idx / fps
        h, w = img.shape[:2]
        res = model.predict(img, conf=opts.min_confidence, device=device, verbose=False)[0]

        frame_boxes: list[tuple[list[float], str, float]] = []
        taken: set[int] = set()  # defects that already got a box in this frame
        boxes = res.boxes
        if boxes is not None and len(boxes):
            # Most confident boxes pick their defect first.
            for xyxy, conf, cls in sorted(
                zip(boxes.xyxy.tolist(), boxes.conf.tolist(), boxes.cls.int().tolist()), key=lambda b: -b[1]
            ):
                dtype = to_damage_type(names.get(cls, str(cls)))
                if dtype is None:
                    continue
                raw_detections += 1
                bbox = [xyxy[0] / w, xyxy[1] / h, xyxy[2] / w, xyxy[3] / h]
                area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
                sighting = Sighting(frame_idx, seconds, float(conf), bbox, area)
                defect = find_link(defects, dtype, sighting, taken) if opts.track else None
                if defect is None:
                    defect = Defect(dtype)
                    defects.append(defect)
                defect.add(sighting, img)
                taken.add(id(defect))
                frame_boxes.append((bbox, dtype.capitalize(), float(conf)))

        frames_done += 1
        update = {
            "step": 1,
            "frames_done": frame_idx + 1,
            "frames_total": total_frames,
            "detections": raw_detections,
            "unique": len(defects),
        }
        now = time.monotonic()
        if now - last_preview >= PREVIEW_EVERY_S:
            update["preview"] = draw_preview(img, frame_boxes)
            last_preview = now
        report(update)

    cap.release()
    report({"step": 2})

    # Drop flickers: defects seen in fewer than MIN_FRAMES frames, unless that sighting was confident.
    kept = [d for d in defects if len(d.sightings) >= MIN_FRAMES or (d.best and d.best.confidence >= SINGLE_SIGHTING_CONF)]

    if gps:
        for d in kept:
            d.lat, d.lng = gps.position_at(d.best.seconds)  # type: ignore[union-attr]
        kept = merge_nearby(kept)

    report({"step": 4})

    incidents = []
    for d in kept:
        b = d.best
        assert b is not None
        size = min(1.0, max(s.area for s in d.sightings) / FULL_SIZE_AREA)
        score = priority_score(d.damage_type, b.confidence, size)
        incidents.append({
            "type": d.damage_type,
            "confidence": round(b.confidence, 3),
            "video_time": round(b.seconds, 2),
            "frame": b.frame,
            "frames_seen": len(d.sightings),
            "bbox": [round(v, 4) for v in b.bbox],
            "size": round(size, 3),
            "priority": score,
            "severity": severity_for(score),
            "lat": d.lat,
            "lng": d.lng,
            "thumbnail": d.thumbnail,
        })
    incidents.sort(key=lambda i: i["priority"], reverse=True)

    return {
        "video": {
            "duration_s": round(total_frames / fps, 1) if total_frames else None,
            "fps": round(fps, 2),
            "frames_total": total_frames,
            "frames_analyzed": frames_done,
        },
        "has_gps": gps is not None,
        "detections_total": raw_detections,
        "duplicates_removed": max(0, raw_detections - len(incidents)),
        "incidents": incidents,
    }
