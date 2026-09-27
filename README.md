# Healthy Scroll

![Healthy Scroll demo](apps/web/public/graphics/asset.gif)

**Your prompt, your feed.** Healthy Scroll skips short-form videos that conflict with a policy you write in plain English. The primary target is **Instagram Reels on instagram.com in Safari on iPhone**, with Instagram Reels in desktop Chrome as the secondary target. It does not work inside the Instagram app; YouTube Shorts support is planned.

Jev makes the filtering decisions through the web API. For Instagram, a separate vision service describes the Reel's own public video and images; it never receives your policy or uploads your screen. An optional audio pass transcribes unclear Reels through ElevenLabs. Filtering requires Google sign-in. API failures leave the Reel alone.

## Project layout

| Path                  | Purpose                                                                      |
| --------------------- | ---------------------------------------------------------------------------- |
| `apps/web`            | Next.js landing page, dashboard, Safari sign-in at `/connect`, and Jev API   |
| `apps/extension`      | Shared Safari and Chrome extension code, built with Vite                     |
| `apps/ios`            | Xcode app that packages the Safari extension                                 |
| `apps/vision`         | Python/FastAPI service for Reel descriptions and optional transcription      |
| `packages/shared`     | Shared TypeScript types, model questions, thresholds, and auth configuration |
| `supabase/migrations` | Database schema and row-level security policies                              |
| `deploy`              | Docker Compose and nginx configuration for the hosted services               |

## Prerequisites

- Node **22.12 or newer** (`.nvmrc`) and **pnpm 10.9.0** (pinned in `package.json`).
- Python **3.11 or 3.12** and **ffmpeg** on `PATH` for the vision service.
- A Vercel AI Gateway API key for Jev and hosted vision descriptions.
- Access to the configured Supabase project and Google OAuth client, or your own replacements (see below).
- **macOS with Xcode 27 and an iPhone simulator** for the iOS workflow used by this project. Desktop Chrome suffices for the Chrome workflow.
- Optional: an ElevenLabs key for transcription, or a GPU for local vision models.

The commands below use a POSIX shell and start from the repository root unless stated otherwise. The vision service's [README](apps/vision/README.md) also covers Windows and local GPU models.

## Install and configure

```bash
nvm use
corepack enable
pnpm install
cp apps/web/.env.example apps/web/.env.local
cp apps/extension/.env.example apps/extension/.env.local
cp apps/vision/.env.example apps/vision/.env
```

Copy the examples only on first setup, preserving any existing local configuration. If Corepack reports a `keyid` error, prefix the failing command with `COREPACK_INTEGRITY_KEYS=0`.

### Web API

Set this in `apps/web/.env.local`:

```dotenv
AI_GATEWAY_API_KEY=your_gateway_key
```

The web server owns the Jev key; never put it in the extension or a `VITE_*` variable. `MOONDREAM_API_KEY` in the example is not required for the Instagram setup. Without a gateway key, the landing page still works and its playground falls back to an offline keyword demo, but live filtering needs the key.

### Vision service

For a setup without a GPU, edit `apps/vision/.env` to use the hosted captioner instead of the example's local Qwen model:

```dotenv
VISION_CAPTIONER=gemini-2.5-flash-lite
AI_GATEWAY_API_KEY=your_gateway_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_project_anon_key
VISION_REQUIRE_AUTH=true
```

Use the **same Supabase project** as the web app and extension. Their checked-in public configuration is in [packages/shared/src/supabase.ts](packages/shared/src/supabase.ts). The anon key is public; do not substitute a service-role key.

Optionally set `ELEVENLABS_API_KEY` to enable the last-resort audio pass. The defaults cap audio at 30 seconds per Reel, 50 new transcriptions per user per UTC day, and 1,000 across all users; adjust `TRANSCRIBE_MAX_S`, `TRANSCRIBE_PER_USER_DAY`, and `TRANSCRIBE_DAILY_MAX` as needed. Without the key, the extension keeps its earlier decision. Set `FFMPEG_PATH` if ffmpeg is not on `PATH`.

Install the Python service:

```bash
cd apps/vision
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

`requirements.txt` supports the hosted captioner without PyTorch or a GPU. Local models need the additional dependencies in `requirements-models.txt`; see the [vision guide](apps/vision/README.md).

### Extension endpoints

Set these in `apps/extension/.env.local` to run against your local services:

```dotenv
VITE_API_BASE_URL=http://localhost:3000
VITE_VISION_URL=http://localhost:8000
VITE_HS_DEBUG=true
VITE_HS_ENABLE_CONTENT=false
```

`VITE_HS_ENABLE_CONTENT` controls the legacy TikTok observer; leave it disabled for Instagram on both Safari and Chrome. Debug mode enables logs and the `hs:probe` / `hs:skip` console hooks.

These values are embedded at build time. Restart the development process or rebuild after changing them. Without overrides, development uses localhost and production builds use `https://healthyscroll.net` and `https://vision.healthyscroll.net`. Remove the localhost overrides when building for a physical iPhone with the hosted services; a phone's localhost is not your computer. The iOS simulator can reach the Mac's localhost.

### Supabase, database, and Google sign-in

The web app and extension read `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `GOOGLE_CLIENT_ID` from [packages/shared/src/supabase.ts](packages/shared/src/supabase.ts), **not web environment variables**. If using the existing project, its owner must configure OAuth redirects and migrations. For your own project:

1. Replace those public constants and set matching Supabase values in `apps/vision/.env`. Update `SUPABASE_HOST` in `apps/extension/manifest.config.ts` to allow your project's hostname, then rebuild.
2. Apply the SQL files in [supabase/migrations](supabase/migrations) in filename order using the Supabase SQL editor or your migration workflow. They create `policies`, `skips`, and `feed_days`, enable row-level security, and add the audio decision stage.
3. Configure a Google OAuth web client and enable the Google provider in Supabase with its client ID and secret. The client ID must match `GOOGLE_CLIENT_ID` in shared code. If the OAuth app is in testing, add your development accounts as test users.
4. Add these **Authorized redirect URIs on the Google client** for the website and Safari handoff:

   ```text
   http://localhost:3000/dashboard
   http://localhost:3000/connect
   https://healthyscroll.net/dashboard
   https://healthyscroll.net/connect
   ```

   Use your own production origin if hosting elsewhere. These paths return directly from Google to the website, which exchanges the ID token with Supabase.

5. For Chrome's separate OAuth flow, also authorize `https://<your-project>.supabase.co/auth/v1/callback` on the Google client. Add `https://bjobokpnmmjcmdiofgkpkajndmjekmej.chromiumapp.org/` to **Supabase Auth's Redirect URLs**. The manifest's public key pins that extension ID; no private extension key is needed to load it unpacked. If you change the ID, update this allow-list entry too.

Safari sign-in starts from the extension popup and opens `/connect`. That page creates a separate session and hands it to the extension; signing in to the website dashboard alone does not sign in the extension.

## Run the local services

Keep each service running in its own terminal:

```bash
# Terminal 1 — repository root
pnpm dev:web
```

```bash
# Terminal 2 — repository root
cd apps/vision
source .venv/bin/activate
python -m uvicorn vision.main:app --host 127.0.0.1 --port 8000
```

The website is at `http://localhost:3000`; vision is at `http://localhost:8000`. Check the processes with:

```bash
curl -f http://localhost:3000/ -o /dev/null
curl -f http://localhost:8000/health
```

These checks confirm the services are listening, not that model calls or sign-in work. `/api/evaluate` and `/describe` require a Supabase bearer token; use a signed-in extension for an end-to-end check.

## Run on iPhone Safari (simulator)

With the local services running and extension endpoints configured:

```bash
pnpm build:safari
open "apps/ios/Healthy Scroll/Healthy Scroll.xcodeproj"
```

1. In Xcode, select the **Healthy Scroll** scheme and an iPhone simulator, then run with **⌘R**. The project references `apps/extension/dist-safari`, so build the extension before running Xcode.
2. In the simulator, open **Settings → Apps → Safari → Extensions → Healthy Scroll**, enable it, and allow access to `instagram.com`, `healthyscroll.net`, and `localhost` for local development.
3. In Safari, open `instagram.com` and sign in to Instagram. Open the Healthy Scroll extension popup, choose **Sign in**, and complete Google sign-in through `/connect`.
4. Write a filter such as “gambling, casinos, or sports betting,” enable filtering, and open Reels. Confident matches should advance the feed automatically.

For continuous extension builds, run `pnpm dev:safari` in another terminal. **After each rebuild, run again in Xcode to reinstall the updated resources. Every reinstall drops Safari's site grants.** Grant them again, including from Safari's page menu (≡) if scripts silently fail to run.

Inspect logs from **Mac Safari → Develop → Simulator**. The Instagram page and extension background page have separate consoles. To locate the installed app for resource inspection:

```bash
xcrun simctl get_app_container booted net.healthyscroll app
```

Its built manifest is at `PlugIns/Healthy Scroll Extension.appex/manifest.json`. For a physical iPhone, select the device and configure signing for the app and extension targets in Xcode; use reachable hosted API endpoints.

## Run in desktop Chrome

```bash
pnpm dev:extension
```

1. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `apps/extension/dist`.
2. Sign in through the extension popup, write a policy, and enable filtering.
3. Open Instagram Reels at `instagram.com`. Reload the extension and feed after changes to the manifest or background code.

Instagram in Chrome uses the same vision service and decision pipeline as Safari. TikTok's legacy visual pipeline uses **Moondream Station** at `http://localhost:2020/v1`; follow [docs/MOONDREAM.md](docs/MOONDREAM.md) for that optional setup. If Station is unavailable, TikTok runs only its text pass. It is not needed for Instagram.

## Checks and production builds

Run these from the repository root:

```bash
pnpm typecheck       # shared, extension, and web; run after changes
pnpm build           # shared + Chrome extension + Next.js
pnpm build:safari    # Safari resources for Xcode, built separately
```

The Python service and iOS app are not built by `pnpm build`. Chrome output is in `apps/extension/dist`, Safari output in `apps/extension/dist-safari`, and Next.js output in `apps/web/.next`. To serve a built website locally:

```bash
pnpm --filter @healthyscroll/web start
```

## Deployment

[.github/workflows/deploy.yml](.github/workflows/deploy.yml) builds and publishes the web and vision Docker images to GHCR, then pulls and restarts them on the configured server. It runs on pushes to `main` that touch its listed application/deployment paths, or via manual dispatch; a README-only push does not trigger it. The workflow needs the repository secret `DEPLOY_SSH_KEY` and a server with Docker Compose and SSH access configured. A fork must also update the workflow's server and image settings and the image names in Compose.

The server keeps [deploy/docker-compose.yml](deploy/docker-compose.yml) and a shared `.env` at `/srv/healthyscroll/`. Put `AI_GATEWAY_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and optional `ELEVENLABS_API_KEY` there; keep `VISION_REQUIRE_AUTH=true`. Compose selects the hosted Gemini captioner and exposes web on `127.0.0.1:3001` and vision on `127.0.0.1:8000`. Install the [nginx configurations](deploy/nginx) separately and configure DNS/TLS for `healthyscroll.net` and `vision.healthyscroll.net`. Secrets stay on the server, outside version control.

To build the images yourself:

```bash
docker build -f apps/web/Dockerfile -t healthyscroll-web .
docker build -t healthyscroll-vision apps/vision
```

The Safari app is built and distributed separately through Xcode; the server workflow does not package it.

## Troubleshooting

| Symptom                                   | Check                                                                                                                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Safari extension appears inactive         | Re-enable site permissions after reinstalling, including from the page menu; inspect both page and background consoles.                                                |
| Google reports a redirect mismatch        | Check the exact origin and `/dashboard` or `/connect` path on the Google client; Chrome additionally needs the Supabase callback and extension redirect configuration. |
| API returns 401                           | Sign in through the extension, and confirm all services use the same Supabase project.                                                                                 |
| Text decisions work but descriptions fail | Check vision logs, `ffmpeg`, the captioner, gateway key, and `SUPABASE_ANON_KEY`.                                                                                      |
| A local build calls production            | Set both extension endpoint overrides and rebuild/reinstall.                                                                                                           |
| Legacy TikTok observer does nothing                       | Enable `VITE_HS_ENABLE_CONTENT`, restart Vite, and reload the extension and feed.                                                                                      |
| `/transcribe` returns 503                 | Audio is optional; configure `ELEVENLABS_API_KEY` to enable it.                                                                                                        |
