# Architecture

## Repo layout

pnpm workspace monorepo.

```
healthyscroll/
├── apps/
│   ├── extension/            Chrome extension (MV3). Vite + CRXJS + React + TS + Tailwind.
│   │   ├── manifest.config.ts     MV3 manifest (permissions, entries)
│   │   └── src/
│   │       ├── background/        Service worker = the brain. Orchestrates the pipeline.
│   │       │   ├── index.ts           message router (thin)
│   │       │   ├── orchestrator.ts    text → visual → monitor pipeline, one Session per tab
│   │       │   ├── jevClient.ts       fetch → our /api/evaluate
│   │       │   ├── moondreamClient.ts fetch → localhost:2020/v1 (caption, query)
│   │       │   ├── frameCapture.ts    chrome.tabs.captureVisibleTab
│   │       │   └── policyStore.ts     chrome.storage.sync wrapper
│   │       ├── content/           Runs on tiktok.com. Eyes and hands only, no judgement.
│   │       │   ├── index.ts           detects video change, performs skip on command
│   │       │   └── tiktok.ts          ALL TikTok DOM knowledge (selectors, scrape, skip)
│   │       ├── popup/             React UI: toggle + textarea
│   │       └── lib/
│   │           ├── messages.ts        typed content↔background message contract
│   │           └── config.ts          endpoints (dev vs prod)
│   └── web/                  Next.js 16 (App Router). healthyscroll.net.
│       ├── app/page.tsx           landing
│       ├── app/api/evaluate/route.ts   POST → Jev → Decision  (the only backend)
│       └── lib/jev.ts             experimental_evaluate call, question wiring
├── packages/
│   └── shared/               Types + Jev schema + thresholds shared by both apps.
│       └── src/
│           ├── types.ts           UserPolicy, VideoContext, FrameDescription, EvaluateRequest, Decision
│           ├── questions.ts       JEV_MODEL, jevQuestions, buildJevState
│           └── thresholds.ts      THRESHOLDS, toVerdict, MONITOR_INTERVAL_MS, MAX_FRAMES_PER_VIDEO
└── docs/
```

`@healthyscroll/shared` is consumed as raw TS source (no build step): the extension via Vite, the web app via `transpilePackages`.

## Components and responsibilities

### Content script (`apps/extension/src/content`)
- Detects when the video in view changes (MutationObserver + captured scroll, throttled). Stable `videoId` from the player wrapper id → permalink → URL → text fingerprint.
- Scrapes `VideoContext` (text only) and sends `VIDEO_CHANGED` to background; sends `VIDEO_CONTEXT_UPDATED` once comments load.
- Uses comments only if the user already has TikTok's comment panel open (they're only in the DOM then). Never opens it.
- On `SKIP_VIDEO`, advances the feed: TikTok's next button, then scroll-into-view, then ArrowDown, checking after each that the video actually changed.
- Knows nothing about models. `tiktok.ts` is the only file allowed to contain selectors.

### Background service worker (`apps/extension/src/background`)
- Owns one `Session` per tab. New video → cancel old session, start new.
- Runs the pipeline (see DECISION_PIPELINE.md).
- Talks to two external things: our API (Jev) and Moondream Station (localhost).
- Captures frames itself with `chrome.tabs.captureVisibleTab` — the content script can't, because TikTok's `<video>` is cross-origin and taints any canvas.

### Popup (`apps/extension/src/popup`)
- Reads/writes `UserPolicy` in `chrome.storage.sync`.
- Nothing else.

### Web API (`apps/web/app/api/evaluate`)
- Stateless. Validates `EvaluateRequest` with zod, calls Jev, returns `Decision`.
- Holds the `AI_GATEWAY_API_KEY`. The extension must never have it.
- CORS open to `*` because the caller is a `chrome-extension://` origin.

### Web landing (`apps/web/app/page.tsx`)
- Landing page modelled on tsenta.com: hero → animated pipeline trace (`components/PipelineDemo.tsx`) → 3-stage how-it-works → prompt playground → "Your week" observability mock (`components/WeekMock.tsx`, fed by a seeded fake week in `lib/mockWeek.ts` run through the real `summarize()`) → open FAQ (privacy lives here now) → popup mock + signed-in saved prompt (`app/Dashboard.tsx`) CTA → footer. Google sign-in is `app/AuthButton.tsx` in the nav. Design tokens live in `app/globals.css` (`@theme`); fonts (Bricolage Grotesque / Geist / Geist Mono) in `app/layout.tsx`.
- Prompt playground (`components/PromptPlayground.tsx`) re-scores a mock feed of 8 clips as the prompt changes. Scoring is behind a `Scorer` interface in `lib/playground/scorers.ts`: `keywordScorer` (default, in-browser) or `jevScorer`, which posts each clip through `/api/evaluate` with its `VideoContext` + a canned Moondream caption (`lib/playground/clips.ts`). Enable with `NEXT_PUBLIC_PLAYGROUND_SCORER=jev`. Verdicts use `toVerdict()` from shared, so the page and the extension agree on what "skip" means.
- The "try writing yours" textarea is not wired to the extension yet; that needs `externally_connectable` (see ROADMAP). "Add to Chrome" links are `#` placeholders until the extension is published.

## Data flow

```
 tiktok.com tab                      extension SW                 healthyscroll.net         user's laptop
 ─────────────                       ────────────                 ─────────────────         ─────────────
 content: video changed ──VIDEO_CHANGED──▶ orchestrator
                                           │
                                           ├─ POST /api/evaluate {policy, context} ──▶ Jev (text pass)
                                           │◀──────────── Decision ────────────────────┘
                                           │  skip? ──SKIP_VIDEO──▶ content: click next
                                           │  uncertain/allow ↓
                                           ├─ captureVisibleTab → frame (jpeg data URL)
                                           ├─ POST localhost:2020/v1/caption ─────────────────────────────▶ Moondream Station
                                           ├─ POST localhost:2020/v1/query   ─────────────────────────────▶ Moondream Station
                                           │◀── caption, policyAnswer ─────────────────────────────────────┘
                                           ├─ POST /api/evaluate {policy, context, frames} ──▶ Jev (visual pass)
                                           │◀──────────── Decision ────────────────────┘
                                           │  skip? ──SKIP_VIDEO──▶ content
                                           └─ sleep 1.5s, repeat (monitor) up to MAX_FRAMES_PER_VIDEO
```

What crosses the network boundary to our server: policy text, page text, Moondream captions. **Never image bytes.**

## Message contract

Defined once in `apps/extension/src/lib/messages.ts`:

- content → background: `VIDEO_CHANGED {context}`, `VIDEO_CONTEXT_UPDATED {context}` (same video, comments arrived; restarts the pipeline), `VIDEO_ENDED {videoId}`
- background → content: `SKIP_VIDEO {videoId, decision}`, `DECISION {decision}`

`SKIP_VIDEO` carries the `videoId` so the content script can refuse to skip if the user already scrolled on.

## Permissions (manifest)

- `storage` — policy persistence
- `tabs`, `activeTab` — `captureVisibleTab`, tab messaging
- host: `tiktok.com`, `localhost:2020` (Moondream), `healthyscroll.net` + `localhost:3000` (API)

## Environments

| | API base | Moondream |
|---|---|---|
| dev (`vite`) | `http://localhost:3000` | `http://localhost:2020/v1` |
| prod (`vite build`) | `https://healthyscroll.net` | `http://localhost:2020/v1` |

Switch is `import.meta.env.DEV` in `lib/config.ts`.

## Key dependencies

- `ai@7` — `experimental_evaluate` (Jev). Gateway is the default provider in AI SDK 7, so the bare model string routes correctly.
- `@crxjs/vite-plugin@3` — MV3 bundling with HMR for popup and content scripts.
- `next@16`, `react@19`, `tailwindcss@4`, `zod@4`.
- Node **>= 22.12** (rolldown native binding). `.nvmrc` is set.
