import type { BackgroundToContent, ContentToBackground } from "../lib/messages";
import { sendToBackground } from "../lib/messages";
import { getActiveItem, getVideoId, probe, scrapeContext, skipToNext } from "./tiktok";

/**
 * Content script entry (runs on tiktok.com).
 *
 * Responsibilities — and nothing more:
 *   - notice when the active video changes and send its text context to background
 *   - perform the skip when background says so
 *
 * All judgement (Jev / Moondream) happens in the background worker.
 * The observer only starts with VITE_HS_ENABLE_CONTENT=true — see start().
 */

const DEBUG = import.meta.env.VITE_HS_DEBUG === "true";
const log = (...args: unknown[]) => {
  if (DEBUG) console.log("[healthyscroll]", ...args);
};

let currentVideoId: string | null = null;
let commentsReported = false;

function checkForVideoChange(): void {
  const item = getActiveItem();
  if (!item) return;
  const context = scrapeContext(item);
  if (!context) return;

  if (context.videoId !== currentVideoId) {
    if (currentVideoId) send({ type: "VIDEO_ENDED", videoId: currentVideoId });
    currentVideoId = context.videoId;
    commentsReported = !!context.comments?.length;
    log("video changed", context);
    send({ type: "VIDEO_CHANGED", context });
    return;
  }

  // If the user has the comment panel open, comments usually load after the
  // video was first reported. Send them once, so the text pass can run again
  // with its strongest signal.
  if (!commentsReported && context.comments?.length) {
    commentsReported = true;
    log("comments loaded", context);
    send({ type: "VIDEO_CONTEXT_UPDATED", context });
  }
}

function send(msg: ContentToBackground): void {
  // Rejects if the extension was reloaded under a live tab ("context invalidated").
  sendToBackground(msg).catch((err) => log("send failed", err));
}

async function skip(videoId: string): Promise<void> {
  const how = await skipToNext(videoId);
  log(how ? `skipped ${videoId} via ${how}` : `skip failed: feed did not move off ${videoId}`);
}

chrome.runtime.onMessage.addListener((msg: BackgroundToContent) => {
  switch (msg.type) {
    case "SKIP_VIDEO":
      // Guard against skipping a video the user has already scrolled past.
      if (msg.videoId === currentVideoId) {
        log("skip requested", msg.decision);
        void skip(msg.videoId);
      }
      break;
    case "DECISION":
      // Hook for a subtle on-page indicator later (e.g. small badge: "checking…").
      log("decision", msg.decision);
      break;
  }
});

/**
 * TikTok is an SPA: the URL changes via history.pushState and the feed items
 * are recycled. A MutationObserver plus a scroll listener is the pragmatic way
 * to catch "new video in view".
 *
 * Throttled, not debounced: the player mutates the DOM continuously while a
 * video plays, which would starve a debounce so it never fires. Scroll is
 * captured at the document because the feed scrolls in an inner container,
 * and scroll events don't bubble.
 */
function start(): void {
  let pending = false;
  const schedule = () => {
    if (pending) return;
    pending = true;
    window.setTimeout(() => {
      pending = false;
      checkForVideoChange();
    }, 150);
  };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("scroll", schedule, { passive: true, capture: true });
  schedule();
}

if (import.meta.env.VITE_HS_ENABLE_CONTENT === "true") start();

/**
 * Debug hooks, callable from the tiktok.com DevTools console (DOM events cross
 * the content script's isolated world). They work with the observer off.
 *
 *   dispatchEvent(new Event("hs:probe"))   what the selectors see right now
 *   dispatchEvent(new Event("hs:skip"))    skip the current video, no backend involved
 */
if (DEBUG) {
  window.addEventListener("hs:probe", () => console.log("[healthyscroll] probe", probe()));
  window.addEventListener("hs:skip", () => {
    const item = getActiveItem();
    const videoId = item && getVideoId(item);
    if (videoId) void skip(videoId);
    else log("skip: no active video found");
  });
  log("debug hooks ready: hs:probe, hs:skip");
}
