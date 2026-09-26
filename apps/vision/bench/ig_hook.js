// Paste into the DevTools console on instagram.com/reels, then scroll a few Reels.
// Collects each Reel's DASH manifest, smallest MP4, poster and caption from
// Instagram's own API responses (the same data the extension will read).
// When done:  copy(JSON.stringify([...__hs.values()]))  -> paste into bench/data/ig_sample.json
(() => {
  const found = (window.__hs = window.__hs || new Map());

  const smallest = (list) =>
    Array.isArray(list) && list.length
      ? [...list].sort((a, b) => (a.width || 0) * (a.height || 0) - (b.width || 0) * (b.height || 0))[0]?.url
      : undefined;

  const scan = (o, depth = 0) => {
    if (!o || typeof o !== "object" || depth > 40) return;
    if (o.video_dash_manifest || o.video_versions) {
      const id = String(o.pk || o.id || o.code);
      if (!found.has(id)) {
        found.set(id, {
          id,
          code: o.code,
          manifest: o.video_dash_manifest,
          videoUrl: smallest(o.video_versions),
          poster: o.image_versions2?.candidates?.[0]?.url,
          caption: o.caption?.text,
        });
        console.log(`[hs] captured reel ${id} (${found.size} total)`);
      }
    }
    for (const k in o) scan(o[k], depth + 1);
  };

  const parse = (text) => {
    if (typeof text !== "string" || !text.includes("video_")) return;
    for (const chunk of text.split("\n")) {
      try { scan(JSON.parse(chunk)); } catch {}
    }
  };

  if (!window.__hsHooked) {
    window.__hsHooked = true;
    const origFetch = window.fetch;
    window.fetch = async (...args) => {
      const res = await origFetch(...args);
      res.clone().text().then(parse).catch(() => {});
      return res;
    };
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (...args) {
      this.addEventListener("load", () => { try { parse(this.responseText); } catch {} });
      return origOpen.apply(this, args);
    };
  }

  // Reels already on the page came in the initial HTML.
  document.querySelectorAll('script[type="application/json"]').forEach((s) => parse(s.textContent));
  console.log(`[hs] hook ready, ${found.size} reels so far. Scroll a few Reels, then run:\n  copy(JSON.stringify([...__hs.values()]))`);
})();
