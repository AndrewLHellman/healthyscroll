/**
 * Contract for apps/vision (FastAPI). Mirrors the pydantic models in
 * apps/vision/vision/main.py; change both together.
 *
 * The vision service decides nothing: it turns a Reel's video into a short
 * description, once, shared by every user. Jev makes every decision.
 *
 * Client flow for one upcoming Reel (sent as soon as it appears, before the
 * viewer swipes to it):
 *   1. POST /api/evaluate (Jev on the Reel's text)  and  POST {vision}/describe,
 *      in parallel. A text-only "skip" from Jev skips right away.
 *   2. When the description arrives, POST /api/evaluate again with
 *      frames: [{ caption }] — text plus what's on screen — and Jev's answer is final.
 *   3. If describe is still "pending", poll GET {vision}/media/instagram/:videoId.
 *      Any error or timeout -> Jev's text-only answer stands (never skip on error).
 */
export interface VisionDescribeRequest {
  videoId: string;
  platform: "instagram" | "tiktok";
  /** DASH MPD XML from Instagram's API response. Send this or `videoUrl`, not both. */
  manifest?: string;
  /** Progressive MP4 URL (smallest `video_versions` entry), when there's no manifest. */
  videoUrl?: string;
  /** The Reel's cover image; used as frame 0. */
  posterUrl?: string;
}

export type VisionCaptionStatus = "none" | "pending" | "ready" | "failed";

export interface VisionDescribeResponse {
  videoId: string;
  frames: number;
  /** True when the Reel's frames came from the shared cache (another user saw it first). */
  mediaCached: boolean;
  framesMs: number;
  totalMs: number;
  /** "ready" -> `caption` is set. "pending" -> poll GET /media/... . "failed" -> give up. */
  captionStatus: VisionCaptionStatus;
  /** <= 40 words: people, activities, objects, setting, quoted on-screen text. */
  caption?: string | null;
  /** Which VLM wrote it. */
  model: string;
}

/** GET /media/:platform/:videoId */
export interface VisionMediaResponse {
  videoId: string;
  frames: number;
  captionStatus: VisionCaptionStatus;
  caption?: string | null;
}
