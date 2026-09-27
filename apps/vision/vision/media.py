"""
Global media cache: one entry per Reel, shared by every user.

Fetching frames and describing them doesn't depend on who is watching, so a
popular Reel is only fetched and captioned once. Nothing here is per user.

A Reel is described in two stages (main.py drives them):
  poster  the cover image alone, captioned right away (~0.8 s: one small JPEG,
          one VLM call). The extension acts on this if it's conclusive.
  frames  poster + frames from the video, captioned once ffmpeg has them (~1.7 s).
`caption` is always the best description so far; `stage` says which one it is,
and `caption_status` stays "pending" while a better one may still come.

Frames are kept as JPEG bytes (~20 KB each) until the final caption is written.

In-memory for now; move to Redis/Supabase if the service runs on more than one box.
"""

from __future__ import annotations

import asyncio
import time
from collections import OrderedDict
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from io import BytesIO
from typing import Literal

from PIL import Image

CaptionStatus = Literal["none", "pending", "ready", "failed"]
CaptionStage = Literal["poster", "frames"]


@dataclass
class Media:
    key: str
    # The cover image, if the Reel had one we could fetch.
    poster_jpeg: bytes | None = None
    # Video frames (without the poster), filled in by the frames stage.
    jpegs: list[bytes] = field(default_factory=list)
    timestamps: list[float] = field(default_factory=list)
    frames_ms: float = 0.0
    input_desc: str = "pending"
    # Best description so far and which stage wrote it.
    caption: str | None = None
    stage: CaptionStage | None = None
    # Per-stage status. "none" = not started, "pending" = running.
    poster_status: CaptionStatus = "none"
    frames_status: CaptionStatus = "none"
    # In-flight work; /describe callers wait on these together.
    poster_task: asyncio.Task | None = None
    frames_task: asyncio.Task | None = None
    # Fires on every status change so waiters can re-check.
    changed: asyncio.Event = field(default_factory=asyncio.Event)
    created_at: float = field(default_factory=time.time)

    @property
    def caption_status(self) -> CaptionStatus:
        """
        "pending" while any stage is still running (a better `caption` may follow, even
        if one is already set); "ready" once nothing more is coming and there is one;
        "failed" when nothing more is coming and there isn't.
        """
        if "pending" in (self.poster_status, self.frames_status):
            return "pending"
        if self.caption is not None:
            return "ready"
        if "failed" in (self.poster_status, self.frames_status):
            return "failed"
        return "none"

    def notify(self) -> None:
        self.changed.set()
        self.changed.clear()

    def poster_image(self) -> Image.Image | None:
        return Image.open(BytesIO(self.poster_jpeg)).convert("RGB") if self.poster_jpeg else None

    def frame_images(self) -> list[Image.Image]:
        return [Image.open(BytesIO(b)).convert("RGB") for b in self.jpegs]

    def all_images(self) -> list[Image.Image]:
        poster = self.poster_image()
        return ([poster] if poster else []) + self.frame_images()


def to_jpegs(images: list[Image.Image]) -> list[bytes]:
    out = []
    for img in images:
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=85)
        out.append(buf.getvalue())
    return out


class MediaStore:
    def __init__(self, max_entries: int = 2048):
        self._entries: OrderedDict[str, Media] = OrderedDict()
        self._building: dict[str, asyncio.Future[Media]] = {}
        self._max = max_entries

    def get(self, key: str) -> Media | None:
        media = self._entries.get(key)
        if media:
            self._entries.move_to_end(key)
        return media

    async def get_or_build(self, key: str, build: Callable[[], Awaitable[Media]]) -> tuple[Media, bool]:
        """(media, was_cached). Concurrent requests for the same Reel share one build."""
        if media := self.get(key):
            return media, True
        if pending := self._building.get(key):
            return await pending, True

        future: asyncio.Future[Media] = asyncio.get_running_loop().create_future()
        self._building[key] = future
        try:
            media = await build()
            self._entries[key] = media
            if len(self._entries) > self._max:
                self._entries.popitem(last=False)
            future.set_result(media)
            return media, False
        except BaseException as err:
            future.set_exception(err)
            future.exception()  # mark retrieved so waiters-less failures don't warn
            raise
        finally:
            del self._building[key]


TranscriptStatus = Literal["none", "pending", "ready", "failed"]


@dataclass
class Transcript:
    """One Reel's transcript (the last-resort audio pass), shared by every user like Media."""

    key: str
    status: TranscriptStatus = "pending"
    text: str | None = None
    # Seconds of audio ElevenLabs billed.
    seconds: float | None = None
    # The one in-flight transcription for this Reel; /transcribe callers wait on it together.
    task: asyncio.Task | None = None
    created_at: float = field(default_factory=time.time)


class TranscriptStore:
    """LRU of Transcripts by media key. A failed one stays failed: this pass costs money, so no retry loops."""

    def __init__(self, max_entries: int = 4096):
        self._entries: OrderedDict[str, Transcript] = OrderedDict()
        self._max = max_entries

    def get(self, key: str) -> Transcript | None:
        entry = self._entries.get(key)
        if entry:
            self._entries.move_to_end(key)
        return entry

    def add(self, entry: Transcript) -> Transcript:
        self._entries[entry.key] = entry
        if len(self._entries) > self._max:
            self._entries.popitem(last=False)
        return entry

    def __len__(self) -> int:
        return len(self._entries)
