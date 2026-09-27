# Roadmap / TODO

## Current targets

Instagram Reels on `instagram.com` in **Safari on iPhone** is the primary target; Instagram Reels in **desktop Chrome** is the secondary target. Both use `background/reels.ts` and the shared vision service. YouTube Shorts is planned. TikTok remains legacy code, not the secondary product target.

The Safari simulator filtering and sign-in loop has been verified; the Instagram hook has also been verified in desktop Chrome. The web and vision services deploy through Docker/GitHub Actions. See the [README](../README.md) for current setup and [AGENTS.md](../AGENTS.md) for recorded verification details. Do not drive a browser or load the extension unless asked.

## Archived TikTok prototype roadmap

The checklist below records the earlier TikTok prototype and its historical status. Its unchecked tasks are not the current Instagram plan; Moondream setup and viewport capture do not apply to either Instagram target.

Status as of 2026-09-26: **TikTok adapter verified on the live For You page** (scrape + skip). Backend (Jev) and Moondream not yet run. The content script observer is gated behind `VITE_HS_ENABLE_CONTENT=true`.

## Phase 1 — make the loop work end to end

- [x] Verify TikTok selectors in `content/tiktok.ts` against the live For You page. With `VITE_HS_DEBUG=true`, run `dispatchEvent(new Event("hs:probe"))` in the tiktok.com console to see which selectors match and which `data-e2e` hooks exist. Update `SELECTORS`.
- [x] Confirm `getActiveItem()` picks the right item as the user scrolls; confirm `getVideoId()` is stable per video. (Id comes from the `xgwrapper-<n>-<videoId>` player wrapper.)
- [x] Confirm `skipToNext()` actually advances the feed. TikTok's `feed-navigation-next` button works; `dispatchEvent(new Event("hs:skip"))` tests it without the backend.
- [ ] Flip `VITE_HS_ENABLE_CONTENT=true`, load unpacked extension, watch `VIDEO_CHANGED` messages flow in the SW console.
- [ ] Get an `AI_GATEWAY_API_KEY`, run `pnpm dev:web`, hit `/api/evaluate` with curl and a fake context. Check probabilities look sane for obvious matches / non-matches.
- [ ] Install Moondream Station, confirm `POST localhost:2020/v1/caption` works with a data URL from `captureVisibleTab`.
- [ ] Watch a real skip happen.

## Phase 2 — make it good

- [ ] Tune `THRESHOLDS` against a handful of policies on real feeds. Log `violatesProbability` per stage.
- [ ] Measure latencies (`Decision.latencyMs` + SW timestamps). Text pass goal < 300 ms, visual < 1.5 s.
- [ ] Crop the captured frame to the `<video>` element's bounding rect before sending to Moondream if UI chrome confuses captions.
- [x] Comments: used only if the user already has TikTok's comment panel open (we never open it). The content script sends `VIDEO_CONTEXT_UPDATED` when they load. Only used when the URL video id matches and they aren't the previous video's stale list.
- [ ] Popup: show "Moondream Station not detected" hint when `isAvailable()` is false.
- [ ] Subtle on-page indicator on `DECISION` (tiny dot: checking / clear / skipped) — optional, must not be distracting.

## Phase 3 — polish for demo

- [x] Landing page design pass (`apps/web/app/page.tsx`).
- [x] Live Jev in the prompt playground via the public, rate-limited `/api/playground` (2026-09-26). Still to do: check the 8 mock Reels score sensibly for each preset against the deployed key, and tune the captions/descriptions in `lib/playground/clips.ts` if any preset misfires.
- [x] Sync policy between healthyscroll.net and the extension — via the Supabase `policies` table (`background/sync.ts`), newest `updated_at` wins.
- [ ] Observability ("your week"): category question + on-device ledger + insights page are scaffolded (`shared/categories.ts`, `shared/insights.ts`, `background/ledger.ts`, `src/insights/`) but unverified — see docs/OBSERVABILITY.md once written. Landing page first.
- [ ] Deploy web to Vercel; point extension prod `API_BASE_URL` at it.
- [ ] Pack the extension.

## Later / maybe

- Historical proposal: Instagram Reels and YouTube Shorts adapters. Instagram is now implemented and is the current target on both browsers; YouTube Shorts remains planned.
- Moondream Cloud fallback route (`/api/describe`) for users without Station — opt-in, since frames leave the device.
- Use a Jev `choice` question to tag *which* part of the policy matched, for a "skipped because: gambling" tooltip.
- Unit tests for `decide()` with `Experimental_EvaluationMockModelV4`.
- Rate-limit `/api/evaluate` per Supabase user id if abuse becomes a concern.

## Known environment gotchas

- Node **>= 22.12** required (Vite 8 / rolldown native binding). `.nvmrc` provided.
- If `pnpm` via corepack fails with "Cannot find matching keyid", run with `COREPACK_INTEGRITY_KEYS=0` or upgrade corepack.
