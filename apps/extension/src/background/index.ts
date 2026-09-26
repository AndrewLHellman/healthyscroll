import type {
  AuthResponse,
  AuthState,
  ContentToBackground,
  PopupToBackground,
} from "../lib/messages";
import { getPolicy } from "./policyStore";
import { cancel, onVideoChanged } from "./orchestrator";
import { getAuthState, signIn, signOut } from "./auth";

/**
 * Background service worker entry. Routes messages from content scripts into
 * the orchestrator, and popup auth requests into auth.ts. Keep this file thin;
 * logic lives in orchestrator.ts / auth.ts.
 */

function handleAuth(msg: PopupToBackground): Promise<AuthState> {
  switch (msg.type) {
    case "AUTH_GET":
      return getAuthState();
    case "AUTH_SIGN_IN":
      return signIn();
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

  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (tabId === undefined || windowId === undefined) return;

  switch (msg.type) {
    case "VIDEO_CHANGED":
    case "VIDEO_CONTEXT_UPDATED":
      // An update restarts the pipeline for the same video, now with comments.
      void getPolicy().then((policy) => onVideoChanged(tabId, windowId, msg.context, policy));
      break;
    case "VIDEO_ENDED":
      cancel(tabId);
      break;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => cancel(tabId));
