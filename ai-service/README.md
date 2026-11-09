# RoadRepair AI – video service

Python service that finds road damage in dashcam video. The web app uploads a video here,
shows live progress, then saves the results to Supabase as the signed-in user.

**How it works:** keeps 5 frames per second → YOLO detects potholes and cracks → each box is
linked to the same defect in earlier frames so it is counted once → keeps the clearest photo of each →
optional GPS file places each defect on the map and merges same-type defects within 8 m.

## Set up (once)

Needs Python 3.11+. Runs on the Mac GPU (Apple Silicon), an NVIDIA GPU, or CPU.

```bash
cd ai-service
python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/download_model.py
```

The model file goes to `models/road-damage.pt` (not committed to git). To use your own
trained model, put it there or set `MODEL_PATH=/path/to/model.pt`.

## Run

```bash
cd ai-service
.venv/bin/uvicorn app.main:app --port 8000
```

Check it at http://localhost:8000/health. The web app looks for it at `http://localhost:8000`
(change with `NEXT_PUBLIC_AI_SERVICE_URL` in the web app's `.env.local`).

## API

| Method | Path | What it does |
|---|---|---|
| GET | `/health` | Is the model loaded, which classes, which device |
| POST | `/jobs` | Form upload: `video` (required), `gps` (optional GPX or CSV `seconds,lat,lng`), `track` (true/false) |
| GET | `/jobs/{id}` | Status, progress %, current step, live preview image, and results when done |

## Files

| File | Purpose |
|---|---|
| `app/main.py` | Web API and background job runner |
| `app/pipeline.py` | Video → detections → tracked, de-duplicated incidents |
| `app/gps.py` | Read GPX/CSV tracks, position at a video time, distances |
| `app/damage.py` | Model class names → app damage types, priority formula |
| `scripts/download_model.py` | Downloads the model from Hugging Face |

## Tuning

Constants at the top of `app/pipeline.py`: frames per second analyzed, minimum confidence,
how many frames a defect must appear in (or how confident a single sighting must be), and the
GPS merge radius.

Measure the effect of a change with:

```bash
.venv/bin/python scripts/evaluate.py --video ../test-data/your-clip.mp4
```

It scores the model on 90 hand-labeled pothole photos, then shows what the model sees in each
video frame versus what the app keeps, with pictures in `../test-data/eval/`.

## No GPS file? Make a demo one

Stock dashcam videos usually have no GPS. To place a video's defects on a street for a demo:

```bash
.venv/bin/python scripts/make_demo_gpx.py --seconds 60 --points 30.2620,-97.7452 30.2747,-97.7404 --out congress.gpx
```

Use the video's length in seconds and two or more `lat,lng` points along the street
(right-click in Google Maps to copy them). Upload the `.gpx` file next to the video.
