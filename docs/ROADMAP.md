# Roadmap / TODO

Status as of 2026-09-25: **scaffold only**. Everything typechecks; nothing has been run against tiktok.com yet. The content script observer is gated behind `VITE_HS_ENABLE_CONTENT=true` so loading the extension is inert until we're ready.

## Phase 1 — make the loop work end to end

- [ ] Verify TikTok selectors in `content/tiktok.ts` against the live For You page (DevTools → look for `data-e2e` attrs). Update `SELECTORS`.
- [ ] Confirm `getActiveItem()` picks the right item as the user scrolls; confirm `getVideoId()` is stable per video.
- [ ] Confirm `skipToNext()` actually advances the feed (button click vs. ArrowDown vs. programmatic scroll).
- [ ] Flip `VITE_HS_ENABLE_CONTENT=true`, load unpacked extension, watch `VIDEO_CHANGED` messages flow in the SW console.
- [ ] Get an `AI_GATEWAY_API_KEY`, run `pnpm dev:web`, hit `/api/evaluate` with curl and a fake context. Check probabilities look sane for obvious matches / non-matches.
- [ ] Install Moondream Station, confirm `POST localhost:2020/v1/caption` works with a data URL from `captureVisibleTab`.
- [ ] Watch a real skip happen.

## Phase 2 — make it good

- [ ] Tune `THRESHOLDS` against a handful of policies on real feeds. Log `violatesProbability` per stage.
- [ ] Measure latencies (`Decision.latencyMs` + SW timestamps). Text pass goal < 300 ms, visual < 1.5 s.
- [ ] Crop the captured frame to the `<video>` element's bounding rect before sending to Moondream if UI chrome confuses captions.
- [ ] Decide whether to also open/scrape comments (they're often the strongest signal but may need a click).
- [ ] Popup: show "Moondream Station not detected" hint when `isAvailable()` is false.
- [ ] Subtle on-page indicator on `DECISION` (tiny dot: checking / clear / skipped) — optional, must not be distracting.

## Phase 3 — polish for demo

- [ ] Landing page design pass (`apps/web/app/page.tsx`). Keep it one screen.
- [ ] Sync policy from healthyscroll.net → extension via `externally_connectable` in the manifest + `chrome.runtime.sendMessage(extensionId, …)` from the page.
- [ ] Deploy web to Vercel; point extension prod `API_BASE_URL` at it.
- [ ] Pack the extension.

## Later / maybe

- Instagram Reels and YouTube Shorts adapters (same `VideoContext` shape, new `content/<platform>.ts`).
- Moondream Cloud fallback route (`/api/describe`) for users without Station — opt-in, since frames leave the device.
- Use a Jev `choice` question to tag *which* part of the policy matched, for a "skipped because: gambling" tooltip.
- Unit tests for `decide()` with `Experimental_EvaluationMockModelV4`.
- Per-install token on `/api/evaluate` if abuse becomes a concern.

## Known environment gotchas

- Node **>= 22.12** required (Vite 8 / rolldown native binding). `.nvmrc` provided.
- If `pnpm` via corepack fails with "Cannot find matching keyid", run with `COREPACK_INTEGRITY_KEYS=0` or upgrade corepack.
