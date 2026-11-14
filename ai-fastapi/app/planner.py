"""Itinerary engine: candidate filter -> OpenAI pick -> spatial ordering -> OSRM -> ItineraryResponse."""
from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass
from datetime import datetime
from itertools import permutations
from typing import Callable, Optional

from . import llm, routing
from .config import (
    GENERATE_DEADLINE,
    OPENAI_TIMEOUT_GENERATE,
    OPENAI_TIMEOUT_REPLAN,
    OSRM_TIMEOUT,
    REPLAN_DEADLINE,
)
from .geo import est_travel, haversine_km, hm_to_min, min_to_hm, round_up
from .models import GenerateRequest, ItineraryResponse, ReplanRequest
from .pois import (
    FOOD_LIKE,
    GOAL_LABELS,
    GOALS,
    VIBE_CATEGORIES,
    VIBE_LABELS,
    PlanContext,
    is_open_during,
    normalize_goal,
    normalize_vibes,
    poi_from_stop,
    poi_score,
    pool_for,
    prepare_pool,
    select_candidates,
)

log = logging.getLogger("dayout.planner")

DURATION = {"cafe": 75, "activity": 90, "food": 60, "dessert_chill": 50}
MEALS = [(11 * 60, 13 * 60 + 30), (17 * 60 + 30, 20 * 60 + 30)]
KCAL_LIMIT = {"eat_clean": 1100, "low_sugar": 1200, "balanced": 1400, "high_protein": 1600}
RELATED = {  # acceptable substitute categories when swapping a stop
    "activity": ("activity", "cafe", "dessert_chill"),
    "cafe": ("cafe", "dessert_chill"),
    "dessert_chill": ("dessert_chill", "cafe"),
    "food": ("food",),
}


class NoPlacesError(RuntimeError):
    pass


@dataclass
class PlannedStop:
    poi: dict
    recommended_items: list[str]
    ai_reason: str
    nutrition_note: str
    duration: int
    # Template reasons are re-rendered after routing so the quoted distance is the real leg.
    auto_reason: bool = False
    why: Optional[str] = None

    @property
    def category(self) -> str:
        return self.poi.get("category", "activity")

    @property
    def cost(self) -> int:
        return int(self.poi.get("estimated_cost_vnd", 0) or 0)

    @property
    def kcal(self) -> int:
        return int(self.poi.get("estimated_calories_kcal", 0) or 0)


# ---------------- text helpers (used when the LLM is unavailable) ----------------
def fallback_note(poi: dict) -> str:
    tags = set(poi.get("nutrition_tags", []))
    if poi.get("category") == "activity":
        return "Vận động nhẹ, không nạp thêm calo"
    if "eat_clean" in tags or "vegetarian" in tags:
        return "Nhiều rau xanh, ít dầu mỡ"
    if "high_protein" in tags:
        return "Giàu đạm, no lâu"
    if "low_sugar" in tags:
        return "Ít đường, năng lượng nhẹ"
    if "indulgent" in tags:
        return "Ngon nhưng nhiều năng lượng, dùng vừa phải"
    return "Năng lượng vừa phải"


def fallback_reason(
    ctx: PlanContext, poi: dict, prev: tuple[float, float], why: str | None = None, dist_km: float | None = None
) -> str:
    parts: list[str] = [why] if why else []
    matched = [
        VIBE_LABELS[v]
        for v in ctx.vibes
        if v in poi.get("vibes", []) or poi.get("category") in VIBE_CATEGORIES.get(v, set())
    ]
    if matched:
        parts.append(f"hợp vibe {matched[0].lower()}")
    if poi.get("category") in FOOD_LIKE and ctx.goal in poi.get("nutrition_tags", []):
        parts.append(f"chuẩn {GOAL_LABELS[ctx.goal]}")
    d = dist_km if dist_km is not None else haversine_km(prev[0], prev[1], poi["lat"], poi["lng"])
    parts.append(f"cách điểm trước {d:.1f}km")
    cost = poi.get("estimated_cost_vnd", 0)
    parts.append(f"~{cost // 1000}k/người" if cost else "miễn phí")
    text = ", ".join(parts)
    return text[:1].upper() + text[1:]


def fallback_title(ctx: PlanContext, planned: list[PlannedStop]) -> str:
    part = "Sáng" if ctx.start_min < 11 * 60 else ("Chiều" if ctx.start_min < 17 * 60 else "Tối")
    districts = [p.poi.get("district") for p in planned if p.poi.get("district")]
    area = max(set(districts), key=districts.count) if districts else "Hà Nội"
    vibe = VIBE_LABELS.get(ctx.vibes[0], "Chill") if ctx.vibes else "Chill"
    return f"{part} {area}: {vibe} & {GOAL_LABELS[ctx.goal]}"


def fallback_highlight(planned: list[PlannedStop]) -> str:
    tags = {t for p in planned for t in p.poi.get("nutrition_tags", [])}
    bits = []
    if "high_protein" in tags:
        bits.append("giàu đạm")
    if "eat_clean" in tags or "vegetarian" in tags:
        bits.append("nhiều rau xanh")
    if "low_sugar" in tags:
        bits.append("ít đường")
    text = ", ".join(bits[:2]) or "năng lượng vừa phải"
    return text[:1].upper() + text[1:]


def nutrition_badge(goal: str, planned: list[PlannedStop], highlight: str) -> str:
    """Deterministic compliance prefix (facts) + short AI highlight (wording)."""
    eats = [p for p in planned if p.category in FOOD_LIKE]
    total = sum(p.kcal for p in planned)
    has_goal = goal == "balanced" or any(goal in p.poi.get("nutrition_tags", []) for p in eats)
    bad = goal in ("eat_clean", "low_sugar") and any("indulgent" in p.poi.get("nutrition_tags", []) for p in eats)
    ok = has_goal and not bad and total <= KCAL_LIMIT.get(goal, 1400)
    prefix = f"{'Đạt chuẩn' if ok else 'Gần chuẩn'} {GOAL_LABELS.get(goal, 'Cân bằng')}"
    highlight = (highlight or "").strip()
    return f"{prefix} • {highlight}" if highlight else prefix


def infer_goal(badge: str) -> str:
    low = (badge or "").lower()
    for g in ("eat_clean", "high_protein", "low_sugar", "balanced"):
        if f"chuẩn {GOAL_LABELS[g].lower()}" in low:
            return g
    if "eat clean" in low:
        return "eat_clean"
    return "balanced"


# ---------------- selection ----------------
def n_stops_for(ctx: PlanContext) -> int:
    return 4 if ctx.window_minutes >= 330 else 3


def plan_slots(ctx: PlanContext, n: int) -> list[str]:
    cats: list[str] = []
    for v in ctx.vibes:
        for c in sorted(VIBE_CATEGORIES.get(v, set())):
            if c not in cats:
                cats.append(c)
    if "photo_spot" in ctx.vibes and "activity" not in cats:
        cats.append("activity")
    if "food" not in cats:
        cats.insert(min(1, len(cats)), "food")
    for c in ("activity", "cafe", "dessert_chill"):
        if len(cats) >= n:
            break
        if c not in cats:
            cats.append(c)
    while len(cats) < n:
        cats.append("activity")
    while len(cats) > n:
        drop = next(i for i in range(len(cats) - 1, -1, -1) if cats[i] != "food")
        cats.pop(drop)
    return cats


def make_stop(ctx: PlanContext, poi: dict, prev: tuple[float, float], why: str | None = None, duration: int | None = None) -> PlannedStop:
    return PlannedStop(
        poi=poi,
        recommended_items=list(poi.get("recommended_items", []))[:2],
        ai_reason=fallback_reason(ctx, poi, prev, why),
        nutrition_note=fallback_note(poi),
        duration=duration or DURATION.get(poi.get("category"), 60),
        auto_reason=True,
        why=why,
    )


def _crowding(p: dict, chosen: list[dict]) -> int:
    """How many already-chosen stops sit in the same building/block (<300m) — keeps plans varied."""
    return sum(1 for c in chosen if haversine_km(c["lat"], c["lng"], p["lat"], p["lng"]) < 0.3)


def heuristic_pick(ctx: PlanContext, candidates: list[dict], n: int, chosen: Optional[list[dict]] = None) -> list[dict]:
    chosen = list(chosen or [])
    slots = plan_slots(ctx, n)
    for p in chosen:  # slots already covered by the AI's picks
        if p["category"] in slots:
            slots.remove(p["category"])
    slots = slots[: max(0, n - len(chosen))]
    ref = (chosen[-1]["lat"], chosen[-1]["lng"]) if chosen else (ctx.origin_lat, ctx.origin_lng)
    spent = sum(p.get("estimated_cost_vnd", 0) for p in chosen)
    per_stop = ctx.budget_pp / max(1, n)
    for i, cat in enumerate(slots):
        pool = [p for p in candidates if p not in chosen and p["category"] == cat]
        if not pool:  # widen to the whole dataset for this role before giving up on variety
            pool = [
                p for p in pool_for(ctx)
                if p not in chosen and p["category"] == cat and haversine_km(ref[0], ref[1], p["lat"], p["lng"]) <= 10
            ]
        if not pool:
            continue
        reserve = sum(
            min((p.get("estimated_cost_vnd", 0) for p in candidates if p["category"] == c), default=0)
            for c in slots[i + 1 :]
        )
        cap = ctx.budget_pp - spent - reserve
        affordable = [p for p in pool if p.get("estimated_cost_vnd", 0) <= cap] or sorted(
            pool, key=lambda p: p.get("estimated_cost_vnd", 0)
        )[:1]
        best = max(affordable, key=lambda p: poi_score(p, ctx, ref[0], ref[1], per_stop) - 2.0 * _crowding(p, chosen))
        chosen.append(best)
        spent += best.get("estimated_cost_vnd", 0)
        ref = (best["lat"], best["lng"])
    return chosen


def budget_repair(ctx: PlanContext, planned: list[PlannedStop], why: str = "Vừa ngân sách hơn") -> list[PlannedStop]:
    planned = list(planned)
    pool = pool_for(ctx)
    per_stop = ctx.budget_pp / max(1, len(planned))
    for _ in range(len(planned) + 1):
        total = sum(p.cost for p in planned)
        if total <= ctx.budget_pp:
            break
        over = total - ctx.budget_pp
        used = {p.poi["id"] for p in planned}
        swapped = False
        for idx in sorted(range(len(planned)), key=lambda i: planned[i].cost, reverse=True):
            old = planned[idx]
            alts = [
                p
                for p in pool
                if p["id"] not in used
                and p["category"] in RELATED.get(old.category, (old.category,))
                and p.get("estimated_cost_vnd", 0) < old.cost
                and haversine_km(old.poi["lat"], old.poi["lng"], p["lat"], p["lng"]) <= 6
            ]
            if not alts:
                continue
            same = [p for p in alts if p["category"] == old.category] or alts
            fit = [p for p in same if p.get("estimated_cost_vnd", 0) <= old.cost - over] or same
            new = max(fit, key=lambda p: poi_score(p, ctx, old.poi["lat"], old.poi["lng"], per_stop))
            prev = (planned[idx - 1].poi["lat"], planned[idx - 1].poi["lng"]) if idx else (ctx.origin_lat, ctx.origin_lng)
            planned[idx] = make_stop(ctx, new, prev, why, duration=old.duration)
            swapped = True
            break
        if not swapped:
            break
    return planned


# ---------------- spatial ordering & scheduling ----------------
def _overlaps_meal(start: int, end: int) -> bool:
    return any(min(end, b) - max(start, a) >= 45 for a, b in MEALS)


def order_cost(ctx: PlanContext, seq: tuple[PlannedStop, ...]) -> float:
    t = ctx.start_min
    lat, lng = ctx.origin_lat, ctx.origin_lng
    km_total, penalty = 0.0, 0.0
    meal_matters = _overlaps_meal(ctx.start_min, ctx.end_min)
    for i, s in enumerate(seq):
        km, minutes = est_travel(haversine_km(lat, lng, s.poi["lat"], s.poi["lng"]))
        km_total += km
        t += minutes
        if s.category == "food" and meal_matters and not any(a - 30 <= t <= b for a, b in MEALS):
            penalty += 3.0
        if not is_open_during(s.poi, t, t + s.duration, need=min(s.duration, 45)):
            penalty += 4.0
        if s.category == "dessert_chill" and any(x.category == "food" for x in seq[i + 1 :]):
            penalty += 1.5
        if i and seq[i - 1].category == s.category:
            penalty += 1.0
        t += s.duration
        lat, lng = s.poi["lat"], s.poi["lng"]
    return km_total + penalty


def best_order(ctx: PlanContext, planned: list[PlannedStop]) -> list[PlannedStop]:
    if len(planned) <= 1:
        return planned
    return list(min(permutations(planned), key=lambda seq: order_cost(ctx, seq)))


def schedule(planned: list[PlannedStop], legs: list[tuple[float, int]], first_start: int, end_min: int) -> list[tuple[int, int]]:
    between = sum(m for _, m in legs[1:])
    total_dur = sum(p.duration for p in planned) or 1
    available = end_min - first_start - between
    scale = max(0.6, min(1.25, available / total_dur)) if available > 0 else 0.6
    times: list[tuple[int, int]] = []
    t = first_start
    for i, p in enumerate(planned):
        dur = max(30, int(round(p.duration * scale / 5.0)) * 5)
        start, end = t, min(t + dur, 24 * 60 - 1)
        times.append((start, end))
        if i + 1 < len(legs):
            t = round_up(end + legs[i + 1][1], 5)
    return times


def build_response(
    ctx: PlanContext,
    planned: list[PlannedStop],
    route: routing.RouteResult,
    title: str,
    highlight: str,
    itinerary_id: str,
    share_url: str,
    first_start: int,
    end_min: int,
) -> dict:
    times = schedule(planned, route.legs, first_start, end_min)
    stops = []
    for i, (p, (start, end)) in enumerate(zip(planned, times)):
        nxt_km, nxt_min = route.legs[i + 1] if i + 1 < len(route.legs) else (0.0, 0)
        poi = p.poi
        if p.auto_reason:
            leg_km = route.legs[i][0] if i < len(route.legs) else None
            p.ai_reason = fallback_reason(ctx, poi, (0.0, 0.0), p.why, dist_km=leg_km)
        stops.append(
            {
                "order": i + 1,
                "stop_id": poi["id"],
                "start_time": min_to_hm(start),
                "end_time": min_to_hm(end),
                "name": poi["name"],
                "category": poi.get("category", "activity"),
                "address": poi.get("address", ""),
                "lat": round(float(poi["lat"]), 6),
                "lng": round(float(poi["lng"]), 6),
                "indoor": bool(poi.get("indoor", False)),
                "recommended_items": p.recommended_items or list(poi.get("recommended_items", []))[:2],
                "estimated_cost_vnd": p.cost,
                "estimated_calories_kcal": p.kcal,
                "nutrition_note": p.nutrition_note or fallback_note(poi),
                "ai_reason": p.ai_reason,
                "distance_to_next_km": round(float(nxt_km), 1),
                "travel_to_next_minutes": int(nxt_min),
            }
        )
    summary = {
        "title": title,
        "total_cost_per_person_vnd": sum(p.cost for p in planned),
        "budget_per_person_vnd": int(ctx.budget_pp),
        "total_calories_kcal": sum(p.kcal for p in planned),
        "nutrition_badge": nutrition_badge(ctx.goal, planned, highlight),
        "total_distance_km": route.total_km,
        "total_travel_minutes": route.total_minutes,
    }
    resp = {
        "itinerary_id": itinerary_id,
        "share_url": share_url or "",
        "summary": summary,
        "route_polyline": route.polyline,
        "stops": stops,
    }
    return ItineraryResponse.model_validate(resp).model_dump()


def new_itinerary_id() -> str:
    return f"itin_{datetime.now().strftime('%Y%m%d')}_{uuid.uuid4().hex[:6]}"


def _clean_items(items: list, poi: dict) -> list[str]:
    out = [str(x).strip() for x in (items or []) if str(x).strip()][:3]
    return out or list(poi.get("recommended_items", []))[:2]


# ---------------- /ai/generate ----------------
async def generate(req: GenerateRequest) -> tuple[dict, str]:
    t0 = time.monotonic()
    start_min = hm_to_min(req.time_window.start, 14 * 60)
    end_min = hm_to_min(req.time_window.end, 21 * 60)
    if end_min <= start_min + 60:
        end_min = min(24 * 60 - 1, start_min + 5 * 60)
    ctx = PlanContext(
        origin_lat=req.origin.lat,
        origin_lng=req.origin.lng,
        origin_label=req.origin.label,
        budget_pp=int(req.budget_vnd),
        people=int(req.people_count),
        vibes=normalize_vibes(req.vibes),
        goal=normalize_goal(req.nutrition_goal),
        start_min=start_min,
        end_min=end_min,
        note=(req.prompt_note or "")[:300],
    )
    await prepare_pool(ctx)
    candidates = select_candidates(ctx, ctx.origin_lat, ctx.origin_lng, k=20)
    if len(candidates) < 2:
        raise NoPlacesError("Không tìm thấy đủ địa điểm quanh vị trí này. Hãy thử lại hoặc chọn khu vực khác.")
    n = min(n_stops_for(ctx), len(candidates))
    by_id = {p["id"]: p for p in candidates}

    ai = await llm.choose_stops(ctx, candidates, n, timeout=OPENAI_TIMEOUT_GENERATE)
    planned: list[PlannedStop] = []
    engine = "heuristic"
    if ai:
        prev = (ctx.origin_lat, ctx.origin_lng)
        for s in ai.get("stops", []):
            poi = by_id.get(s.get("poi_id"))
            if not poi or any(p.poi["id"] == poi["id"] for p in planned):
                continue
            planned.append(
                PlannedStop(
                    poi=poi,
                    recommended_items=_clean_items(s.get("recommended_items"), poi),
                    ai_reason=(s.get("ai_reason") or "").strip(),
                    auto_reason=not (s.get("ai_reason") or "").strip(),
                    nutrition_note=(s.get("nutrition_note") or "").strip() or fallback_note(poi),
                    duration=DURATION.get(poi["category"], 60),
                )
            )
            prev = (poi["lat"], poi["lng"])
            if len(planned) >= 4:
                break
        if planned:
            engine = "openai"
    if len(planned) < min(3, n):  # top up deterministically if the model under-delivered
        picks = heuristic_pick(ctx, candidates, n, chosen=[p.poi for p in planned])
        prev = (ctx.origin_lat, ctx.origin_lng)
        known = {p.poi["id"] for p in planned}
        for poi in picks:
            if poi["id"] not in known:
                planned.append(make_stop(ctx, poi, prev))
            prev = (poi["lat"], poi["lng"])
    planned = budget_repair(ctx, planned)
    planned = best_order(ctx, planned)

    points = [(ctx.origin_lat, ctx.origin_lng)] + [(p.poi["lat"], p.poi["lng"]) for p in planned]
    remaining = GENERATE_DEADLINE - (time.monotonic() - t0)
    route = await routing.route(points, timeout=min(OSRM_TIMEOUT, max(0.8, remaining)))

    title = ((ai or {}).get("title") or "").strip() or fallback_title(ctx, planned)
    highlight = ((ai or {}).get("nutrition_highlight") or "").strip() or fallback_highlight(planned)
    first_leg = min(route.legs[0][1], 90) if route.legs else 0
    first_start = round_up(ctx.start_min + first_leg, 5)
    resp = build_response(ctx, planned, route, title, highlight, new_itinerary_id(), "", first_start, ctx.end_min)
    return resp, f"{engine}+{route.source}"


# ---------------- /ai/replan ----------------
REASON_ALIASES = {
    "rain": "rainy_weather",
    "rainy": "rainy_weather",
    "rainy_weather": "rainy_weather",
    "budget": "tighter_budget",
    "save_budget": "tighter_budget",
    "tighter_budget": "tighter_budget",
    "lower_calories": "lower_calories",
    "low_calories": "lower_calories",
    "crowded": "crowded",
}
REASON_WHY = {
    "rainy_weather": "Trong nhà, tránh mưa",
    "tighter_budget": "Tiết kiệm hơn",
    "lower_calories": "Nhẹ calo hơn",
    "crowded": "Đổi điểm tương đương gần đó",
}


def _pick_targets(reason: str, planned: list[PlannedStop], target_order: Optional[int]) -> list[int]:
    n = len(planned)
    given = target_order - 1 if target_order and 1 <= target_order <= n else None
    if reason == "rainy_weather":
        idxs = [i for i, p in enumerate(planned) if not p.poi.get("indoor", False)]
        if given is not None and given not in idxs:
            idxs.append(given)
        return sorted(idxs)
    if given is not None:
        return [given]
    if reason == "tighter_budget":
        return [max(range(n), key=lambda i: planned[i].cost)]
    if reason == "lower_calories":
        return [max(range(n), key=lambda i: planned[i].kcal)]
    return [0]


_GENERIC_WORDS = {"the", "cafe", "cà", "café", "bún", "phở", "công", "bảo", "nhà", "kem", "chè", "trà", "hồ", "khu", "trung", "di"}


def _brand(name: str) -> str:
    first = (name or "").split(" ")[0].lower()
    return "" if first in _GENERIC_WORDS or len(first) < 4 else first


def _reason_bonus(reason: str, old: PlannedStop, p: dict, extra_allowed: float) -> float:
    bonus = 0.0
    new_cost = p.get("estimated_cost_vnd", 0)
    if new_cost > old.cost + extra_allowed:
        bonus -= 4.0  # a swap must not blow the budget
    if reason == "tighter_budget":
        bonus += (old.cost - new_cost) / 40000.0
    elif reason == "lower_calories":
        bonus += (old.kcal - p.get("estimated_calories_kcal", 0)) / 80.0
    elif reason == "rainy_weather" and p.get("category") == old.category:
        bonus += 2.5  # a park becomes an indoor activity, not yet another cafe
    return bonus


def _fits_plan(p: dict, planned: list[PlannedStop], idx: int) -> float:
    """Penalty for repeating a brand anywhere or a category right next door."""
    penalty = 0.0
    brand = _brand(p.get("name", ""))
    for j, s in enumerate(planned):
        if j == idx:
            continue
        if brand and _brand(s.poi.get("name", "")) == brand:
            penalty -= 3.0
        if abs(j - idx) == 1 and s.category == p.get("category"):
            penalty -= 1.5
    return penalty


def _allow_fn(reason: str, old: PlannedStop, slot: tuple[int, int], strict: bool) -> Callable[[dict], bool]:
    cats = RELATED.get(old.category, (old.category,))

    def allow(p: dict) -> bool:
        if reason == "rainy_weather" and not p.get("indoor", False):
            return False
        if reason == "tighter_budget" and old.cost > 0 and p.get("estimated_cost_vnd", 0) >= old.cost:
            return False
        if reason == "lower_calories" and old.kcal > 0 and p.get("estimated_calories_kcal", 0) >= old.kcal:
            return False
        if strict:
            if p["category"] != old.category and not (reason == "rainy_weather" and p["category"] in cats):
                return False
            if not is_open_during(p, slot[0], slot[1], need=min(45, slot[1] - slot[0])):
                return False
        elif p["category"] not in cats:
            return False
        return True

    return allow


async def replan(req: ReplanRequest) -> tuple[dict, str]:
    t0 = time.monotonic()
    itin = ItineraryResponse.model_validate(req.current_itinerary or {})
    if not itin.stops:
        raise ValueError("current_itinerary.stops trống — cần gửi lại toàn bộ ItineraryResponse hiện tại.")
    stops = sorted(itin.stops, key=lambda s: s.order)
    reason = REASON_ALIASES.get((req.reason or "crowded").strip().lower(), "crowded")

    current_total = sum(s.estimated_cost_vnd for s in stops)
    budget = req.new_budget_vnd or itin.summary.budget_per_person_vnd or current_total
    if reason == "tighter_budget" and not req.new_budget_vnd:
        budget = int(round(min(budget, current_total) * 0.8, -3))

    if req.origin:
        o_lat, o_lng, o_label = req.origin.lat, req.origin.lng, req.origin.label
    elif itin.route_polyline and len(itin.route_polyline[0]) >= 2:
        o_lat, o_lng, o_label = itin.route_polyline[0][0], itin.route_polyline[0][1], "Điểm xuất phát"
    else:
        o_lat, o_lng, o_label = stops[0].lat, stops[0].lng, stops[0].name

    first_start = hm_to_min(stops[0].start_time, 14 * 60)
    end_min = max(hm_to_min(stops[-1].end_time, 21 * 60), first_start + 60)
    ctx = PlanContext(
        origin_lat=o_lat,
        origin_lng=o_lng,
        origin_label=o_label,
        budget_pp=int(budget),
        people=1,
        vibes=normalize_vibes(req.vibes),
        goal=normalize_goal(req.nutrition_goal) if req.nutrition_goal in GOALS else infer_goal(itin.summary.nutrition_badge),
        start_min=first_start,
        end_min=end_min,
    )
    await prepare_pool(ctx)

    planned = [
        PlannedStop(
            poi=poi_from_stop(s.model_dump()),
            recommended_items=list(s.recommended_items),
            ai_reason=s.ai_reason,
            nutrition_note=s.nutrition_note,
            duration=max(30, hm_to_min(s.end_time) - hm_to_min(s.start_time)),
        )
        for s in stops
    ]
    slots = [(hm_to_min(s.start_time), hm_to_min(s.end_time)) for s in stops]
    target_idxs = _pick_targets(reason, planned, req.target_stop_order)

    used = {p.poi["id"] for p in planned}
    targets = []
    slack = max(0, ctx.budget_pp - sum(p.cost for p in planned)) / max(1, len(target_idxs))
    for idx in target_idxs:
        old = planned[idx]
        cands: list[dict] = []
        for strict in (True, False):
            cands = select_candidates(
                ctx, old.poi["lat"], old.poi["lng"], k=14, exclude_ids=used,
                allow=_allow_fn(reason, old, slots[idx], strict), min_per_category=0,
            )
            if cands:
                break
        if cands:
            per_stop = ctx.budget_pp / max(1, len(planned))
            cands.sort(
                key=lambda p: poi_score(p, ctx, old.poi["lat"], old.poi["lng"], per_stop)
                + _reason_bonus(reason, old, p, slack)
                + _fits_plan(p, planned, idx),
                reverse=True,
            )
            targets.append({"order": idx + 1, "idx": idx, "old": old.poi, "candidates": cands[:8]})

    engine = "noop"
    ai = None
    if targets:
        ai = await llm.choose_replacements(
            ctx, reason, [s.model_dump() for s in stops], targets, timeout=OPENAI_TIMEOUT_REPLAN
        )
        ai_by_order = {r.get("target_order"): r for r in (ai or {}).get("replacements", [])}
        engine = "openai" if ai else "heuristic"
        for t in targets:
            idx, old = t["idx"], planned[t["idx"]]
            cand_by_id = {p["id"]: p for p in t["candidates"]}
            r = ai_by_order.get(t["order"])
            prev = (planned[idx - 1].poi["lat"], planned[idx - 1].poi["lng"]) if idx else (ctx.origin_lat, ctx.origin_lng)
            new_poi = cand_by_id.get((r or {}).get("poi_id"))
            if new_poi and new_poi["id"] not in used:
                planned[idx] = PlannedStop(
                    poi=new_poi,
                    recommended_items=_clean_items(r.get("recommended_items"), new_poi),
                    ai_reason=(r.get("ai_reason") or "").strip(),
                    auto_reason=not (r.get("ai_reason") or "").strip(),
                    why=REASON_WHY[reason],
                    nutrition_note=(r.get("nutrition_note") or "").strip() or fallback_note(new_poi),
                    duration=old.duration,
                )
            else:
                fresh = [p for p in t["candidates"] if p["id"] not in used]
                if not fresh:
                    continue
                # re-check against stops swapped earlier in this same replan (e.g. two rainy swaps)
                rank = {p["id"]: i for i, p in enumerate(fresh)}
                best = max(fresh, key=lambda p: _fits_plan(p, planned, idx) - 0.3 * rank[p["id"]])
                planned[idx] = make_stop(ctx, best, prev, REASON_WHY[reason], duration=old.duration)
            used.add(planned[idx].poi["id"])
    if engine != "noop" and sum(p.cost for p in planned) > ctx.budget_pp:
        planned = budget_repair(ctx, planned, why=REASON_WHY.get(reason) if reason == "tighter_budget" else "Vừa ngân sách hơn")

    points = [(ctx.origin_lat, ctx.origin_lng)] + [(p.poi["lat"], p.poi["lng"]) for p in planned]
    remaining = REPLAN_DEADLINE - (time.monotonic() - t0)
    route = await routing.route(points, timeout=min(OSRM_TIMEOUT, max(0.6, remaining)))

    title = itin.summary.title or fallback_title(ctx, planned)
    highlight = ((ai or {}).get("nutrition_highlight") or "").strip() or fallback_highlight(planned)
    resp = build_response(
        ctx, planned, route, title, highlight,
        itin.itinerary_id or new_itinerary_id(), itin.share_url or "", first_start, end_min,
    )
    return resp, f"{engine}+{route.source}"
