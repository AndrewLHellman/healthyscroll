"""
SigLIP 2 zero-shot scorer: not a VLM, just image/text similarity.

Split in two so the expensive half is shared across users:
  embed_images(frames)            once per Reel, cached globally (policy-independent)
  score_embeddings(emb, policy)   per user: a dot product against cached text embeddings, <1 ms

The policy is split into short concepts ("gambling", "drinking", ...); the score
is the best frame x concept match, in SigLIP's own sigmoid probability. Those
probabilities are small and not comparable to a VLM's Yes/No probability, so
SigLIP has its own thresholds (see Spec in scorers/__init__.py), calibrated by
the benchmark. Good at concrete, visible things; weak where the category has to
be inferred ("BOTTOMLESS MIMOSAS" -> alcohol). Uncertain results escalate to a
caption + Jev.
"""

from __future__ import annotations

import re
import time
from collections import OrderedDict

import torch
from PIL import Image
from transformers import AutoModel, AutoProcessor

from .base import Score

_TEXT_CACHE_MAX = 2048


class SigLIPScorer:
    def __init__(self, name: str, model_id: str):
        self.name = name
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.dtype = torch.float16 if self.device == "cuda" else torch.float32
        self.processor = AutoProcessor.from_pretrained(model_id)
        self.model = AutoModel.from_pretrained(model_id, dtype=self.dtype).to(self.device).eval()
        self._text_cache: OrderedDict[str, torch.Tensor] = OrderedDict()

    # --- policy-independent half (cache the result per Reel) -------------------

    @torch.inference_mode()
    def embed_images(self, frames: list[Image.Image]) -> torch.Tensor:
        """[frames, dim] L2-normalized image embeddings."""
        inputs = self.processor(images=frames, return_tensors="pt").to(self.device)
        return _normalize(_features(self.model.get_image_features(**inputs)))

    # --- per-user half ---------------------------------------------------------

    @torch.inference_mode()
    def score_embeddings(self, image_emb: torch.Tensor, policy: str) -> Score:
        started = time.perf_counter()
        concepts = split_policy(policy)
        text_emb = torch.stack([self._embed_text(c) for c in concepts])  # [concepts, dim]
        logits = image_emb @ text_emb.T * self.model.logit_scale.exp() + self.model.logit_bias
        probs = torch.sigmoid(logits.float())  # [frames, concepts]
        best = probs.max().item()
        frame_idx, concept_idx = divmod(int(probs.argmax()), probs.shape[1])
        return Score(
            probability=best,
            latency_ms=(time.perf_counter() - started) * 1000,
            detail={"concept": concepts[concept_idx], "frame": frame_idx},
        )

    def _embed_text(self, concept: str) -> torch.Tensor:
        hit = self._text_cache.get(concept)
        if hit is not None:
            self._text_cache.move_to_end(concept)
            return hit
        inputs = self.processor(
            text=[f"a video frame showing {concept}"],
            padding="max_length",
            max_length=64,
            return_tensors="pt",
        ).to(self.device)
        emb = _normalize(_features(self.model.get_text_features(**inputs)))[0]
        self._text_cache[concept] = emb
        if len(self._text_cache) > _TEXT_CACHE_MAX:
            self._text_cache.popitem(last=False)
        return emb

    # --- Scorer interface (benchmark) -----------------------------------------

    def score(self, frames: list[Image.Image], policy: str) -> Score:
        started = time.perf_counter()
        emb = self.embed_images(frames)
        s = self.score_embeddings(emb, policy)
        if self.device == "cuda":
            torch.cuda.synchronize()
        s.latency_ms = (time.perf_counter() - started) * 1000
        return s

    def close(self) -> None:
        del self.model
        self._text_cache.clear()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()


def _features(out) -> torch.Tensor:
    # transformers 5 may return a ModelOutput instead of a bare tensor.
    return out if isinstance(out, torch.Tensor) else out.pooler_output


def _normalize(x: torch.Tensor) -> torch.Tensor:
    return x / x.norm(dim=-1, keepdim=True)


def split_policy(policy: str) -> list[str]:
    parts = re.split(r",|;|\n|\band\b|\bor\b", policy, flags=re.IGNORECASE)
    concepts = [p.strip(" .\"'") for p in parts if len(p.strip(" .\"'")) > 2]
    return concepts[:8] or [policy.strip()]
