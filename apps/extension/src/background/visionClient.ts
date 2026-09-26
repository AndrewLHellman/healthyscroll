import type {
  VisionDescribeRequest,
  VisionDescribeResponse,
  VisionMediaResponse,
} from "@healthyscroll/shared";
import { VISION_BASE_URL } from "../lib/config";
import { authedFetch } from "./auth";

/**
 * apps/vision client. Same auth as /api/evaluate: the user's Supabase token.
 * Contract and client flow: packages/shared/src/vision.ts.
 */

export async function describe(req: VisionDescribeRequest): Promise<VisionDescribeResponse> {
  const res = await authedFetch(`${VISION_BASE_URL}/describe`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`vision describe failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as VisionDescribeResponse;
}

/**
 * The Reel's description: what /describe returned if it was ready, otherwise
 * poll for it. Resolves to the text, or null on failure/timeout — never throws.
 */
export async function describeAndWait(
  req: VisionDescribeRequest,
  { timeoutMs = 20_000, intervalMs = 1000 } = {},
): Promise<string | null> {
  const first = await describe(req);
  if (first.captionStatus === "ready") return first.caption ?? null;
  if (first.captionStatus !== "pending") return null;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const res = await authedFetch(`${VISION_BASE_URL}/media/${req.platform}/${encodeURIComponent(req.videoId)}`);
      if (!res.ok) return null;
      const media = (await res.json()) as VisionMediaResponse;
      if (media.captionStatus === "ready") return media.caption ?? null;
      if (media.captionStatus !== "pending") return null;
    } catch {
      return null;
    }
  }
  return null;
}
