import type {
  VisionAnalyzeRequest,
  VisionAnalyzeResponse,
  VisionMediaResponse,
} from "@healthyscroll/shared";
import { VISION_BASE_URL } from "../lib/config";
import { getAccessToken } from "./auth";

/**
 * apps/vision client. Same auth as /api/evaluate: the user's Supabase token.
 * Contract and client flow: packages/shared/src/vision.ts.
 */

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  if (!token) throw new Error("vision skipped: not signed in");
  return { authorization: `Bearer ${token}` };
}

export async function analyze(req: VisionAnalyzeRequest): Promise<VisionAnalyzeResponse> {
  const res = await fetch(`${VISION_BASE_URL}/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`vision analyze failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as VisionAnalyzeResponse;
}

/**
 * Wait for the Reel's caption (the server starts it when /analyze is uncertain).
 * Resolves to the caption, or null on failure/timeout — never throws.
 */
export async function waitForCaption(
  platform: string,
  videoId: string,
  { timeoutMs = 20_000, intervalMs = 1000 } = {},
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${VISION_BASE_URL}/media/${platform}/${encodeURIComponent(videoId)}`, {
        headers: await authHeaders(),
      });
      if (!res.ok) return null;
      const media = (await res.json()) as VisionMediaResponse;
      if (media.captionStatus === "ready") return media.caption ?? null;
      if (media.captionStatus !== "pending") return null;
    } catch {
      return null;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}
