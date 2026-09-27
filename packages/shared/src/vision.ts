/**
 * Contract for apps/vision (FastAPI). Mirrors the pydantic models in
 * apps/vision/vision/main.py; change both together.
 *
 * The vision service decides nothing: it turns a Reel's video into a short
 * description, once, shared by every user. Jev makes every decision.
 *
 * The service describes a Reel in two stages: the cover image alone (fast), then
 * poster + video frames. Each is just a description to the client, and to Jev.
 *
 * Client flow for one upcoming Reel (sent as soon as it appears, before the
 * viewer swipes to it):
 *   1. POST /api/evaluate (Jev on the Reel's text)  and  POST {vision}/describe,
 *      in parallel. A text-only "skip" from Jev skips right away.
 *   2. Each time a (better) description arrives, POST /api/evaluate again with
 *      frames: [{ caption }] — text plus what's on screen. "skip" skips and the
 *      client stops looking; otherwise it waits for the next description.
 *   3. While captionStatus is "pending" more may come: long-poll
 *      GET {vision}/media/instagram/:videoId?wait=<s>&seen=<stage> — the server
 *      holds it until a newer stage has a caption. "ready"/"failed" -> nothing more.
 *      Any error or timeout -> the last answer stands (never skip on error).
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
/** What the current `caption` was written from: the cover image alone, or poster + video frames. */
export type VisionCaptionStage = "poster" | "frames";

export interface VisionDescribeResponse {
  videoId: string;
  /** Images the current `caption` was written from. */
  frames: number;
  /** True when the Reel came from the shared cache (another user saw it first). */
  mediaCached: boolean;
  framesMs: number;
  totalMs: number;
  /**
   * "pending" -> a better `caption` may follow (one can already be set): poll GET /media/... .
   * "ready" -> `caption` is set and nothing more is coming. "failed" -> give up.
   */
  captionStatus: VisionCaptionStatus;
  /** <= 60 words: people, activities, objects, setting, quoted on-screen text. */
  caption?: string | null;
  stage?: VisionCaptionStage | null;
  /** Which VLM wrote it. */
  model: string;
}

/** GET /media/:platform/:videoId */
export interface VisionMediaResponse {
  videoId: string;
  frames: number;
  captionStatus: VisionCaptionStatus;
  caption?: string | null;
  stage?: VisionCaptionStage | null;
}

/**
 * POST {vision}/transcribe — the last resort, after text + description left Jev
 * unsure (0.2 < p < 0.8), and only for the Reel on screen. The server pulls the
 * first ~30 s of the Reel's own audio track and has ElevenLabs Scribe write down
 * what's said; the extension sends that to /api/evaluate as `transcript`, and
 * Jev's answer is final. Cached per Reel for every user, like descriptions.
 * Costs real money per call, so the server also caps calls per user and per day.
 */
export interface VisionTranscribeRequest {
  videoId: string;
  platform: "instagram" | "tiktok";
  /** DASH MPD XML (its audio track is used). Send this or `videoUrl`, not both. */
  manifest?: string;
  /** Progressive MP4 URL, when there's no manifest. */
  videoUrl?: string;
}

/**
 * "ready" -> `transcript` is set (may be "" for a Reel with no speech).
 * "pending" -> poll GET /transcript/... . "failed" -> give up.
 */
export type VisionTranscriptStatus = "none" | "pending" | "ready" | "failed";

export interface VisionTranscribeResponse {
  videoId: string;
  transcriptStatus: VisionTranscriptStatus;
  transcript?: string | null;
  /** Seconds of audio sent to ElevenLabs (what's billed). */
  audioSeconds?: number | null;
  /** True when another user's request already transcribed this Reel. */
  cached: boolean;
  totalMs: number;
  model: string;
}

/** GET /transcript/:platform/:videoId */
export interface VisionTranscriptResponse {
  videoId: string;
  transcriptStatus: VisionTranscriptStatus;
  transcript?: string | null;
}
