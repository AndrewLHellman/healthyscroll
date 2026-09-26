# Jev (TypeSafe AI) via Vercel AI Gateway

Reference notes for the decision model. Verified against Vercel docs on 2026-09-25.

## What it is

Jev is TypeSafe AI's "System One" evaluation model. You give it `state` (string or structured object) and typed `questions`; it returns choices, scores, or boolean probabilities. It generates no prose — max output tokens is literally 0. TypeSafe reports it as up to ~194× faster and ~445× cheaper than using an LLM for the same classification work.

- Model id: **`typesafe-ai/jev`**
- Pricing: **$0.042 / 1M input tokens**, no output charge
- Limits: 64k tokens per request, 32k for `state`
- Questions in one request are evaluated independently and in parallel — adding questions doesn't degrade others.

## How we call it

`ai@7.0.105+` exposes `experimental_evaluate`. AI Gateway is the default provider in AI SDK 7, so the bare model string routes through it.

```ts
import { experimental_evaluate as evaluate } from "ai";

const result = await evaluate({
  model: "typesafe-ai/jev",
  state: { policy, video, visualFrames },
  questions: {
    violates: {
      type: "boolean",
      instructions: "...",
      criteria: { true: "...", false: "..." },
    },
  },
  providerOptions: { gateway: { zeroDataRetention: true } },
});

result.answers.violates.probability; // 0..1
result.providerMetadata?.typesafe?.confidence; // optional Record<string, number>
```

Our wrapper: `apps/web/lib/jev.ts`. Schema: `packages/shared/src/questions.ts`.

## Question types (for future expansion)

| Type | Fields in answer | Notes |
|---|---|---|
| `boolean` | `probability` | What we use. ~0.98 strong yes, ~0.02 strong no, ~0.5 unsure. |
| `choice` | `choice`, `probabilities` | Up to 255 options. Could classify *which* filter category matched (for a "why was this skipped" tooltip). |
| `score` | `score`, `probabilities` | 2–10 levels. Could grade severity. |

Probabilities are rounded to 2dp and may sum to 0.99.

## Auth

- Local dev / self-hosted: `AI_GATEWAY_API_KEY` env var (create at vercel.com → AI Gateway).
- Deployed on Vercel: `VERCEL_OIDC_TOKEN` is injected automatically; `vercel env pull` gives you a 12-hour one locally.

Key lives **only** in `apps/web`. The extension calls our API, never the gateway.

## Testing without spending

```ts
import { Experimental_EvaluationMockModelV4 as MockEvaluationModel } from "ai/test";
```

Lets us unit test `decide()` with canned probabilities. Not set up yet.

## Sources

- https://vercel.com/kb/guide/typesafe-jev-and-ai-sdk
- https://vercel.com/ai-gateway/models/jev
- https://vercel.com/i/what-is-jev
- https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway
