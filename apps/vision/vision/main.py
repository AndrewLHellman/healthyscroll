"""
Healthy Scroll vision service.

    POST /analyze                    Reel media + the user's policy -> fast visual verdict
    GET  /media/{platform}/{videoId} poll for the Reel's caption (after an "uncertain")
    GET  /health

Flow (see apps/vision/README.md):
  1. Per Reel, once, shared by all users: fetch ~1 frame / 2 s (max 8) + poster,
     embed with SigLIP 2, cache.                                      (~100-300 ms)
  2. Per user: score the policy against the cached embeddings.       (<1 ms)
  3. If that's uncertain: caption the Reel once in the background (Qwen3-VL /
     Gemini), cached per Reel. The client polls /media/... and sends the
     caption to Jev (/api/evaluate `frames[].caption`) for the final call.

The extension calls this for *upcoming* Reels as soon as they appear, so the
answer is usually ready before the viewer swipes to them.

Run:  uvicorn vision.main:app --port 8000        (from apps/vision, venv active)
"""

from __future__ import annotations

import asyncio
import hashlib
import os
import logging
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel, Field, model_validator

from .auth import verify_bearer
from .config import settings
from .frames import POSTER_T, VideoSource, extract_frames
from .media import CaptionStatus, Media, MediaStore, to_jpegs
from .scorers import REGISTRY, build_scorer

log = logging.getLogger("vision")
logging.basicConfig(level=logging.INFO)

state: dict = {}
store = MediaStore()


@asynccontextmanager
async def lifespan(_: FastAPI):
    log.info("scorer=%s captioner=%s quantize=%s", settings.model, settings.captioner, settings.quantize)
    scorer = build_scorer(settings.model, quantize=settings.quantize)
    captioner = None
    if settings.captioner != "none":
        captioner = (
            scorer if settings.captioner == settings.model
            else build_scorer(settings.captioner, quantize=settings.quantize)
        )
        if not hasattr(captioner, "describe"):
            raise RuntimeError(f"VISION_CAPTIONER={settings.captioner} can't describe(); use an hf or gateway model")
    # Separate locks: a multi-second caption must never hold up the fast path
    # (embeddings + per-user scores, tens of ms). Both models fit in VRAM together;
    # CUDA interleaves their kernels. Same model for both -> share one lock.
    gpu = asyncio.Lock()
    state.update(
        scorer=scorer,
        captioner=captioner,
        gpu=gpu,
        caption_lock=gpu if captioner is scorer else asyncio.Lock(),
    )

    # First inference pays for CUDA init and kernel selection (~1.5 s); do it now,
    # not on the first real Reel.
    blank = [Image.new("RGB", (252, 448), "gray")] * 3
    await asyncio.to_thread(scorer.score, blank, "warm-up")
    if captioner is not None and captioner is not scorer and hasattr(captioner, "score"):
        await asyncio.to_thread(captioner.score, blank, "warm-up")
    yield
    scorer.close()
    if captioner is not None and captioner is not scorer:
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


class AnalyzeRequest(BaseModel):
    videoId: str = Field(min_length=1, max_length=128)
    platform: Literal["instagram", "tiktok"] = "instagram"
    policy: str = Field(min_length=1, max_length=2000)
    # Exactly one of these. `manifest` is the DASH MPD from Instagram's API response.
    manifest: str | None = Field(default=None, max_length=500_000)
    videoUrl: str | None = None
    # The Reel's cover image; used as frame 0.
    posterUrl: str | None = None
    # When the fast score is "uncertain", resolve it right here: ask the caption VLM
    # (Qwen3-VL) "is it about / does it feature the policy's topics?" from the frames
    # (~0.5 s, cached per Reel + policy) and return skip/allow. Without it, an
    # uncertain Reel gets a background caption for the client to send to Jev.
    deep: bool = False

    @model_validator(mode="after")
    def one_source(self):
        if bool(self.manifest) == bool(self.videoUrl):
            raise ValueError("send exactly one of manifest or videoUrl")
        return self


class AnalyzeResponse(BaseModel):
    videoId: str
    verdict: Literal["skip", "allow", "uncertain"]
    violatesProbability: float
    model: str
    # What matched best (SigLIP): the policy concept and the frame's timestamp.
    matched: str | None = None
    frames: int
    # True when this Reel's frames/embeddings came from the shared cache.
    mediaCached: bool
    framesMs: float
    modelMs: float
    totalMs: float
    # Caption for the Jev escalation path. "pending" -> poll GET /media/...
    captionStatus: CaptionStatus
    caption: str | None = None
    # Present when deep=true and the fast score was uncertain: the VLM's P(yes).
    deepProbability: float | None = None


class MediaResponse(BaseModel):
    videoId: str
    frames: int
    captionStatus: CaptionStatus
    caption: str | None = None


# --- helpers -----------------------------------------------------------------

_hits: dict[str, deque[float]] = defaultdict(deque)


def _rate_limit(who: str, bucket: str = "analyze", per_min: int | None = None) -> None:
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


def _thresholds() -> tuple[float, float]:
    spec = REGISTRY[settings.model]
    skip = settings.skip_threshold if settings.skip_threshold is not None else spec.skip
    allow = settings.allow_threshold if settings.allow_threshold is not None else spec.allow
    return skip, allow


def _verdict(p: float) -> Literal["skip", "allow", "uncertain"]:
    skip, allow = _thresholds()
    if p >= skip:
        return "skip"
    if p <= allow:
        return "allow"
    return "uncertain"


def _media_key(platform: str, video_id: str) -> str:
    return f"{platform}:{video_id}"


async def _build_media(key: str, source: VideoSource) -> Media:
    frames = await extract_frames(source)
    if not frames.images:
        # Never skip on error: the extension treats 422 as "leave the video alone".
        raise HTTPException(status_code=422, detail=f"no frames extracted ({frames.input_desc})")
    media = Media(
        key=key,
        jpegs=to_jpegs(frames.images),
        timestamps=frames.timestamps,
        frames_ms=frames.elapsed_ms,
        input_desc=frames.input_desc,
    )
    scorer = state["scorer"]
    if hasattr(scorer, "embed_images"):
        async with state["gpu"]:
            media.features = await asyncio.to_thread(scorer.embed_images, frames.images)
    return media


CAPTION_MAX_FRAMES = 4
# Real Reels (2026-09-26, "cats, dogs, animals", topic-wording prompt): non-animal <= 0.06,
# a chihuahua Reel 0.84. Few positives so far; retune with bench/ on labeled Reels.
DEEP_SKIP = float(os.getenv("VISION_DEEP_SKIP_THRESHOLD", "0.3"))


def _spread(items: list, n: int) -> list:
    """n items evenly spaced across the list (keeps first and last)."""
    if len(items) <= n:
        return items
    return [items[round(i * (len(items) - 1) / (n - 1))] for i in range(n)]


async def _caption(media: Media) -> None:
    try:
        started = time.perf_counter()
        # Generation cost grows with visual tokens; 4 spread-out frames tell the story.
        frames = _spread(media.images(), CAPTION_MAX_FRAMES)
        async with state["caption_lock"]:
            media.caption = await asyncio.to_thread(state["captioner"].describe, frames)
        media.caption_status = "ready"
        log.info("%s caption in %.0f ms: %s", media.key, (time.perf_counter() - started) * 1000, media.caption)
    except Exception:
        log.exception("%s caption failed", media.key)
        media.caption_status = "failed"


# --- routes ------------------------------------------------------------------


@app.get("/health")
def health():
    skip, allow = _thresholds()
    return {
        "ok": True,
        "model": settings.model,
        "captioner": settings.captioner,
        "thresholds": {"skip": skip, "allow": allow},
        "cachedReels": len(store._entries),
    }


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest, request: Request, authorization: str | None = Header(default=None)):
    who = await _caller(request, authorization)
    _rate_limit(who)
    started = time.perf_counter()

    key = _media_key(req.platform, req.videoId)
    source = VideoSource(manifest=req.manifest, url=req.videoUrl, poster_url=req.posterUrl)
    try:
        media, cached = await store.get_or_build(key, lambda: _build_media(key, source))
    except ValueError as err:  # malformed manifest
        raise HTTPException(status_code=422, detail=str(err)) from err

    scorer = state["scorer"]
    t0 = time.perf_counter()
    matched = None
    if media.features is not None:
        async with state["gpu"]:
            score = await asyncio.to_thread(scorer.score_embeddings, media.features, req.policy)
        p = score.probability
        frame_t = media.timestamps[score.detail["frame"]]
        matched = f'{score.detail["concept"]} @ {"poster" if frame_t == POSTER_T else f"{frame_t:g}s"}'
    else:
        # VLM scorer: policy-dependent, so cache per policy on the Reel.
        policy_key = hashlib.sha1(req.policy.strip().lower().encode()).hexdigest()
        if policy_key not in media.scores:
            async with state["gpu"]:
                score = await asyncio.to_thread(scorer.score, media.images(), req.policy)
            media.scores[policy_key] = score.probability
        p = media.scores[policy_key]
    model_ms = (time.perf_counter() - t0) * 1000

    verdict = _verdict(p)

    deep_p = None
    captioner = state["captioner"]
    if verdict == "uncertain" and req.deep and captioner is not None and hasattr(captioner, "score"):
        deep_key = "deep:" + hashlib.sha1(req.policy.strip().lower().encode()).hexdigest()
        if deep_key not in media.scores:
            frames = _spread(media.images(), CAPTION_MAX_FRAMES)
            async with state["caption_lock"]:
                score = await asyncio.to_thread(captioner.score, frames, req.policy)
            media.scores[deep_key] = score.probability
        deep_p = media.scores[deep_key]
        # Deep is the tie-breaker for "uncertain", so it decides outright either way.
        # (No background caption then: it would hold the VLM for 3-7 s and delay the
        # next Reel's deep check.)
        verdict = "skip" if deep_p >= DEEP_SKIP else "allow"

    if verdict == "uncertain" and state["captioner"] is not None and media.caption_status in ("none", "failed"):
        media.caption_status = "pending"
        asyncio.create_task(_caption(media))

    res = AnalyzeResponse(
        videoId=req.videoId,
        verdict=verdict,
        violatesProbability=round(p, 5),
        model=settings.model,
        matched=matched,
        frames=len(media.jpegs),
        mediaCached=cached,
        framesMs=0.0 if cached else round(media.frames_ms, 1),
        modelMs=round(model_ms, 2),
        totalMs=round((time.perf_counter() - started) * 1000, 1),
        captionStatus=media.caption_status,
        caption=media.caption,
        deepProbability=None if deep_p is None else round(deep_p, 4),
    )
    log.info("%s %s p=%.4f%s cached=%s total=%.0fms", key, verdict, p,
             "" if deep_p is None else f" deep={deep_p:.3f}", cached, res.totalMs)
    return res


@app.get("/media/{platform}/{video_id}", response_model=MediaResponse)
async def media_status(platform: str, video_id: str, request: Request, authorization: str | None = Header(default=None)):
    who = await _caller(request, authorization)
    _rate_limit(who, bucket="poll", per_min=settings.rate_per_min * 5)  # cheap dict lookup; clients poll
    media = store.get(_media_key(platform, video_id))
    if media is None:
        raise HTTPException(status_code=404, detail="unknown reel; POST /analyze first")
    return MediaResponse(
        videoId=video_id,
        frames=len(media.jpegs),
        captionStatus=media.caption_status,
        caption=media.caption,
    )
