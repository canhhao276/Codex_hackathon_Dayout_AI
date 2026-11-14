"""Environment configuration (reads ai-fastapi/.env if present)."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

load_dotenv(BASE_DIR / ".env")


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o").strip() or "gpt-4o"
OPENAI_TIMEOUT_GENERATE = _float("OPENAI_TIMEOUT_GENERATE", 6.0)
OPENAI_TIMEOUT_REPLAN = _float("OPENAI_TIMEOUT_REPLAN", 4.5)

OSRM_BASE_URL = os.getenv("OSRM_BASE_URL", "https://router.project-osrm.org").rstrip("/")
OSRM_TIMEOUT = _float("OSRM_TIMEOUT", 2.5)
OVERPASS_URL = os.getenv("OVERPASS_URL", "https://overpass-api.de/api/interpreter")
OVERPASS_TIMEOUT = _float("OVERPASS_TIMEOUT", 2.5)

# End-to-end latency targets (seconds) used to shrink the routing timeout adaptively.
GENERATE_DEADLINE = 8.0  # Node BFF waits up to 10s
REPLAN_DEADLINE = 6.5

USER_AGENT = "DayoutAI-Hackathon/1.0"


def openai_enabled() -> bool:
    return bool(OPENAI_API_KEY) and not OPENAI_API_KEY.startswith("sk-...")
