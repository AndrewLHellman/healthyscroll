import type { VideoContext } from "@healthyscroll/shared";

/**
 * TikTok DOM adapter. This is the only file that should know about TikTok's
 * markup. Selectors WILL rot — keep them here, keep them data-e2e based where
 * possible (TikTok ships `data-e2e` test hooks that are more stable than classes).
 *
 * Status: STUB. Selectors below are best guesses to be verified against the
 * live page in DevTools before wiring up. Nothing here is exercised yet.
 */

const SELECTORS = {
  /** Container for the currently-active video in the For You feed. */
  activeItem: '[data-e2e="recommend-list-item-container"]',
  video: "video",
  author: '[data-e2e="video-author-uniqueid"]',
  description: '[data-e2e="video-desc"]',
  hashtag: 'a[href*="/tag/"]',
  audio: '[data-e2e="video-music"]',
  comment: '[data-e2e="comment-level-1"] p',
  /** Button that advances to the next video in the feed. */
  nextButton: '[data-e2e="arrow-right"], button[aria-label*="next" i]',
} as const;

/** Find the feed item currently in view (largest intersection with the viewport). */
export function getActiveItem(): HTMLElement | null {
  const items = Array.from(document.querySelectorAll<HTMLElement>(SELECTORS.activeItem));
  if (items.length === 0) return null;
  const vh = window.innerHeight;
  let best: HTMLElement | null = null;
  let bestVisible = 0;
  for (const el of items) {
    const r = el.getBoundingClientRect();
    const visible = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    if (visible > bestVisible) {
      bestVisible = visible;
      best = el;
    }
  }
  return best;
}

/** Read everything text-based about the active video. Cheap; safe to call often. */
export function scrapeContext(item: HTMLElement): VideoContext {
  const text = (sel: string) => item.querySelector(sel)?.textContent?.trim() || undefined;
  const all = (sel: string) =>
    Array.from(item.querySelectorAll(sel))
      .map((el) => el.textContent?.trim())
      .filter((t): t is string => !!t);

  return {
    videoId: getVideoId(item),
    platform: "tiktok",
    url: location.href,
    author: text(SELECTORS.author),
    description: text(SELECTORS.description),
    hashtags: all(SELECTORS.hashtag).map((h) => h.replace(/^#/, "")),
    audioTitle: text(SELECTORS.audio),
    comments: all(SELECTORS.comment).slice(0, 20),
  };
}

/** TikTok video ids are 19-digit numbers; prefer the URL, fall back to any id attr on the item. */
export function getVideoId(item: HTMLElement): string {
  const fromUrl = location.pathname.match(/\/video\/(\d+)/)?.[1];
  if (fromUrl) return fromUrl;
  const fromAttr = item.id?.match(/\d{15,}/)?.[0];
  return fromAttr ?? `${location.pathname}#${Date.now()}`;
}

/**
 * Advance to the next video. Tries TikTok's own button first; falls back to the
 * keyboard shortcut TikTok binds (ArrowDown). NOT wired up yet — see docs/ROADMAP.md.
 */
export function skipToNext(): void {
  const btn = document.querySelector<HTMLElement>(SELECTORS.nextButton);
  if (btn) {
    btn.click();
    return;
  }
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
}
