"""Make a GPS track (GPX) for a video that has none, so its defects can be shown on the map.

Give two or more points along a street and the video length; the track moves between them
at a steady speed, one point per second. Coordinates are "latitude,longitude"
(right-click a spot in Google Maps to copy them).

Example: a 60-second drive along Congress Ave, Austin
    .venv/bin/python scripts/make_demo_gpx.py --seconds 60 \
        --points 30.2620,-97.7452 30.2747,-97.7404 --out congress.gpx

Only for demos: a made-up track places defects approximately, not where they really are.
"""

import argparse
from datetime import datetime, timedelta, timezone
from pathlib import Path


def parse_point(text: str) -> tuple[float, float]:
    lat, lng = (float(v) for v in text.split(","))
    return lat, lng


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--points", nargs="+", type=parse_point, required=True, help="lat,lng waypoints in driving order")
    parser.add_argument("--seconds", type=float, required=True, help="length of the video in seconds")
    parser.add_argument("--out", default="demo-track.gpx")
    args = parser.parse_args()

    pts = args.points if len(args.points) > 1 else args.points * 2
    legs = len(pts) - 1
    start = datetime.now(timezone.utc).replace(microsecond=0)
    lines = []
    for s in range(int(args.seconds) + 1):
        # Position along the whole route (0-1), then within the current leg.
        t = s / args.seconds * legs
        leg = min(int(t), legs - 1)
        f = t - leg
        (lat1, lng1), (lat2, lng2) = pts[leg], pts[leg + 1]
        lat, lng = lat1 + (lat2 - lat1) * f, lng1 + (lng2 - lng1) * f
        when = (start + timedelta(seconds=s)).isoformat().replace("+00:00", "Z")
        lines.append(f'      <trkpt lat="{lat:.6f}" lon="{lng:.6f}"><time>{when}</time></trkpt>')

    gpx = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<gpx version="1.1" creator="RoadRepair AI demo" xmlns="http://www.topografix.com/GPX/1/1">\n'
        "  <trk><name>Demo track</name><trkseg>\n" + "\n".join(lines) + "\n  </trkseg></trk>\n</gpx>\n"
    )
    Path(args.out).write_text(gpx)
    print(f"Wrote {len(lines)} points to {args.out}")


if __name__ == "__main__":
    main()
