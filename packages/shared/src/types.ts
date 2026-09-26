/**
 * Shared domain types for Healthy Scroll.
 * Used by the extension (producer of VideoContext, consumer of Decision)
 * and the web API (runs Jev and returns Decision).
 */

/** What the user typed into the "what should we skip?" box. Plain language. */
export interface UserPolicy {
  /** Free-text description of content the user does NOT want to see. */
  prompt: string;
  /** Master switch. When false, the extension observes nothing and skips nothing. */
  enabled: boolean;
  updatedAt: number;
}

/** Everything the content script can read off the page about the current video, no vision needed. */
export interface VideoContext {
  /** Stable id for the video (TikTok video id from URL or DOM). */
  videoId: string;
  platform: "tiktok";
  url: string;
  author?: string;
  description?: string;
  hashtags?: string[];
  /** Sound / music title if present. */
  audioTitle?: string;
  /** Top N visible comments, if the comment panel is open or rendered. */
  comments?: string[];
  /** Any on-screen text captions TikTok exposes in the DOM (not OCR). */
  onScreenText?: string[];
}

/** Output of Moondream describing a single captured frame. */
export interface FrameDescription {
  videoId: string;
  /** ms since video started playing when the frame was captured. */
  atMs: number;
  /** Short natural-language caption from Moondream `caption`. */
  caption: string;
  /** Optional answer to a policy-specific `query` (e.g. "Is there gambling on screen?"). */
  policyAnswer?: string;
}

/** Request body for POST /api/evaluate. */
export interface EvaluateRequest {
  policy: Pick<UserPolicy, "prompt">;
  context: VideoContext;
  /** Present on the visual pass(es); absent on the fast text-only pass. */
  frames?: FrameDescription[];
}

export type Verdict = "skip" | "allow" | "uncertain";

/** Response body from POST /api/evaluate. */
export interface Decision {
  videoId: string;
  verdict: Verdict;
  /** Jev's probability that the video violates the policy, 0..1. */
  violatesProbability: number;
  /** Which stage produced this decision. */
  stage: "text" | "visual" | "monitor";
  /** Wall-clock ms spent inside Jev for observability. */
  latencyMs: number;
}
