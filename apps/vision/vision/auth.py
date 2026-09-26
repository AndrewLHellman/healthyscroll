"""Supabase access-token check, mirroring apps/web/lib/supabase.ts."""

from __future__ import annotations

import time

import httpx

from .config import settings

# token -> (user_id, expires_at). Avoids a Supabase round trip on every video.
_cache: dict[str, tuple[str, float]] = {}
_TTL_S = 60


async def verify_bearer(authorization: str | None) -> str | None:
    """User id for a valid `Authorization: Bearer <token>`, else None."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization[7:].strip()

    hit = _cache.get(token)
    if hit and hit[1] > time.time():
        return hit[0]

    async with httpx.AsyncClient(timeout=5) as client:
        res = await client.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"},
        )
    if res.status_code != 200:
        return None
    user_id = res.json().get("id")
    if user_id:
        if len(_cache) > 10_000:
            _cache.clear()
        _cache[token] = (user_id, time.time() + _TTL_S)
    return user_id
