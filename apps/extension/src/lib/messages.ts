import type { Decision, VideoContext } from "@healthyscroll/shared";

/**
 * Typed message contract between the content script (page side) and the
 * background service worker (orchestrator side). Keep every cross-context
 * message here so both sides share one source of truth.
 */

/** content → background */
export type ContentToBackground =
  | { type: "VIDEO_CHANGED"; context: VideoContext }
  /** Same video, richer context (comments finished loading). Background re-runs the pipeline. */
  | { type: "VIDEO_CONTEXT_UPDATED"; context: VideoContext }
  | { type: "VIDEO_ENDED"; videoId: string }
  /** Tab shown/hidden. Only used to pause the dwell clock in the tally. */
  | { type: "VISIBILITY_CHANGED"; visible: boolean };

/** background → content */
export type BackgroundToContent =
  | { type: "SKIP_VIDEO"; videoId: string; decision: Decision }
  | { type: "DECISION"; decision: Decision };

/** popup → background. Background replies with AuthResponse. */
export type PopupToBackground =
  | { type: "AUTH_GET" }
  | { type: "AUTH_SIGN_IN" }
  | { type: "AUTH_SIGN_OUT" };

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
