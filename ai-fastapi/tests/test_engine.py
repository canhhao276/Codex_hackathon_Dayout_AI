"""Offline tests: OpenAI, OSRM and Overpass are mocked, so these run without network or keys.

Run:  .venv/Scripts/python -m pytest -q      (Windows)
      .venv/bin/python -m pytest -q          (macOS/Linux)
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import main  # noqa: E402
from app import llm, planner, pois, routing  # noqa: E402
from app.geo import HANOI_BBOX  # noqa: E402

REAL_STRUCTURED_CALL = llm._structured_call

STOP_KEYS = {
    "order", "stop_id", "start_time", "end_time", "name", "category", "address", "lat", "lng", "indoor",
    "recommended_items", "estimated_cost_vnd", "estimated_calories_kcal", "nutrition_note", "ai_reason",
    "distance_to_next_km", "travel_to_next_minutes",
}
SUMMARY_KEYS = {
    "title", "total_cost_per_person_vnd", "budget_per_person_vnd", "total_calories_kcal",
    "nutrition_badge", "total_distance_km", "total_travel_minutes",
}
CONTRACT_REQUEST = {
    "origin": {"lat": 21.0012, "lng": 105.8035, "label": "79 Nguyễn Như Kon Tum, Thanh Xuân, Hà Nội"},
    "budget_vnd": 350000,
    "people_count": 2,
    "vibes": ["chill_cafe", "interactive_activity", "local_food"],
    "nutrition_goal": "eat_clean",
    "time_window": {"start": "14:00", "end": "21:00"},
    "prompt_note": "Đi hẹn hò cuối tuần, thích không gian thoáng, ít dầu mỡ",
}


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    async def fake_route(points, timeout=None):
        return routing.fallback_route(points)

    async def no_llm(*args, **kwargs):
        return None

    monkeypatch.setattr(planner.routing, "route", fake_route)
    monkeypatch.setattr(llm, "_structured_call", no_llm)


@pytest.fixture
def client():
    with TestClient(main.app) as c:
        yield c


def assert_contract(it: dict):
    assert set(it) == {"itinerary_id", "share_url", "summary", "route_polyline", "stops"}
    assert set(it["summary"]) == SUMMARY_KEYS
    assert 3 <= len(it["stops"]) <= 4
    for i, s in enumerate(it["stops"], start=1):
        assert set(s) == STOP_KEYS
        assert s["order"] == i
        assert s["recommended_items"], "every stop needs recommended items"
        assert s["ai_reason"]
    assert it["stops"][-1]["distance_to_next_km"] == 0
    assert all(len(p) == 2 for p in it["route_polyline"]) and len(it["route_polyline"]) >= 2
    assert it["summary"]["total_cost_per_person_vnd"] == sum(s["estimated_cost_vnd"] for s in it["stops"])
    assert it["summary"]["total_calories_kcal"] == sum(s["estimated_calories_kcal"] for s in it["stops"])


# ---------------- dataset ----------------
def test_dataset_quality():
    data = pois.load_pois()
    assert len(data) >= 60
    assert len({p["id"] for p in data}) == len(data)
    min_lat, max_lat, min_lng, max_lng = HANOI_BBOX
    for p in data:
        assert p["category"] in pois.CATEGORIES, p["id"]
        assert min_lat < p["lat"] < max_lat and min_lng < p["lng"] < max_lng, p["id"]
        assert isinstance(p["indoor"], bool)
        assert p["recommended_items"], p["id"]
        assert set(p["vibes"]) <= set(pois.VIBE_CATEGORIES), p["id"]
        assert set(p["nutrition_tags"]) <= {*pois.GOALS, "vegetarian", "indulgent"}, p["id"]
    by_cat = {c: sum(p["category"] == c for p in data) for c in pois.CATEGORIES}
    assert min(by_cat.values()) >= 8, by_cat


# ---------------- /health & /ai/generate ----------------
def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_generate_contract_and_budget(client):
    r = client.post("/ai/generate", json=CONTRACT_REQUEST)
    assert r.status_code == 200, r.text
    it = r.json()
    assert_contract(it)
    assert it["summary"]["total_cost_per_person_vnd"] <= 350000
    assert it["summary"]["budget_per_person_vnd"] == 350000
    assert any(s["category"] == "food" for s in it["stops"])
    assert it["itinerary_id"].startswith("itin_")
    assert r.headers["X-AI-Engine"].startswith("heuristic")
    times = [s["start_time"] for s in it["stops"]]
    assert times == sorted(times) and times[0] >= "14:00"


def test_generate_tolerates_nulls(client):
    r = client.post("/ai/generate", json={"origin": None, "vibes": None, "prompt_note": None, "budget_vnd": "250000"})
    assert r.status_code == 200, r.text
    assert_contract(r.json())


def test_generate_uses_llm_choice(client, monkeypatch):
    async def fake_choose(ctx, candidates, n, timeout, **_):
        picks = []
        for cat in ("cafe", "activity", "food"):
            picks.append(next(p for p in candidates if p["category"] == cat))
        return {
            "title": "Chiều chill test",
            "nutrition_highlight": "Ít đường",
            "stops": [
                {"poi_id": "poi_FAKE_hallucinated", "recommended_items": ["x"], "ai_reason": "x", "nutrition_note": "x"},
                *[
                    {"poi_id": p["id"], "recommended_items": ["Món AI"], "ai_reason": f"AI chọn {p['name']}", "nutrition_note": "ok"}
                    for p in picks
                ],
            ],
        }

    monkeypatch.setattr(planner.llm, "choose_stops", fake_choose)
    r = client.post("/ai/generate", json=CONTRACT_REQUEST)
    assert r.status_code == 200, r.text
    it = r.json()
    assert_contract(it)
    assert r.headers["X-AI-Engine"].startswith("openai")
    assert it["summary"]["title"] == "Chiều chill test"
    assert all(s["stop_id"] != "poi_FAKE_hallucinated" for s in it["stops"])
    assert it["summary"]["nutrition_badge"].endswith("Ít đường")


# ---------------- /ai/replan ----------------
def _generate(client, **overrides):
    body = {**CONTRACT_REQUEST, **overrides}
    it = client.post("/ai/generate", json=body).json()
    it["share_url"] = "https://example.trycloudflare.com/s/hk26"
    return it


def test_replan_rain_makes_everything_indoor(client):
    it = _generate(client, vibes=["photo_spot", "local_food", "chill_cafe"])
    assert any(not s["indoor"] for s in it["stops"]), "test needs an outdoor stop"
    r = client.post("/ai/replan", json={"current_itinerary": it, "target_stop_order": None, "reason": "rainy_weather"})
    assert r.status_code == 200, r.text
    new = r.json()
    assert_contract(new)
    assert all(s["indoor"] for s in new["stops"])
    assert new["itinerary_id"] == it["itinerary_id"] and new["share_url"] == it["share_url"]
    assert r.headers["X-Replan-Changed"] == "1"


def test_replan_tighter_budget(client):
    it = _generate(client)
    old_total = it["summary"]["total_cost_per_person_vnd"]
    new_budget = int(old_total * 0.8)
    r = client.post("/ai/replan", json={"current_itinerary": it, "reason": "tighter_budget", "new_budget_vnd": new_budget})
    assert r.status_code == 200, r.text
    new = r.json()
    assert_contract(new)
    assert new["summary"]["total_cost_per_person_vnd"] <= new_budget
    assert new["summary"]["budget_per_person_vnd"] == new_budget


def test_replan_single_stop_swap(client):
    it = _generate(client)
    r = client.post("/ai/replan", json={"current_itinerary": it, "target_stop_order": 2, "reason": "crowded"})
    assert r.status_code == 200, r.text
    new = r.json()
    assert new["stops"][1]["stop_id"] != it["stops"][1]["stop_id"]
    for i in (0, 2):
        assert new["stops"][i]["stop_id"] == it["stops"][i]["stop_id"]


def test_replan_lower_calories(client):
    it = _generate(client, nutrition_goal="balanced", vibes=["local_food", "night_chill"])
    r = client.post("/ai/replan", json={"current_itinerary": it, "reason": "lower_calories"})
    assert r.status_code == 200, r.text
    assert r.json()["summary"]["total_calories_kcal"] < it["summary"]["total_calories_kcal"]


def test_replan_uses_llm_choice(client, monkeypatch):
    async def fake_replace(ctx, reason, current_stops, targets, timeout):
        return {
            "nutrition_highlight": "Nhẹ bụng",
            "replacements": [
                {"target_order": t["order"], "poi_id": t["candidates"][-1]["id"], "recommended_items": ["Món mới"],
                 "ai_reason": "AI đổi vì trời mưa", "nutrition_note": "ok"}
                for t in targets
            ],
        }

    monkeypatch.setattr(planner.llm, "choose_replacements", fake_replace)
    it = _generate(client)
    r = client.post("/ai/replan", json={"current_itinerary": it, "target_stop_order": 1, "reason": "crowded"})
    assert r.status_code == 200, r.text
    assert r.json()["stops"][0]["ai_reason"] == "AI đổi vì trời mưa"
    assert r.headers["X-AI-Engine"].startswith("openai")


def test_replan_rejects_empty_itinerary(client):
    r = client.post("/ai/replan", json={"current_itinerary": {}, "reason": "rainy_weather"})
    assert r.status_code == 422


# ---------------- global coverage (Overpass) ----------------
def test_outside_hanoi_uses_osm(client, monkeypatch):
    lat, lng = 13.7466, 100.5393  # Bangkok
    elements = [
        {"type": "node", "id": 1, "lat": lat + 0.002, "lon": lng, "tags": {"amenity": "cafe", "name": "Cafe A"}},
        {"type": "node", "id": 2, "lat": lat, "lon": lng + 0.003, "tags": {"amenity": "restaurant", "name": "Thai Kitchen", "cuisine": "thai"}},
        {"type": "node", "id": 3, "lat": lat - 0.003, "lon": lng, "tags": {"tourism": "museum", "name": "Art Museum"}},
        {"type": "way", "id": 4, "center": {"lat": lat + 0.004, "lon": lng + 0.001}, "tags": {"leisure": "park", "name": "Lumphini"}},
        {"type": "node", "id": 5, "lat": lat + 0.001, "lon": lng - 0.002, "tags": {"amenity": "ice_cream", "name": "Gelato"}},
        {"type": "node", "id": 6, "lat": lat, "lon": lng, "tags": {"amenity": "cafe"}},  # no name -> skipped
    ]

    async def fake_fetch(lat_, lng_, radius_m=2500):
        return [p for p in (pois._overpass_to_poi(e) for e in elements) if p]

    monkeypatch.setattr(pois, "fetch_overpass_pois", fake_fetch)
    body = {**CONTRACT_REQUEST, "origin": {"lat": lat, "lng": lng, "label": "Siam"}, "budget_vnd": 600000}
    r = client.post("/ai/generate", json=body)
    assert r.status_code == 200, r.text
    it = r.json()
    assert all(s["stop_id"].startswith("osm_") for s in it["stops"])


def test_outside_hanoi_without_osm_fails_cleanly(client, monkeypatch):
    async def empty(*a, **k):
        return []

    monkeypatch.setattr(pois, "fetch_overpass_pois", empty)
    body = {**CONTRACT_REQUEST, "origin": {"lat": 13.7466, "lng": 100.5393, "label": "Siam"}}
    r = client.post("/ai/generate", json=body)
    assert r.status_code == 503


# ---------------- OpenAI SDK wiring (mock HTTP transport, no key needed) ----------------
def test_openai_structured_output_wiring(monkeypatch):
    import asyncio
    import json as _json

    import httpx
    from openai import AsyncOpenAI

    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        body = _json.loads(request.content)
        captured["body"] = body
        schema = body["response_format"]["json_schema"]["schema"]
        ids = schema["properties"]["stops"]["items"]["properties"]["poi_id"]["enum"]
        content = {
            "title": "Test",
            "nutrition_highlight": "Ít đường",
            "stops": [{"poi_id": i, "recommended_items": ["a"], "ai_reason": "r", "nutrition_note": "n"} for i in ids[:3]],
        }
        return httpx.Response(200, json={
            "id": "chatcmpl-x", "object": "chat.completion", "created": 0, "model": body["model"],
            "choices": [{"index": 0, "finish_reason": "stop",
                         "message": {"role": "assistant", "content": _json.dumps(content)}}],
        })

    client = AsyncOpenAI(api_key="sk-test", http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    monkeypatch.setattr(llm, "_structured_call", REAL_STRUCTURED_CALL)  # undo the autouse no-op
    monkeypatch.setattr(llm, "_client", client)
    monkeypatch.setattr(llm, "openai_enabled", lambda: True)

    ctx = pois.PlanContext(21.0012, 105.8035, "origin", 350000, 2, ["chill_cafe"], "eat_clean", 840, 1260)
    cands = pois.select_candidates(ctx, ctx.origin_lat, ctx.origin_lng, k=20)
    out = asyncio.run(llm.choose_stops(ctx, cands, 3, timeout=5))
    assert out and len(out["stops"]) == 3
    rf = captured["body"]["response_format"]
    assert rf["type"] == "json_schema" and rf["json_schema"]["strict"] is True
    assert set(rf["json_schema"]["schema"]["properties"]["stops"]["items"]["properties"]["poi_id"]["enum"]) == {p["id"] for p in cands}
