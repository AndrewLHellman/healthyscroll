# Decision pipeline

The current pipeline is implemented in `apps/extension/src/background/reels.ts` and shared by **Instagram Reels in Safari on iPhone (primary)** and **Instagram Reels in desktop Chrome (secondary)**. Jev makes every filtering decision; the vision service only describes media.

## Inputs and output

- The user’s plain-English policy defines unwanted content.
- Reel context includes available caption, hashtags, author, and audio metadata.
- Visual descriptions and, when needed, an audio transcript add evidence.
- Jev returns a probability and a verdict through `/api/evaluate`. Shared questions and thresholds live in `packages/shared/src/questions.ts` and `thresholds.ts`.

The skip threshold is 0.80; probabilities at or below 0.20 are allowed. The middle band calls for more evidence rather than a guessed skip.

## Text and vision in parallel

As Instagram discovers upcoming Reels, the extension begins a text evaluation and a `/describe` request in parallel. A confident text-only match can skip immediately when the Reel is active; a slow visual response does not hold it up.

Vision fetches the Reel’s own public media, describes the poster first when available, and then describes sampled video frames. The background receives descriptions through `visionClient.ts` and asks Jev to evaluate the text plus each new description. A confident match ends further evaluation; otherwise the pipeline waits for the fuller description. Vision never receives the user’s policy and never returns a filtering verdict.

## Last-resort audio

Only when text plus description leaves Jev uncertain, and only when the Reel is on screen, the extension requests `/transcribe`. It does not transcribe every prefetched Reel. Reels identified as using licensed music are excluded from this pass.

The service extracts up to the configured audio duration (30 seconds by default), sends it to ElevenLabs, and caches the transcript per Reel. Jev evaluates text, description, and transcript with stage `audio`. Per-user and global daily limits cap new transcriptions. Missing credentials or any transcription failure preserve the earlier answer.

## Acting on decisions

The content script reports discovery and activity through `REELS_DISCOVERED` and `REEL_ACTIVE`. The background sends `SKIP_REEL` only for a confident match to the active Reel, at most once per Reel per tab. The content adapter performs the feed advance; it makes no filtering decisions.

An earlier allow verdict can be refined by later visual evidence. An error is never a reason to skip. If vision fails, available text evidence still applies; a failed API request itself produces no skip.

## Failure handling

| Situation | Behavior |
| --- | --- |
| Jev/API request fails | Log the error; no skip based on the failure. |
| Media or description unavailable | Retain available evidence; do not invent a visual verdict. |
| Audio missing, unavailable, or rate limited | Keep the earlier answer. |
| User scrolls before a result arrives | Check the active Reel before acting. |
| Repeated matching results | Skip at most once per Reel per tab. |
| Database sync fails | Filtering continues; sync must not trigger or block a skip. |

## Legacy TikTok pipeline

`background/orchestrator.ts` retains the older TikTok/Chrome implementation: text evaluation, local Moondream descriptions from viewport captures, and periodic monitoring. Its content observer is gated by `VITE_HS_ENABLE_CONTENT`. That pipeline is not used by either Instagram target. See [MOONDREAM.md](MOONDREAM.md) for the legacy local model reference and the [vision README](../apps/vision/README.md) for the current description service.
