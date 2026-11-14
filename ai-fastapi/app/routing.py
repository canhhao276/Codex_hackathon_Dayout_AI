"""OSRM free routing with a never-fail Haversine fallback."""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass

from .config import OSRM_BASE_URL, OSRM_TIMEOUT
from .geo import est_travel, haversine_km
from .http import get_client

log = logging.getLogger("dayout.routing")

# OSRM public demo uses car speeds without live traffic; Hanoi motorbike traffic is slower.
TRAFFIC_FACTOR = 1.3
MAX_POLYLINE_POINTS = 400


@dataclass
class RouteResult:
    polyline: list[list[float]]  # [[lat, lng], ...]
    legs: list[tuple[float, int]]  # (km, minutes) for each consecutive pair of points
    source: str  # "osrm" | "fallback"

    @property
    def total_km(self) -> float:
        return round(sum(k for k, _ in self.legs), 1)

    @property
    def total_minutes(self) -> int:
        return int(sum(m for _, m in self.legs))


_cache: dict[tuple, RouteResult] = {}


def _downsample(points: list[list[float]]) -> list[list[float]]:
    if len(points) <= MAX_POLYLINE_POINTS:
        return points
    step = math.ceil(len(points) / MAX_POLYLINE_POINTS)
    out = points[::step]
    if out[-1] != points[-1]:
        out.append(points[-1])
    return out


def fallback_route(points: list[tuple[float, float]]) -> RouteResult:
    legs = []
    for (a_lat, a_lng), (b_lat, b_lng) in zip(points, points[1:]):
        km, minutes = est_travel(haversine_km(a_lat, a_lng, b_lat, b_lng))
        legs.append((round(km, 2), minutes))
    return RouteResult([[round(lat, 6), round(lng, 6)] for lat, lng in points], legs, "fallback")


async def route(points: list[tuple[float, float]], timeout: float | None = None) -> RouteResult:
    if len(points) < 2:
        return RouteResult([[lat, lng] for lat, lng in points], [], "fallback")
    key = tuple((round(lat, 5), round(lng, 5)) for lat, lng in points)
    if key in _cache:
        return _cache[key]
    coords = ";".join(f"{lng:.6f},{lat:.6f}" for lat, lng in points)
    url = f"{OSRM_BASE_URL}/route/v1/driving/{coords}"
    try:
        resp = await get_client().get(
            url,
            params={"overview": "full", "geometries": "geojson", "steps": "false"},
            timeout=timeout or OSRM_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("code") != "Ok" or not data.get("routes"):
            raise ValueError(f"OSRM code={data.get('code')}")
        r = data["routes"][0]
        poly = [[round(lat, 6), round(lng, 6)] for lng, lat in r["geometry"]["coordinates"]]
        legs = [
            (round(leg["distance"] / 1000.0, 2), max(1, int(math.ceil(leg["duration"] * TRAFFIC_FACTOR / 60))))
            for leg in r["legs"]
        ]
        if len(legs) != len(points) - 1:
            raise ValueError("OSRM leg count mismatch")
        result = RouteResult(_downsample(poly), legs, "osrm")
    except Exception as exc:
        log.warning("OSRM unavailable (%s) -> fallback straight-line route", exc)
        return fallback_route(points)
    if len(_cache) > 256:
        _cache.clear()
    _cache[key] = result
    return result
