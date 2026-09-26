import type {
  AuthResponse,
  AuthState,
  ContentToBackground,
  PopupToBackground,
} from "../lib/messages";
import { getPolicy } from "./policyStore";
import { cancel, onVideoChanged } from "./orchestrator";
import { forgetTab, onReelActive, onReelsDiscovered } from "./reels";
import { getAuthState, signIn, signOut } from "./auth";
import { maybePullPolicy, pullPolicy, startPolicySync } from "./sync";

/**
 * Background service worker entry. Routes messages from content scripts into
 * the orchestrator, and popup auth requests into auth.ts. Keep this file thin;
 * logic lives in orchestrator.ts / auth.ts / sync.ts.
 */

const DEBUG = import.meta.env.VITE_HS_DEBUG === "true";
if (DEBUG) console.log("[background] started", new Date().toISOString());

startPolicySync();

/** Best-effort: the popup should still open if Supabase is unreachable. */
const pullQuietly = () => pullPolicy().catch((err: unknown) => console.error("[sync]", err));

function handleAuth(msg: PopupToBackground): Promise<AuthState> {
  switch (msg.type) {
    // Pull before replying so the popup shows the latest saved prompt.
    case "AUTH_GET":
      return pullQuietly().then(getAuthState);
    case "AUTH_SIGN_IN":
      return signIn().then(async (auth) => {
        await pullQuietly();
        return auth;
      });
    case "AUTH_SIGN_OUT":
      return signOut().then(getAuthState);
  }
}

function isAuthMessage(msg: ContentToBackground | PopupToBackground): msg is PopupToBackground {
  return msg.type.startsWith("AUTH_");
}

chrome.runtime.onMessage.addListener((msg: ContentToBackground | PopupToBackground, sender, sendResponse) => {
  if (isAuthMessage(msg)) {
    handleAuth(msg).then(
      (auth) => sendResponse({ ok: true, auth } satisfies AuthResponse),
      (err: unknown) => {
        console.error("[auth]", err);
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) } satisfies AuthResponse);
      },
    );
    return true; // keep the channel open for the async reply
  }

  if (DEBUG) console.log("[background] message", msg.type, "from tab", sender.tab?.id);

  // Safari may leave out sender.tab fields; only TikTok's frame capture needs windowId.
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (tabId === undefined) {
    console.warn("[background] dropped message with no sender tab", msg.type, sender);
    return;
  }

  switch (msg.type) {
    case "VIDEO_CHANGED":
    case "VIDEO_CONTEXT_UPDATED":
      if (windowId === undefined) return;
      // An update restarts the pipeline for the same video, now with comments.
      // Website edits land on the next video (pull is throttled and async).
      maybePullPolicy();
      void getPolicy().then((policy) => onVideoChanged(tabId, windowId, msg.context, policy));
      break;
    case "VIDEO_ENDED":
      cancel(tabId);
      break;
    // Instagram Reels: judged on discovery (prefetch), acted on when active.
    case "REELS_DISCOVERED":
      maybePullPolicy();
      void getPolicy().then((policy) => onReelsDiscovered(tabId, msg.reels, policy));
      break;
    case "REEL_ACTIVE":
      void getPolicy().then((policy) => onReelActive(tabId, msg.code, policy));
      break;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  cancel(tabId);
  forgetTab(tabId);
});
