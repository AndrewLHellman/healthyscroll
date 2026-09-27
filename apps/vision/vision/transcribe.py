"""
ElevenLabs speech-to-text (Scribe) for the last-resort audio pass.

Only called by POST /transcribe, which the extension only calls when a Reel's
text + description left Jev unsure and that Reel is on screen. Sends the first
~30 s of the Reel's own public audio (16 kHz mono PCM from frames.extract_audio);
nothing about the user. ElevenLabs' zero-retention mode is Enterprise-only, so
on our plan they may log what we send, which is public Reel audio.

API: POST {ELEVENLABS_URL}/v1/speech-to-text, header xi-api-key, multipart:
model_id, file, file_format=pcm_s16le_16 (skips their decode step, lower latency).
Response: { text, language_code, audio_duration_secs, words: [...] }.
"""

from __future__ import annotations

import httpx

from .config import settings

# Scribe v2 list price. Only used to log what each call cost.
USD_PER_AUDIO_HOUR = 0.22

_client: httpx.AsyncClient | None = None


class TranscribeError(Exception):
    pass


def _http() -> httpx.AsyncClient:
    # Created lazily so it binds to the server's event loop.
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=5.0))
    return _client


async def transcribe_pcm(pcm: bytes) -> tuple[str, float]:
    """(transcript, billed seconds). "" when the Reel has no speech. Raises TranscribeError."""
    if not settings.elevenlabs_api_key:
        raise TranscribeError("ELEVENLABS_API_KEY is not set")
    try:
        res = await _http().post(
            f"{settings.elevenlabs_url}/v1/speech-to-text",
            headers={"xi-api-key": settings.elevenlabs_api_key},
            data={
                "model_id": settings.elevenlabs_model,
                "file_format": "pcm_s16le_16",
                # "(laughter)", "(music)"... cheap extra context for Jev.
                "tag_audio_events": "true",
            },
            files={"file": ("reel.pcm", pcm, "application/octet-stream")},
        )
    except httpx.HTTPError as err:
        raise TranscribeError(f"request failed: {err}") from err
    if res.status_code != 200:
        raise TranscribeError(f"HTTP {res.status_code}: {res.text[:300]}")
    body = res.json()
    seconds = float(body.get("audio_duration_secs") or len(pcm) / 32_000)
    return (body.get("text") or "").strip(), seconds


def cost_usd(seconds: float) -> float:
    return seconds / 3600 * USD_PER_AUDIO_HOUR
