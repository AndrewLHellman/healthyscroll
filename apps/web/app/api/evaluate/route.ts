import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { EvaluateRequest } from "@healthyscroll/shared";
import { decide } from "@/lib/jev";

/**
 * POST /api/evaluate
 *
 * Called by the extension's background worker once per stage per video.
 * Body: EvaluateRequest. Response: Decision. See packages/shared/src/types.ts.
 *
 * Stateless by design — no DB, no auth for the hackathon. If this ever needs
 * to be locked down, a per-install token in the extension is the simplest path.
 */

const frameSchema = z.object({
  videoId: z.string(),
  atMs: z.number(),
  caption: z.string(),
  policyAnswer: z.string().optional(),
});

const bodySchema = z.object({
  policy: z.object({ prompt: z.string().min(1).max(2000) }),
  context: z.object({
    videoId: z.string(),
    platform: z.literal("tiktok"),
    url: z.string(),
    author: z.string().optional(),
    description: z.string().optional(),
    hashtags: z.array(z.string()).optional(),
    audioTitle: z.string().optional(),
    comments: z.array(z.string()).optional(),
    onScreenText: z.array(z.string()).optional(),
  }),
  frames: z.array(frameSchema).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data as EvaluateRequest;

  // Stage is inferred server-side from what was sent; the client overrides it locally.
  const stage = body.frames && body.frames.length > 0 ? "visual" : "text";

  try {
    const decision = await decide(body, stage);
    return NextResponse.json(decision, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("[evaluate] jev failed", err);
    return NextResponse.json({ error: "evaluation failed" }, { status: 502, headers: CORS_HEADERS });
  }
}

// The extension calls this cross-origin from a chrome-extension:// origin.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
