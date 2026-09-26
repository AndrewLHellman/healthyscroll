import { defineManifest } from "@crxjs/vite-plugin";

/**
 * MV3 manifest. CRXJS turns this into dist/manifest.json and wires up the
 * popup / background / content script entries.
 */
export default defineManifest({
  manifest_version: 3,
  name: "Healthy Scroll",
  description:
    "Skips short-form videos that don't align with your goals. Your prompt, your feed.",
  version: "0.1.0",
  action: {
    default_popup: "src/popup/index.html",
    default_title: "Healthy Scroll",
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["https://www.tiktok.com/*"],
      js: ["src/content/index.ts"],
      run_at: "document_idle",
    },
  ],
  permissions: [
    // Persist the user's policy.
    "storage",
    // Needed for chrome.tabs.captureVisibleTab (frame capture) and messaging.
    "tabs",
    "activeTab",
  ],
  host_permissions: [
    // The feed we observe.
    "https://www.tiktok.com/*",
    // Local Moondream Station (on-device VLM).
    "http://localhost:2020/*",
    // Our decision API (Jev lives behind it).
    "https://healthyscroll.net/*",
    "http://localhost:3000/*",
  ],
});
