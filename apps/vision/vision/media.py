"""
Global, policy-independent media cache: one entry per Reel, shared by every user.

Fetching frames and embedding them is the expensive part and doesn't depend on
who is watching, so a popular Reel is only analysed once. Per-user work on top
(SigLIP scoring against the user's policy, Jev) is milliseconds.

Frames are kept as JPEG bytes (~20 KB each) so the caption model can run later,
only for Reels whose fast score came back uncertain.

In-memory for now; move to Redis/Supabase if the service runs on more than one box.
"""

from __future__ import annotations

import asyncio
import time
from collections import OrderedDict
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from io import BytesIO
from typing import Any, Literal

from PIL import Image

CaptionStatus = Literal["none", "pending", "ready", "failed"]


@dataclass
class Media:
    key: str
    jpegs: list[bytes]
    timestamps: list[float]
    frames_ms: float
    input_desc: str
    # Scorer-specific, policy-independent features (SigLIP image embeddings).
    features: Any = None
    # Policy-dependent scores for scorers without features (VLM Yes/No), keyed by policy hash.
    scores: dict[str, float] = field(default_factory=dict)
    caption: str | None = None
    caption_status: CaptionStatus = "none"
    created_at: float = field(default_factory=time.time)

    def images(self) -> list[Image.Image]:
        return [Image.open(BytesIO(b)).convert("RGB") for b in self.jpegs]


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
