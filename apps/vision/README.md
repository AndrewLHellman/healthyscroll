# apps/vision — Reel description service

FastAPI service that takes one Instagram Reel (its DASH manifest or a video URL,
plus the poster), pulls frames with ffmpeg **without downloading the whole
video**, and has a VLM write a short description of what's in them. It makes
**no decisions** and never sees a user's policy: the extension sends the
description to Jev (`/api/evaluate`, `frames[].caption`) together with the
Reel's own text, and Jev decides.

```
                                          ┌── once per Reel, shared by ALL users (cached) ──┐
extension ─POST /describe─▶ vision ──────▶│ stage "poster": cover image -> VLM description   │ ~0.8 s
 (for upcoming Reels,                     │ stage "frames": first ~300 KB of the video ->    │ ~1.7 s
  in parallel with Jev text)              │   3 frames + poster -> VLM description           │ (~4 s laptop GPU)
                                          │ VLM: <= 60 words — people, activities, objects,  │
                                          │      setting, quoted on-screen text              │
                                          └──────────────────────────────────────────────────┘
                                          │
       first description ◀────────────────┘   captionStatus "pending" = a better one is coming:
                  │                            poll GET /media/instagram/:id
                  ▼
   extension → Jev (/api/evaluate) with text + description → skip, or wait for the next description
```

- **Auth:** `Authorization: Bearer <Supabase access token>`, same as `/api/evaluate`.
  **Rate limit:** `VISION_RATE_PER_MIN` per user (prefetch multiplies calls).
- **Two stages, each just a description:** Jev is never told which one it is looking at. The
  extension skips as soon as any description makes Jev say skip and stops polling; otherwise
  it waits for the frames stage and asks again. Most Reels are settled on the poster.
- **Never skip on error:** no frames / bad manifest → the frames stage fails; the poster
  stage still answers if there was a poster, else `captionStatus: "failed"` and the extension
  lets Jev go on the Reel's text alone.
- **Cache:** frames and descriptions are per Reel, so a popular Reel is fetched and described
  once; every extra user costs one Jev call. In memory for now (one box).
- **Captioner** is `VISION_CAPTIONER`: `qwen3-vl-2b` on a GPU, `gemini-2.5-flash-lite` through the
  AI Gateway on the deploy server (no GPU there). Models live behind one interface
  (`vision/scorers`), which `bench/` also uses to compare them as *scorers* — that scoring path
  is benchmark-only now; the service itself only calls `describe()`.
- **Contract:** `packages/shared/src/vision.ts` (request/response + the client flow).

## Last resort: `POST /transcribe` (ElevenLabs)

When a Reel's text + description still leave Jev unsure (0.2 < p < 0.8), and
only once that Reel is on screen, the extension asks for what's *said* in it:

```
extension ─POST /transcribe─▶ vision: smallest audio track from the DASH manifest,
                                      first 30 s in one range request (~250 KB)
                                      → ffmpeg → 16 kHz mono PCM
                              ─────▶ ElevenLabs Scribe v2 → transcript (cached per Reel)
extension ─POST /api/evaluate { …, frames: [description], transcript } → Jev decides (final)
```

- Costs money ($0.22 per hour of audio, ~$0.0018 per 30 s Reel), so it's capped:
  `TRANSCRIBE_MAX_S` seconds per Reel, `TRANSCRIBE_PER_USER_DAY` and
  `TRANSCRIBE_DAILY_MAX` new transcriptions per UTC day (cache hits are free;
  429 past the cap). Set a credit limit on the key in the ElevenLabs dashboard too.
- Reels using a licensed song are skipped by the extension (the transcript would be lyrics).
- No `ELEVENLABS_API_KEY` → 503, and the extension keeps its earlier answer.
- `GET /health` shows today's count, audio seconds and estimated cost.
- Privacy: only the Reel's public audio is sent; nothing about the user. ElevenLabs'
  zero-retention mode is Enterprise-only, so they may log it.

## Setup (Windows, from `apps/vision`)

```bash
py -3.11 -m venv .venv
.venv/Scripts/python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
.venv/Scripts/python -m pip install -r requirements-models.txt   # or requirements.txt for gateway-only
cp .env.example .env                                              # fill SUPABASE_ANON_KEY / AI_GATEWAY_API_KEY
.venv/Scripts/python -m uvicorn vision.main:app --port 8000
```

ffmpeg must be on `PATH` (or set `FFMPEG_PATH`).

## Scorers

| name | what | notes |
|---|---|---|
| `qwen3-vl-2b` | Qwen3-VL 2B Instruct | best accuracy/size; native multi-image & video |
| `qwen3-vl-4b` | Qwen3-VL 4B Instruct | step up if 2B isn't accurate enough |
| `lfm2-vl-1.6b` / `lfm2-vl-450m` | Liquid LFM2-VL | built for low latency |
| `smolvlm2-500m` / `smolvlm2-2.2b` | HF SmolVLM2 | tiny; weaker on abstract policies |
| `siglip2-base` | SigLIP 2 image–text similarity | ~10 ms; fast first tier for concrete things; needs its own threshold |
| `gemini-3.5-flash-lite` / `gemini-3.1-flash-lite` | via Vercel AI Gateway | no GPU; network round trip; frames go to Google |
| `moondream-station` | local Moondream Station | what the extension used before |

Local HF models answer a single Yes/No token (prefill only, no generation).
Hosted models are asked for a 0–100 number instead.

## Results so far (2026-09-26, RTX 3050 Laptop 4 GB, 4-bit LM / bf16 vision)

Synthetic smoke set (12 clips × 4 policies, text-on-colour, including clips where the
category must be inferred and lookalikes that must not match). Latency is model time
for 3 frames at 448 px; frame extraction adds ~100–180 ms.

| model | AUROC | acc@0.5 | p50 ms | notes |
|---|---|---|---|---|
| **qwen3-vl-2b** | **0.994** | **0.96** | 401 | most accurate; now the **captioner** for uncertain Reels (~4 s per caption on the laptop) |
| siglip2-base | 0.947 | 0.83 | 26 | **default scorer** (chosen for latency). Misses inferred cases on its own, so thresholds send those to the caption + Jev path |
| lfm2-vl-1.6b | 0.944 | 0.83 | 471 | reads text fine, weak on inference; probabilities cluster low |
| smolvlm2-500m | 0.894 | 0.83 | 393 | dropped (weights deleted) |
| lfm2-vl-450m | 0.806 | 0.83 | 124 | fastest VLM but weakest; dropped (weights deleted) |

Not yet run: Gemini Flash-Lite (needs `AI_GATEWAY_API_KEY` in `.env`), Qwen3-VL-4B / SmolVLM2-2.2B
(disk space), and **real Reels** — the smoke set only proves the pipeline; choose the final
model and `VISION_SKIP_THRESHOLD` from `bench/data/reels`. Note Qwen's probabilities on
inferred cases sit around 0.5–0.6, so the 0.8 skip threshold will need lowering after calibration.

Gotcha: 4-bit quantizing the *vision* tower breaks some models (LFM2-VL-1.6B described
"CASINO NIGHT" as "a person wearing…"). `hf_vlm.py` quantizes only the language model.

## Real Instagram spike (2026-09-26)

7 Reels captured from desktop Chrome with `bench/ig_hook.js`, run through `/analyze`
from the **same laptop/IP** as the browser (`bench/ig_check.py`):

- **The server can fetch Instagram media without cookies**: all 7 worked via both the DASH
  manifest and the smallest `video_versions` MP4. DASH was usually faster
  (frames 550–1000 ms for 4–9 frames vs 660–2200 ms for MP4) → prefer the manifest.
- End-to-end per Reel ~0.6–1.2 s cold (almost all frame fetching); SigLIP scoring <1 ms warm.
- None of the 7 matched the test policy (ads, Minecraft, anime, a chihuahua, a comedy skit):
  no false skips. 4/7 landed "uncertain" and were captioned correctly in 2.6–7.5 s — e.g. the
  skit SigLIP scored closest to "alcohol" (0.044) was captioned as a chocolate-milk joke, which
  Jev would allow.
- **Still unverified: a different IP.** fbcdn URLs may be bound to the viewer's IP; repeat the
  check from the deploy server before relying on server-side fetching.

## Benchmark

```bash
.venv/Scripts/python -m bench.make_smoke_set                       # synthetic plumbing check
.venv/Scripts/python -m bench.run --data bench/data/smoke
.venv/Scripts/python -m bench.run --models qwen3-vl-2b lfm2-vl-1.6b gemini-3.5-flash-lite
```

Reports land in `bench/results/<time>.md` (committed) with a per-row CSV beside it (ignored).

End-to-end API check (DASH manifest + MP4 URL + cache + error paths) against a running server:

```bash
ffmpeg -i bench/data/smoke/clips/roulette.mp4 -map 0:v -b:v:0 400k -s:v:0 360x640 -map 0:v -b:v:1 1200k \
  -s:v:1 720x1280 -c:v libx264 -f dash -single_file 1 bench/data/smoke/dash/roulette.mpd
.venv/Scripts/python -m http.server 8765 --directory bench/data/smoke
VISION_REQUIRE_AUTH=false .venv/Scripts/python -m uvicorn vision.main:app --port 8000
.venv/Scripts/python -m bench.api_check
```

### Building the real test set (`bench/data/reels/`, git-ignored)

The smoke set is solid colours with text; it proves the pipeline runs, not that a
model is accurate. For real numbers:

1. Screen-record ~50 Reels on a phone (or save them), trim to ~10 s, drop them in
   `bench/data/reels/clips/`. Aim for a mix: clear matches, clear non-matches, and
   hard cases (a bar in the background of a cooking video, a gym selfie vs. a
   workout tutorial).
2. Write `bench/data/reels/labels.jsonl`, one line per clip × policy you care about:
   ```json
   {"clip": "slots_streamer.mp4", "policy": "gambling, casinos or sports betting", "label": true}
   {"clip": "slots_streamer.mp4", "policy": "alcohol and drinking", "label": false}
   ```
   Use the same 5–6 realistic policies for every clip, including at least one
   abstract one ("anything that makes me feel bad about my body").
3. Run `python -m bench.run`. Pick the model on **AUROC** first, then latency, then
   set `VISION_SKIP_THRESHOLD` from its best-F1 threshold.

Laptop numbers (RTX 3050 4 GB, 4-bit) are fine for comparing accuracy; latency on a
server GPU in bf16 will be lower, so re-run the finalists there with `--no-quantize`.
