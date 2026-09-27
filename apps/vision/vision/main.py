"""
Healthy Scroll vision service.

    POST /describe                   Reel media -> a short description of what's in it
    GET  /media/{platform}/{videoId} poll for that description if it wasn't ready in time
    GET  /health

The service makes no decisions. It turns a Reel's video into text, once, shared
by every user; the extension hands that text to Jev (/api/evaluate,
`frames[].caption`) together with the Reel's own caption, and Jev decides
against the user's policy. Nothing about any user's policy is sent here.

Flow (see apps/vision/README.md):
  1. Per Reel, once: fetch the first few hundred KB of the video (one range
     request) + poster; ~1 frame / 3 s (max 3) from it as small JPEGs.  (~1-2 s)
  2. Per Reel, once: a VLM (Gemini via the AI Gateway, or Qwen3-VL on a GPU)
     writes <= 40 words: people, activities, objects, setting, on-screen text.
  3. /describe waits up to CAPTION_WAIT_S for that; if it's slower, the client
     polls /media/... .

The extension calls this for *upcoming* Reels as soon as they appear, so the
description is usually ready before the viewer swipes to them.

Run:  uvicorn vision.main:app --port 8000        (from apps/vision, venv active)
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator

from .auth import verify_bearer
from .config import settings
from .frames import VideoSource, extract_frames
from .media import CaptionStatus, Media, MediaStore, to_jpegs
from .scorers import REGISTRY, build_scorer

log = logging.getLogger("vision")
logging.basicConfig(level=logging.INFO)

state: dict = {}
store = MediaStore()

# Generation cost grows with visual tokens; 4 spread-out frames tell the story.
CAPTION_MAX_FRAMES = 4
# How long /describe holds the request for the description before handing the
# client off to polling. Gateway captions take ~1-2 s, a laptop GPU 3-7 s.
CAPTION_WAIT_S = 8.0


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.captioner == "none":
        raise RuntimeError("VISION_CAPTIONER=none: this service only describes Reels; pick a VLM")
    spec = REGISTRY[settings.captioner]
    log.info("captioner=%s (%s) quantize=%s", settings.captioner, spec.kind, settings.quantize)
    captioner = build_scorer(settings.captioner, quantize=settings.quantize)
    if not hasattr(captioner, "describe"):
        raise RuntimeError(f"VISION_CAPTIONER={settings.captioner} can't describe(); use an hf or gateway model")
    state.update(
        captioner=captioner,
        # A local model has one GPU: one caption at a time. A hosted one is just
        # HTTP calls; let a few Reels caption together.
        caption_slots=asyncio.Semaphore(1 if spec.kind == "hf" else 6),
    )
    yield
    captioner.close()


app = FastAPI(title="Healthy Scroll vision", lifespan=lifespan)
# Callers are extension origins (safari-web-extension://<random>, chrome-extension://...)
# whose ids change; auth is the bearer token, not the origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["authorization", "content-type"],
)


# --- models ------------------------------------------------------------------


class DescribeRequest(BaseModel):
    videoId: str = Field(min_length=1, max_length=128)
    platform: Literal["instagram", "tiktok"] = "instagram"
    # Exactly one of these. `manifest` is the DASH MPD from Instagram's API response.
    manifest: str | None = Field(default=None, max_length=500_000)
    videoUrl: str | None = None
    # The Reel's cover image; used as frame 0.
    posterUrl: str | None = None

    @model_validator(mode="after")
    def one_source(self):
        if bool(self.manifest) == bool(self.videoUrl):
            raise ValueError("send exactly one of manifest or videoUrl")
        return self


class DescribeResponse(BaseModel):
    videoId: str
    frames: int
    # True when this Reel's frames came from the shared cache (another user saw it first).
    mediaCached: bool
    framesMs: float
    totalMs: float
    # "ready" -> `caption` is set. "pending" -> poll GET /media/... . "failed" -> give up.
    captionStatus: CaptionStatus
    caption: str | None = None
    model: str


class MediaResponse(BaseModel):
    videoId: str
    frames: int
    captionStatus: CaptionStatus
    caption: str | None = None


# --- helpers -----------------------------------------------------------------

_hits: dict[str, deque[float]] = defaultdict(deque)


def _rate_limit(who: str, bucket: str = "describe", per_min: int | None = None) -> None:
    now = time.monotonic()
    hits = _hits[f"{bucket}:{who}"]
    while hits and now - hits[0] > 60:
        hits.popleft()
    if len(hits) >= (per_min or settings.rate_per_min):
        raise HTTPException(status_code=429, detail="rate limit")
    hits.append(now)


async def _caller(request: Request, authorization: str | None) -> str:
    if not settings.require_auth:
        return f"ip:{request.client.host if request.client else '?'}"
    user_id = await verify_bearer(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="unauthorized")
    return user_id


def _media_key(platform: str, video_id: str) -> str:
    return f"{platform}:{video_id}"


async def _build_media(key: str, source: VideoSource) -> Media:
    frames = await extract_frames(source)
    if not frames.images:
        # The extension treats 422 as "nothing to add": Jev goes on text alone.
        raise HTTPException(status_code=422, detail=f"no frames extracted ({frames.input_desc})")
    return Media(
        key=key,
        jpegs=to_jpegs(frames.images),
        timestamps=frames.timestamps,
        frames_ms=frames.elapsed_ms,
        input_desc=frames.input_desc,
    )


def _spread(items: list, n: int) -> list:
    """n items evenly spaced across the list (keeps first and last)."""
    if len(items) <= n:
        return items
    return [items[round(i * (len(items) - 1) / (n - 1))] for i in range(n)]


async def _caption(media: Media) -> None:
    try:
        started = time.perf_counter()
        frames = _spread(media.images(), CAPTION_MAX_FRAMES)
        async with state["caption_slots"]:
            media.caption = await asyncio.to_thread(state["captioner"].describe, frames)
        media.caption_status = "ready"
        log.info("%s caption in %.0f ms: %s", media.key, (time.perf_counter() - started) * 1000, media.caption)
    except Exception:
        log.exception("%s caption failed", media.key)
        media.caption_status = "failed"
        # Let the next /describe for this Reel try again (the gateway may have been down).
        media.caption_task = None


def _ensure_caption(media: Media) -> asyncio.Task | None:
    """Start the Reel's caption once; concurrent callers share the same task."""
    if media.caption_status in ("none", "failed") and media.caption_task is None:
        media.caption_status = "pending"
        media.caption_task = asyncio.create_task(_caption(media))
    return media.caption_task


# --- routes ------------------------------------------------------------------


@app.get("/health")
def health():
    return {
        "ok": True,
        "captioner": settings.captioner,
        "cachedReels": len(store._entries),
    }


@app.post("/describe", response_model=DescribeResponse)
async def describe(req: DescribeRequest, request: Request, authorization: str | None = Header(default=None)):
    who = await _caller(request, authorization)
    _rate_limit(who)
    started = time.perf_counter()

    key = _media_key(req.platform, req.videoId)
    source = VideoSource(manifest=req.manifest, url=req.videoUrl, poster_url=req.posterUrl)
    try:
        media, cached = await store.get_or_build(key, lambda: _build_media(key, source))
    except ValueError as err:  # malformed manifest
        raise HTTPException(status_code=422, detail=str(err)) from err

    task = _ensure_caption(media)
    if task is not None and media.caption_status == "pending":
        remaining = CAPTION_WAIT_S - (time.perf_counter() - started)
        if remaining > 0:
            await asyncio.wait({task}, timeout=remaining)

    res = DescribeResponse(
        videoId=req.videoId,
        frames=len(media.jpegs),
        mediaCached=cached,
        framesMs=0.0 if cached else round(media.frames_ms, 1),
        totalMs=round((time.perf_counter() - started) * 1000, 1),
        captionStatus=media.caption_status,
        caption=media.caption,
        model=settings.captioner,
    )
    log.info("%s %s cached=%s total=%.0fms", key, media.caption_status, cached, res.totalMs)
    return res


@app.get("/media/{platform}/{video_id}", response_model=MediaResponse)
async def media_status(platform: str, video_id: str, request: Request, authorization: str | None = Header(default=None)):
    who = await _caller(request, authorization)
    _rate_limit(who, bucket="poll", per_min=settings.rate_per_min * 5)  # cheap dict lookup; clients poll
    media = store.get(_media_key(platform, video_id))
    if media is None:
        raise HTTPException(status_code=404, detail="unknown reel; POST /describe first")
    return MediaResponse(
        videoId=video_id,
        frames=len(media.jpegs),
        captionStatus=media.caption_status,
        caption=media.caption,
    )
