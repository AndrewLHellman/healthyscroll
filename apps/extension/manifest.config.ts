import { defineManifest } from "@crxjs/vite-plugin";

/**
 * MV3 manifest, per build target. CRXJS turns this into manifest.json and
 * wires up the popup / background / content script entries.
 *
 *   chrome — desktop Chrome: TikTok, plus Instagram for development.
 *   safari — iOS Safari: Instagram Reels only. Packaged by the Xcode project in apps/ios.
 *
 * On Safari the background and Instagram content script are not declared here,
 * and the Instagram main-world hook for neither target: vite.config.ts adds them
 * to the built manifest (CRXJS's module loaders break them; see that file).
 */
export type Target = "chrome" | "safari";

const HOSTS = [
  // Vision service (apps/vision): local dev, and its prod home once deployed.
  "http://localhost:8000/*",
  "https://vision.healthyscroll.net/*",
  // Our decision API (Jev lives behind it).
  "https://healthyscroll.net/*",
  "http://localhost:3000/*",
  // Supabase auth (session exchange + token refresh).
  "https://ikwvesahfsjpwdnwdfos.supabase.co/*",
];

export default function manifestFor(target: Target) {
  return defineManifest({
    manifest_version: 3,
    name: "Healthy Scroll",
    description:
      "Skips short-form videos that don't align with your goals. Your prompt, your feed.",
    version: "0.1.0",
    ...(target === "chrome" && {
      // Pins the extension ID to bjobokpnmmjcmdiofgkpkajndmjekmej so OAuth redirect
      // URLs (https://<id>.chromiumapp.org/) stay stable. Private key: key.pem (gitignored).
      key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmWq9d2PbJ7Ok/a9wmf+sYj6ln+gswdgEX0yA1icbPq6hPLURR1BH0wtcF2NRP7SmWlZPJDWq8LmonTC6vJqni8stChQjhfAoSjoDNJy7LH2hc4AIiLDtdn2ZWPZgTUtLSjeKYsUiaBUiWDA307s5pupEf2YAI0s1QzXoRkTWXXggga8vTacZdGsyAAT2hGWsIj/MA4u3/bOunD3rSecf4o3N02cibaQxhpJrPv+GzFPNutfNZe2xoZKAShLfWvqppCDdodGDHVrrIOW6HbRnof+0f017VBUnOjqiIt0QqkEtyTc/lKDjyR25P4QxMH4+V/65BKnjmzmYDBxCshmKMQIDAQAB",
    }),
    action: {
      default_popup: "src/popup/index.html",
      default_title: "Healthy Scroll",
    },
    // Safari's background is added by vite.config.ts as a classic script
    // (it can't run CRXJS's module service worker).
    ...(target === "chrome" && {
      background: {
        service_worker: "src/background/index.ts",
        type: "module" as const,
      },
    }),
    ...(target === "chrome" && {
      content_scripts: [
        {
          matches: ["https://www.tiktok.com/*"],
          js: ["src/content/index.ts"],
          run_at: "document_idle" as const,
        },
        // Instagram Reels, part 1 (isolated world): active Reel + skip, talks to background.
        // Part 2, the main-world hook (public/instagram-hook.js), is added by vite.config.ts.
        {
          matches: ["https://www.instagram.com/*"],
          js: ["src/content/instagramMain.ts"],
          run_at: "document_start" as const,
        },
      ],
    }),
    permissions:
      target === "chrome"
        ? [
            // Persist the user's policy.
            "storage",
            // Needed for chrome.tabs.captureVisibleTab (frame capture) and messaging.
            "tabs",
            "activeTab",
            // Google sign-in via Supabase (chrome.identity.launchWebAuthFlow).
            "identity",
          ]
        : ["storage"],
    host_permissions:
      target === "chrome"
        ? [
            // The feeds we observe.
            "https://www.tiktok.com/*",
            "https://www.instagram.com/*",
            // Local Moondream Station (on-device VLM).
            "http://localhost:2020/*",
            ...HOSTS,
          ]
        : ["https://www.instagram.com/*", ...HOSTS],
  });
}
