"""Dayout AI — FastAPI AI & Spatial Engine (port 8000).

Run:  uvicorn main:app --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from app import config
from app.http import close_client
from app.models import GenerateRequest, ItineraryResponse, ReplanRequest
from app.planner import NoPlacesError, generate, replan
from app.pois import load_pois

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("dayout")


@asynccontextmanager
async def lifespan(_: FastAPI):
    pois = load_pois()
    log.info(
        "Dayout AI engine ready: %d POIs, OpenAI=%s (model %s)",
        len(pois), "ON" if config.openai_enabled() else "OFF (heuristic fallback)", config.OPENAI_MODEL,
    )
    yield
    await close_client()


app = FastAPI(title="Dayout AI — AI & Spatial Engine", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def timing(request: Request, call_next):
    t0 = time.perf_counter()
    response = await call_next(request)
    ms = (time.perf_counter() - t0) * 1000
    response.headers["X-Process-Time-Ms"] = f"{ms:.0f}"
    if request.url.path.startswith("/ai/"):
        log.info("%s %s -> %s in %.0f ms (engine=%s)", request.method, request.url.path,
                 response.status_code, ms, response.headers.get("X-AI-Engine", "-"))
    return response


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "dayout-ai-fastapi",
        "openai_configured": config.openai_enabled(),
        "model": config.OPENAI_MODEL,
        "poi_count": len(load_pois()),
        "routing": config.OSRM_BASE_URL,
    }


@app.post("/ai/generate", response_model=ItineraryResponse)
async def ai_generate(body: GenerateRequest, response: Response):
    try:
        result, engine = await generate(body)
    except NoPlacesError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    response.headers["X-AI-Engine"] = engine
    return result


@app.post("/ai/replan", response_model=ItineraryResponse)
async def ai_replan(body: ReplanRequest, response: Response):
    try:
        result, engine = await replan(body)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=f"current_itinerary không đúng schema ItineraryResponse: {exc.errors()[:3]}")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except NoPlacesError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    response.headers["X-AI-Engine"] = engine
    # "0" = nothing needed changing (e.g. rain but every stop is already indoor).
    response.headers["X-Replan-Changed"] = "0" if engine.startswith("noop") else "1"
    return result


@app.get("/ai/pois")
async def ai_pois():
    """Debug helper: the curated Hanoi dataset."""
    return {"count": len(load_pois()), "pois": load_pois()}
