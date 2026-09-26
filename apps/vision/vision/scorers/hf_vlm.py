"""
Any Hugging Face image-text-to-text VLM (Qwen3-VL, LFM2-VL, SmolVLM2, ...).

We never generate text. One forward pass over [frames + question], then read the
logits of the *next* token and compare "Yes" against "No". That's prefill only,
which is several times faster than generating a caption, and it yields a
probability rather than a string to parse.
"""

from __future__ import annotations

import time

import torch
from PIL import Image
from transformers import AutoModelForImageTextToText, AutoProcessor, BitsAndBytesConfig

from ..prompt import describe_prompt, yes_no_prompt
from .base import Score

YES_WORDS = ["Yes", "yes", " Yes", " yes", "YES"]
NO_WORDS = ["No", "no", " No", " no", "NO"]

# Vision side across model families (LFM2-VL, Qwen3-VL, SmolVLM). transformers
# matches these as regexes from the start of the full module path
# ("model.vision_tower.…"), hence the ".*" prefix.
VISION_MODULES = [
    r".*vision_tower", r".*multi_modal_projector", r".*visual", r".*vision_model", r".*connector", "lm_head",
]


class HFVisionScorer:
    def __init__(self, name: str, model_id: str, quantize: bool = False):
        self.name = name
        self.model_id = model_id
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.bfloat16 if self.device == "cuda" else torch.float32

        quant = None
        if quantize and self.device == "cuda":
            quant = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_compute_dtype=dtype,
                # Only the language model is quantized. 4-bit vision towers/projectors
                # make some models (LFM2-VL-1.6B) stop seeing the image at all.
                llm_int8_skip_modules=VISION_MODULES,
            )

        self.processor = AutoProcessor.from_pretrained(model_id)
        # SmolVLM/Idefics-style processors tile each image into many crops by
        # default (~10x the visual tokens). Our frames are already small.
        image_processor = getattr(self.processor, "image_processor", None)
        if hasattr(image_processor, "do_image_splitting"):
            image_processor.do_image_splitting = False
        self.model = AutoModelForImageTextToText.from_pretrained(
            model_id,
            dtype=dtype,
            device_map=self.device,
            quantization_config=quant,
        ).eval()

        tok = self.processor.tokenizer
        self.yes_ids = _single_token_ids(tok, YES_WORDS)
        self.no_ids = _single_token_ids(tok, NO_WORDS)
        if not self.yes_ids or not self.no_ids:
            raise RuntimeError(f"{model_id}: couldn't find single-token Yes/No ids")

    @torch.inference_mode()
    def score(self, frames: list[Image.Image], policy: str) -> Score:
        started = time.perf_counter()
        messages = [
            {
                "role": "user",
                "content": [
                    *({"type": "image", "image": img} for img in frames),
                    {"type": "text", "text": yes_no_prompt(policy, len(frames))},
                ],
            }
        ]
        inputs = self.processor.apply_chat_template(
            messages,
            add_generation_prompt=True,
            tokenize=True,
            return_dict=True,
            return_tensors="pt",
        ).to(self.model.device)

        logits = self.model(**inputs).logits[0, -1].float()
        yes = torch.logsumexp(logits[self.yes_ids], dim=0)
        no = torch.logsumexp(logits[self.no_ids], dim=0)
        p_yes = torch.sigmoid(yes - no).item()
        if self.device == "cuda":
            torch.cuda.synchronize()

        return Score(
            probability=p_yes,
            latency_ms=(time.perf_counter() - started) * 1000,
            detail={"input_tokens": int(inputs["input_ids"].shape[-1])},
        )

    @torch.inference_mode()
    def describe(self, frames: list[Image.Image], max_new_tokens: int = 64) -> str:
        """Short policy-independent description of the whole clip (cached per Reel)."""
        messages = [
            {
                "role": "user",
                "content": [
                    *({"type": "image", "image": img} for img in frames),
                    {"type": "text", "text": describe_prompt(len(frames))},
                ],
            }
        ]
        inputs = self.processor.apply_chat_template(
            messages,
            add_generation_prompt=True,
            tokenize=True,
            return_dict=True,
            return_tensors="pt",
        ).to(self.model.device)
        out = self.model.generate(**inputs, max_new_tokens=max_new_tokens, do_sample=False)
        return self.processor.decode(out[0][inputs["input_ids"].shape[-1]:], skip_special_tokens=True).strip()

    def close(self) -> None:
        del self.model
        if torch.cuda.is_available():
            torch.cuda.empty_cache()


def _single_token_ids(tokenizer, words: list[str]) -> list[int]:
    ids: set[int] = set()
    for w in words:
        enc = tokenizer.encode(w, add_special_tokens=False)
        if len(enc) == 1:
            ids.add(enc[0])
    return sorted(ids)
