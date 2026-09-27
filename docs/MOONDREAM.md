# Moondream (legacy TikTok on-device vision)

This reference covers the legacy TikTok/Chrome implementation. The current targets are Instagram Reels in iPhone Safari (primary) and desktop Chrome (secondary); both use `apps/vision` to describe Reel media and do not require Moondream Station.

Reference notes for the vision model. Verified 2026-09-25.

## What it is

Moondream is a family of tiny vision-language models (0.5B, 2B, 3B params) built for edge devices. Fast enough on a laptop CPU to describe a frame in well under a second. Capabilities: `caption`, `query` (VQA), `detect` (bounding boxes), `point`, `segment`.

## How we run it

**Moondream Station** — free desktop app (Mac / Ubuntu) that serves the model locally over REST.

- Default endpoint: **`http://localhost:2020/v1`** (falls to a nearby port if 2020 is taken)
- Same REST shape as Moondream Cloud, so swapping the base URL is the only change for a cloud fallback.
- Install: https://moondream.ai/station — docs: https://docs.moondream.ai/station/

The legacy TikTok pipeline needs Station running for its visual stages. Without it, the extension degrades to text-only decisions.

## API surface we use

Called from the background service worker with plain `fetch` (`apps/extension/src/background/moondreamClient.ts`). We don't use the `moondream` npm package in the extension because the service worker has no Node `Buffer`/`fs`; the REST body is trivial.

```
POST /v1/caption   { image_url: "<data:image/jpeg;base64,...>", length: "short"|"normal"|"long", stream: false }
                   → { caption: string }

POST /v1/query     { image_url: "<data url>", question: string, stream: false }
                   → { answer: string }
```

`image_url` accepts a base64 data URL — exactly what `chrome.tabs.captureVisibleTab` returns, no conversion needed.

## Official Node client (for server-side fallback)

```bash
npm install moondream   # v0.2.0
```

```js
import { vl } from "moondream";
const model = new vl({ endpoint: "http://localhost:2020/v1" }); // Station
// or
const model = new vl({ apiKey: process.env.MOONDREAM_API_KEY }); // Cloud

const { caption } = await model.caption({ image: buffer, length: "short" });
const { answer }  = await model.query({ image: buffer, question: "..." });
```

`image` is a `Buffer` or base64 string. Streaming supported via `stream: true`.

If we add a `/api/describe` route for users without Station, this is what it would use. Note that this *does* send frames off-device — should be opt-in and clearly labelled.

## How we prompt it

Per frame, two calls in parallel:

1. `caption` (short) — neutral description, gives Jev general context.
2. `query` with the user's policy baked in:
   > A user does not want to see: "{policy}". Describe anything in this image related to that, or say "nothing relevant".

Both strings go into `FrameDescription` and onward to Jev. Moondream never makes the skip decision; it only describes.

## Sources

- https://github.com/m87-labs/moondream-node
- https://github.com/m87-labs/moondream-station
- https://docs.moondream.ai/station/
- https://moondream.ai/
