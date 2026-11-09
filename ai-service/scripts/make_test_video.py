"""Build a test video of real potholes for trying the pipeline without dashcam footage.

Downloads road photos from the keremberke/pothole-segmentation dataset on Hugging Face
(open source, from Roboflow Universe) and turns each into 2 seconds of video that slowly
zooms in, like driving up to the pothole.

Usage:
    .venv/bin/python scripts/make_test_video.py --count 24 --out ../test-data/pothole-test.mp4

Then make a matching GPS track (length = count x 2 seconds):
    .venv/bin/python scripts/make_demo_gpx.py --seconds 48 \
        --points 30.2620,-97.7452 30.2747,-97.7404 --out ../test-data/pothole-test.gpx
"""

import argparse
import json
import urllib.request
from pathlib import Path

import cv2
import numpy as np

ROWS_API = (
    "https://datasets-server.huggingface.co/rows?dataset=keremberke/pothole-segmentation"
    "&config=full&split=train&offset={offset}&length=20"
)
FPS = 30
SECONDS_PER_PHOTO = 2
SIZE = (960, 720)  # width, height
MAX_ZOOM = 1.18


def fetch_photos(count: int) -> list[np.ndarray]:
    photos: list[np.ndarray] = []
    offset = 0
    while len(photos) < count and offset < 80:
        rows = json.load(urllib.request.urlopen(ROWS_API.format(offset=offset)))["rows"]
        for row in rows:
            data = urllib.request.urlopen(row["row"]["image"]["src"]).read()
            img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
            if img is not None:
                photos.append(img)
            if len(photos) >= count:
                break
        offset += 20
    return photos


def frame_for(photo: np.ndarray, zoom: float) -> np.ndarray:
    """Zoom toward the lower middle of the photo, fitted into the video frame."""
    h, w = photo.shape[:2]
    cw, ch = int(w / zoom), int(h / zoom)
    x0 = (w - cw) // 2
    y0 = int((h - ch) * 0.75)  # drift down, toward the road just ahead
    view = cv2.resize(photo[y0:y0 + ch, x0:x0 + cw], (SIZE[1], SIZE[1]))
    # Square photo in a wider frame: fill the sides with a blurred copy.
    background = cv2.GaussianBlur(cv2.resize(view, SIZE), (0, 0), 25)
    left = (SIZE[0] - SIZE[1]) // 2
    background[:, left:left + SIZE[1]] = view
    return background


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--count", type=int, default=24, help="number of photos (max 80)")
    parser.add_argument("--out", default="pothole-test.mp4")
    args = parser.parse_args()

    photos = fetch_photos(args.count)
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    writer = cv2.VideoWriter(args.out, cv2.VideoWriter_fourcc(*"avc1"), FPS, SIZE)
    if not writer.isOpened():  # H.264 unavailable: fall back to MPEG-4
        writer = cv2.VideoWriter(args.out, cv2.VideoWriter_fourcc(*"mp4v"), FPS, SIZE)

    frames_per_photo = FPS * SECONDS_PER_PHOTO
    for photo in photos:
        for i in range(frames_per_photo):
            writer.write(frame_for(photo, 1 + (MAX_ZOOM - 1) * i / frames_per_photo))
    writer.release()
    print(f"Wrote {args.out}: {len(photos)} photos, {len(photos) * SECONDS_PER_PHOTO} seconds")


if __name__ == "__main__":
    main()
