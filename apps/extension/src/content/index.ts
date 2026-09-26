import type { BackgroundToContent } from "../lib/messages";
import { sendToBackground } from "../lib/messages";
import { getActiveItem, scrapeContext, skipToNext } from "./tiktok";

/**
 * Content script entry (runs on tiktok.com).
 *
 * Responsibilities — and nothing more:
 *   - notice when the active video changes and send its text context to background
 *   - perform the skip when background says so
 *
 * All judgement (Jev / Moondream) happens in the background worker.
 * Status: SCAFFOLD. Observers are defined but not started — see start().
 */

let currentVideoId: string | null = null;

function checkForVideoChange(): void {
  const item = getActiveItem();
  if (!item) return;
  const context = scrapeContext(item);
  if (context.videoId === currentVideoId) return;

  if (currentVideoId) void sendToBackground({ type: "VIDEO_ENDED", videoId: currentVideoId });
  currentVideoId = context.videoId;
  void sendToBackground({ type: "VIDEO_CHANGED", context });
}

chrome.runtime.onMessage.addListener((msg: BackgroundToContent) => {
  switch (msg.type) {
    case "SKIP_VIDEO":
      // Guard against skipping a video the user has already scrolled past.
      if (msg.videoId === currentVideoId) skipToNext();
      break;
    case "DECISION":
      // Hook for a subtle on-page indicator later (e.g. small badge: "checking…").
      break;
  }
});

/**
 * TikTok is an SPA: the URL changes via history.pushState and the feed items
 * are recycled. A MutationObserver plus a scroll listener is the pragmatic way
 * to catch "new video in view". Debounced so a flurry of DOM churn = one check.
 */
function start(): void {
  let t: number | undefined;
  const schedule = () => {
    window.clearTimeout(t);
    t = window.setTimeout(checkForVideoChange, 150);
  };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("scroll", schedule, { passive: true });
  schedule();
}

// Intentionally not started yet. Flip this on when we're ready to test against the live site.
if (import.meta.env.VITE_HS_ENABLE_CONTENT === "true") start();
