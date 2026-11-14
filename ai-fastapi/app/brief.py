"""Phân tích nhu cầu người dùng gõ bằng lời → điền sẵn form Smart Brief trên app.

POST /ai/parse-brief  {"text": "..."}  → BriefParse (mọi field có thể null = "không nhắc tới").
OpenAI Structured Outputs là chính; nếu thiếu key / quá giờ thì dùng bộ phân tích theo quy tắc.
"""
from __future__ import annotations

import re
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from . import llm
from .config import OPENAI_TIMEOUT_REPLAN

VIBES = ["chill_cafe", "interactive_activity", "local_food", "photo_spot", "night_chill"]
GOALS = ["balanced", "eat_clean", "high_protein", "low_sugar"]
AREAS = ["venue", "hoan_kiem", "cau_giay", "tay_ho", "dong_da"]


def _nullable(schema: dict) -> dict:
    return {"anyOf": [schema, {"type": "null"}]}


SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "budget_per_person_vnd", "people_count", "vibes", "extra_interests", "nutrition_goal",
        "start_time", "duration_minutes", "area_key", "note", "summary",
    ],
    "properties": {
        "budget_per_person_vnd": _nullable({"type": "integer"}),
        "people_count": _nullable({"type": "integer"}),
        "vibes": {"type": "array", "items": {"type": "string", "enum": VIBES}},
        "extra_interests": {"type": "array", "items": {"type": "string"}},
        "nutrition_goal": _nullable({"type": "string", "enum": GOALS}),
        "start_time": _nullable({"type": "string"}),
        "duration_minutes": _nullable({"type": "integer"}),
        "area_key": _nullable({"type": "string", "enum": AREAS}),
        "note": {"type": "string"},
        "summary": {"type": "string"},
    },
}

SYSTEM = (
    "Bạn là bộ phân tích yêu cầu của Dayout AI (app lên lịch trình đi chơi trong ngày tại Hà Nội). "
    "Đọc đoạn mô tả tiếng Việt (có thể viết tắt, không dấu) và trích xuất thông tin để điền form. "
    "Field nào người dùng KHÔNG nhắc tới thì để null (hoặc mảng rỗng) — tuyệt đối không bịa."
)


def _vn_now() -> datetime:
    return datetime.now(timezone(timedelta(hours=7)))


def _user_prompt(text: str) -> str:
    now = _vn_now()
    return f"""Bây giờ là {now:%H:%M} ngày {now:%d/%m/%Y} (giờ Hà Nội).

Mô tả của người dùng:
\"\"\"{text}\"\"\"

Quy tắc:
- budget_per_person_vnd: số tiền MỖI NGƯỜI, đơn vị VNĐ ("500k" = 500000, "1tr"/"1 triệu" = 1000000, "1tr2" = 1200000). Nếu là tổng cả nhóm thì chia cho số người.
- people_count: số người đi (tính cả người nói). "hẹn hò"/"2 đứa" = 2. "một mình" = 1.
- vibes: chọn trong {VIBES} — chill_cafe=cafe chill; interactive_activity=workshop/bowling/boardgame/xem phim/vui chơi; local_food=ăn uống/đặc sản; photo_spot=chụp ảnh/sống ảo; night_chill=đi tối/bar/acoustic.
- extra_interests: sở thích khác không thuộc 5 vibe trên, mỗi mục 1-4 từ tiếng Việt (VD "Mua sắm", "Hợp trẻ em").
- nutrition_goal: balanced | eat_clean (healthy/ít dầu mỡ/giảm cân) | high_protein (tập gym/nhiều đạm) | low_sugar (ít ngọt/tiểu đường).
- start_time: "HH:MM" 24h. Có giờ cụ thể thì dùng giờ đó ("7h tối" = 19:00). Chỉ nói buổi: "sáng"=09:00, "trưa"=11:30, "chiều"=14:00, "tối"=18:30 (KHÔNG dùng giờ hiện tại). Chỉ khi nói "bây giờ"/"đi luôn" mới dùng giờ hiện tại làm tròn lên 15 phút. Không nhắc thời gian thì null.
- duration_minutes: thời lượng cả buổi nếu có ("cả ngày"≈600, "vài tiếng"≈180); có giờ kết thúc thì tính từ start_time.
- area_key: venue (Thanh Xuân/Nguyễn Như Kon Tum/Royal City/hội trường), hoan_kiem (Hồ Gươm/phố cổ), cau_giay, tay_ho (Hồ Tây), dong_da.
- note: ràng buộc còn lại cần giữ nguyên ý (ăn chay, dị ứng, không cay, gửi xe, hẹn hò...), tối đa 25 từ, rỗng nếu không có.
- summary: 1 câu ≤ 20 từ tóm tắt cách bạn hiểu yêu cầu."""


# ---------- Bộ phân tích dự phòng theo quy tắc (không cần OpenAI) ----------
def _fold(s: str) -> str:
    s = unicodedata.normalize("NFD", s.lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn").replace("đ", "d")


_KEYWORDS = {
    "vibes": {
        "chill_cafe": ["cafe", "ca phe", "coffee", "tra sua"],
        "interactive_activity": ["workshop", "bowling", "boardgame", "board game", "xem phim", "rap phim", "vui choi", "truot bang", "game"],
        "local_food": ["an uong", "do an", "an ngon", "dac san", "pho", "bun", "lau", "nuong", "an toi", "an trua"],
        "photo_spot": ["chup anh", "song ao", "check in", "checkin", "photo"],
        "night_chill": ["buoi toi", "dem", "bar", "pub", "acoustic", "rooftop"],
    },
    "goal": {
        "eat_clean": ["eat clean", "healthy", "it dau mo", "giam can", "lanh manh"],
        "high_protein": ["protein", "gym", "nhieu dam", "giau dam"],
        "low_sugar": ["it duong", "it ngot", "khong duong", "tieu duong"],
    },
    "area": {
        "hoan_kiem": ["ho guom", "hoan kiem", "pho co", "ho hoan kiem"],
        "cau_giay": ["cau giay"],
        "tay_ho": ["ho tay", "tay ho"],
        "dong_da": ["dong da"],
        "venue": ["thanh xuan", "nguyen nhu kon tum", "royal city", "hoi truong"],
    },
}


_PERIOD_DEFAULT = {"morning": "09:00", "noon": "11:30", "afternoon": "14:00", "evening": "18:30"}


def _period_word(text: str) -> Optional[str]:
    """Buổi trong ngày người dùng nhắc tới. Xét chữ CÓ DẤU trước vì bỏ dấu thì "tối"="tôi", "sáng"="sang"."""
    low = text.lower()
    if re.search(r"\btối\b|buoi toi|toi nay|an toi", low):
        return "evening"
    if re.search(r"\bchiều\b|\bchieu\b", low):
        return "afternoon"
    if re.search(r"\btrưa\b|\btrua\b", low):
        return "noon"
    if re.search(r"\bsáng\b|buoi sang|sang nay|sang mai", low):
        return "morning"
    return None


def _period_of(hm: str) -> str:
    h = int(hm[:2])
    return "morning" if h < 11 else "noon" if h < 13 else "afternoon" if h < 17 else "evening"


def _fix_start_with_period(result: dict, text: str) -> dict:
    """AI đôi khi điền giờ hiện tại dù người dùng nói "tối nay" → kéo về đúng buổi."""
    period = _period_word(text)
    st = result.get("start_time")
    if period and isinstance(st, str) and re.fullmatch(r"\d\d:\d\d", st) and _period_of(st) != period:
        result = {**result, "start_time": heuristic_parse(text).get("start_time") or _PERIOD_DEFAULT[period]}
    return result


def heuristic_parse(text: str) -> dict:
    t = _fold(text)
    people = None
    m = re.search(r"(\d{1,2})\s*(nguoi|ban|dua|thanh vien|mem)", t)
    if m:
        people = int(m.group(1))
    elif re.search(r"hen ho|2 dua|cap doi|nguoi yeu", t):
        people = 2
    elif "mot minh" in t:
        people = 1

    budget = None
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(tr|trieu)\s*(\d)?", t)
    if m:
        budget = float(m.group(1).replace(",", ".")) * 1_000_000 + (int(m.group(3)) * 100_000 if m.group(3) else 0)
    else:
        m = re.search(r"(\d{2,4})\s*(k|nghin|ngan)\b", t)
        if m:
            budget = int(m.group(1)) * 1000
    per_person = re.search(r"(moi nguoi|moi dua|1 nguoi|/ ?nguoi|mot nguoi)", t)
    if budget and people and not per_person and re.search(r"(tong|ca nhom|ca hoi)", t):
        budget = budget / people
    budget_int = int(round(budget / 1000.0) * 1000) if budget else None

    start = None
    period = _period_word(text)
    m = re.search(r"(\d{1,2})\s*(?:h|gio|:)\s*(\d{2})?(?!\s*(?:tieng|nguoi|k\b))", t)
    if m and int(m.group(1)) <= 23:
        h = int(m.group(1))
        if h < 12 and period in ("afternoon", "evening"):
            h += 12
        start = f"{h:02d}:{int(m.group(2) or 0):02d}"
    elif period:
        start = _PERIOD_DEFAULT[period]

    duration = 600 if "ca ngay" in t else None
    vibes = [k for k, words in _KEYWORDS["vibes"].items() if any(w in t for w in words)]
    goal = next((k for k, words in _KEYWORDS["goal"].items() if any(w in t for w in words)), None)
    area = next((k for k, words in _KEYWORDS["area"].items() if any(w in t for w in words)), None)
    note_bits = [label for word, label in [("an chay", "Ăn chay"), ("khong cay", "Không ăn cay"),
                                           ("di ung", "Có dị ứng thực phẩm"), ("gui xe", "Cần chỗ gửi xe"),
                                           ("hen ho", "Đi hẹn hò")] if word in t]
    return {
        "budget_per_person_vnd": budget_int,
        "people_count": people,
        "vibes": vibes,
        "extra_interests": [],
        "nutrition_goal": goal,
        "start_time": start,
        "duration_minutes": duration,
        "area_key": area,
        "note": ", ".join(note_bits),
        "summary": "Phân tích nhanh theo từ khoá (AI chưa phản hồi).",
    }


def _clean(d: dict) -> dict:
    """Chặn giá trị vô lý từ model trước khi trả về app."""
    out = dict(d)
    b = out.get("budget_per_person_vnd")
    out["budget_per_person_vnd"] = int(b) if isinstance(b, (int, float)) and 20_000 <= b <= 50_000_000 else None
    p = out.get("people_count")
    out["people_count"] = int(p) if isinstance(p, (int, float)) and 1 <= p <= 50 else None
    st = out.get("start_time")
    out["start_time"] = st if isinstance(st, str) and re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", st) else None
    dur = out.get("duration_minutes")
    out["duration_minutes"] = int(dur) if isinstance(dur, (int, float)) and 60 <= dur <= 16 * 60 else None
    out["vibes"] = [v for v in out.get("vibes") or [] if v in VIBES]
    out["extra_interests"] = [str(x).strip()[:40] for x in out.get("extra_interests") or [] if str(x).strip()][:6]
    if out.get("nutrition_goal") not in GOALS:
        out["nutrition_goal"] = None
    if out.get("area_key") not in AREAS:
        out["area_key"] = None
    out["note"] = str(out.get("note") or "").strip()[:300]
    out["summary"] = str(out.get("summary") or "").strip()[:200]
    return out


async def parse_brief(text: str) -> tuple[dict, str]:
    text = (text or "").strip()[:1000]
    if not text:
        raise ValueError("Mô tả trống.")
    result = await llm._structured_call(
        SYSTEM, _user_prompt(text), SCHEMA, "dayout_brief", timeout=max(OPENAI_TIMEOUT_REPLAN, 5.0)
    )
    if result:
        return _clean(_fix_start_with_period(result, text)), "openai"
    return _clean(heuristic_parse(text)), "heuristic"
