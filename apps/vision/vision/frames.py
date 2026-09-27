"""
Pull a handful of frames out of a video without downloading all of it.

Instagram serves Reels as MPEG-DASH: the manifest lists one fragmented MP4 per
quality level, each addressed by byte ranges. We pick the smallest video
representation and hand its URL to ffmpeg with `-ss` *before* `-i`, so ffmpeg
reads the index and fetches only the bytes around each timestamp (HTTP range
requests). The same path works for a plain progressive MP4 URL or a local file.

Frames: one every VISION_FRAME_EVERY_S (default 3 s), at most VISION_MAX_FRAMES (3),
plus the poster image as frame 0 when given. Greedy by design: one range request
for the first few hundred KB of the smallest representation (prefix_budget),
decoded from memory by one ffmpeg process; whatever frames fall inside that
prefix are the frames. Fixed cost per Reel, however long it is. If the file's
index isn't at the front (a non-faststart MP4) ffmpeg seeks over HTTP instead.
(History, 2026-09-27: one ffmpeg per timestamp, each with its own TLS handshake
+ index fetch + seek to a CDN 155 ms away, took 5-7 s per Reel; one ffmpeg
streaming 10 s of video took ~3.4 s; the VLM itself takes < 1 s.)
Explicit timestamps (benchmarks) still use one seek per timestamp.
ffmpeg runs in threads rather than asyncio subprocesses: the latter needs the
Proactor loop on Windows, which uvicorn doesn't always use.
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

    With no known duration we ask for the full set; ffmpeg stops at the end of a
    shorter video and we keep the frames it did produce.
    """
    step, cap = settings.frame_every_s, settings.max_frames
    ts = [0.5 + i * step for i in range(cap)]
    if duration:
        ts = [t for t in ts if t < duration - 0.1] or [max(0.0, duration / 2)]
    return ts


def pick_dash_video_url(manifest: str) -> tuple[str | None, float | None, int | None]:
    """Smallest video representation's BaseURL (>= 360p when available), the duration in seconds, its bandwidth (bit/s)."""
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
        return None, duration, None
    good = [c for c in candidates if c[0] >= 360] or candidates
    good.sort(key=lambda c: (c[1], c[0]))
    return good[0][2], duration, good[0][1] or None


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


def _ffmpeg_cmd(input_: str, start: float, is_remote: bool) -> list[str]:
    cmd = [settings.ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin"]
    if is_remote:
        cmd += ["-user_agent", USER_AGENT, "-rw_timeout", "8000000"]
        cmd += ["-protocol_whitelist", "file,http,https,tcp,tls,crypto"]
    # -ss before -i: seek in the container index, don't decode from 0.
    return cmd + ["-ss", f"{start:.3f}", "-i", input_]


def _scale_filter(long_side: int) -> str:
    # Scale so the longer side is `long_side` (Reels are portrait; this keeps landscape sane too).
    return f"scale='if(gt(iw,ih),{long_side},-2)':'if(gt(iw,ih),-2,{long_side})'"


_MJPEG_OUT = ["-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "3", "pipe:1"]
_JPEG_SOI = b"\xff\xd8\xff"


def _grab_one(input_: str, t: float, long_side: int, is_remote: bool) -> Image.Image | None:
    cmd = _ffmpeg_cmd(input_, t, is_remote) + ["-frames:v", "1", "-vf", _scale_filter(long_side)] + _MJPEG_OUT
    proc = subprocess.run(cmd, capture_output=True, timeout=FFMPEG_TIMEOUT_S)
    if proc.returncode != 0 or not proc.stdout:
        return None
    return Image.open(BytesIO(proc.stdout)).convert("RGB")


def _grab_every(
    input_: str, start: float, step: float, count: int, long_side: int, is_remote: bool
) -> list[Image.Image]:
    """`count` frames at start, start+step, ... from one ffmpeg run (one connection, one decode)."""
    # select: the first frame, then the first frame at least `step` after the last
    # selected one. (Not the fps filter: it waits for the frame *after* each slot,
    # so the last one never arrives within -t.)
    select = f"select='isnan(prev_selected_t)+gte(t-prev_selected_t\\,{step:g})'"
    cmd = _ffmpeg_cmd(input_, start, is_remote)
    cmd += ["-t", f"{step * (count - 1) + 0.6:.3f}", "-frames:v", str(count)]
    cmd += ["-vf", f"{select},{_scale_filter(long_side)}", "-fps_mode", "passthrough"] + _MJPEG_OUT
    proc = subprocess.run(cmd, capture_output=True, timeout=FFMPEG_TIMEOUT_S)
    # A non-zero exit with some frames out (e.g. short video) is still useful.
    return _split_mjpeg(proc.stdout, count)


# One client for every CDN fetch: keep-alive skips the TLS handshake (~0.3 s at
# the CDN's distance) for the next Reel on the same host.
_http = httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=6, follow_redirects=True)

# How much of the video to pull: enough for PREFIX_S seconds at the
# representation's bitrate (plus the index at the front), within bounds.
PREFIX_S = 6.0
PREFIX_MIN = 200_000
PREFIX_MAX = 600_000
PREFIX_UNKNOWN = 450_000  # a progressive MP4 URL: bitrate unknown, usually 720p


def prefix_budget(bandwidth: int | None) -> int:
    if not bandwidth:
        return PREFIX_UNKNOWN
    return int(min(PREFIX_MAX, max(PREFIX_MIN, bandwidth / 8 * PREFIX_S * 1.15 + 64_000)))


def _fetch_prefix(url: str, budget: int) -> bytes:
    """The first `budget` bytes of the file: one range request, no more."""
    buf = bytearray()
    try:
        with _http.stream("GET", url, headers={"Range": f"bytes=0-{budget - 1}"}) as res:
            if res.status_code not in (200, 206):
                return b""
            for chunk in res.iter_bytes():
                buf += chunk
                if len(buf) >= budget:
                    break  # the server ignored Range (200): stop reading anyway
    except httpx.HTTPError:
        return b""
    return bytes(buf[:budget])


def _grab_from_bytes(data: bytes, step: float, count: int, long_side: int) -> list[Image.Image]:
    """Up to `count` frames, `step` seconds apart, from a truncated MP4/fMP4 in memory.

    ffmpeg decodes what's there and errors at the cut; the frames it emitted
    first are still on stdout. Needs the index (moov / sidx) at the front, which
    DASH representations and faststart MP4s have. Returns [] otherwise.
    """
    # First frame after the fade-in, then one every `step`.
    select = f"select='gte(t\\,0.4)*isnan(prev_selected_t)+gte(t-prev_selected_t\\,{step:g})'"
    cmd = [settings.ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-i", "pipe:0"]
    cmd += ["-frames:v", str(count), "-vf", f"{select},{_scale_filter(long_side)}", "-fps_mode", "passthrough"]
    cmd += _MJPEG_OUT
    try:
        proc = subprocess.run(cmd, input=data, capture_output=True, timeout=FFMPEG_TIMEOUT_S)
    except subprocess.TimeoutExpired:
        return []
    return _split_mjpeg(proc.stdout, count)


def _split_mjpeg(data: bytes, count: int) -> list[Image.Image]:
    images: list[Image.Image] = []
    # An MJPEG stream is just JPEGs back to back; SOI can't occur inside a JPEG.
    for chunk in data.split(_JPEG_SOI)[1:]:
        try:
            images.append(Image.open(BytesIO(_JPEG_SOI + chunk)).convert("RGB"))
        except OSError:
            break  # truncated last frame
    return images[:count]


def _fetch_poster(url: str, long_side: int) -> Image.Image | None:
    try:
        res = _http.get(url)
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
    bandwidth: int | None = None
    try:
        if source.manifest:
            url, duration, bandwidth = pick_dash_video_url(source.manifest)
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

        poster_task = (
            asyncio.to_thread(_fetch_poster, source.poster_url, long_side) if source.poster_url else None
        )
        if timestamps:
            # Explicit timestamps: still don't ask for frames past the end.
            timestamps = [t for t in timestamps if not duration or t < duration - 0.1] or [0.5]
            results = await asyncio.gather(
                *(asyncio.to_thread(_grab_one, input_, t, long_side, remote) for t in timestamps)
            )
        else:
            timestamps = sample_timestamps(duration)
            step = settings.frame_every_s
            images: list[Image.Image] = []
            if remote and desc != "dash-manifest":
                # Greedy path: the first few hundred KB in one range request,
                # decoded from memory. Cost is fixed no matter how long the Reel is.
                data = await asyncio.to_thread(_fetch_prefix, input_, prefix_budget(bandwidth))
                if data:
                    images = await asyncio.to_thread(_grab_from_bytes, data, step, len(timestamps), long_side)
                    if images:
                        desc += "+prefix"
            if not images:
                # Index not at the front, or the fetch failed: let ffmpeg seek over HTTP.
                if len(timestamps) == 1:
                    one = await asyncio.to_thread(_grab_one, input_, timestamps[0], long_side, remote)
                    images = [one] if one else []
                else:
                    images = await asyncio.to_thread(
                        _grab_every, input_, timestamps[0], step, len(timestamps), long_side, remote
                    )
            # A short video (or a small prefix) yields fewer frames; they're the leading ones.
            timestamps = timestamps[: len(images)]
            results = list(images)
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
