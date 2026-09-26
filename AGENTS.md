# CLAUDE.md

Healthy Scroll — a Safari extension for iPhone that skips Instagram Reels (on `instagram.com` in Safari, not the app) that don't match a policy the user wrote in plain English. TikTok in Chrome is the secondary target; YouTube Shorts is later. Read `docs/OVERVIEW.md` first, then `docs/ARCHITECTURE.md` and `docs/DECISION_PIPELINE.md`. The landing page (`apps/web/app/page.tsx`, especially the FAQ) is the current source of truth for product intent; the docs still describe the Chrome/TikTok build and are being brought in line. This file is just operating notes.

## Commands

```bash
pnpm install
pnpm typecheck        # run after every change; all three packages must pass
pnpm build
pnpm dev:web          # Next.js on :3000
pnpm dev:extension    # Vite/CRXJS → apps/extension/dist
```

Node >= 22.12 (`.nvmrc`). If corepack complains about a keyid, prefix with `COREPACK_INTEGRITY_KEYS=0`.

## Layout

- `apps/extension` — MV3 web extension (Vite/CRXJS). Ships as a Safari Web Extension on iOS and loads unpacked in Chrome for development. `background/` is the brain (pipeline), `content/` is eyes and hands only (scrape + skip), `popup/` is one toggle + one textarea, `insights/` is the on-device "your week" page.
- `apps/web` — Next.js 16 landing + dashboard + `app/api/evaluate/route.ts` (the only backend; calls Jev, and Moondream when a frame is needed).
- `packages/shared` — types, Jev question schema, thresholds. Consumed as raw TS by both apps.

## Rules of the codebase

- **All platform DOM knowledge lives in one adapter per site under `apps/extension/src/content/`** (`instagram.ts` for Reels, `tiktok.ts` for TikTok). Nowhere else. Adapters share the `VideoContext` shape; the rest of the extension must not know which site it is on. Prefer stable hooks (`data-e2e` on TikTok, `aria-label`/roles on Instagram) over class names.
- **The content script never makes decisions.** It reports `VIDEO_CHANGED` and executes `SKIP_VIDEO`. Judgement is in `background/orchestrator.ts`.
- **The extension never holds the AI Gateway key.** Jev is only called from `apps/web/lib/jev.ts`.
- **Auth is Supabase + Google, run from the background worker** (`background/auth.ts`, session in `chrome.storage.local`). Sign-in is optional: without it the prompt lives only on the device and `/api/evaluate` still works. The API verifies the bearer token in `apps/web/lib/supabase.ts`. Chrome extension ID is pinned by `key` in the manifest; the private key is `apps/extension/key.pem` (gitignored). Safari uses its own bundle ID; the OAuth redirect must be registered for both.
- **Database is Supabase Postgres with RLS** (`supabase/migrations/`). Tables: `policies` (one row per user), `skips`, and `feed_days` (daily watch totals per topic). The extension syncs in `background/sync.ts` only; DB calls are best-effort and must never block or trigger a skip.
- **Watch tally ("Your week") is daily totals, never per-Reel records.** The Instagram content script times each Reel off its existing 250 ms active-Reel check (visible time only, capped at 3 min, swipe-throughs under 1 s ignored) and sends batches (`REELS_WATCHED`). `background/tally.ts` adds them to per-day, per-category totals in `chrome.storage.local`; the category is Jev's `category` answer from the text pass (`reels.ts`). Signed-in users' totals are upserted to `feed_days`; which Reels were watched never leaves the phone. Shapes and `summarizeDays()` in `packages/shared/src/feed.ts` / `insights.ts`. Debug: `dispatchEvent(new Event("hs:tally"))`.
- **Frames are described, then discarded. Never stored.** The extension sends text only (caption, comments, the user's prompt). When Jev is unsure, the *server* fetches one frame, has Moondream describe it in a sentence, and drops the bytes; only the sentence is kept for the second Jev call. The dwell tally ("your week") never leaves the phone. There is no local Moondream Station on iPhone; `background/moondreamClient.ts` → `localhost:2020` is the Chrome-dev-only path and is going away.
- **Never skip on error.** If Jev/Moondream/API fails, log and leave the Reel alone. Only confident matches (`THRESHOLDS.skip`) skip; the middle band gets a second look, never a guess.
- Cross-context message types are defined once in `apps/extension/src/lib/messages.ts`.
- Anything shared between extension and web (types, Jev schema, thresholds) goes in `packages/shared`.
- **Safari on iOS is the constraint.** No `chrome.tabs.captureVisibleTab`, no `localhost`, service worker can be killed anytime. Anything that only works in desktop Chrome is dev tooling, not product.
- UI is minimal by design. Don't add settings, stats, or onboarding without being asked. The popup is one toggle, one text box, one line about today.

## Deploy

Pushing to `main` builds `apps/web/Dockerfile`, pushes it to `ghcr.io/andrewlhellman/healthyscroll-web`, and restarts it on the server via `deploy/docker-compose.yml` (`.github/workflows/deploy.yml`). On the server: `/srv/healthyscroll/{docker-compose.yml,.env}`, container on `127.0.0.1:3001`, nginx site `healthyscroll.net` in front. Secrets go in the server's `.env`, never in the repo.

## Current state

The landing page and marketing are ahead of the code. As of 2026-09-26:

- Only `content/tiktok.ts` exists; `content/instagram.ts` (Reels on `instagram.com`) has not been written, and `manifest.config.ts` still matches `tiktok.com` only.
- The Safari Web Extension wrapper (Xcode project) does not exist yet; the extension is built and loaded unpacked in Chrome.
- Moondream is still called from the extension against `localhost:2020`; the server-side describe step in `/api/evaluate` has not been built.
- TikTok adapter (scrape + skip) is verified on the live For You page; the Jev pipeline has not been run end to end.

The content script observer is gated behind `VITE_HS_ENABLE_CONTENT=true`; `VITE_HS_DEBUG=true` adds console logging and the `hs:probe` / `hs:skip` console hooks. Do not drive a browser or load the extension unless asked — see `docs/ROADMAP.md` for the order of operations.

## External APIs (verified 2026-09-25)

- Jev: `experimental_evaluate({ model: "typesafe-ai/jev", state, questions })` from `ai@7`. Boolean answers → `result.answers.<q>.probability`. Details in `docs/JEV.md`.
- Moondream REST: `POST /v1/caption|query` with `{ image_url: <data URL> }`. Verified against Moondream Station on `localhost:2020`; the same shape is used server-side (Moondream Cloud or a Station next to the web container). Details in `docs/MOONDREAM.md`.
