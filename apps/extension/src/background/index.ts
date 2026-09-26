import type { ContentToBackground } from "../lib/messages";
import { getPolicy } from "./policyStore";
import { cancel, onVideoChanged } from "./orchestrator";

/**
 * Background service worker entry. Routes messages from content scripts into
 * the orchestrator. Keep this file thin; logic lives in orchestrator.ts.
 */

chrome.runtime.onMessage.addListener((msg: ContentToBackground, sender) => {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (tabId === undefined || windowId === undefined) return;

  switch (msg.type) {
    case "VIDEO_CHANGED":
      void getPolicy().then((policy) => onVideoChanged(tabId, windowId, msg.context, policy));
      break;
    case "VIDEO_ENDED":
      cancel(tabId);
      break;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => cancel(tabId));
