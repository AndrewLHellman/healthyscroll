import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { EvaluateRequest } from "@healthyscroll/shared";
import { decide } from "@/lib/jev";
import { verifyRequest } from "@/lib/supabase";

/**
 * POST /api/evaluate
 *
 * Called by the extension's background worker once per stage per video.
 * Body: EvaluateRequest. Response: Decision. See packages/shared/src/types.ts.
 *
 * Requires `Authorization: Bearer <Supabase access token>` so only signed-in
 * users can spend the AI Gateway key. Otherwise stateless — no DB.
 */

const frameSchema = z.object({
  videoId: z.string(),
  atMs: z.number(),
  caption: z.string(),
  policyAnswer: z.string().optional(),
});

const bodySchema = z.object({
  // Empty prompt is allowed: the extension still asks for the category (tally-only mode).
  policy: z.object({ prompt: z.string().max(2000) }),
  context: z.object({
    videoId: z.string(),
    platform: z.enum(["tiktok", "instagram"]),
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
  const userId = await verifyRequest(req.headers.get("authorization"));
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: CORS_HEADERS });
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
  "Access-Control-Allow-Headers": "content-type, authorization",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
