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
 * alone first (~1.5 s), then poster + video frames (~2 s). Yields each new one and
 * ends when the service says nothing more is coming, on error, or at timeoutMs.
 * Waiting for the next one is a long poll: GET /media?wait=&seen= is held by the
 * server until a newer stage lands, so it arrives as soon as it exists.
 * Never throws. Stop consuming (break/return) to stop polling.
 */
export async function* describeStream(
  req: VisionDescribeRequest,
  { timeoutMs = 20_000, waitS = 8 } = {},
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
    try {
      polls++;
      const params = new URLSearchParams({ wait: String(waitS) });
      if (yieldedStage) params.set("seen", yieldedStage);
      const sent = Date.now();
      const res = await authedFetch(
        `${VISION_BASE_URL}/media/${req.platform}/${encodeURIComponent(req.videoId)}?${params}`,
      );
      if (!res.ok) return;
      last = (await res.json()) as VisionMediaResponse;
      // A server that doesn't hold the request (older build) would make this a hot loop.
      const nothingNew = last.captionStatus === "pending" && (last.stage ?? null) === (yieldedStage ?? null);
      if (nothingNew && Date.now() - sent < 300) await new Promise((r) => setTimeout(r, 500));
    } catch {
      return;
    }
  }
}
