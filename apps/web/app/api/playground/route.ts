import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { Decision } from "@healthyscroll/shared";
import { decide } from "@/lib/jev";
import { CLIPS } from "@/lib/playground/clips";

/**
 * POST /api/playground
 *
 * Powers the prompt playground on the landing page. Body: `{ prompt }`.
 * Response: `{ scores }`, one `violatesProbability` per clip in `CLIPS` order
 * (`null` where Jev failed, never a skip).
 *
 * Unlike /api/evaluate this is public — visitors aren't signed in — so the
 * content is fixed server-side: a caller chooses the prompt and nothing else,
 * which bounds one request to `CLIPS.length` Jev calls over known inputs.
 * Each clip goes through the same `decide()` as a real Reel, with its vision
 * description as the visual caption (the text+description pass in reels.ts).
 */

const bodySchema = z.object({
  prompt: z.string().trim().min(1).max(300),
});

export async function POST(req: NextRequest) {
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    // No gateway credentials (local dev): tell the page to fall back to its mock.
    return NextResponse.json({ error: "playground disabled" }, { status: 503 });
  }
  if (!allow(clientIp(req))) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { prompt } = parsed.data;

  const scores = await Promise.all(
    CLIPS.map(async (c): Promise<number | null> => {
      try {
        const d: Decision = await decide(
          {
            policy: { prompt },
            context: c.context,
            frames: [{ videoId: c.context.videoId, atMs: 0, caption: c.visionDescription }],
          },
          "visual",
        );
        return d.violatesProbability;
      } catch (err) {
        console.warn("[playground] jev failed", c.context.author, err);
        return null;
      }
    }),
  );

  return NextResponse.json({ scores });
}

/* ------------------------------------------------------------- rate limit */

// Best-effort, per process (the site runs as one container). Enough to stop a
// loop from burning gateway credit; a debounced human types far below this.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, { count: number; resetAt: number }>();

/** Client IP from nginx's forwarding headers; "" when there are none. */
function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "";
}

function allow(ip: string): boolean {
  // Without a client IP everyone shares one bucket, so give it room: still a
  // ceiling on gateway spend, not one visitor's loop locking the rest out.
  const max = ip ? MAX_PER_WINDOW : MAX_PER_WINDOW * 10;
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt <= now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    return true;
  }
  entry.count += 1;
  return entry.count <= max;
}
