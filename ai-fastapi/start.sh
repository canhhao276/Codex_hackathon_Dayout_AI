#!/usr/bin/env bash
# Dayout AI - FastAPI engine launcher (macOS/Linux/Git Bash)
set -e
cd "$(dirname "$0")"
[ -f .env ] || { cp .env.example .env; echo "Created .env - put your OPENAI_API_KEY in it."; }
PY=.venv/bin/python; [ -f .venv/Scripts/python.exe ] && PY=.venv/Scripts/python.exe
if [ ! -x "$PY" ] && [ ! -f "$PY" ]; then
  if command -v uv >/dev/null; then uv venv --python 3.12 .venv; else python3 -m venv .venv; fi
  PY=.venv/bin/python; [ -f .venv/Scripts/python.exe ] && PY=.venv/Scripts/python.exe
fi
if command -v uv >/dev/null; then uv pip install --python .venv -r requirements.txt; else "$PY" -m pip install -r requirements.txt; fi
exec "$PY" -m uvicorn main:app --host 0.0.0.0 --port 8000
