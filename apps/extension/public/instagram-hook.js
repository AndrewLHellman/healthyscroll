// @ts-check
/**
 * Runs in Instagram's own page context ("MAIN" world, document_start) so it can
 * see the page's network responses. Content scripts in the isolated world can't.
 *
 * Deliberately a plain, self-contained classic script in public/ (copied as-is,
 * not bundled): CRXJS wraps bundled content scripts in a loader that does a
 * dynamic import(), which in the MAIN world runs under Instagram's CSP and
 * resolves late — the hook would miss the first feed requests or not load at all.
 *
 * Instagram's feed API responses (GraphQL / REST, fetch or XHR, sometimes
 * newline-delimited JSON) and the JSON embedded in the initial HTML contain,
 * per Reel: pk, shortcode, the DASH manifest, video_versions, poster, caption.
 * We collect those and hand them to the isolated content script with
 * window.postMessage. Reels arrive here before they're on screen, which is what
 * makes prefetching possible.
 *
 * Protocol (keep in sync with src/lib/messages.ts HOOK_SOURCE / HELLO_SOURCE / ReelInfo):
 *   hook -> content   { source: "healthyscroll-hook", reels: ReelInfo[] }
 *   content -> hook   { source: "healthyscroll-content" }  => hook replays all Reels seen
 *   content -> hook   { source: "healthyscroll-content", want: "<shortcode>" }
 *                     => hook re-sends that Reel, or fetches it from Instagram if never seen
 *
 * No chrome.* APIs exist in this world. DOM and judgement live elsewhere
 * (src/content/instagram.ts, src/background/reels.ts).
 * Proven against the live site with apps/vision/bench/ig_hook.js (2026-09-26).
 */
(() => {
  const HOOK_SOURCE = "healthyscroll-hook";
  const HELLO_SOURCE = "healthyscroll-content";

  if (window.__hsHooked) return;
  window.__hsHooked = true;

  /** @type {Set<string>} */
  const sent = new Set();
  /** @type {object[]} */
  const all = [];

  const smallest = (list) => {
    if (!Array.isArray(list) || list.length === 0) return undefined;
    const sorted = [...list].sort(
      (a, b) => (a?.width ?? 0) * (a?.height ?? 0) - (b?.width ?? 0) * (b?.height ?? 0),
    );
    return typeof sorted[0]?.url === "string" ? sorted[0].url : undefined;
  };

  // Instagram's JSON is loosely shaped; read it defensively.
  const toReel = (o) => {
    const id = o.pk ?? o.id;
    const code = o.code ?? o.shortcode;
    if (!id || typeof code !== "string") return null;
    if (!o.video_dash_manifest && !o.video_versions) return null;
    const music = o.clips_metadata?.music_info?.music_asset_info;
    const original = o.clips_metadata?.original_sound_info;
    return {
      id: String(id).split("_")[0],
      code,
      manifest: typeof o.video_dash_manifest === "string" ? o.video_dash_manifest : undefined,
      videoUrl: smallest(o.video_versions),
      posterUrl: o.image_versions2?.candidates?.[0]?.url,
      caption: o.caption?.text ?? undefined,
      author: o.user?.username ?? o.owner?.username,
      audioTitle: music?.title ?? original?.original_audio_title,
    };
  };

  const scan = (o, found, depth = 0) => {
    if (!o || typeof o !== "object" || depth > 40) return;
    if ("video_dash_manifest" in o || "video_versions" in o) {
      const reel = toReel(o);
      if (reel && !sent.has(reel.code)) {
        sent.add(reel.code);
        found.push(reel);
        all.push(reel);
      }
    }
    for (const key in o) scan(o[key], found, depth + 1);
  };

  const parse = (text) => {
    if (typeof text !== "string" || !text.includes("video_")) return;
    const found = [];
    // Some Instagram endpoints prefix JSON with an anti-hijacking guard.
    for (const chunk of text.replace(/^for \(;;\);/, "").split("\n")) {
      try {
        scan(JSON.parse(chunk), found);
      } catch {
        // not JSON (or a partial line); ignore
      }
    }
    if (found.length) window.postMessage({ source: HOOK_SOURCE, reels: found }, window.location.origin);
  };

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    res.clone().text().then(parse, () => {});
    return res;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (...args) {
    this.addEventListener("load", () => {
      if (this.responseType === "" || this.responseType === "text") parse(this.responseText);
    });
    return origOpen.apply(this, args);
  };

  // Shortcode -> media pk (Instagram shortcodes are the pk in URL-safe base64).
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const shortcodeToPk = (code) => {
    let pk = 0n;
    for (const ch of code.slice(0, 11)) {
      const i = ALPHABET.indexOf(ch);
      if (i < 0) return null;
      pk = pk * 64n + BigInt(i);
    }
    return pk.toString();
  };

  // Instagram's public web app id, sent by the page itself on every API call.
  const IG_APP_ID = "936619743392459";
  /** @type {Set<string>} */
  const requested = new Set();

  /**
   * A Reel came on screen that no feed response told us about (seen on the live
   * site: the first Reels after a load, and some later ones). Ask Instagram for
   * it the way the page does when you open a Reel; the fetch goes through our
   * hook above, so parse() picks it up.
   */
  const fetchMissing = (code) => {
    if (sent.has(code) || requested.has(code)) return;
    requested.add(code);
    const pk = shortcodeToPk(code);
    if (!pk) return;
    window
      .fetch(`/api/v1/media/${pk}/info/`, { headers: { "X-IG-App-ID": IG_APP_ID }, credentials: "include" })
      .catch(() => {});
  };

  window.addEventListener("message", (e) => {
    if (e.source !== window || e.data?.source !== HELLO_SOURCE) return;
    if (typeof e.data.want === "string") {
      // Already have it: send it again (the content script may have missed it).
      const known = all.find((r) => r.code === e.data.want);
      if (known) window.postMessage({ source: HOOK_SOURCE, reels: [known] }, window.location.origin);
      else fetchMissing(e.data.want);
      return;
    }
    if (all.length) window.postMessage({ source: HOOK_SOURCE, reels: all }, window.location.origin);
  });

  // Reels shipped inside the initial HTML.
  const scanEmbedded = () =>
    document.querySelectorAll('script[type="application/json"]').forEach((s) => parse(s.textContent));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scanEmbedded);
  else scanEmbedded();
})();
