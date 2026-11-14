"""Tally the on-site survey into pitch-ready numbers.

Usage:  python evidence/tally_survey.py [path/to/survey_responses.csv]
Writes: evidence/survey_summary.md
"""
from __future__ import annotations

import csv
import statistics
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
PAINS = {
    "A": "Không biết đi đâu / quán nào hợp vibe",
    "B": "Đường đi vòng vèo, các điểm xa nhau",
    "C": "Không ước lượng được chi phí, hay lố ngân sách",
    "D": "Khó kiểm soát ăn uống / calo",
    "E": "Cả nhóm bàn mãi không chốt được kèo",
    "F": "Thời tiết (mưa) làm hỏng kế hoạch",
}


def _int(value: str) -> int | None:
    try:
        return int(float(str(value).strip()))
    except (TypeError, ValueError):
        return None


def load(path: Path) -> list[dict]:
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = [r for r in csv.DictReader(f) if (r.get("id") or "").strip() and not r["id"].startswith("#")]
    return rows


def pct(part: int, whole: int) -> int:
    return round(100 * part / whole) if whole else 0


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # Vietnamese text on Windows consoles
    path =Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "survey_responses.csv"
    rows = load(path)
    n = len(rows)
    if n == 0:
        print(f"Chưa có câu trả lời nào trong {path}. Hãy nhập kết quả khảo sát thật trước.")
        return

    minutes = [m for m in (_int(r.get("q1_minutes")) for r in rows) if m is not None]
    apps = [a for a in (_int(r.get("q2_apps_count")) for r in rows) if a is not None]
    tries = [t for t in (_int(r.get("q4_would_try")) for r in rows) if t is not None]
    pains = Counter(
        code.strip().upper()
        for r in rows
        for code in (r.get("q3_pains") or "").split("|")
        if code.strip()
    )
    app_names = Counter(
        a.strip().lower() for r in rows for a in (r.get("q2_apps") or "").split("|") if a.strip()
    )
    quotes = [r["quote"].strip() for r in rows if (r.get("quote") or "").strip()]

    lines = [f"# Kết quả khảo sát thực tế tại hội trường (n = {n})", ""]
    if minutes:
        over30 = sum(m >= 30 for m in minutes)
        lines += [
            f"- **Thời gian chốt 1 lịch trình:** trung bình **{statistics.mean(minutes):.0f} phút**, "
            f"trung vị {statistics.median(minutes):.0f} phút; **{pct(over30, len(minutes))}%** mất ≥ 30 phút.",
        ]
    if apps:
        ge3 = sum(a >= 3 for a in apps)
        lines += [
            f"- **Số app phải dùng:** trung bình **{statistics.mean(apps):.1f} app**; "
            f"**{pct(ge3, len(apps))}%** dùng ≥ 3 app.",
        ]
        if app_names:
            top = ", ".join(f"{k} ({v})" for k, v in app_names.most_common(4))
            lines.append(f"- App hay dùng nhất: {top}.")
    if pains:
        lines += ["", "**Nỗi đau lớn nhất (được chọn bởi % người tham gia):**", ""]
        for code, cnt in pains.most_common():
            lines.append(f"- {PAINS.get(code, code)}: **{pct(cnt, n)}%** ({cnt}/{n})")
    if tries:
        keen = sum(t >= 4 for t in tries)
        lines += ["", f"- **Muốn dùng thử ngay (4–5/5):** **{pct(keen, len(tries))}%** ({keen}/{len(tries)})."]
    if quotes:
        lines += ["", "**Trích dẫn nguyên văn:**", ""] + [f"> \"{q}\"" for q in quotes[:3]]

    # One-liner for the 0:00–0:45 pitch slot
    pitch = f"Khảo sát {n} bạn trẻ ngay tại hội trường hôm nay"
    if minutes:
        pitch += f": trung bình mất {statistics.mean(minutes):.0f} phút"
        if apps:
            pitch += f" và {statistics.mean(apps):.1f} app"
        pitch += " để chốt 1 buổi đi chơi"
    if pains:
        code, cnt = pains.most_common(1)[0]
        pitch += f"; {pct(cnt, n)}% nói nỗi đau lớn nhất là \"{PAINS.get(code, code).lower()}\""
    pitch += "."
    lines += ["", "## Câu chốt cho pitch", "", f"> {pitch}", ""]

    text = "\n".join(lines)
    out = HERE / "survey_summary.md"
    out.write_text(text, encoding="utf-8")
    print(text)
    print(f"\n(Đã lưu {out})")


if __name__ == "__main__":
    main()
