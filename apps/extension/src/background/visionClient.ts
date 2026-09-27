import type {
  VisionCaptionStage,
  VisionDescribeRequest,
  VisionDescribeResponse,
  VisionMediaResponse,
  VisionTranscribeRequest,
  VisionTranscribeResponse,
  VisionTranscriptResponse,
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

/**
 * The last-resort audio pass: what's said in the Reel (ElevenLabs, server-side).
 * Only for a Reel on screen that text + description left Jev unsure about.
 * Resolves to the transcript, or null when there's nothing usable (no speech,
 * no audio track, budget used up, service not configured, timeout) — never throws.
 */
export async function transcribeAndWait(
  req: VisionTranscribeRequest,
  { timeoutMs = 15_000, intervalMs = 1000 } = {},
): Promise<string | null> {
  const started = performance.now();
  const took = () => `${Math.round(performance.now() - started)}ms`;
  let first: VisionTranscribeResponse;
  try {
    const res = await authedFetch(`${VISION_BASE_URL}/transcribe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      // 429 = daily budget used up, 503 = no ElevenLabs key on the server.
      console.warn(`[vision] ${req.videoId} /transcribe ${res.status}: ${await res.text()}`);
      return null;
    }
    first = (await res.json()) as VisionTranscribeResponse;
  } catch (err) {
    console.warn(`[vision] ${req.videoId} /transcribe failed`, err);
    return null;
  }
  console.log(
    `[vision] ${req.videoId} /transcribe ${first.transcriptStatus} cached=${first.cached} ` +
      `audio=${first.audioSeconds ?? "?"}s server totalMs=${first.totalMs} (${first.model}) round trip ${took()}`,
  );
  if (first.transcriptStatus === "ready") return first.transcript?.trim() || null;
  if (first.transcriptStatus !== "pending") return null;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const res = await authedFetch(`${VISION_BASE_URL}/transcript/${req.platform}/${encodeURIComponent(req.videoId)}`);
      if (!res.ok) return null;
      const t = (await res.json()) as VisionTranscriptResponse;
      if (t.transcriptStatus === "ready") return t.transcript?.trim() || null;
      if (t.transcriptStatus !== "pending") return null;
    } catch {
      return null;
    }
  }
  console.warn(`[vision] ${req.videoId} transcript still pending; giving up at ${took()}`);
  return null;
}
