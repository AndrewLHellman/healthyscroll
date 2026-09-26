/**
 * Instagram Reels DOM adapter. This is the only file that should know about
 * Instagram's markup. Two jobs: which Reel is on screen, and moving past it.
 *
 * Media data (manifest, poster, caption) does NOT come from the DOM; the
 * main-world hook reads it from Instagram's API responses (public/instagram-hook.js).
 *
 * Status: written against instagram.com/reels on desktop Chrome, not yet
 * verified live. With VITE_HS_DEBUG=true, run `dispatchEvent(new Event("hs:probe"))`
 * in the console to see what each strategy finds, and
 * `dispatchEvent(new Event("hs:skip"))` to try a skip without the backend.
 */

/** instagram.com/reels/<code>/ (feed) or /reel/<code>/ (single). The feed updates it as you scroll. */
const REEL_PATH = /^\/reels?\/([A-Za-z0-9_-]+)/;

const SELECTORS = {
  reelLink: ['a[href*="/reel/"]', 'a[href*="/reels/"]'],
  nextButton: [
    'div[role="button"][aria-label*="next" i]',
    'button[aria-label*="next" i]',
    '[aria-label="Navigate to next Reel" i]',
  ],
} as const satisfies Record<string, readonly string[]>;

/** Shortcode of the Reel on screen, or null if we're not on a Reel. */
export function getActiveReelCode(): string | null {
  const fromUrl = window.location.pathname.match(REEL_PATH)?.[1];
  if (fromUrl) return fromUrl;
  // Fallback: the most visible <video>, then the nearest link to a Reel around it.
  const video = mostVisibleVideo();
  return video ? codeNear(video) : null;
}

function codeNear(el: Element): string | null {
  let node: Element | null = el;
  for (let i = 0; node && i < 12; i++, node = node.parentElement) {
    for (const sel of SELECTORS.reelLink) {
      const href = node.querySelector<HTMLAnchorElement>(sel)?.getAttribute("href");
      const code = href?.match(/\/reels?\/([A-Za-z0-9_-]+)/)?.[1];
      if (code) return code;
    }
  }
  return null;
}

function mostVisibleVideo(): HTMLVideoElement | null {
  let best: HTMLVideoElement | null = null;
  let bestArea = 0;
  for (const v of document.querySelectorAll("video")) {
    const r = v.getBoundingClientRect();
    const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
    const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
    if (w * h > bestArea) {
      bestArea = w * h;
      best = v;
    }
  }
  return best;
}

function scrollContainerOf(el: Element | null): HTMLElement | null {
  for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 10) return node;
  }
  return null;
}

type SkipStrategy = { name: string; run: () => boolean };

function strategies(): SkipStrategy[] {
  return [
    {
      // The Reels feed is a vertical scroller; one viewport down = next Reel.
      name: "scroll-container",
      run: () => {
        const box = scrollContainerOf(mostVisibleVideo());
        if (!box) return false;
        box.scrollBy({ top: box.clientHeight, behavior: "smooth" });
        return true;
      },
    },
    {
      name: "next-button",
      run: () => {
        for (const sel of SELECTORS.nextButton) {
          const btn = document.querySelector<HTMLElement>(sel);
          if (btn) {
            btn.click();
            return true;
          }
        }
        return false;
      },
    },
    {
      // Desktop Reels responds to the arrow keys.
      name: "arrow-down",
      run: () => {
        const target = document.activeElement ?? document.body;
        for (const type of ["keydown", "keyup"] as const) {
          target.dispatchEvent(
            new KeyboardEvent(type, { key: "ArrowDown", code: "ArrowDown", keyCode: 40, bubbles: true }),
          );
        }
        return true;
      },
    },
    {
      name: "window-scroll",
      run: () => {
        window.scrollBy({ top: innerHeight, behavior: "smooth" });
        return true;
      },
    },
  ];
}

/**
 * Move past `code`. Tries each strategy until the active Reel changes.
 * Returns the strategy that worked, or null.
 */
export async function skipReel(code: string): Promise<string | null> {
  for (const s of strategies()) {
    if (getActiveReelCode() !== code) return "already-moved";
    if (!s.run()) continue;
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 100));
      if (getActiveReelCode() !== code) return s.name;
    }
  }
  return null;
}

/** Debug report (hs:probe). */
export function probe(): Record<string, unknown> {
  const video = mostVisibleVideo();
  const box = scrollContainerOf(video);
  return {
    path: window.location.pathname,
    activeCode: getActiveReelCode(),
    codeFromUrl: window.location.pathname.match(REEL_PATH)?.[1] ?? null,
    codeNearVideo: video ? codeNear(video) : null,
    videos: document.querySelectorAll("video").length,
    scrollContainer: box ? `${box.tagName}.${box.className.slice(0, 40)} h=${box.clientHeight}` : null,
    nextButtons: SELECTORS.nextButton.map((sel) => [sel, document.querySelectorAll(sel).length]),
  };
}
