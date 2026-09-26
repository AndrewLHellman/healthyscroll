"""
Hosted VLMs through Vercel AI Gateway's OpenAI-compatible API (e.g. Gemini Flash-Lite).

No GPU needed; costs a network round trip. We can't rely on token logprobs from
every provider, so the model is asked for a 0-100 number instead of Yes/No.
"""

from __future__ import annotations

import base64
import re
import time
from io import BytesIO

import httpx
from PIL import Image

from ..config import settings
from ..prompt import describe_prompt, percent_prompt
from .base import Score


class GatewayScorer:
    def __init__(self, name: str, model_id: str):
        if not settings.ai_gateway_api_key:
            raise RuntimeError("AI_GATEWAY_API_KEY is not set (apps/vision/.env)")
        self.name = name
        self.model_id = model_id
        self.client = httpx.Client(
            base_url=settings.ai_gateway_url,
            headers={"Authorization": f"Bearer {settings.ai_gateway_api_key}"},
            timeout=20,
        )

    def score(self, frames: list[Image.Image], policy: str) -> Score:
        started = time.perf_counter()
        content = [
            *({"type": "image_url", "image_url": {"url": _data_url(img)}} for img in frames),
            {"type": "text", "text": percent_prompt(policy, len(frames))},
        ]
        res = self.client.post(
            "/chat/completions",
            json={
                "model": self.model_id,
                "messages": [{"role": "user", "content": content}],
                "temperature": 0,
                "max_tokens": 8,
                # Don't let the gateway or provider keep what people watch.
                "providerOptions": {"gateway": {"zeroDataRetention": True}},
            },
        )
        res.raise_for_status()
        text = res.json()["choices"][0]["message"]["content"] or ""
        match = re.search(r"\d{1,3}", text)
        if not match:
            raise ValueError(f"{self.model_id} returned no number: {text!r}")
        return Score(
            probability=min(int(match.group()), 100) / 100,
            latency_ms=(time.perf_counter() - started) * 1000,
            detail={"raw": text.strip()},
        )

    def describe(self, frames: list[Image.Image]) -> str:
        """Short policy-independent description of the whole clip (cached per Reel)."""
        content = [
            *({"type": "image_url", "image_url": {"url": _data_url(img)}} for img in frames),
            {"type": "text", "text": describe_prompt(len(frames))},
        ]
        res = self.client.post(
            "/chat/completions",
            json={
                "model": self.model_id,
                "messages": [{"role": "user", "content": content}],
                "temperature": 0,
                "max_tokens": 160,
                "providerOptions": {"gateway": {"zeroDataRetention": True}},
            },
        )
        res.raise_for_status()
        return (res.json()["choices"][0]["message"]["content"] or "").strip()

    def close(self) -> None:
        self.client.close()


def _data_url(img: Image.Image) -> str:
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
