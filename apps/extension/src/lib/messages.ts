import type { Decision, VideoContext } from "@healthyscroll/shared";

/**
 * Typed message contract between the content script (page side) and the
 * background service worker (orchestrator side). Keep every cross-context
 * message here so both sides share one source of truth.
 */

/** content → background */
export type ContentToBackground =
  | { type: "VIDEO_CHANGED"; context: VideoContext }
  | { type: "VIDEO_ENDED"; videoId: string };

/** background → content */
export type BackgroundToContent =
  | { type: "SKIP_VIDEO"; videoId: string; decision: Decision }
  | { type: "DECISION"; decision: Decision };

export function sendToBackground(msg: ContentToBackground): Promise<void> {
  return chrome.runtime.sendMessage(msg);
}

export function sendToTab(tabId: number, msg: BackgroundToContent): Promise<void> {
  return chrome.tabs.sendMessage(tabId, msg);
}
