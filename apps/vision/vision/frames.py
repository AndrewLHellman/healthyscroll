"""
Pull a handful of frames out of a video without downloading all of it.

Instagram serves Reels as MPEG-DASH: the manifest lists one fragmented MP4 per
quality level, each addressed by byte ranges. We pick the smallest video
representation and hand its URL to ffmpeg with `-ss` *before* `-i`, so ffmpeg
reads the index and fetches only the bytes around each timestamp (HTTP range
requests). The same path works for a plain progressive MP4 URL or a local file.

Frames: one every VISION_FRAME_EVERY_S (default 2 s), at most VISION_MAX_FRAMES (8),
plus the poster image as frame 0 when given. ffmpeg runs once per timestamp, in
parallel threads. (Threads rather than
asyncio subprocesses: the latter needs the Proactor loop on Windows, which
uvicorn doesn't always use.)
"""

from __future__ import annotations

import asyncio
import subprocess
import tempfile
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

import httpx
from PIL import Image

from .config import settings

# Instagram's CDN is happier with a browser-like UA than ffmpeg's default.
USER_AGENT = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
)
FFMPEG_TIMEOUT_S = 15

_DASH_NS = {"mpd": "urn:mpeg:dash:schema:mpd:2011"}


@dataclass
class VideoSource:
    """Exactly one of these should be set."""

    manifest: str | None = None  # DASH MPD XML, as found in Instagram's API responses
    url: str | None = None  # progressive MP4 / fMP4 URL
    path: str | None = None  # local file (benchmark)
    # Optional: the Reel's cover image. Cheap (one small JPEG) and usually shows
    # the "hook", so it becomes frame 0.
    poster_url: str | None = None


# Timestamp recorded for the poster frame.
POSTER_T = -1.0


@dataclass
class Frames:
    images: list[Image.Image]
    timestamps: list[float]  # seconds; POSTER_T for the poster
    elapsed_ms: float
    input_desc: str


def sample_timestamps(duration: float | None) -> list[float]:
    """0.5 s, then every VISION_FRAME_EVERY_S, capped at VISION_MAX_FRAMES and the video's length.

    With no known duration we ask for the full set; ffmpeg returns nothing past
    the end and those frames are dropped (requests run in parallel, so it's free).
    """
    step, cap = settings.frame_every_s, settings.max_frames
    ts = [0.5 + i * step for i in range(cap)]
    if duration:
        ts = [t for t in ts if t < duration - 0.1] or [max(0.0, duration / 2)]
    return ts


def pick_dash_video_url(manifest: str) -> tuple[str | None, float | None]:
    """Smallest video representation's BaseURL (>= 360p when available) and the duration in seconds."""
    try:
        root = ET.fromstring(manifest)
    except ET.ParseError as err:
        raise ValueError(f"manifest is not valid XML: {err}") from err
    duration = _parse_iso_duration(root.get("mediaPresentationDuration"))

    candidates: list[tuple[int, int, str]] = []  # (height, bandwidth, url)
    for aset in root.iterfind(".//mpd:AdaptationSet", _DASH_NS):
        for rep in aset.iterfind("mpd:Representation", _DASH_NS):
            mime = rep.get("mimeType") or aset.get("mimeType") or ""
            ctype = aset.get("contentType") or ""
            if "video" not in mime and ctype != "video":
                continue
            base = rep.find("mpd:BaseURL", _DASH_NS)
            if base is None or not (base.text or "").strip():
                continue
            height = int(rep.get("height") or aset.get("height") or 0)
            bandwidth = int(rep.get("bandwidth") or 0)
            candidates.append((height, bandwidth, base.text.strip()))

    if not candidates:
        return None, duration
    good = [c for c in candidates if c[0] >= 360] or candidates
    good.sort(key=lambda c: (c[1], c[0]))
    return good[0][2], duration


def _parse_iso_duration(value: str | None) -> float | None:
    """'PT12.345S' / 'PT1M3S' -> seconds. Only the forms DASH manifests use."""
    if not value or not value.startswith("PT"):
        return None
    seconds, num = 0.0, ""
    for ch in value[2:]:
        if ch.isdigit() or ch == ".":
            num += ch
            continue
        if not num:
            continue
        seconds += float(num) * {"H": 3600, "M": 60, "S": 1}.get(ch, 0)
        num = ""
    return seconds


def _grab_one(input_: str, t: float, long_side: int, is_remote: bool) -> Image.Image | None:
    # Scale so the longer side is `long_side` (Reels are portrait; this keeps landscape sane too).
    scale = f"scale='if(gt(iw,ih),{long_side},-2)':'if(gt(iw,ih),-2,{long_side})'"
    cmd = [settings.ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin"]
    if is_remote:
        cmd += ["-user_agent", USER_AGENT, "-rw_timeout", "8000000"]
        cmd += ["-protocol_whitelist", "file,http,https,tcp,tls,crypto"]
    cmd += ["-ss", f"{t:.3f}", "-i", input_, "-frames:v", "1", "-vf", scale]
    cmd += ["-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "3", "pipe:1"]
    proc = subprocess.run(cmd, capture_output=True, timeout=FFMPEG_TIMEOUT_S)
    if proc.returncode != 0 or not proc.stdout:
        return None
    return Image.open(BytesIO(proc.stdout)).convert("RGB")


def _fetch_poster(url: str, long_side: int) -> Image.Image | None:
    try:
        res = httpx.get(url, headers={"User-Agent": USER_AGENT}, timeout=5, follow_redirects=True)
        res.raise_for_status()
        img = Image.open(BytesIO(res.content)).convert("RGB")
    except (httpx.HTTPError, OSError):
        return None  # the video frames are enough on their own
    img.thumbnail((long_side, long_side))
    return img


async def extract_frames(
    source: VideoSource,
    timestamps: list[float] | None = None,
    long_side: int | None = None,
) -> Frames:
    started = time.perf_counter()
    long_side = long_side or settings.frame_long_side

    tmp_manifest: Path | None = None
    duration: float | None = None
    try:
        if source.manifest:
            url, duration = pick_dash_video_url(source.manifest)
            if url:
                input_, remote, desc = url, True, "dash-representation"
            else:
                # No usable BaseURL: let ffmpeg's DASH demuxer read the manifest itself.
                with tempfile.NamedTemporaryFile("w", suffix=".mpd", delete=False, encoding="utf-8") as f:
                    f.write(source.manifest)
                    tmp_manifest = Path(f.name)
                input_, remote, desc = str(tmp_manifest), True, "dash-manifest"
        elif source.url:
            input_, remote, desc = source.url, True, "url"
        elif source.path:
            input_, remote, desc = source.path, False, "file"
        else:
            raise ValueError("VideoSource needs manifest, url or path")

        if timestamps:
            # Explicit timestamps: still don't ask for frames past the end.
            timestamps = [t for t in timestamps if not duration or t < duration - 0.1] or [0.5]
        else:
            timestamps = sample_timestamps(duration)

        poster_task = (
            asyncio.to_thread(_fetch_poster, source.poster_url, long_side) if source.poster_url else None
        )
        results = await asyncio.gather(
            *(asyncio.to_thread(_grab_one, input_, t, long_side, remote) for t in timestamps)
        )
        poster = await poster_task if poster_task else None
    finally:
        if tmp_manifest:
            tmp_manifest.unlink(missing_ok=True)

    kept = [(img, t) for img, t in zip(results, timestamps) if img is not None]
    if poster is not None:
        kept.insert(0, (poster, POSTER_T))
    return Frames(
        images=[img for img, _ in kept],
        timestamps=[t for _, t in kept],
        elapsed_ms=(time.perf_counter() - started) * 1000,
        input_desc=desc,
    )
