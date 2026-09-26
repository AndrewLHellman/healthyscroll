import type { Verdict } from "./types";

/**
 * Contract for apps/vision (FastAPI). Mirrors the pydantic models in
 * apps/vision/vision/main.py; change both together.
 *
 * Client flow for one upcoming Reel (sent as soon as it appears, before the
 * viewer swipes to it):
 *   1. POST /api/evaluate (Jev, text only)  and  POST {vision}/analyze { deep: true },
 *      in parallel. Skip as soon as either says "skip".
 *   2. With deep, the server settles an unsure frame score itself with its VLM, so
 *      analyze answers "skip" or "allow" (~1 s cold, cached per Reel).
 *   3. Only if the server has no VLM does analyze stay "uncertain": poll
 *      GET {vision}/media/instagram/:videoId for the caption and send it to
 *      /api/evaluate as frames: [{ caption }]. Any error -> leave the Reel alone.
 */
export interface VisionAnalyzeRequest {
  videoId: string;
  platform: "instagram" | "tiktok";
  /** The user's policy text. */
  policy: string;
  /** DASH MPD XML from Instagram's API response. Send this or `videoUrl`, not both. */
  manifest?: string;
  /** Progressive MP4 URL (smallest `video_versions` entry), when there's no manifest. */
  videoUrl?: string;
  /** The Reel's cover image; used as frame 0. */
  posterUrl?: string;
  /**
   * Also have the server's VLM (Qwen3-VL) answer "does this match the policy?"
   * from the frames and decide outright (skip/allow). Fallback for uncertain
   * Reels when Jev is unavailable. ~0.4 s, cached per Reel + policy.
   */
  deep?: boolean;
}

export type VisionCaptionStatus = "none" | "pending" | "ready" | "failed";

export interface VisionAnalyzeResponse {
  videoId: string;
  verdict: Verdict;
  /** On the scorer's own scale (SigLIP: small numbers); use `verdict`, not this, to decide. */
  violatesProbability: number;
  model: string;
  /** Best-matching policy concept and frame, e.g. "casinos @ 2.5s". */
  matched?: string | null;
  frames: number;
  /** True when the Reel's frames came from the shared cache (another user saw it first). */
  mediaCached: boolean;
  framesMs: number;
  modelMs: number;
  totalMs: number;
  captionStatus: VisionCaptionStatus;
  caption?: string | null;
  /** Only with deep: the VLM's P(yes). */
  deepProbability?: number | null;
}

/** GET /media/:platform/:videoId */
export interface VisionMediaResponse {
  videoId: string;
  frames: number;
  captionStatus: VisionCaptionStatus;
  caption?: string | null;
}
