"""POI data: curated Hanoi dataset + OpenStreetMap Overpass fallback for any city."""
from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Iterable, Optional

from .config import DATA_DIR, OVERPASS_TIMEOUT, OVERPASS_URL
from .geo import haversine_km, hm_to_min, in_hanoi
from .http import get_client

log = logging.getLogger("dayout.pois")

OVERPASS_MIRRORS = ("https://overpass.kumi.systems/api/interpreter",)

CATEGORIES = ("cafe", "activity", "food", "dessert_chill")
FOOD_LIKE = ("food", "cafe", "dessert_chill")

VIBE_CATEGORIES = {
    "chill_cafe": {"cafe"},
    "interactive_activity": {"activity"},
    "local_food": {"food"},
    "photo_spot": set(),  # matched via the POI's own vibes, any category
    "night_chill": {"dessert_chill"},
}
VIBE_LABELS = {
    "chill_cafe": "Cafe chill",
    "interactive_activity": "Hoạt động tương tác",
    "local_food": "Ẩm thực địa phương",
    "photo_spot": "Góc chụp ảnh đẹp",
    "night_chill": "Chill buổi tối",
}
GOALS = ("balanced", "eat_clean", "high_protein", "low_sugar")
GOAL_LABELS = {
    "balanced": "Cân bằng",
    "eat_clean": "Eat Clean",
    "high_protein": "Giàu Protein",
    "low_sugar": "Ít đường",
}


@dataclass
class PlanContext:
    origin_lat: float
    origin_lng: float
    origin_label: str
    budget_pp: int
    people: int
    vibes: list[str]
    goal: str
    start_min: int
    end_min: int
    note: str = ""
    extra_pois: list[dict] = field(default_factory=list)  # Overpass results outside Hanoi
    remote: bool = False  # origin is outside Hanoi -> only live OSM data is valid

    @property
    def window_minutes(self) -> int:
        return max(60, self.end_min - self.start_min)


def normalize_goal(goal: Optional[str]) -> str:
    g = (goal or "balanced").strip().lower().replace("-", "_").replace(" ", "_")
    return g if g in GOALS else "balanced"


def normalize_vibes(vibes: Optional[Iterable[str]]) -> list[str]:
    out: list[str] = []
    for v in vibes or []:
        key = str(v).strip().lower()
        if key in VIBE_CATEGORIES and key not in out:
            out.append(key)
    return out


@lru_cache(maxsize=1)
def load_pois() -> tuple[dict, ...]:
    with open(DATA_DIR / "hanoi_pois.json", encoding="utf-8") as f:
        data = json.load(f)
    return tuple(data)


@lru_cache(maxsize=1)
def poi_index() -> dict[str, dict]:
    return {p["id"]: p for p in load_pois()}


def is_open_during(poi: dict, start_min: int, end_min: int, need: int = 45) -> bool:
    o = hm_to_min(poi.get("open_time", "00:00"), 0)
    c = hm_to_min(poi.get("close_time", "23:59"), 24 * 60 - 1)
    if c <= o:  # closes after midnight
        c = 24 * 60 - 1
    overlap = min(c, end_min) - max(o, start_min)
    return overlap >= min(need, max(1, end_min - start_min))


def poi_score(poi: dict, ctx: PlanContext, ref_lat: float, ref_lng: float, per_stop_budget: float) -> float:
    d = haversine_km(ref_lat, ref_lng, poi["lat"], poi["lng"])
    score = -1.0 * d
    pvibes = set(poi.get("vibes", []))
    for v in ctx.vibes:
        if v in pvibes:
            score += 2.5
        if poi["category"] in VIBE_CATEGORIES.get(v, set()):
            score += 1.5
    tags = set(poi.get("nutrition_tags", []))
    if poi["category"] in FOOD_LIKE:
        if ctx.goal in tags:
            score += 2.5
        if ctx.goal in ("eat_clean", "low_sugar") and "indulgent" in tags:
            score -= 2.5
        if ctx.goal == "balanced" and "balanced" in tags:
            score += 1.0
    cost = poi.get("estimated_cost_vnd", 0)
    if per_stop_budget > 0 and cost > per_stop_budget * 1.6:
        score -= 3.0
    if not is_open_during(poi, ctx.start_min, ctx.end_min):
        score -= 6.0
    return score


def pool_for(ctx: PlanContext) -> list[dict]:
    if ctx.remote:
        return ctx.extra_pois
    return list(load_pois())


def select_candidates(
    ctx: PlanContext,
    ref_lat: float,
    ref_lng: float,
    k: int = 20,
    exclude_ids: Iterable[str] = (),
    allow: Optional[callable] = None,
    min_per_category: int = 3,
) -> list[dict]:
    """Haversine radius filter (expanding) + scoring, with category coverage."""
    excluded = set(exclude_ids)
    pool = [p for p in pool_for(ctx) if p["id"] not in excluded and (allow is None or allow(p))]
    if not pool:
        return []
    per_stop_budget = ctx.budget_pp / 3 if ctx.budget_pp else 0
    needed = {p["category"] for p in pool}  # every role that exists must be reachable
    in_radius: list[dict] = pool
    for radius in (3, 5, 8, 12, 25):
        in_radius = [p for p in pool if haversine_km(ref_lat, ref_lng, p["lat"], p["lng"]) <= radius]
        cats = {p["category"] for p in in_radius}
        if len(in_radius) >= k and cats >= needed:
            break
    else:
        in_radius = pool
    ranked = sorted(in_radius, key=lambda p: poi_score(p, ctx, ref_lat, ref_lng, per_stop_budget), reverse=True)

    chosen: list[dict] = []
    for cat in CATEGORIES:  # guarantee coverage so the LLM has real choices per role
        quota = min_per_category + (1 if cat == "food" else 0)
        chosen.extend([p for p in ranked if p["category"] == cat][:quota])
    for p in ranked:
        if len(chosen) >= k:
            break
        if p not in chosen:
            chosen.append(p)
    return chosen


# ---------------- Overpass (global coverage) ----------------
_OVERPASS_DEFAULTS = {
    "cafe": ("cafe", True, 60000, 150, ["chill_cafe"], ["Đồ uống signature của quán"]),
    "restaurant": ("food", True, 150000, 650, ["local_food"], ["Món đặc trưng của quán"]),
    "fast_food": ("food", True, 90000, 750, ["local_food"], ["Combo phổ biến"]),
    "ice_cream": ("dessert_chill", True, 40000, 200, ["night_chill"], ["Kem / tráng miệng"]),
    "bar": ("dessert_chill", True, 150000, 250, ["night_chill"], ["Đồ uống & nhạc"]),
    "pub": ("dessert_chill", True, 150000, 300, ["night_chill"], ["Đồ uống & nhạc"]),
    "cinema": ("activity", True, 120000, 0, ["interactive_activity", "night_chill"], ["Vé xem phim"]),
    "museum": ("activity", True, 80000, 0, ["interactive_activity", "photo_spot"], ["Tham quan triển lãm"]),
    "gallery": ("activity", True, 50000, 0, ["interactive_activity", "photo_spot"], ["Xem triển lãm"]),
    "attraction": ("activity", False, 0, 0, ["photo_spot"], ["Tham quan & chụp ảnh"]),
    "park": ("activity", False, 0, 0, ["photo_spot"], ["Đi dạo & chụp ảnh"]),
    "bowling_alley": ("activity", True, 150000, 0, ["interactive_activity"], ["Chơi bowling"]),
    "escape_game": ("activity", True, 180000, 0, ["interactive_activity"], ["Phòng thoát hiểm"]),
}
_overpass_cache: dict[tuple, list[dict]] = {}


def _overpass_to_poi(el: dict) -> Optional[dict]:
    tags = el.get("tags", {})
    name = tags.get("name:vi") or tags.get("name") or tags.get("name:en")
    if not name:
        return None
    kind = tags.get("amenity") or tags.get("tourism") or tags.get("leisure")
    if kind not in _OVERPASS_DEFAULTS:
        return None
    lat = el.get("lat") or (el.get("center") or {}).get("lat")
    lng = el.get("lon") or (el.get("center") or {}).get("lon")
    if lat is None or lng is None:
        return None
    category, indoor, cost, kcal, vibes, items = _OVERPASS_DEFAULTS[kind]
    cuisine = (tags.get("cuisine") or "").replace(";", ", ")
    ntags: list[str] = []
    if category in FOOD_LIKE:
        ntags.append("balanced")
        if any(x in cuisine for x in ("vegetarian", "vegan", "salad", "healthy")):
            ntags = ["eat_clean", "vegetarian", "low_sugar", "balanced"]
            kcal = min(kcal, 500)
    street = " ".join(x for x in (tags.get("addr:housenumber"), tags.get("addr:street")) if x)
    city = tags.get("addr:city", "")
    address = ", ".join(x for x in (street, city) if x) or "Gần vị trí của bạn (OpenStreetMap)"
    return {
        "id": f"osm_{el.get('type', 'n')[0]}{el.get('id')}",
        "name": name,
        "category": category,
        "address": address,
        "district": city,
        "lat": float(lat),
        "lng": float(lng),
        "indoor": indoor,
        "estimated_cost_vnd": cost,
        "recommended_items": [f"Món {cuisine}"] if cuisine and category == "food" else items,
        "estimated_calories_kcal": kcal,
        "nutrition_tags": ntags,
        "vibes": vibes,
        "open_time": "00:00",
        "close_time": "23:59",
        "source": "osm",
    }


async def fetch_overpass_pois(lat: float, lng: float, radius_m: int = 2500) -> list[dict]:
    key = (round(lat, 3), round(lng, 3), radius_m)
    if key in _overpass_cache:
        return _overpass_cache[key]
    q = f"""[out:json][timeout:3];
(
  node["amenity"~"^(cafe|restaurant|fast_food|ice_cream|bar|pub|cinema)$"]["name"](around:{radius_m},{lat},{lng});
  node["tourism"~"^(museum|gallery|attraction)$"]["name"](around:{radius_m},{lat},{lng});
  nwr["leisure"~"^(park|bowling_alley|escape_game)$"]["name"](around:{radius_m},{lat},{lng});
);
out center 150;"""
    async def ask(url: str) -> list[dict]:
        resp = await get_client().post(url, data={"data": q}, timeout=OVERPASS_TIMEOUT)
        resp.raise_for_status()
        return resp.json().get("elements", [])

    # Race the main server against a public mirror; first good answer wins (all within ~2.5s).
    urls = list(dict.fromkeys([OVERPASS_URL, *OVERPASS_MIRRORS]))
    tasks = [asyncio.create_task(ask(u)) for u in urls]
    elements: list[dict] = []
    try:
        for fut in asyncio.as_completed(tasks, timeout=OVERPASS_TIMEOUT + 0.5):
            try:
                elements = await fut
                if elements:
                    break
            except asyncio.TimeoutError:
                raise
            except Exception as exc:  # network / overload
                log.warning("Overpass mirror failed: %r", exc)
    except asyncio.TimeoutError:
        log.warning("Overpass timed out after %.1fs", OVERPASS_TIMEOUT + 0.5)
    finally:
        for t in tasks:
            t.cancel()
    if not elements:
        return []
    pois = [p for p in (_overpass_to_poi(e) for e in elements) if p]
    seen: set[str] = set()
    unique = []
    for p in pois:
        if p["name"] not in seen:
            seen.add(p["name"])
            unique.append(p)
    _overpass_cache[key] = unique
    return unique


async def prepare_pool(ctx: PlanContext) -> None:
    """Outside Hanoi -> load live OSM POIs so the engine works in any city."""
    if not in_hanoi(ctx.origin_lat, ctx.origin_lng):
        ctx.remote = True
        ctx.extra_pois = await fetch_overpass_pois(ctx.origin_lat, ctx.origin_lng)


def poi_from_stop(stop: dict) -> dict:
    """Rebuild a POI-like dict from an itinerary stop (enriched from the dataset when possible)."""
    base = dict(poi_index().get(stop.get("stop_id", ""), {}))
    base.update(
        {
            "id": stop.get("stop_id") or base.get("id") or f"stop_{stop.get('order', 0)}",
            "name": stop.get("name") or base.get("name", ""),
            "category": stop.get("category") or base.get("category", "activity"),
            "address": stop.get("address") or base.get("address", ""),
            "lat": float(stop.get("lat", base.get("lat", 0.0))),
            "lng": float(stop.get("lng", base.get("lng", 0.0))),
            "indoor": bool(stop.get("indoor", base.get("indoor", False))),
            "estimated_cost_vnd": int(stop.get("estimated_cost_vnd", base.get("estimated_cost_vnd", 0)) or 0),
            "estimated_calories_kcal": int(
                stop.get("estimated_calories_kcal", base.get("estimated_calories_kcal", 0)) or 0
            ),
        }
    )
    base.setdefault("nutrition_tags", [])
    base.setdefault("vibes", [])
    base.setdefault("recommended_items", stop.get("recommended_items", []))
    return base
