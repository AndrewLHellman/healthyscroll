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
  // Pins the extension ID to bjobokpnmmjcmdiofgkpkajndmjekmej so OAuth redirect
  // URLs (https://<id>.chromiumapp.org/) stay stable. Private key: key.pem (gitignored).
  key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmWq9d2PbJ7Ok/a9wmf+sYj6ln+gswdgEX0yA1icbPq6hPLURR1BH0wtcF2NRP7SmWlZPJDWq8LmonTC6vJqni8stChQjhfAoSjoDNJy7LH2hc4AIiLDtdn2ZWPZgTUtLSjeKYsUiaBUiWDA307s5pupEf2YAI0s1QzXoRkTWXXggga8vTacZdGsyAAT2hGWsIj/MA4u3/bOunD3rSecf4o3N02cibaQxhpJrPv+GzFPNutfNZe2xoZKAShLfWvqppCDdodGDHVrrIOW6HbRnof+0f017VBUnOjqiIt0QqkEtyTc/lKDjyR25P4QxMH4+V/65BKnjmzmYDBxCshmKMQIDAQAB",
  action: {
    default_popup: "src/popup/index.html",
    default_title: "Healthy Scroll",
  },
  // "Your week" — the on-device tally. Opened from the popup via openOptionsPage().
  options_ui: {
    page: "src/insights/index.html",
    open_in_tab: true,
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
    // Google sign-in via Supabase (chrome.identity.launchWebAuthFlow).
    "identity",
  ],
  host_permissions: [
    // The feed we observe.
    "https://www.tiktok.com/*",
    // Local Moondream Station (on-device VLM).
    "http://localhost:2020/*",
    // Our decision API (Jev lives behind it).
    "https://healthyscroll.net/*",
    "http://localhost:3000/*",
    // Supabase auth (session exchange + token refresh).
    "https://ikwvesahfsjpwdnwdfos.supabase.co/*",
  ],
});
