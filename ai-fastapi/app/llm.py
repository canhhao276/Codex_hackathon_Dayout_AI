"""OpenAI Structured Outputs: the AI picks real places (by id) and explains why.

The model can only choose ids from the candidate list (JSON-schema enum), so it
can never hallucinate a place. Costs, calories, coordinates and routing always
come from data + OSRM, not from the model.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Optional

from .config import OPENAI_API_KEY, OPENAI_MODEL, openai_enabled
from .geo import haversine_km, min_to_hm
from .pois import GOAL_LABELS, VIBE_LABELS, PlanContext

log = logging.getLogger("dayout.llm")

_client = None


def _get_client():
    global _client
    if _client is None:
        from openai import AsyncOpenAI

        _client = AsyncOpenAI(api_key=OPENAI_API_KEY, max_retries=0)
    return _client


def _candidate_line(p: dict, ref_lat: float, ref_lng: float) -> str:
    d = haversine_km(ref_lat, ref_lng, p["lat"], p["lng"])
    return (
        f'{p["id"]} | {p["name"]} | {p["category"]} | cách {d:.1f}km | '
        f'{p.get("estimated_cost_vnd", 0) // 1000}k/người | {p.get("estimated_calories_kcal", 0)}kcal | '
        f'{"trong nhà" if p.get("indoor") else "ngoài trời"} | dinh dưỡng: {",".join(p.get("nutrition_tags", [])) or "-"} | '
        f'vibe: {",".join(p.get("vibes", [])) or "-"} | món: {"; ".join(p.get("recommended_items", [])[:3])} | '
        f'mở {p.get("open_time", "00:00")}-{p.get("close_time", "23:59")}'
    )


async def _structured_call(system: str, user: str, schema: dict, name: str, timeout: float) -> Optional[dict]:
    if not openai_enabled():
        return None
    try:
        resp = await asyncio.wait_for(
            _get_client().chat.completions.create(
                model=OPENAI_MODEL,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                response_format={
                    "type": "json_schema",
                    "json_schema": {"name": name, "strict": True, "schema": schema},
                },
                temperature=0.4,
                max_tokens=700,
            ),
            timeout=timeout,
        )
        content = resp.choices[0].message.content
        return json.loads(content) if content else None
    except Exception as exc:  # timeout, auth, rate limit, refusal...
        log.warning("OpenAI call '%s' failed: %s", name, exc)
        return None


SYSTEM_PLANNER = (
    "Bạn là Dayout AI — chuyên gia lập lịch trình đi chơi trong ngày tại thành phố cho giới trẻ Việt Nam. "
    "Bạn CHỈ được chọn địa điểm từ danh sách ứng viên (theo id). Viết tiếng Việt tự nhiên, ngắn gọn, cụ thể."
)


def _stop_schema(ids: list[str]) -> dict:
    # No per-request `enum`: a new strict schema costs OpenAI ~3s of extra preprocessing on
    # every call. The schema stays constant (cached); unknown ids are dropped in planner.py.
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["poi_id", "recommended_items", "ai_reason", "nutrition_note"],
        "properties": {
            "poi_id": {"type": "string"},
            "recommended_items": {"type": "array", "items": {"type": "string"}},
            "ai_reason": {"type": "string"},
            "nutrition_note": {"type": "string"},
        },
    }


async def choose_stops(ctx: PlanContext, candidates: list[dict], n_stops: int, timeout: float) -> Optional[dict]:
    ids = [p["id"] for p in candidates]
    schema = {
        "type": "object",
        "additionalProperties": False,
        "required": ["title", "nutrition_highlight", "stops"],
        "properties": {
            "title": {"type": "string"},
            "nutrition_highlight": {"type": "string"},
            "stops": {"type": "array", "items": _stop_schema(ids)},
        },
    }
    vibes = ", ".join(VIBE_LABELS.get(v, v) for v in ctx.vibes) or "tùy AI chọn"
    lines = "\n".join(_candidate_line(p, ctx.origin_lat, ctx.origin_lng) for p in candidates)
    user = f"""Yêu cầu người dùng:
- Xuất phát: {ctx.origin_label} ({ctx.origin_lat:.4f},{ctx.origin_lng:.4f})
- Khung giờ: {min_to_hm(ctx.start_min)} - {min_to_hm(ctx.end_min)}
- Ngân sách: {ctx.budget_pp:,} VNĐ/người, {ctx.people} người
- Vibe mong muốn: {vibes}
- Chế độ dinh dưỡng: {GOAL_LABELS.get(ctx.goal, ctx.goal)}
- Ghi chú: {ctx.note or "không có"}

Ứng viên (id | tên | loại | khoảng cách từ điểm xuất phát | chi phí | kcal | trong/ngoài trời | tag dinh dưỡng | vibe | món | giờ mở):
{lines}

Hãy chọn ĐÚNG {n_stops} điểm dừng khác nhau, theo thứ tự đi hợp lý:
1. TỔNG chi phí/người <= {ctx.budget_pp:,} VNĐ (càng sát ngân sách càng tốt, không vượt).
2. Có ít nhất 1 điểm loại "food" làm bữa chính; tránh 2 điểm cùng loại liền nhau.
3. Ưu tiên khớp vibe & chế độ dinh dưỡng; tránh món "indulgent" nếu là Eat Clean/Ít đường.
4. Các điểm gần nhau, không đi vòng; quán phải đang mở trong khung giờ. Đa dạng trải nghiệm: không quá 2 điểm trong cùng 1 tòa nhà/TTTM; nếu có vibe chụp ảnh hãy cân nhắc 1 điểm ngoài trời đẹp.
5. recommended_items: 1-2 món ngắn lấy từ cột "món" của chính địa điểm đó.
6. ai_reason: tối đa 12 từ, lý do cụ thể (vibe, khoảng cách, giá hoặc dinh dưỡng).
7. nutrition_note: tối đa 6 từ. title: tối đa 6 từ, hấp dẫn. nutrition_highlight: tối đa 5 từ (VD "Giàu đạm, ít đường").
Trả lời ngắn gọn, không giải thích thêm."""
    return await _structured_call(SYSTEM_PLANNER, user, schema, "dayout_plan", timeout)


REASON_TEXT = {
    "rainy_weather": "Trời đang mưa: BẮT BUỘC chọn địa điểm TRONG NHÀ.",
    "tighter_budget": "Người dùng muốn tiết kiệm: chọn địa điểm RẺ HƠN điểm cũ.",
    "lower_calories": "Người dùng muốn giảm calo: chọn món/địa điểm ÍT CALO HƠN.",
    "crowded": "Quán cũ đang đông/người dùng muốn đổi: chọn địa điểm tương đương, gần đó.",
}


async def choose_replacements(
    ctx: PlanContext,
    reason: str,
    current_stops: list[dict],
    targets: list[dict[str, Any]],
    timeout: float,
) -> Optional[dict]:
    """targets: [{"order": int, "old": poi, "candidates": [poi,...]}]"""
    all_ids = sorted({p["id"] for t in targets for p in t["candidates"]})
    if not all_ids:
        return None
    schema = {
        "type": "object",
        "additionalProperties": False,
        "required": ["nutrition_highlight", "replacements"],
        "properties": {
            "nutrition_highlight": {"type": "string"},
            "replacements": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["target_order", "poi_id", "recommended_items", "ai_reason", "nutrition_note"],
                    "properties": {
                        "target_order": {"type": "integer"},
                        "poi_id": {"type": "string"},  # validated against candidates in planner.py
                        "recommended_items": {"type": "array", "items": {"type": "string"}},
                        "ai_reason": {"type": "string"},
                        "nutrition_note": {"type": "string"},
                    },
                },
            },
        },
    }
    plan_lines = "\n".join(
        f'{s["order"]}. {s["start_time"]} {s["name"]} ({s["category"]}, {s["estimated_cost_vnd"] // 1000}k, '
        f'{s["estimated_calories_kcal"]}kcal, {"trong nhà" if s.get("indoor") else "ngoài trời"})'
        for s in current_stops
    )
    blocks = []
    for t in targets:
        old = t["old"]
        lines = "\n".join(_candidate_line(p, old["lat"], old["lng"]) for p in t["candidates"])
        blocks.append(f"Điểm cần thay số {t['order']} (đang là: {old['name']}). Ứng viên (khoảng cách tính từ điểm cũ):\n{lines}")
    user = f"""Lịch trình hiện tại:
{plan_lines}

Lý do đổi: {REASON_TEXT.get(reason, REASON_TEXT["crowded"])}
Ngân sách: {ctx.budget_pp:,} VNĐ/người. Chế độ dinh dưỡng: {GOAL_LABELS.get(ctx.goal, ctx.goal)}.

{chr(10).join(blocks)}

Với MỖI điểm cần thay, chọn đúng 1 địa điểm thay thế từ danh sách ứng viên CỦA ĐIỂM ĐÓ (target_order = số thứ tự điểm cần thay).
Ưu tiên gần lộ trình, khớp lý do đổi và chế độ dinh dưỡng; tổng chi phí sau khi đổi không vượt ngân sách.
Không chọn 2 quán cùng thương hiệu (VD 2 Starbucks) và tránh 2 điểm cùng loại đứng liền nhau; nếu điểm cũ là hoạt động thì ưu tiên hoạt động thay thế. ai_reason tối đa 12 từ, nhắc rõ lý do đổi (VD "Trong nhà tránh mưa, cách 600m").
recommended_items 1-2 món ngắn từ cột "món". nutrition_note tối đa 6 từ. nutrition_highlight tối đa 5 từ cho cả lịch trình mới."""
    return await _structured_call(SYSTEM_PLANNER, user, schema, "dayout_replan", timeout)
