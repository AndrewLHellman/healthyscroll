import type { Decision, VideoContext } from "@healthyscroll/shared";

/**
 * Typed message contract between the content script (page side) and the
 * background service worker (orchestrator side). Keep every cross-context
 * message here so both sides share one source of truth.
 */

/**
 * One Instagram Reel as read from Instagram's own API responses by the
 * main-world hook (public/instagram-hook.js). Everything the pipeline needs
 * to judge it before it's on screen.
 */
export interface ReelInfo {
  /** Media pk. Used as videoId for the vision service and Jev. */
  id: string;
  /** Shortcode, as in instagram.com/reels/<code>/. How the page tells us which Reel is active. */
  code: string;
  /** DASH MPD XML (preferred: the server fetches only the bytes it needs). */
  manifest?: string;
  /** Smallest progressive MP4, when there's no manifest. */
  videoUrl?: string;
  posterUrl?: string;
  caption?: string;
  author?: string;
  audioTitle?: string;
}

/** window.postMessage tag: main-world hook (public/instagram-hook.js) -> content script ({ source, reels: ReelInfo[] }). */
export const HOOK_SOURCE = "healthyscroll-hook";
/** Content script -> hook on start; the hook replays every Reel seen so far (no race on load). */
export const HELLO_SOURCE = "healthyscroll-content";

/** content → background */
export type ContentToBackground =
  | { type: "VIDEO_CHANGED"; context: VideoContext }
  /** Same video, richer context (comments finished loading). Background re-runs the pipeline. */
  | { type: "VIDEO_CONTEXT_UPDATED"; context: VideoContext }
  | { type: "VIDEO_ENDED"; videoId: string }
  /** Instagram: Reels loaded into the page (usually ahead of the viewer). Judged immediately. */
  | { type: "REELS_DISCOVERED"; reels: ReelInfo[] }
  /** Instagram: this Reel (by shortcode) is now on screen. */
  | { type: "REEL_ACTIVE"; code: string };

/** background → content */
export type BackgroundToContent =
  | { type: "SKIP_VIDEO"; videoId: string; decision: Decision }
  | { type: "DECISION"; decision: Decision }
  /** Instagram: move past this Reel (by shortcode), if it's still the one on screen. */
  | { type: "SKIP_REEL"; code: string; reason: string };

/** popup → background. Background replies with AuthResponse. */
export type PopupToBackground =
  | { type: "AUTH_GET" }
  | { type: "AUTH_SIGN_IN" }
  | { type: "AUTH_SIGN_OUT" }
  /** From content/connect.ts on healthyscroll.net/connect: Safari's sign-in (it has no chrome.identity). */
  | { type: "AUTH_HANDOFF"; accessToken: string; refreshToken: string };

export type AuthState = { email: string | null };
export type AuthResponse = { ok: true; auth: AuthState } | { ok: false; error: string };

export function sendToBackground(msg: ContentToBackground): Promise<void> {
  return chrome.runtime.sendMessage(msg);
}

export function sendAuthMessage(msg: PopupToBackground): Promise<AuthResponse> {
  return chrome.runtime.sendMessage(msg);
}

export function sendToTab(tabId: number, msg: BackgroundToContent): Promise<void> {
  return chrome.tabs.sendMessage(tabId, msg);
}
