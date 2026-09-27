"""Settings for the vision service, read once from the environment (and .env)."""

from __future__ import annotations

import os
import shutil
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


@dataclass(frozen=True)
class Settings:
    # The VLM that describes each Reel (cached per Reel, passed to Jev as a frame
    # caption). A key of vision.scorers.REGISTRY with describe(): an hf model on
    # a GPU box, or a gemini-* model through the AI Gateway on a plain one.
    captioner: str = os.getenv("VISION_CAPTIONER", "qwen3-vl-2b")
    # 4-bit weights (bitsandbytes). Needed on small GPUs like a 4 GB laptop card;
    # turn off on a real server GPU for lower latency.
    quantize: bool = os.getenv("VISION_QUANTIZE", "true").lower() == "true"

    # Sample one frame every N seconds (starting at 0.5 s), capped. The poster
    # image, when the client sends one, is prepended as an extra frame. Poster +
    # 3 frames is what the captioner looks at (main.CAPTION_MAX_FRAMES), and the
    # download is the cost: the CDN is ~155 ms away from the server and a cold
    # connection moves ~300 KB/s, so every second of video read is ~0.2 s.
    frame_every_s: float = float(os.getenv("VISION_FRAME_EVERY_S", "3"))
    max_frames: int = int(os.getenv("VISION_MAX_FRAMES", "3"))
    # Frames are scaled so the long side is this many pixels. Small VLMs are tuned
    # for ~384-512 px; bigger only adds visual tokens and latency.
    frame_long_side: int = int(os.getenv("VISION_FRAME_SIZE", "448"))

    ffmpeg: str = os.getenv("FFMPEG_PATH") or shutil.which("ffmpeg") or "ffmpeg"

    # Per signed-in user. Prefetch multiplies calls (every upcoming Reel), so
    # this is generous, but it stops one token hammering the GPU.
    rate_per_min: int = int(os.getenv("VISION_RATE_PER_MIN", "120"))

    # Supabase: every /analyze call must carry a signed-in user's access token.
    supabase_url: str = os.getenv("SUPABASE_URL", "https://ikwvesahfsjpwdnwdfos.supabase.co")
    supabase_anon_key: str = os.getenv("SUPABASE_ANON_KEY", "")
    require_auth: bool = os.getenv("VISION_REQUIRE_AUTH", "true").lower() == "true"

    # Vercel AI Gateway (hosted scorers such as Gemini Flash-Lite).
    ai_gateway_api_key: str = os.getenv("AI_GATEWAY_API_KEY", "")
    ai_gateway_url: str = os.getenv("AI_GATEWAY_URL", "https://ai-gateway.vercel.sh/v1")

    # Local Moondream Station (optional scorer).
    moondream_url: str = os.getenv("MOONDREAM_URL", "http://localhost:2020/v1")

    # ElevenLabs speech-to-text: the last-resort audio pass (POST /transcribe),
    # only for Reels text + description left Jev unsure. Billed per second of
    # audio ($0.22/hour on Scribe v2), so it's capped three ways below.
    # No key -> /transcribe answers 503 and the extension keeps its earlier answer.
    elevenlabs_api_key: str = os.getenv("ELEVENLABS_API_KEY", "")
    elevenlabs_url: str = os.getenv("ELEVENLABS_URL", "https://api.elevenlabs.io")
    elevenlabs_model: str = os.getenv("ELEVENLABS_STT_MODEL", "scribe_v2")
    # Seconds of audio sent per Reel, from the start. Most Reels say what they're about early.
    transcribe_max_s: float = float(os.getenv("TRANSCRIBE_MAX_S", "30"))
    # New transcriptions (cache hits are free) per signed-in user per UTC day.
    transcribe_per_user_day: int = int(os.getenv("TRANSCRIBE_PER_USER_DAY", "50"))
    # New transcriptions per UTC day across everyone. A hard ceiling on the bill:
    # 1000 x 30 s = 8.3 h = ~$1.83/day.
    transcribe_daily_max: int = int(os.getenv("TRANSCRIBE_DAILY_MAX", "1000"))


settings = Settings()
