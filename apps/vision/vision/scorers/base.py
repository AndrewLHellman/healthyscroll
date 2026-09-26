from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from PIL import Image


@dataclass
class Score:
    """Probability (0..1) that the frames contain what the policy asks to skip."""

    probability: float
    latency_ms: float
    # Free-form extras for debugging / the benchmark (raw text, per-frame scores...).
    detail: dict = field(default_factory=dict)


class Scorer(Protocol):
    name: str

    def score(self, frames: list[Image.Image], policy: str) -> Score: ...

    def close(self) -> None:
        """Release GPU memory (the benchmark loads models one after another)."""
        ...
