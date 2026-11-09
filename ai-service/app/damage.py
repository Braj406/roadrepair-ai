"""Damage classes and the repair priority formula.

Model class names vary between datasets, so we map them to the app's four damage types.
The priority formula mirrors `priorityScore` in src/lib/data.ts so both sides agree.
"""

from __future__ import annotations

import re

# App damage types, matching the DamageType union in the web app.
POTHOLE = "pothole"
ALLIGATOR = "alligator"
LONGITUDINAL = "longitudinal"
TRANSVERSE = "transverse"

# Model class name (lowercased) -> app damage type. Covers RDD2022 codes and common plain names.
CLASS_MAP: dict[str, str] = {
    "d00": LONGITUDINAL,
    "d10": TRANSVERSE,
    "d20": ALLIGATOR,
    "d40": POTHOLE,
    "longitudinal": LONGITUDINAL,
    "longitudinal crack": LONGITUDINAL,
    "longitudinal_crack": LONGITUDINAL,
    "transverse": TRANSVERSE,
    "transverse crack": TRANSVERSE,
    "transverse_crack": TRANSVERSE,
    "alligator": ALLIGATOR,
    "alligator crack": ALLIGATOR,
    "alligator_crack": ALLIGATOR,
    "pothole": POTHOLE,
    "potholes": POTHOLE,
}

TYPE_WEIGHT = {POTHOLE: 1.0, ALLIGATOR: 0.85, TRANSVERSE: 0.55, LONGITUDINAL: 0.5}


RDD_CODE = re.compile(r"\bd(00|10|20|40)\b")


def to_damage_type(class_name: str) -> str | None:
    """Return the app damage type for a model class name, or None to ignore that class.

    Handles plain names ("pothole"), bare codes ("D40") and mixed names such as
    "Pothole (D40)" or "D00_Longitudinal".
    """
    name = class_name.strip().lower()
    if name in CLASS_MAP:
        return CLASS_MAP[name]
    code = RDD_CODE.search(name.replace("_", " "))
    if code:
        return CLASS_MAP[f"d{code.group(1)}"]
    return None


def priority_score(damage_type: str, confidence: float, size: float, times_seen: int = 1, change_pct: float = 0) -> int:
    """0-100 repair priority.

    size: 0-1, how big the damage looks (1 = very large).
    times_seen: number of trips it was seen on.
    change_pct: how much its area grew since the previous trip.
    """
    size = min(1.0, max(0.0, size))
    repeat = min(1.0, times_seen / 4)
    worse = min(1.0, max(0.0, change_pct) / 60)
    raw = TYPE_WEIGHT[damage_type] * (0.35 + 0.65 * confidence) * (0.15 + 0.4 * size + 0.2 * repeat + 0.25 * worse)
    return round(min(100.0, raw * 100))


def severity_for(score: int) -> str:
    if score >= 45:
        return "high"
    if score >= 28:
        return "medium"
    return "low"
