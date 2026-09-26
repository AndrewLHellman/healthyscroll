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
- `packages/shared` — types, Jev question schema, thresholds. Consumed as raw TS by both apps.

## Rules of the codebase

- **All TikTok DOM knowledge lives in `apps/extension/src/content/tiktok.ts`.** Nowhere else. Prefer `data-e2e` selectors.
- **The content script never makes decisions.** It reports `VIDEO_CHANGED` and executes `SKIP_VIDEO`. Judgement is in `background/orchestrator.ts`.
- **The extension never holds the AI Gateway key.** Jev is only called from `apps/web/lib/jev.ts`.
- **Image bytes never leave the device.** Frames go to Moondream Station on `localhost:2020` only. Only text (metadata + captions) goes to our API.
- **Never skip on error.** If Jev/Moondream/API fails, log and leave the video alone.
- Cross-context message types are defined once in `apps/extension/src/lib/messages.ts`.
- Anything shared between extension and web (types, Jev schema, thresholds) goes in `packages/shared`.
- UI is minimal by design. Don't add settings, stats, or onboarding without being asked.

## Current state

TikTok adapter (scrape + skip) verified on the live For You page; the Jev/Moondream pipeline has not been run yet. The content script observer is gated behind `VITE_HS_ENABLE_CONTENT=true`; `VITE_HS_DEBUG=true` adds console logging and the `hs:probe` / `hs:skip` console hooks. Do not drive a browser or load the extension unless asked — see `docs/ROADMAP.md` Phase 1 for the order of operations.

## External APIs (verified 2026-09-25)

- Jev: `experimental_evaluate({ model: "typesafe-ai/jev", state, questions })` from `ai@7`. Boolean answers → `result.answers.<q>.probability`. Details in `docs/JEV.md`.
- Moondream Station REST: `POST http://localhost:2020/v1/caption|query` with `{ image_url: <data URL> }`. Details in `docs/MOONDREAM.md`.
