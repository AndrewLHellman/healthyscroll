"""
Healthy Scroll vision service.

    POST /describe                   Reel media -> a short description of what's in it
    GET  /media/{platform}/{videoId} poll for that description if it wasn't ready in time
    GET  /health

The service makes no decisions. It turns a Reel's video into text, once, shared
by every user; the extension hands that text to Jev (/api/evaluate,
`frames[].caption`) together with the Reel's own caption, and Jev decides
against the user's policy. Nothing about any user's policy is sent here.

Flow (see apps/vision/README.md), per Reel, once, in two stages that run together:
  poster  fetch the cover image (one small JPEG, ~50 ms) and have the VLM
          (Gemini via the AI Gateway, or Qwen3-VL on a GPU) describe it.  (~0.8 s)
  frames  fetch the first few hundred KB of the video (one range request),
          ~1 frame / 3 s (max 3) from it with ffmpeg, describe poster + frames.
          This one is final.                                             (~1.7 s)
/describe waits up to CAPTION_WAIT_S for the *first* description; the client
polls /media/... for the final one only if it still needs it (Jev was unsure).
Most Reels are settled on the poster alone and the frames stage is just filling
the shared cache.

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
from .frames import VideoSource, extract_frames, fetch_poster
from .media import CaptionStage, CaptionStatus, Media, MediaStore, to_jpegs
from .scorers import REGISTRY, build_scorer

log = logging.getLogger("vision")
logging.basicConfig(level=logging.INFO)

state: dict = {}
store = MediaStore()

# Generation cost grows with visual tokens; 4 spread-out frames tell the story.
CAPTION_MAX_FRAMES = 4
# How long /describe holds the request for the first description before handing
# the client off to polling. A gateway poster caption takes ~0.8 s, a laptop GPU 3-7 s.
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
    # Images the best description so far was written from (poster counts as one).
    frames: int
    # True when this Reel came from the shared cache (another user saw it first).
    mediaCached: bool
    framesMs: float
    totalMs: float
    # "pending" -> a better `caption` may follow (it can already be set): poll GET /media/... .
    # "ready" -> `caption` is set and nothing more is coming. "failed" -> give up.
    captionStatus: CaptionStatus
    caption: str | None = None
    # Which stage wrote `caption`: the cover image alone, or poster + video frames.
    stage: CaptionStage | None = None
    model: str


class MediaResponse(BaseModel):
    videoId: str
    frames: int
    captionStatus: CaptionStatus
    caption: str | None = None
    stage: CaptionStage | None = None


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
    """The cheap part, done before /describe answers: just the poster. Frames come in the background."""
    media = Media(key=key)
    if source.poster_url:
        poster = await fetch_poster(source.poster_url)
        if poster is not None:
            media.poster_jpeg = to_jpegs([poster])[0]
    return media


def _spread(items: list, n: int) -> list:
    """n items evenly spaced across the list (keeps first and last)."""
    if len(items) <= n:
        return items
    return [items[round(i * (len(items) - 1) / (n - 1))] for i in range(n)]


def _set_status(media: Media, stage: CaptionStage, status: CaptionStatus) -> None:
    setattr(media, f"{stage}_status", status)
    media.notify()


async def _describe(media: Media, stage: CaptionStage, images: list) -> None:
    started = time.perf_counter()
    async with state["caption_slots"]:
        text = await asyncio.to_thread(state["captioner"].describe, images)
    # Stages can finish out of order (a slow poster call); never downgrade frames -> poster.
    if not (stage == "poster" and media.frames_status == "ready"):
        media.caption, media.stage = text, stage
    log.info("%s %s caption in %.0f ms: %s", media.key, stage, (time.perf_counter() - started) * 1000, text)


async def _poster_stage(media: Media) -> None:
    try:
        await _describe(media, "poster", [media.poster_image()])
        _set_status(media, "poster", "ready")
    except Exception:
        log.exception("%s poster caption failed", media.key)
        _set_status(media, "poster", "failed")
        media.poster_task = None  # let the next /describe for this Reel retry


async def _frames_stage(media: Media, source: VideoSource) -> None:
    try:
        # The poster was fetched in _build_media; pull only video frames here.
        frames = await extract_frames(VideoSource(manifest=source.manifest, url=source.url, path=source.path))
        media.jpegs = to_jpegs(frames.images)
        media.timestamps = frames.timestamps
        media.frames_ms = frames.elapsed_ms
        media.input_desc = frames.input_desc
        log.info("%s frames=%d (%s, %.0fms)", media.key, len(frames.images), frames.input_desc, frames.elapsed_ms)
        if not frames.images:
            raise RuntimeError(f"no frames extracted ({frames.input_desc})")
        await _describe(media, "frames", _spread(media.all_images(), CAPTION_MAX_FRAMES))
        _set_status(media, "frames", "ready")
    except Exception:
        log.exception("%s frames caption failed", media.key)
        _set_status(media, "frames", "failed")
        media.frames_task = None


def _ensure_stages(media: Media, source: VideoSource) -> None:
    """Start whatever hasn't run (or failed last time); concurrent callers share the tasks."""
    if media.poster_jpeg and media.poster_status in ("none", "failed") and media.poster_task is None:
        media.poster_status = "pending"
        media.poster_task = asyncio.create_task(_poster_stage(media))
    if media.frames_status in ("none", "failed") and media.frames_task is None:
        media.frames_status = "pending"
        media.frames_task = asyncio.create_task(_frames_stage(media, source))


async def _wait_for_first_caption(media: Media, timeout: float) -> None:
    """Return once any stage has written a description, nothing is running any more, or time is up."""
    deadline = time.perf_counter() + timeout
    while media.caption is None and media.caption_status == "pending":
        remaining = deadline - time.perf_counter()
        if remaining <= 0:
            return
        try:
            await asyncio.wait_for(media.changed.wait(), timeout=remaining)
        except asyncio.TimeoutError:
            return


def _image_count(media: Media) -> int:
    """How many images the current `caption` was written from."""
    if media.stage == "frames":
        return min((1 if media.poster_jpeg else 0) + len(media.jpegs), CAPTION_MAX_FRAMES)
    return 1 if media.stage == "poster" else 0


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
    media, cached = await store.get_or_build(key, lambda: _build_media(key, source))
    # A malformed manifest or unreachable video surfaces as the frames stage failing;
    # the poster stage still answers if there was a poster.
    _ensure_stages(media, source)
    await _wait_for_first_caption(media, CAPTION_WAIT_S - (time.perf_counter() - started))

    res = DescribeResponse(
        videoId=req.videoId,
        frames=_image_count(media),
        mediaCached=cached,
        framesMs=0.0 if cached else round(media.frames_ms, 1),
        totalMs=round((time.perf_counter() - started) * 1000, 1),
        captionStatus=media.caption_status,
        caption=media.caption,
        stage=media.stage,
        model=settings.captioner,
    )
    log.info(
        "%s %s stage=%s cached=%s total=%.0fms",
        key, media.caption_status, media.stage, cached, res.totalMs,
    )
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
        frames=_image_count(media),
        captionStatus=media.caption_status,
        caption=media.caption,
        stage=media.stage,
    )
