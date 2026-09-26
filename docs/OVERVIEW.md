# Healthy Scroll — Overview

**One line:** a Chrome extension that skips short-form videos which don't align with your goals, before they get a chance to hook you.

**Context:** built for TigerHacks (theme: health). The angle is mental health — doom-scrolling is driven by an algorithm optimising for engagement, not for you. Healthy Scroll puts a filter between the algorithm and your eyes that *you* write.

## The user experience

1. Install the extension.
2. Open the popup (or healthyscroll.net) and type, in plain English, what you don't want to see. Examples:
   - "gambling, sports betting, casino content"
   - "drinking, partying"
   - "thirst-trap / provocative content, gooner bait"
   - "anything that makes me compare myself to other people"
3. Toggle it on. Scroll TikTok as normal.
4. Videos that match your filter get skipped automatically — ideally before you register them, otherwise within a second or two of the video changing to something that matches.

That's it. There's deliberately no dashboard, no stats, no gamification. One switch, one text box.

## How it works (short version)

Two models, split by what they're good at:

| Model | Where it runs | Job | Why |
|---|---|---|---|
| **Jev** (`typesafe-ai/jev`, via Vercel AI Gateway) | Our server (`healthyscroll.net/api/evaluate`) | Makes the skip / don't-skip decision from text | Evaluation model: returns a calibrated probability, no prose. ~instant, ~free ($0.042 / 1M input tokens). |
| **Moondream** (Moondream Station) | User's own machine, `localhost:2020` | Describes what's visually on screen | Tiny VLM (0.5B–2B) that runs on a laptop CPU with sub-second latency. Frames never leave the device. |

Pipeline per video:

1. **Text pass** — scrape description, hashtags, author, sound, visible comments → Jev. If Jev is confident either way, we act immediately (skip) or move on (allow). Most videos should resolve here.
2. **Visual pass** — if Jev is unsure, capture the current frame → Moondream caption + a policy-specific question → feed those captions back to Jev with the text → decide.
3. **Monitor** — while the video plays, keep sampling frames every ~1.5 s and re-asking Jev. If the video *becomes* something you filtered mid-way, skip then.

Full detail in [DECISION_PIPELINE.md](./DECISION_PIPELINE.md); component layout in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Principles

- **Your prompt, your feed.** The user's own words are the only source of truth for what gets filtered. No preset categories, no moralising defaults.
- **Instant when possible, thorough when needed.** Cheap text decision first; vision only on uncertainty.
- **Frames stay local.** Video imagery is only ever seen by Moondream on the user's device. What leaves the machine is text (page metadata + short captions), sent to Jev with zero data retention.
- **Minimal UI.** If a feature needs explaining, it's probably out of scope.

## Scope for the hackathon

- Platform: **TikTok web** (`tiktok.com`) only. The adapter pattern (`apps/extension/src/content/tiktok.ts`) leaves room for Instagram Reels / YouTube Shorts later.
- Config surface: extension popup. Website is a landing page + the API; syncing the policy from the website into the extension is a stretch goal.
- No accounts, no database, no auth.
