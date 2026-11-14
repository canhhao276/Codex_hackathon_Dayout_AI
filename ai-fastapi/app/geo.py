"""Small geo / time helpers."""
from __future__ import annotations

import math

# Generous bounding box around Hanoi's urban districts.
HANOI_BBOX = (20.85, 21.25, 105.65, 106.05)  # min_lat, max_lat, min_lng, max_lng


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def in_hanoi(lat: float, lng: float) -> bool:
    min_lat, max_lat, min_lng, max_lng = HANOI_BBOX
    return min_lat <= lat <= max_lat and min_lng <= lng <= max_lng


def hm_to_min(value: str, default: int = 14 * 60) -> int:
    try:
        h, m = str(value).strip().split(":")[:2]
        return max(0, min(24 * 60 - 1, int(h) * 60 + int(m)))
    except (ValueError, AttributeError):
        return default


def min_to_hm(minutes: int) -> str:
    minutes = int(round(minutes)) % (24 * 60)
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def round_up(value: float, step: int = 5) -> int:
    return int(math.ceil(value / step) * step)


def est_travel(km_straight: float) -> tuple[float, int]:
    """Fallback road estimate: straight line * 1.25, motorbike ~18 km/h in city traffic."""
    road_km = km_straight * 1.25
    minutes = max(1, int(math.ceil(road_km / 18.0 * 60)))
    return road_km, minutes
