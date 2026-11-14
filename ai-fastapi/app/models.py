"""Pydantic models that mirror HACKATHON_PLAN.md section 7 (JSON API Contract).

Field names are LOCKED by the team contract — do not rename them.
Requests are lenient (nulls -> defaults, unknown keys ignored) so the Node BFF
and the mobile app can never crash this service with a slightly different body.
"""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

DEFAULT_ORIGIN = {
    "lat": 21.0012,
    "lng": 105.8035,
    "label": "79 Nguyễn Như Kon Tum, Thanh Xuân, Hà Nội",
}


class Lenient(BaseModel):
    model_config = ConfigDict(extra="ignore")

    @model_validator(mode="before")
    @classmethod
    def _drop_nulls(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return {k: v for k, v in data.items() if v is not None}
        return data


# ---------- Requests ----------
class Origin(Lenient):
    lat: float = DEFAULT_ORIGIN["lat"]
    lng: float = DEFAULT_ORIGIN["lng"]
    label: str = DEFAULT_ORIGIN["label"]


class TimeWindow(Lenient):
    start: str = "14:00"
    end: str = "21:00"


class GenerateRequest(Lenient):
    origin: Origin = Field(default_factory=Origin)
    budget_vnd: int = Field(350000, ge=0)
    people_count: int = Field(2, ge=1)
    vibes: list[str] = Field(default_factory=list)
    nutrition_goal: str = "balanced"
    time_window: TimeWindow = Field(default_factory=TimeWindow)
    prompt_note: str = ""


class ReplanRequest(Lenient):
    current_itinerary: dict[str, Any] = Field(default_factory=dict)
    target_stop_order: Optional[int] = None
    reason: str = "crowded"  # rainy_weather | crowded | tighter_budget | lower_calories
    new_budget_vnd: Optional[int] = None
    # Optional context (not in the locked contract, safe to omit):
    nutrition_goal: Optional[str] = None
    vibes: Optional[list[str]] = None
    origin: Optional[Origin] = None


# ---------- Response (ItineraryResponse) ----------
class Stop(Lenient):
    order: int
    stop_id: str
    start_time: str
    end_time: str
    name: str
    category: str
    address: str = ""
    lat: float
    lng: float
    indoor: bool = False
    recommended_items: list[str] = Field(default_factory=list)
    estimated_cost_vnd: int = 0
    estimated_calories_kcal: int = 0
    nutrition_note: str = ""
    ai_reason: str = ""
    distance_to_next_km: float = 0.0
    travel_to_next_minutes: int = 0


class Summary(Lenient):
    title: str = "Lịch trình Dayout"
    total_cost_per_person_vnd: int = 0
    budget_per_person_vnd: int = 0
    total_calories_kcal: int = 0
    nutrition_badge: str = ""
    total_distance_km: float = 0.0
    total_travel_minutes: int = 0


class ItineraryResponse(Lenient):
    itinerary_id: str = ""
    share_url: str = ""
    summary: Summary = Field(default_factory=Summary)
    route_polyline: list[list[float]] = Field(default_factory=list)
    stops: list[Stop] = Field(default_factory=list)
