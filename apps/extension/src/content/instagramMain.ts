import {
  HELLO_SOURCE,
  HOOK_SOURCE,
  sendToBackground,
  type BackgroundToContent,
  type ContentToBackground,
  type ReelInfo,
} from "../lib/messages";
import { getActiveReelCode, probe, skipReel } from "./instagram";

/**
 * Content script entry on instagram.com (isolated world).
 *
 * Eyes and hands only, like the TikTok script:
 *   - forward Reels the main-world hook found (public/instagram-hook.js) -> REELS_DISCOVERED
 *   - report which Reel is on screen                             -> REEL_ACTIVE
 *   - skip when background says so                               <- SKIP_REEL
 * All judgement is in background/reels.ts.
 */

const DEBUG = import.meta.env.VITE_HS_DEBUG === "true";
const log = (...args: unknown[]) => {
  if (DEBUG) console.log("[healthyscroll]", ...args);
};

let activeCode: string | null = null;
let alive = true;

function send(msg: ContentToBackground): void {
  // After the extension reloads, this copy is orphaned: go quiet (reload the tab for a fresh one).
  if (!chrome.runtime?.id) {
    log("not sending: chrome.runtime.id is gone (orphaned?)", msg.type);
    alive = false;
    return;
  }
  try {
    sendToBackground(msg).catch((err) => log("send failed", err));
  } catch (err) {
    log("send threw; going quiet", msg.type, err);
    alive = false;
  }
}

// Reels from the hook. Batched a little: one feed page yields ~10 at once.
let pending: ReelInfo[] = [];
let flushTimer: number | undefined;
const known = new Set<string>();
window.addEventListener("message", (e) => {
  if (e.source !== window || e.data?.source !== HOOK_SOURCE || !Array.isArray(e.data.reels)) return;
  for (const r of e.data.reels as ReelInfo[]) known.add(r.code);
  pending.push(...(e.data.reels as ReelInfo[]));
  clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => {
    const reels = pending;
    pending = [];
    log(`discovered ${reels.length} reels`, reels.map((r) => r.code));
    send({ type: "REELS_DISCOVERED", reels });
  }, 50);
});
// Ask the hook to replay anything it caught before we were listening.
window.postMessage({ source: HELLO_SOURCE }, window.location.origin);

// Active Reel: the URL changes as you scroll; poll cheaply (SPA navigation has no reliable event).
function checkActive(): void {
  if (!alive) return;
  const code = getActiveReelCode();
  if (code && code !== activeCode) {
    activeCode = code;
    log("active", code, known.has(code) ? "" : "(no data yet)");
    send({ type: "REEL_ACTIVE", code });
    // On screen but no feed response described it: have the hook fetch it.
    if (!known.has(code)) {
      window.setTimeout(() => {
        if (!known.has(code) && activeCode === code) {
          log("requesting missing reel", code);
          window.postMessage({ source: HELLO_SOURCE, want: code }, window.location.origin);
        }
      }, 300);
    }
  }
}
window.setInterval(checkActive, 250);
checkActive();

chrome.runtime.onMessage.addListener((msg: BackgroundToContent) => {
  if (msg.type !== "SKIP_REEL") return;
  // Guard: only skip the Reel that's still on screen.
  if (msg.code !== getActiveReelCode()) return;
  log("skipping", msg.code, msg.reason);
  void skipReel(msg.code).then((how) =>
    log(how ? `skipped ${msg.code} via ${how}` : `skip failed: still on ${msg.code}`),
  );
});

if (DEBUG) {
  window.addEventListener("hs:probe", () => console.log("[healthyscroll] probe", probe()));
  window.addEventListener("hs:skip", () => {
    const code = getActiveReelCode();
    if (code) void skipReel(code).then((how) => console.log("[healthyscroll] test skip:", how));
  });
}
