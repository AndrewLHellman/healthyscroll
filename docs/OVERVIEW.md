# Healthy Scroll — Overview

**Your prompt, your feed.** Healthy Scroll skips Instagram Reels that conflict with a policy the user writes in plain English.

The primary target is **instagram.com in Safari on iPhone**. The secondary target is **instagram.com in desktop Chrome**. It does not work inside the Instagram app. YouTube Shorts is planned; the repository retains a legacy TikTok adapter, but TikTok is not the secondary product target.

## The user experience

1. Install and enable the extension, then sign in with Google from its popup.
2. Describe what you do not want to see, such as “gambling, casinos, or sports betting.”
3. Turn filtering on and scroll Instagram Reels. Confident matches are skipped automatically.
4. View “Your week” for daily totals by topic. The watch tally stores aggregates rather than a per-Reel viewing history.

## How it works

Both Instagram targets share the same pipeline in `apps/extension/src/background/reels.ts`:

1. As Instagram loads Reels, the extension discovers their text and media ahead of time.
2. Jev evaluates the text while `apps/vision` describes the Reel’s own cover image and video frames. A confident text-only skip can act immediately.
3. Jev evaluates text plus each available description. The vision service describes content; only Jev makes filtering decisions.
4. If the result remains uncertain and the Reel is on screen, an optional audio pass uses ElevenLabs to transcribe its audio, then asks Jev again. Licensed-song Reels are excluded from this audio pass.

The server holds the AI Gateway key. The extension never uploads the user’s screen: vision fetches the Reel’s public CDN media. Descriptions are cached per Reel and the vision service never receives the user’s policy. Failures never trigger a skip.

## Components

- **Extension:** discovers Reels, coordinates evaluation in the background, and advances the feed.
- **Web app:** landing page, dashboard, Safari sign-in handoff, and authenticated Jev API.
- **Vision service:** descriptions and optional transcription, shared by Safari and Chrome.
- **iOS app:** packages the Safari extension through Xcode.
- **Supabase:** Google authentication, policy sync, skip records, and daily topic totals with row-level security.

See the [README](../README.md) for setup, [architecture](ARCHITECTURE.md) for component boundaries, and [decision pipeline](DECISION_PIPELINE.md) for filtering behavior. The [landing-page FAQ](../apps/web/app/page.tsx) describes current product intent.
