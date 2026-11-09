"""GPS tracks: read a GPX or CSV file and look up the position at any moment of the video.

We assume the GPS track starts when the video starts. Most dashcams record both at once,
so this is close enough for a first version.
"""

from __future__ import annotations

import csv
import io
import math
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime


@dataclass
class TrackPoint:
    seconds: float  # seconds since the first point
    lat: float
    lng: float


class GpsTrack:
    def __init__(self, points: list[TrackPoint]):
        if len(points) < 1:
            raise ValueError("GPS file has no points")
        self.points = sorted(points, key=lambda p: p.seconds)

    def position_at(self, seconds: float) -> tuple[float, float]:
        """Latitude and longitude at a moment in the video, interpolated between points."""
        pts = self.points
        if seconds <= pts[0].seconds:
            return pts[0].lat, pts[0].lng
        if seconds >= pts[-1].seconds:
            return pts[-1].lat, pts[-1].lng
        for a, b in zip(pts, pts[1:]):
            if a.seconds <= seconds <= b.seconds:
                span = b.seconds - a.seconds or 1.0
                t = (seconds - a.seconds) / span
                return a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t
        return pts[-1].lat, pts[-1].lng


def _parse_time(text: str) -> datetime:
    return datetime.fromisoformat(text.strip().replace("Z", "+00:00"))


def parse_gpx(data: bytes) -> GpsTrack:
    root = ET.fromstring(data)
    raw: list[tuple[datetime | None, float, float]] = []
    # Accept any GPX namespace by matching on the tag's local name.
    for el in root.iter():
        if el.tag.split("}")[-1] in ("trkpt", "rtept", "wpt"):
            when = next((c.text for c in el if c.tag.split("}")[-1] == "time" and c.text), None)
            raw.append((_parse_time(when) if when else None, float(el.attrib["lat"]), float(el.attrib["lon"])))
    if not raw:
        raise ValueError("No track points found in GPX file")
    if all(t is not None for t, _, _ in raw):
        start = raw[0][0]
        return GpsTrack([TrackPoint((t - start).total_seconds(), lat, lng) for t, lat, lng in raw])  # type: ignore[operator]
    # No timestamps: assume one point per second.
    return GpsTrack([TrackPoint(float(i), lat, lng) for i, (_, lat, lng) in enumerate(raw)])


def parse_csv(data: bytes) -> GpsTrack:
    """CSV with columns seconds,lat,lng (header row optional)."""
    points: list[TrackPoint] = []
    for row in csv.reader(io.StringIO(data.decode("utf-8", errors="ignore"))):
        try:
            points.append(TrackPoint(float(row[0]), float(row[1]), float(row[2])))
        except (ValueError, IndexError):
            continue  # header or blank line
    return GpsTrack(points)


def parse_track(filename: str, data: bytes) -> GpsTrack:
    if filename.lower().endswith(".csv"):
        return parse_csv(data)
    return parse_gpx(data)


def distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distance in meters between two coordinates (haversine)."""
    r = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))
