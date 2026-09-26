# Decision pipeline

Where the product actually lives. Implemented in `apps/extension/src/background/orchestrator.ts`; constants in `packages/shared/src/thresholds.ts`.

## Inputs

- `UserPolicy.prompt` — the user's free text. Treated as the *definition* of "violates".
- `VideoContext` — text scraped from the page: author, description, hashtags, sound title, top comments, any DOM captions.
- `FrameDescription[]` — Moondream's output for frames captured so far (visual stages only).

## Output

`Decision { verdict: "skip" | "allow" | "uncertain", violatesProbability, stage, latencyMs }`

## The single Jev question

We ask Jev one boolean:

> "The user wrote a policy describing content they do NOT want to see while scrolling. Does this video conflict with that policy?"

with `true`/`false` criteria spelled out (see `jevQuestions` in `packages/shared/src/questions.ts`). Jev returns `probability ∈ [0,1]`. Jev's guidance: ~0.98 = strong yes, ~0.02 = strong no, ~0.5 = genuinely unsure — so the middle band is meaningful, not noise.

Thresholds (`THRESHOLDS`):

```
p >= 0.80  → skip
p <= 0.20  → allow
otherwise  → uncertain
```

These are the main tuning knob. Start here, adjust after watching real feeds.

## Stages

### 1. Text pass (`stage: "text"`) — target: < 300 ms end to end

- Trigger: `VIDEO_CHANGED`.
- State sent to Jev: policy + VideoContext. No frames.
- `skip` → send `SKIP_VIDEO`, session over.
- `allow` → *don't* stop. Text can lie (innocuous caption, provocative video). Fall through to monitor with a normal delay.
- `uncertain` → fall through to the visual pass with **no delay**.

If Moondream Station is not reachable, the text pass is all we have; we stop here and leave the video alone.

### 2. Visual pass (`stage: "visual"`) — target: < 1.5 s

- Capture the viewport with `chrome.tabs.captureVisibleTab` (JPEG q60).
- Run two Moondream calls in parallel on the same frame:
  - `caption({ length: "short" })` — generic description. Gives Jev context.
  - `query({ question })` — the question is built from the user's policy: *"A user does not want to see: "{policy}". Describe anything in this image related to that, or say "nothing relevant"."* Gives Jev a directly relevant signal.
- Append the `FrameDescription`, re-run Jev with `frames` included.
- `skip` → `SKIP_VIDEO`. Otherwise continue to monitor.

### 3. Monitor (`stage: "monitor"`)

- Every `MONITOR_INTERVAL_MS` (1500), repeat the visual pass, accumulating frames (Jev sees the whole history each time, so a trend across frames counts).
- Stop after `MAX_FRAMES_PER_VIDEO` (8) frames — roughly the first 12 s of a video — to cap CPU and API cost. Most TikToks are shorter than that anyway.
- Any `VIDEO_CHANGED` / `VIDEO_ENDED` / tab close cancels the session immediately. Every await in the loop checks `session.cancelled` before acting, so a late Jev response can't skip the *next* video.

## Failure modes to design around

| Situation | Behaviour |
|---|---|
| API unreachable / Jev error | Log, do nothing. Never skip on error. |
| Moondream Station not running | Text pass only. Consider surfacing a hint in the popup. |
| User scrolls before decision returns | `SKIP_VIDEO` carries `videoId`; content script ignores mismatches. |
| Selectors rot (TikTok redesign) | Everything is in `tiktok.ts`; `VideoContext` fields are all optional so partial scrapes still work. |
| captureVisibleTab includes UI chrome | Fine for captions. Crop to the `<video>` bounding rect later if accuracy suffers. |

## Why Jev and not a chat LLM

- It's an *evaluation* model: fixed-schema output (probability), no tokens generated, so it's fast and there's nothing to parse.
- Cost is negligible ($0.042 / 1M input; output is free) — running it on every single video, multiple times, is fine.
- Calibrated probabilities make the "uncertain → look closer" branch principled rather than a hack.
- Zero data retention is a per-request flag (`providerOptions.gateway.zeroDataRetention`).

## Why Moondream and not sending frames to a cloud VLM

- Privacy: what someone watches is sensitive. Frames never leave the device.
- Latency: local, no upload. Sub-second on a laptop.
- Cost: free.
- Trade-off: user has to install Moondream Station. Acceptable for a hackathon demo; a Cloud fallback via `MOONDREAM_API_KEY` on the server is the escape hatch (see ROADMAP).
