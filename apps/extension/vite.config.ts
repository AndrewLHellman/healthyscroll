import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

/**
 * Adds the Instagram main-world hook (public/instagram-hook.js, copied to dist/
 * as-is) to the built manifest. It can't go through manifest.config.ts: CRXJS
 * would bundle it behind a dynamic-import loader, which in the MAIN world runs
 * under Instagram's CSP and too late to see the first feed requests.
 * Build-only: `vite` dev mode doesn't get the hook.
 */
function instagramMainWorldHook(): Plugin {
  return {
    name: "healthyscroll-instagram-hook",
    apply: "build",
    closeBundle() {
      const path = resolve(__dirname, "dist/manifest.json");
      const built = JSON.parse(readFileSync(path, "utf8"));
      built.content_scripts ??= [];
      built.content_scripts.push({
        matches: ["https://www.instagram.com/*"],
        js: ["instagram-hook.js"],
        run_at: "document_start",
        world: "MAIN",
      });
      writeFileSync(path, JSON.stringify(built, null, 2));
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest }), instagramMainWorldHook()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    // CRXJS HMR needs a stable port.
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
});
