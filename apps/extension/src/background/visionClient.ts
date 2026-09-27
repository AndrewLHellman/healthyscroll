import type {
  VisionCaptionStage,
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

export interface Description {
  text: string;
  /** Which stage wrote it; for logs only. Jev is never told. */
  stage: VisionCaptionStage | null;
}

/**
 * The Reel's descriptions as the service produces them: usually the cover image
 * alone first (~1 s), then poster + video frames (~2 s). Yields each new one and
 * ends when the service says nothing more is coming, on error, or at timeoutMs.
 * Never throws. Stop consuming (break/return) to stop polling.
 */
export async function* describeStream(
  req: VisionDescribeRequest,
  { timeoutMs = 20_000, intervalMs = 700 } = {},
): AsyncGenerator<Description> {
  const started = performance.now();
  const elapsed = () => `${Math.round(performance.now() - started)}ms`;
  let first: VisionDescribeResponse;
  try {
    first = await describe(req);
  } catch (err) {
    console.warn(`[vision] ${req.videoId} /describe failed after ${elapsed()}`, err);
    return;
  }
  console.log(
    `[vision] ${req.videoId} /describe ${first.captionStatus} stage=${first.stage ?? "-"} cached=${first.mediaCached} ` +
      `server totalMs=${first.totalMs} (${first.model}) round trip ${elapsed()}`,
  );
  let last: VisionDescribeResponse | VisionMediaResponse = first;

  let yieldedStage: VisionCaptionStage | null | undefined;
  const deadline = Date.now() + timeoutMs;
  let polls = 0;
  for (;;) {
    if (last.caption && last.stage !== yieldedStage) {
      yieldedStage = last.stage ?? null;
      yield { text: last.caption, stage: yieldedStage };
    }
    if (last.captionStatus !== "pending") {
      if (polls) console.log(`[vision] ${req.videoId} ${last.captionStatus} after ${polls} poll(s), ${elapsed()}`);
      return;
    }
    if (Date.now() >= deadline) {
      console.warn(`[vision] ${req.videoId} still pending after ${polls} poll(s); giving up at ${elapsed()}`);
      return;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      polls++;
      const res = await authedFetch(`${VISION_BASE_URL}/media/${req.platform}/${encodeURIComponent(req.videoId)}`);
      if (!res.ok) return;
      last = (await res.json()) as VisionMediaResponse;
    } catch {
      return;
    }
  }
}
