import { countsAsSeen, dayKey, feedKey, MAX_VIEW_SECONDS, type ReelView } from "@healthyscroll/shared";
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
 *   - time how long each Reel was on screen, in batches          -> REELS_WATCHED
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

// Watch time. Rides on the 250 ms active-Reel check below: no timers or video
// listeners of its own. Only visible time counts; finished views go to
// background in batches (background/tally.ts turns them into daily totals).
const BATCH_SIZE = 10;

interface OpenView {
  code: string;
  seenAt: number;
  visibleMs: number;
  /** performance.now() when the current visible stretch began; null while paused. */
  since: number | null;
  skipped: boolean;
}
let view: OpenView | null = null;
let finished: ReelView[] = [];

const pageVisible = () => document.visibilityState === "visible";

function startView(code: string): void {
  endView();
  view = { code, seenAt: Date.now(), visibleMs: 0, since: pageVisible() ? performance.now() : null, skipped: false };
}

function pauseView(): void {
  if (view?.since == null) return;
  view.visibleMs += performance.now() - view.since;
  view.since = null;
}

function resumeView(): void {
  if (view && view.since === null && pageVisible()) view.since = performance.now();
}

function endView(): void {
  if (!view) return;
  pauseView();
  const seconds = Math.round(Math.min(view.visibleMs / 1000, MAX_VIEW_SECONDS) * 10) / 10;
  const done: ReelView = { code: view.code, seenAt: view.seenAt, seconds, skipped: view.skipped };
  view = null;
  if (!countsAsSeen(done)) return; // a swipe-through
  finished.push(done);
  if (finished.length >= BATCH_SIZE) flushViews(false);
}

function flushViews(final: boolean): void {
  if (!finished.length) return;
  log(`watched ${finished.length} reels`, finished);
  send({ type: "REELS_WATCHED", views: finished, final });
  finished = [];
}

document.addEventListener("visibilitychange", () => {
  if (pageVisible()) {
    checkActive();
  } else {
    // Switching apps or tabs: stop the clock, and send what we have so the dashboard is current.
    pauseView();
    flushViews(true);
  }
});
window.addEventListener("pagehide", () => {
  endView();
  flushViews(true);
});

// Active Reel: the URL changes as you scroll; poll cheaply (SPA navigation has no reliable event).
function checkActive(): void {
  if (!alive) return;
  const code = getActiveReelCode();
  if (!code) {
    // Off the Reels feed (profile, DMs...): stop the clock; the same Reel may come back.
    pauseView();
    return;
  }
  if (code === activeCode) {
    resumeView();
    return;
  }
  activeCode = code;
  startView(code);
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
window.setInterval(checkActive, 250);
checkActive();

chrome.runtime.onMessage.addListener((msg: BackgroundToContent) => {
  if (msg.type === "REEL_WANTED") {
    // Background lost (or never had) this Reel. If the hook has seen it, it
    // re-sends it -> REELS_DISCOVERED. Unknown codes are already being
    // requested by checkActive's timer; don't fetch twice.
    if (known.has(msg.code)) {
      log("background wants", msg.code);
      window.postMessage({ source: HELLO_SOURCE, want: msg.code }, window.location.origin);
    }
    return;
  }
  if (msg.type !== "SKIP_REEL") return;
  queueSkip(msg.code, msg.reason);
});

/**
 * Skips run one at a time. Several matching Reels in a row means the next
 * SKIP_REEL arrives while the previous skip is still scrolling; it waits for
 * that to land, then checks the Reel is (still) the one on screen.
 */
let skipQueue: Promise<void> = Promise.resolve();
function queueSkip(code: string, reason: string): void {
  skipQueue = skipQueue.then(async () => {
    // Guard: only skip the Reel that's still on screen.
    if (code !== getActiveReelCode()) return log("not skipping", code, "(no longer on screen)");
    log("skipping", code, reason);
    // Mark it before moving: the move itself ends the view.
    if (view?.code === code) view.skipped = true;
    const how = await skipReel(code);
    log(how ? `skipped ${code} via ${how}` : `skip failed: still on ${code}`);
  });
}

if (DEBUG) {
  window.addEventListener("hs:probe", () => console.log("[healthyscroll] probe", probe()));
  // Skip the Reel on screen without Jev; counted in the tally like a real skip.
  window.addEventListener("hs:skip", () => {
    const code = getActiveReelCode();
    if (!code) return;
    if (view?.code === code) view.skipped = true;
    void skipReel(code).then((how) => console.log("[healthyscroll] test skip:", how));
  });
  // Today's watch totals on this device, plus views not yet sent to background.
  window.addEventListener("hs:tally", () => {
    const key = feedKey(dayKey(Date.now()));
    void chrome.storage.local.get(key).then((got) =>
      console.log("[healthyscroll] tally", { today: got[key] ?? {}, unsent: finished, open: view }),
    );
  });
}
