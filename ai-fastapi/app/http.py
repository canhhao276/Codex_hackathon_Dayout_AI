"""Shared async HTTP client (connection reuse keeps OSRM/Overpass calls fast)."""
from __future__ import annotations

import httpx

from .config import USER_AGENT

_client: httpx.AsyncClient | None = None


def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, follow_redirects=True)
    return _client


async def close_client() -> None:
    global _client
    if _client is not None and not _client.is_closed:
        await _client.aclose()
    _client = None
