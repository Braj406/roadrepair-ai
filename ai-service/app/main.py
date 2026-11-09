"""RoadRepair AI video service (FastAPI).

  GET  /health         model status
  POST /jobs           upload a video (+ optional GPS file), returns a job id
  GET  /jobs/{job_id}  progress, live preview and, when done, the incidents found

Videos are processed one at a time in a background thread and deleted afterwards.
Results are kept in memory only; the web app saves them to Supabase as the signed-in user.
"""

from __future__ import annotations

import os
import tempfile
import threading
import time
import uuid
from pathlib import Path

import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

from .gps import GpsTrack, parse_track
from .pipeline import Options, analyze_video

SERVICE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = Path(os.environ.get("MODEL_PATH", SERVICE_DIR / "models" / "road-damage.pt"))
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
MAX_UPLOAD_BYTES = 2 * 1024**3  # 2 GB
JOB_TTL_S = 60 * 60             # forget finished jobs after an hour

STEPS = [
    "Extracting video frames",
    "Detecting road damage",
    "Tracking and merging duplicates",
    "Comparing with past trips",
    "Generating repair report",
]

DEVICE = "mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu")

app = FastAPI(title="RoadRepair AI service")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["*"], allow_headers=["*"])

_model: YOLO | None = None
_model_error: str | None = None
_gpu_lock = threading.Lock()  # one video at a time
_jobs: dict[str, dict] = {}


def get_model() -> YOLO:
    global _model, _model_error
    if _model is None:
        if not MODEL_PATH.exists():
            _model_error = f"No model file at {MODEL_PATH}. See ai-service/README.md."
            raise RuntimeError(_model_error)
        _model = YOLO(str(MODEL_PATH))
        _model_error = None
    return _model


def _cleanup_old_jobs() -> None:
    cutoff = time.time() - JOB_TTL_S
    for job_id in [j for j, v in _jobs.items() if v.get("finished_at", time.time()) < cutoff]:
        _jobs.pop(job_id, None)


def _run_job(job_id: str, video_path: str, gps: GpsTrack | None, opts: Options) -> None:
    job = _jobs[job_id]

    def report(update: dict) -> None:
        job.update(update)
        total = job.get("frames_total") or 0
        frac = (job.get("frames_done", 0) / total) if total else 0
        # Detection is most of the work: 2% -> 92%, then merging and the report.
        job["progress"] = {0: 2, 1: 2 + 90 * frac, 2: 94, 4: 98}.get(job["step"], job.get("progress", 0))

    try:
        with _gpu_lock:
            job["status"] = "processing"
            model = get_model()
            result = analyze_video(video_path, model, DEVICE, gps, opts, report)
        job.update(status="completed", progress=100, step=len(STEPS), result=result)
    except Exception as exc:  # report any failure to the browser instead of crashing the thread
        job.update(status="failed", error=str(exc))
    finally:
        job["finished_at"] = time.time()
        Path(video_path).unlink(missing_ok=True)


@app.get("/health")
def health() -> dict:
    loaded = _model is not None
    if not loaded and MODEL_PATH.exists():
        try:
            get_model()
            loaded = True
        except Exception as exc:  # broken model file
            return {"ok": False, "model_loaded": False, "error": str(exc), "device": DEVICE}
    return {
        "ok": loaded,
        "model_loaded": loaded,
        "model_file": MODEL_PATH.name,
        "classes": list(_model.names.values()) if _model else [],
        "device": DEVICE,
        "error": None if loaded else f"No model file at {MODEL_PATH.name}. See ai-service/README.md.",
    }


@app.post("/jobs")
async def create_job(
    video: UploadFile = File(...),
    gps: UploadFile | None = File(None),
    track: bool = Form(True),
) -> dict:
    _cleanup_old_jobs()
    if not MODEL_PATH.exists():
        raise HTTPException(503, "The AI model isn't installed yet. See ai-service/README.md.")

    track_data = None
    if gps is not None and gps.filename:
        try:
            track_data = parse_track(gps.filename, await gps.read())
        except Exception as exc:
            raise HTTPException(400, f"Couldn't read the GPS file: {exc}") from exc

    # Stream the upload to a temp file so large videos don't fill memory.
    suffix = Path(video.filename or "video.mp4").suffix or ".mp4"
    fd, video_path = tempfile.mkstemp(prefix="rr_", suffix=suffix)
    size = 0
    with os.fdopen(fd, "wb") as out:
        while chunk := await video.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                out.close()
                Path(video_path).unlink(missing_ok=True)
                raise HTTPException(413, "Video is over 2 GB.")
            out.write(chunk)

    job_id = uuid.uuid4().hex[:12]
    _jobs[job_id] = {
        "id": job_id,
        "status": "queued",
        "filename": video.filename,
        "step": 0,
        "steps": STEPS,
        "progress": 0,
        "created_at": time.time(),
    }
    threading.Thread(target=_run_job, args=(job_id, video_path, track_data, Options(track=track)), daemon=True).start()
    return {"id": job_id}


@app.get("/jobs/{job_id}")
def get_job(job_id: str) -> dict:
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found (it may have expired).")
    return job
