# Architecture

Healthy Scroll is a pnpm workspace with a Python vision service and an Xcode wrapper. Instagram Reels in iPhone Safari is the primary target; Instagram Reels in desktop Chrome is the secondary target. Both use the same Instagram adapter, background decision pipeline, and server APIs.

## Repository layout

| Path | Responsibility |
| --- | --- |
| `apps/extension/src/content/instagram.ts` | Instagram DOM knowledge, active Reel detection, and skipping |
| `apps/extension/src/content/instagramMain.ts` | Instagram content-script entry point |
| `apps/extension/public/instagram-hook.js` | Main-world hook that reads Reel metadata and media from Instagram API responses |
| `apps/extension/src/background/reels.ts` | Jev decisions, description coordination, and audio fallback |
| `apps/extension/src/background/auth.ts` | Extension session and authenticated requests |
| `apps/extension/src/background/sync.ts` | Best-effort Supabase synchronization |
| `apps/extension/src/background/tally.ts` | Daily watch totals by topic |
| `apps/extension/src/popup` | Filtering toggle, policy text, and sign-in |
| `apps/extension/src/insights` | On-device weekly summary |
| `apps/web` | Next.js website, dashboard, `/connect`, and `/api/evaluate` |
| `apps/vision` | FastAPI descriptions and optional audio transcription |
| `apps/ios` | Xcode app packaging the Safari extension |
| `packages/shared` | Types, Jev questions, thresholds, auth constants, and API contracts |
| `supabase/migrations` | Database schema and row-level security |

Shared TypeScript is consumed directly by Vite and Next.js; it does not need a separate compiled package for development.

## Instagram data flow

1. The main-world hook reports Reel media and metadata; progressive video URLs provide a fallback. All Instagram DOM selectors stay in `content/instagram.ts`.
2. The content script sends `REELS_DISCOVERED` and `REEL_ACTIVE` to the background. It reports observations and executes `SKIP_REEL`; it never judges content.
3. The background calls `/api/evaluate` for Jev’s text decision and `/describe` for visual descriptions in parallel. Jev evaluates text plus descriptions as they arrive.
4. For an uncertain active Reel, the background may call `/transcribe` and ask Jev to evaluate the resulting transcript.
5. A confident match advances the feed only if that Reel is still active. Each Reel can be skipped once per tab.

The cross-context contract lives in `apps/extension/src/lib/messages.ts`; shared vision and evaluation contracts live in `packages/shared`. See [DECISION_PIPELINE.md](DECISION_PIPELINE.md).

## Authentication and storage

Sign-in is required for filtering. Web and vision APIs verify Supabase bearer tokens. The extension background owns its session in `chrome.storage.local`.

- **Safari:** opens `/connect`, which creates a separate session and hands it to the extension through `content/connect.ts`. The website’s dashboard session is not shared with the extension.
- **Chrome:** uses `chrome.identity` with Supabase’s OAuth flow. The manifest pins the extension ID for a stable redirect URL.
- **Website:** redirects directly to Google and exchanges the returned ID token with Supabase.

`background/sync.ts` synchronizes policies and skip records without blocking filtering. The content script measures visible Reel watch time and reports batches; `background/tally.ts` stores daily totals by topic and syncs signed-in users’ aggregates to `feed_days`. The watch tally does not upload a per-Reel viewing history.

## Privacy and service boundaries

The web API holds the Jev gateway key. Vision receives media references, never a policy, and fetches the Reel’s own CDN images/video without uploading the user’s screen. Hosted captioners process those media frames. Optional transcription sends public Reel audio to ElevenLabs. Descriptions and transcripts are cached per Reel.

The landing page’s prompt playground uses fixed example clips through `/api/playground`, with an offline keyword fallback. It is separate from authenticated live filtering.

## Build targets and endpoints

- **Safari:** `pnpm build:safari` produces `apps/extension/dist-safari`, referenced by the Xcode project. Background and content scripts are bundled as classic IIFEs in `vite.config.ts` because Safari cannot run CRXJS’s module loaders. The background can unload at any time.
- **Chrome:** `pnpm dev:extension` or the extension’s production build produces `apps/extension/dist`. Chrome uses an MV3 service worker.

Development defaults to web at `http://localhost:3000` and vision at `http://localhost:8000`; production defaults to `https://healthyscroll.net` and `https://vision.healthyscroll.net`. `VITE_API_BASE_URL` and `VITE_VISION_URL` override these at build time. Safari localhost match patterns must omit ports.

The Chrome manifest also retains a legacy TikTok adapter. Its `VIDEO_CHANGED` / `SKIP_VIDEO` messages, `background/orchestrator.ts`, viewport capture, and local Moondream pipeline are separate from the current Instagram architecture. `VITE_HS_ENABLE_CONTENT` gates only that legacy observer. See [MOONDREAM.md](MOONDREAM.md) for historical implementation details.

See the [README](../README.md) for complete setup, permissions, auth redirects, run commands, and deployment.
