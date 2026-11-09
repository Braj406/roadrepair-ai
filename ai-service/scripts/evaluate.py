"""Measure how accurate the road damage model is.

1. Photos with known answers (default):
   Runs the model on pothole photos from keremberke/pothole-segmentation (Hugging Face),
   where every pothole was boxed by hand, and reports:
     - found:  share of real potholes the model detected (recall)
     - right:  share of the model's pothole boxes that were real potholes (precision)
   at several confidence cut-offs. Also saves a picture: green = real pothole,
   pink = model's answer.

2. Videos (--video PATH [PATH ...]):
   Compares what the model sees frame by frame with what survives tracking and
   de-duplication, to show whether low counts come from the model or from the filters.

Usage:
    .venv/bin/python scripts/evaluate.py
    .venv/bin/python scripts/evaluate.py --video ../test-data/clip1.mp4 ../test-data/clip2.mp4

Results go to ../test-data/eval/ (report.txt and .jpg sheets).
"""

from __future__ import annotations

import argparse
import base64
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.damage import POTHOLE, to_damage_type  # noqa: E402
from app.pipeline import MIN_CONFIDENCE, MIN_FRAMES, SAMPLE_FPS, SINGLE_SIGHTING_CONF, Options, analyze_video  # noqa: E402

SERVICE_DIR = Path(__file__).resolve().parent.parent
OUT_DIR = SERVICE_DIR.parent / "test-data" / "eval"
PHOTO_CACHE = SERVICE_DIR.parent / "test-data" / "labeled-photos"  # downloaded once
ROWS_API = "https://datasets-server.huggingface.co/rows?dataset=keremberke/pothole-segmentation&config=full&split={split}&offset={offset}&length=100"
THRESHOLDS = [0.1, 0.15, 0.25, 0.4, 0.5]
IOU_MATCH = 0.3  # boxes overlapping this much count as the same pothole
GREEN, PINK = (80, 200, 80), (157, 63, 214)


def iou(a: list[float], b: list[float]) -> float:
    """Overlap of two x1,y1,x2,y2 boxes, 0-1."""
    ix = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / union if union else 0.0


def download(url: str, tries: int = 4) -> bytes:
    """Fetch a URL, retrying on the server errors Hugging Face sometimes returns."""
    for attempt in range(tries):
        try:
            return urllib.request.urlopen(url, timeout=30).read()
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
            if attempt == tries - 1:
                raise RuntimeError(f"Couldn't download test photos ({exc}). Try again in a minute.") from exc
            time.sleep(2 * (attempt + 1))
    raise AssertionError("unreachable")


def cache_labeled_photos() -> None:
    """Download all labeled photos once into PHOTO_CACHE (images + labels.json)."""
    PHOTO_CACHE.mkdir(parents=True, exist_ok=True)
    labels = {}
    for split in ("train", "validation", "test"):
        rows = json.loads(download(ROWS_API.format(split=split, offset=0)))["rows"]
        for r in rows:
            row = r["row"]
            name = f"{split}-{r['row_idx']:03d}.jpg"
            (PHOTO_CACHE / name).write_bytes(download(row["image"]["src"]))
            labels[name] = [[x, y, x + w, y + h] for x, y, w, h in row["objects"]["bbox"]]  # COCO x,y,w,h -> x1,y1,x2,y2
    (PHOTO_CACHE / "labels.json").write_text(json.dumps(labels))


def fetch_labeled_photos(limit: int) -> list[tuple[np.ndarray, list[list[float]]]]:
    if not (PHOTO_CACHE / "labels.json").exists():
        print("Downloading labeled test photos (first run only)…")
        cache_labeled_photos()
    labels = json.loads((PHOTO_CACHE / "labels.json").read_text())
    return [(cv2.imread(str(PHOTO_CACHE / name)), truth) for name, truth in list(labels.items())[:limit]]


def predictions(model, img: np.ndarray, device: str) -> list[tuple[list[float], str, float]]:
    res = model.predict(img, conf=min(THRESHOLDS), device=device, verbose=False)[0]
    out = []
    for xyxy, conf, cls in zip(res.boxes.xyxy.tolist(), res.boxes.conf.tolist(), res.boxes.cls.int().tolist()):
        dtype = to_damage_type(model.names[cls])
        if dtype:
            out.append((xyxy, dtype, float(conf)))
    return out


def score(results: list[tuple[list[list[float]], list[tuple[list[float], str, float]]]], cut: float) -> dict:
    found = total_truth = right = total_pred = other_type = 0
    for truth, preds in results:
        kept = [p for p in preds if p[2] >= cut]
        potholes = [p for p in kept if p[1] == POTHOLE]
        total_truth += len(truth)
        total_pred += len(potholes)
        found += sum(any(iou(t, p[0]) >= IOU_MATCH for p in potholes) for t in truth)
        right += sum(any(iou(t, p[0]) >= IOU_MATCH for t in truth) for p in potholes)
        other_type += sum(1 for p in kept if p[1] != POTHOLE and any(iou(t, p[0]) >= IOU_MATCH for t in truth))
    return {
        "found": found / total_truth if total_truth else 0,
        "right": right / total_pred if total_pred else 0,
        "boxes": total_pred,
        "truth": total_truth,
        "other_type": other_type,
    }


def draw(img: np.ndarray, truth: list[list[float]], preds: list[tuple[list[float], str, float]], cut: float) -> np.ndarray:
    out = img.copy()
    for t in truth:
        cv2.rectangle(out, (int(t[0]), int(t[1])), (int(t[2]), int(t[3])), GREEN, 3)
    for box, dtype, conf in preds:
        if conf < cut:
            continue
        p1, p2 = (int(box[0]), int(box[1])), (int(box[2]), int(box[3]))
        cv2.rectangle(out, p1, p2, PINK, 2)
        cv2.putText(out, f"{dtype[:4]} {conf:.2f}", (p1[0] + 3, max(16, p1[1] - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, PINK, 2)
    return cv2.resize(out, (240, 240))


def sheet(tiles: list[np.ndarray], per_row: int = 6) -> np.ndarray:
    blank = np.zeros_like(tiles[0])
    tiles = tiles + [blank] * (-len(tiles) % per_row)
    return np.vstack([np.hstack(tiles[i:i + per_row]) for i in range(0, len(tiles), per_row)])


def evaluate_photos(model, device: str, limit: int) -> list[str]:
    photos = fetch_labeled_photos(limit)
    results = []
    tiles = []
    for img, truth in photos:
        preds = predictions(model, img, device)
        results.append((truth, preds))
        if len(tiles) < 36:
            tiles.append(draw(img, truth, preds, MIN_CONFIDENCE))
    cv2.imwrite(str(OUT_DIR / "photos.jpg"), sheet(tiles))

    lines = [f"PHOTOS: {len(photos)} photos, {sum(len(t) for t, _ in results)} hand-labeled potholes", ""]
    lines.append("confidence  found (recall)  right (precision)  pothole boxes  labeled as other damage")
    for cut in THRESHOLDS:
        s = score(results, cut)
        mark = "  <- current setting" if abs(cut - MIN_CONFIDENCE) < 1e-9 else ""
        lines.append(f"  >= {cut:.2f}      {s['found']:6.0%}          {s['right']:6.0%}            {s['boxes']:4d}           {s['other_type']:3d}{mark}")
    confs = [p[2] for _, preds in results for p in preds if p[1] == POTHOLE]
    if confs:
        lines.append("")
        lines.append(f"pothole confidence: median {np.median(confs):.2f}, highest {max(confs):.2f}")
    lines.append(f"picture: {OUT_DIR / 'photos.jpg'}  (green = real pothole, pink = model)")
    return lines


def evaluate_video(model, device: str, path: str) -> list[str]:
    # Raw view: every analyzed frame, no tracking or filtering.
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    stride = max(1, round(fps / SAMPLE_FPS))
    frames = frames_with = 0
    by_type: dict[str, int] = {}
    confs: list[float] = []
    flagged: list[tuple[bool, float, np.ndarray]] = []  # (has pothole, best confidence, drawn frame)
    idx = -1
    while cap.grab():
        idx += 1
        if idx % stride:
            continue
        ok, img = cap.retrieve()
        if not ok:
            break
        frames += 1
        preds = [p for p in predictions(model, img, device) if p[2] >= MIN_CONFIDENCE]
        frames_with += bool(preds)
        for _, dtype, conf in preds:
            by_type[dtype] = by_type.get(dtype, 0) + 1
            confs.append(conf)
        if preds:
            tile = draw(img, [], preds, MIN_CONFIDENCE)
            cv2.putText(tile, f"{idx / fps:.1f}s", (6, 230), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            flagged.append((any(p[1] == POTHOLE for p in preds), max(p[2] for p in preds), tile))
    cap.release()
    # Save the flagged frames, potholes first, most confident first.
    flagged.sort(key=lambda f: (f[0], f[1]), reverse=True)
    if flagged:
        cv2.imwrite(str(OUT_DIR / f"{Path(path).stem}-frames.jpg"), sheet([t for _, _, t in flagged[:24]]))

    # The real pipeline, as the app runs it.
    model.predictor = None
    result = analyze_video(path, model, device, None, Options(), lambda _u: None)
    thumbs = []
    for inc in result["incidents"][:24]:
        data = inc["thumbnail"].split(",", 1)[1] if inc["thumbnail"] else None
        if data:
            img = cv2.imdecode(np.frombuffer(base64.b64decode(data), np.uint8), cv2.IMREAD_COLOR)
            tile = cv2.resize(img, (240, 180))
            cv2.putText(tile, f"{inc['type'][:5]} {inc['confidence']:.2f}", (6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            thumbs.append(tile)
    if thumbs:
        cv2.imwrite(str(OUT_DIR / f"{Path(path).stem}-incidents.jpg"), sheet(thumbs, 4))

    return [
        f"VIDEO: {Path(path).name} ({result['video']['duration_s']} s, {frames} frames analyzed at {SAMPLE_FPS}/s)",
        "",
        "What the model sees (every analyzed frame, no filtering):",
        f"  picture: {OUT_DIR / (Path(path).stem + '-frames.jpg')}",
        f"  frames with any damage: {frames_with} of {frames}",
        f"  boxes by type: {by_type or 'none'}",
        f"  confidence: median {np.median(confs):.2f}, highest {max(confs):.2f}" if confs else "  confidence: n/a",
        "",
        f"What the app reports (linked; {MIN_FRAMES}+ frames, or 1 frame at {SINGLE_SIGHTING_CONF}+ confidence):",
        f"  incidents: {len(result['incidents'])}  "
        + str({t: sum(1 for i in result['incidents'] if i['type'] == t) for t in {i['type'] for i in result['incidents']}}),
        f"  picture: {OUT_DIR / (Path(path).stem + '-incidents.jpg')}" if thumbs else "  (no incidents to show)",
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--video", nargs="*", default=[], help="also check these videos")
    parser.add_argument("--photos", type=int, default=90, help="number of labeled photos to test (max 90)")
    parser.add_argument("--model", default=str(SERVICE_DIR / "models" / "road-damage.pt"))
    args = parser.parse_args()

    import torch
    from ultralytics import YOLO

    device = "mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu")
    model = YOLO(args.model)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    def save(lines: list[str]) -> None:
        (OUT_DIR / "report.txt").write_text("\n".join(lines) + "\n")

    lines = evaluate_photos(model, device, args.photos)
    save(lines)  # keep the photo results even if a video fails
    print("\n".join(lines))

    for video in args.video:
        path = Path(video).expanduser()
        try:
            section = evaluate_video(model, device, str(path))
        except ValueError:
            section = [
                f"VIDEO: {path.name} could not be opened.",
                "If it's in Downloads, Desktop or Documents, macOS may be blocking Terminal from reading it:",
                "copy it into roadrepair-ai/test-data/ and try again.",
            ]
        section = ["", "-" * 60, ""] + section
        lines += section
        save(lines)
        print("\n".join(section))

    print(f"\nSaved to {OUT_DIR / 'report.txt'}")


if __name__ == "__main__":
    main()
