"""
Moondream via a running Moondream Station (docs/MOONDREAM.md). One image per
request, so each frame is asked separately and the score is the fraction of
frames answered "yes". Coarse, but it lets the benchmark compare against what
the extension used before.
"""

from __future__ import annotations

import base64
import time
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO

import httpx
from PIL import Image

from ..config import settings
from .base import Score


class MoondreamStationScorer:
    def __init__(self, name: str):
        self.name = name
        self.client = httpx.Client(base_url=settings.moondream_url, timeout=20)
        self.client.get("/").raise_for_status()  # fail fast if Station isn't running

    def score(self, frames: list[Image.Image], policy: str) -> Score:
        started = time.perf_counter()
        question = (
            f'The viewer wants to skip videos containing: "{policy.strip()}". '
            "Does this image contain that? Answer yes or no."
        )
        with ThreadPoolExecutor(len(frames)) as pool:
            answers = list(pool.map(lambda img: self._ask(img, question), frames))
        yes = sum(a.strip().lower().startswith("yes") for a in answers)
        return Score(
            probability=yes / max(len(answers), 1),
            latency_ms=(time.perf_counter() - started) * 1000,
            detail={"answers": answers},
        )

    def _ask(self, img: Image.Image, question: str) -> str:
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=85)
        url = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
        res = self.client.post("/query", json={"image_url": url, "question": question})
        res.raise_for_status()
        return str(res.json().get("answer", ""))

    def close(self) -> None:
        self.client.close()
