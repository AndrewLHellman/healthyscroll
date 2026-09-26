# CLAUDE.md

Healthy Scroll — Chrome extension that skips short-form videos not aligned with a user-written policy. Read `docs/OVERVIEW.md` first, then `docs/ARCHITECTURE.md` and `docs/DECISION_PIPELINE.md`. Those are the source of truth for intent; this file is just operating notes.

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

- `apps/extension` — MV3 extension. `background/` is the brain (pipeline), `content/` is eyes and hands only (scrape + skip), `popup/` is one toggle + one textarea.
- `apps/web` — Next.js 16 landing + `app/api/evaluate/route.ts` (the only backend; calls Jev).
- `apps/vision` — Python/FastAPI `POST /analyze`: pulls ~3 frames from a Reel's DASH manifest or video URL with ffmpeg (range requests, no full download) and scores them against the policy with a VLM. Model is `VISION_MODEL`; `bench/` compares models on labeled clips using the same code. See `apps/vision/README.md`.
- `packages/shared` — types, Jev question schema, thresholds. Consumed as raw TS by both apps.

## Rules of the codebase

- **All TikTok DOM knowledge lives in `apps/extension/src/content/tiktok.ts`.** Nowhere else. Prefer `data-e2e` selectors.
- **Instagram Reels:** DOM knowledge (active Reel, skip) lives only in `content/instagram.ts`. Reel media (DASH manifest, poster, caption) comes from Instagram's API responses via the main-world hook `public/instagram-hook.js` (plain JS, appended to the built manifest by `vite.config.ts`; it can't import anything). Judgement is `background/reels.ts`: Jev text + vision `/analyze` in parallel for every Reel as it loads (prefetch), caption → Jev when vision is uncertain, one skip per Reel.
- **The content script never makes decisions.** It reports `VIDEO_CHANGED` and executes `SKIP_VIDEO`. Judgement is in `background/orchestrator.ts`.
- **The extension never holds the AI Gateway key.** Jev is only called from `apps/web/lib/jev.ts`.
- **Auth is Supabase + Google, run from the background worker** (`background/auth.ts`, session in `chrome.storage.local`). The API verifies the bearer token in `apps/web/lib/supabase.ts`. Extension ID is pinned by `key` in the manifest; the private key is `apps/extension/key.pem` (gitignored).
- **Database is Supabase Postgres with RLS** (`supabase/migrations/`). Tables: `policies` (one row per user) and `skips`. The extension syncs in `background/sync.ts` only; DB calls are best-effort and must never block or trigger a skip.
- **The extension never uploads the user's screen.** Visual analysis runs server-side in `apps/vision` on the Reel's own (public CDN) video, fetched from the manifest/URL the extension sends. No screenshots, no `captureVisibleTab` output, leaves the device. (Moving to Instagram Reels on iOS Safari; the TikTok/Moondream-Station path is legacy.)
- **Never skip on error.** If Jev/Moondream/API fails, log and leave the video alone.
- Cross-context message types are defined once in `apps/extension/src/lib/messages.ts`.
- Anything shared between extension and web (types, Jev schema, thresholds) goes in `packages/shared`.
- UI is minimal by design. Don't add settings, stats, or onboarding without being asked.

## Deploy

Pushing to `main` builds `apps/web/Dockerfile`, pushes it to `ghcr.io/andrewlhellman/healthyscroll-web`, and restarts it on the server via `deploy/docker-compose.yml` (`.github/workflows/deploy.yml`). On the server: `/srv/healthyscroll/{docker-compose.yml,.env}`, container on `127.0.0.1:3001`, nginx site `healthyscroll.net` in front. Secrets go in the server's `.env`, never in the repo.

## Current state

TikTok adapter (scrape + skip) verified on the live For You page; the Jev/Moondream pipeline has not been run yet. The content script observer is gated behind `VITE_HS_ENABLE_CONTENT=true`; `VITE_HS_DEBUG=true` adds console logging and the `hs:probe` / `hs:skip` console hooks. Do not drive a browser or load the extension unless asked — see `docs/ROADMAP.md` Phase 1 for the order of operations.

## External APIs (verified 2026-09-25)

- Jev: `experimental_evaluate({ model: "typesafe-ai/jev", state, questions })` from `ai@7`. Boolean answers → `result.answers.<q>.probability`. Details in `docs/JEV.md`.
- Moondream Station REST: `POST http://localhost:2020/v1/caption|query` with `{ image_url: <data URL> }`. Details in `docs/MOONDREAM.md`.
