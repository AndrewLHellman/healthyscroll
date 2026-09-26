import { copyFileSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { build, defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { crx } from "@crxjs/vite-plugin";
import manifestFor, { type Target } from "./manifest.config";

// HS_TARGET=safari builds the iOS Safari extension into dist-safari/ (the Xcode
// project in apps/ios references that folder). Default is Chrome into dist/.
const target: Target = process.env.HS_TARGET === "safari" ? "safari" : "chrome";
const outDir = resolve(__dirname, target === "chrome" ? "dist" : "dist-safari");
const define = { "import.meta.env.VITE_HS_TARGET": JSON.stringify(target) };
const INSTAGRAM = ["https://www.instagram.com/*"];

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    crx({ manifest: manifestFor(target) }),
    postBuildScripts(mode),
  ],
  define,
  build: {
    outDir,
    emptyOutDir: true,
  },
  server: {
    // CRXJS HMR needs a stable port.
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
}));

/**
 * Scripts added to the built manifest after CRXJS writes it. One plugin so the
 * steps run in order (closeBundle hooks run in parallel and would race on
 * manifest.json). Build-only: `vite` dev mode gets none of this.
 *
 * Safari only — Safari can't run CRXJS's ES-module loaders, so these are built
 * separately as single classic IIFEs:
 *   - background (src/background/index.ts) -> assets/background.js. CRXJS's
 *     service worker is `type: module` with an `import` loader, which Safari
 *     doesn't support: the worker never starts. Registered as a non-persistent
 *     background script (required on iOS).
 *   - Instagram isolated-world script (src/content/instagramMain.ts) ->
 *     assets/instagram.js. CRXJS's loader does a dynamic import() of a
 *     web-accessible chunk, which fails ("Importing a module script failed").
 *
 * Both targets — the Instagram main-world hook (public/instagram-hook.js, as-is).
 * It can't go through manifest.config.ts: CRXJS would bundle it behind the same
 * loader, which in the MAIN world runs under Instagram's CSP and too late to see
 * the first feed requests.
 *
 * Safari files go in assets/, the folder the Xcode project references.
 */
function postBuildScripts(mode: string): Plugin {
  const src = resolve(__dirname, "src");

  const buildClassic = (entry: string, fileName: string) =>
    build({
      configFile: false,
      root: __dirname,
      mode,
      define,
      logLevel: "warn",
      build: {
        outDir,
        emptyOutDir: false,
        watch: null,
        lib: { entry: resolve(src, entry), formats: ["iife"], name: "healthyscroll", fileName: () => fileName },
      },
    });

  return {
    name: "healthyscroll-post-build-scripts",
    apply: "build",
    buildStart() {
      if (target !== "safari") return;
      // These entries aren't in CRXJS's graph; watch them so dev:safari rebuilds.
      for (const dir of ["background", "content", "lib"]) {
        for (const f of readdirSync(resolve(src, dir))) this.addWatchFile(resolve(src, dir, f));
      }
    },
    async closeBundle() {
      const path = resolve(outDir, "manifest.json");
      const scripts: object[] = [];
      let background: object | undefined;

      if (target === "safari") {
        await buildClassic("background/index.ts", "assets/background.js");
        background = { scripts: ["assets/background.js"], persistent: false };
        await buildClassic("content/instagramMain.ts", "assets/instagram.js");
        scripts.push({ matches: INSTAGRAM, js: ["assets/instagram.js"], run_at: "document_start" });
      }

      let hook = "instagram-hook.js";
      if (target === "safari") {
        hook = "assets/instagram-hook.js";
        copyFileSync(resolve(__dirname, "public/instagram-hook.js"), resolve(outDir, hook));
      }
      scripts.push({ matches: INSTAGRAM, js: [hook], run_at: "document_start", world: "MAIN" });

      const built = JSON.parse(readFileSync(path, "utf8"));
      if (background) built.background = background;
      built.content_scripts = [...(built.content_scripts ?? []), ...scripts];
      writeFileSync(path, JSON.stringify(built, null, 2));
    },
  };
}
