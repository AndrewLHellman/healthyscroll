"""
Scorer registry. `build_scorer(name)` is used by both the API and the benchmark,
so the model the benchmark picks is exactly what /analyze runs.

Heavy imports (torch, transformers) happen inside build_scorer so the gateway
scorer works without them installed.
"""

from __future__ import annotations

from dataclasses import dataclass

from .base import Score, Scorer


@dataclass(frozen=True)
class Spec:
    kind: str  # "hf" | "siglip" | "gateway" | "moondream"
    model_id: str = ""
    # Quantize to 4-bit when VISION_QUANTIZE is on. Only models too big for a
    # 4 GB card in bf16 need it; tiny ones run faster unquantized.
    quantize_ok: bool = False
    # Probability bands: >= skip -> "skip", <= allow -> "allow", else "uncertain"
    # (which triggers the caption + Jev path). Each model's scores live on a
    # different scale; calibrate with bench/ on real Reels.
    skip: float = 0.8
    allow: float = 0.2


REGISTRY: dict[str, Spec] = {
    "qwen3-vl-2b": Spec("hf", "Qwen/Qwen3-VL-2B-Instruct", quantize_ok=True),
    "qwen3-vl-4b": Spec("hf", "Qwen/Qwen3-VL-4B-Instruct", quantize_ok=True),
    "lfm2-vl-1.6b": Spec("hf", "LiquidAI/LFM2-VL-1.6B", quantize_ok=True),
    "lfm2-vl-450m": Spec("hf", "LiquidAI/LFM2-VL-450M"),
    "smolvlm2-500m": Spec("hf", "HuggingFaceTB/SmolVLM2-500M-Video-Instruct"),
    "smolvlm2-2.2b": Spec("hf", "HuggingFaceTB/SmolVLM2-2.2B-Instruct", quantize_ok=True),
    # Raw SigLIP sigmoid scores are small. From the smoke set (2026-09-26): every
    # negative <= 0.0084; explicit positives 0.06-0.42; inferred positives 0.0025-0.024.
    # allow=0.0015 lets no positive through and sends ~1 in 4 negatives to the caption
    # path (cheap: captions are per Reel, not per user).
    # Real Reels, policy "cats, dogs, animals" (2026-09-26): dog 0.031, otter 0.039 but
    # gecko 0.003, pigeon 0.002, chinchilla 0.008; non-animal Reels <= 0.0015. So skip
    # lowered to 0.025 for real photos; small/odd animals still go the caption + Jev route.
    "siglip2-base": Spec("siglip", "google/siglip2-base-patch16-224", skip=0.025, allow=0.0015),
    "gemini-3.5-flash-lite": Spec("gateway", "google/gemini-3.5-flash-lite"),
    "gemini-3.1-flash-lite": Spec("gateway", "google/gemini-3.1-flash-lite"),
    # The only Flash-Lite the gateway's free tier allows (3.x return 403); what
    # the deploy server captions with.
    "gemini-2.5-flash-lite": Spec("gateway", "google/gemini-2.5-flash-lite"),
    "moondream-station": Spec("moondream"),
}


def build_scorer(name: str, quantize: bool = True) -> Scorer:
    spec = REGISTRY.get(name)
    if spec is None:
        raise KeyError(f"unknown scorer {name!r}; choose from {', '.join(REGISTRY)}")

    if spec.kind == "hf":
        from .hf_vlm import HFVisionScorer

        return HFVisionScorer(name, spec.model_id, quantize=quantize and spec.quantize_ok)
    if spec.kind == "siglip":
        from .siglip import SigLIPScorer

        return SigLIPScorer(name, spec.model_id)
    if spec.kind == "gateway":
        from .gateway import GatewayScorer

        return GatewayScorer(name, spec.model_id)
    if spec.kind == "moondream":
        from .moondream import MoondreamStationScorer

        return MoondreamStationScorer(name)
    raise ValueError(spec.kind)


__all__ = ["REGISTRY", "Score", "Scorer", "build_scorer"]
