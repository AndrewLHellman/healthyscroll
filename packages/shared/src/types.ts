import type { Category } from "./categories";

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
  /** Stable id for the video (TikTok video id / Instagram media pk). */
  videoId: string;
  platform: "tiktok" | "instagram";
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
  /**
   * What's said in the Reel, from its own audio (ElevenLabs, via the vision
   * service). Only on the last-resort audio pass, when text + frames left Jev unsure.
   */
  transcript?: string;
}

export type Verdict = "skip" | "allow" | "uncertain";

/** Response body from POST /api/evaluate. */
export interface Decision {
  videoId: string;
  verdict: Verdict;
  /** Jev's probability that the video violates the policy, 0..1. */
  violatesProbability: number;
  /**
   * What the video is about, from the same Jev call. Independent of the policy.
   * Absent only if the model didn't answer the question.
   */
  category?: { label: Category; probability: number };
  /** Which stage produced this decision. "audio" = text + frames + the Reel's transcript. */
  stage: "text" | "visual" | "monitor" | "audio";
  /** Wall-clock ms spent inside Jev for observability. */
  latencyMs: number;
}

/**
 * One row in the on-device tally: a video the user was shown, how long they
 * stayed, and what it was. Lives in chrome.storage.local, never sent anywhere.
 * No description or captions are kept — just enough to draw the charts.
 */
export interface WatchRecord {
  videoId: string;
  author?: string;
  /** Epoch ms when the video came into view. */
  startedAt: number;
  /** Time the video was actually on screen (tab visible), ms. */
  dwellMs: number;
  category?: Category;
  categoryP?: number;
  /** Last verdict the pipeline reached for it, if Jev was asked. */
  verdict?: Verdict;
  /** True if Healthy Scroll skipped it (as opposed to the user scrolling on). */
  skipped: boolean;
}
