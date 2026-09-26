# Healthy Scroll

**Your prompt, your feed.** A Chrome extension that skips short-form videos which don't align with your goals — you describe what you don't want to see, it skips those videos in real time.

Built for TigerHacks 2026 (theme: health). Decisions by [Jev](https://vercel.com/ai-gateway/models/jev) via Vercel AI Gateway; on-device vision by [Moondream](https://moondream.ai/).

## Docs

- [docs/OVERVIEW.md](docs/OVERVIEW.md) — what it is and why
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — repo layout, components, data flow
- [docs/DECISION_PIPELINE.md](docs/DECISION_PIPELINE.md) — the text → visual → monitor pipeline
- [docs/JEV.md](docs/JEV.md) / [docs/MOONDREAM.md](docs/MOONDREAM.md) — model reference notes
- [docs/ROADMAP.md](docs/ROADMAP.md) — what's done, what's next

## Layout

```
apps/extension   Chrome extension (Vite + CRXJS + React + TS)
apps/web         healthyscroll.net (Next.js) + /api/evaluate (Jev)
packages/shared  Types, Jev question schema, thresholds
```

## Setup

Requires Node >= 22.12 and pnpm.

```bash
nvm use                 # reads .nvmrc
pnpm install
cp .env.example apps/web/.env.local   # add AI_GATEWAY_API_KEY
```

## Develop

```bash
pnpm dev:web            # http://localhost:3000
pnpm dev:extension      # builds to apps/extension/dist with HMR
```

Load `apps/extension/dist` as an unpacked extension at `chrome://extensions`. For the visual stages, install and run [Moondream Station](https://moondream.ai/station) (serves on `localhost:2020`).

The content-script observer is off by default while the pipeline is under construction. Set `VITE_HS_ENABLE_CONTENT=true` in `apps/extension/.env` to turn it on.

```bash
pnpm typecheck          # all packages
pnpm build              # all packages
```
