import type { VideoContext } from "@healthyscroll/shared";

/**
 * TikTok DOM adapter. This is the only file that should know about TikTok's
 * markup. Selectors WILL rot — keep them here, keep them data-e2e based where
 * possible (TikTok ships `data-e2e` test hooks that are more stable than classes).
 *
 * Status: selectors are best guesses, not yet verified against the live page.
 * With VITE_HS_DEBUG=true, run `dispatchEvent(new Event("hs:probe"))` in the
 * tiktok.com console to see what each selector matches (see content/index.ts).
 */

/** Candidates per field, tried in order; the first that matches wins. */
const SELECTORS = {
  /** Container for one video in the feed. Falls back to climbing from <video> if none match. */
  activeItem: ['[data-e2e="recommend-list-item-container"]', "article[data-scroll-index]"],
  /** The feed has no username text; it's in the avatar link's href (`/@user`). */
  authorLink: ['[data-e2e="video-author-avatar"]', 'a[href^="/@"]'],
  /** Hashtags are read out of this text; their links now point at search, not /tag/. */
  description: ['[data-e2e="video-desc"]', '[data-e2e="browse-video-desc"]'],
  audio: ['[data-e2e="video-music"]', '[data-e2e="browse-music"]'],
  /** The comment panel is a side drawer outside the feed item, so this is queried page-wide. */
  comment: ['[data-e2e="comment-level-1"]'],
  /** TikTok's own "next video" control. */
  nextButton: [
    '[data-e2e="feed-navigation-next"]',
    '[data-e2e="arrow-down"]',
    'button[aria-label*="next video" i]',
    '[data-e2e="arrow-right"]',
  ],
  /** TikTok's player wrapper id embeds the video id: `xgwrapper-<n>-<videoId>`. */
  playerWrapper: ['[id^="xgwrapper-"]'],
  videoLink: ['a[href*="/video/"]'],
} as const satisfies Record<string, readonly string[]>;

type Candidates = readonly string[];

/** Find the feed item currently in view (largest visible area). */
export function getActiveItem(): HTMLElement | null {
  return mostVisible(getFeedItems().items);
}

/**
 * All feed items currently in the DOM. Prefers the known container hooks; if
 * those rot, treats "the largest ancestor that holds exactly one <video> and is
 * about a screen tall" as the item, so scraping degrades instead of dying.
 */
function getFeedItems(): { items: HTMLElement[]; source: string } {
  for (const sel of SELECTORS.activeItem) {
    const items = Array.from(document.querySelectorAll<HTMLElement>(sel));
    if (items.length > 0) return { items, source: sel };
  }
  const videos = Array.from(document.querySelectorAll<HTMLElement>("video"));
  return { items: videos.map(itemAroundVideo), source: "video-fallback" };
}

function itemAroundVideo(video: HTMLElement): HTMLElement {
  let el = video;
  while (el.parentElement && el.parentElement !== document.body) {
    const parent = el.parentElement;
    if (parent.querySelectorAll("video").length > 1) break;
    if (parent.getBoundingClientRect().height > window.innerHeight * 1.5) break;
    el = parent;
  }
  return el;
}

function mostVisible(els: HTMLElement[]): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestArea = 0;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    const h = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
    const w = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0));
    if (h * w > bestArea) {
      bestArea = h * w;
      best = el;
    }
  }
  return best;
}

/** Read everything text-based about a feed item. Null if we can't tell which video it is yet. */
export function scrapeContext(item: HTMLElement): VideoContext | null {
  const videoId = getVideoId(item);
  if (!videoId) return null;

  const description = textOf(item, SELECTORS.description);
  return {
    videoId,
    platform: "tiktok",
    url: location.href,
    author: authorOf(item),
    description,
    hashtags: [...new Set(description?.match(/#[\p{L}\p{N}_]+/gu) ?? [])].map((h) => h.slice(1)),
    audioTitle: audioOf(item),
    comments: commentsFor(videoId),
  };
}

/** First comment last read from the panel, and which video it was read for. */
let lastPanel = { videoId: "", firstComment: "" };

/**
 * Comments from the side panel, only if the user already has it open (we never
 * open it) and it's showing this video. With the panel open TikTok puts the
 * video in the URL (/@user/video/<id>), but after a scroll the URL can update
 * before the panel re-renders, so the previous video's comments are rejected too.
 */
function commentsFor(videoId: string): string[] {
  if (location.pathname.match(/\/video\/(\d+)/)?.[1] !== videoId) return [];
  const comments = textsOf(document, SELECTORS.comment).slice(0, 20);
  const firstComment = comments[0] ?? "";
  if (firstComment && lastPanel.videoId !== videoId && firstComment === lastPanel.firstComment) {
    return [];
  }
  lastPanel = { videoId, firstComment };
  return comments;
}

/**
 * Sound title. The feed's music hook is a textless disc icon whose aria-label
 * reads "Watch more videos with music <title>"; fall back to the
 * `/music/<name>-<id>` link slug.
 */
function audioOf(item: HTMLElement): string | undefined {
  const el = first(item, SELECTORS.audio);
  if (!el) return undefined;
  const fromAttrs = [el.textContent, el.getAttribute("aria-label"), el.getAttribute("title")]
    .map((s) => s?.trim().replace(/^Watch more videos with music\s+/i, ""))
    .find(Boolean);
  if (fromAttrs) return fromAttrs;
  const href = (el.closest("a") ?? el.querySelector("a"))?.getAttribute("href");
  const slug = href?.match(/\/music\/([^/?#]+)/)?.[1];
  return slug ? decodeURIComponent(slug).replace(/-\d{10,}$/, "").replace(/-/g, " ") : undefined;
}

/** Username from the avatar's `/@user` link (the avatar may sit inside the <a> or wrap it). */
function authorOf(item: HTMLElement): string | undefined {
  const el = first(item, SELECTORS.authorLink);
  const link = el?.closest("a") ?? el?.querySelector("a");
  return link?.getAttribute("href")?.match(/\/@([^/?#]+)/)?.[1];
}

/**
 * A stable id for the video in this item. Must not change between calls for the
 * same video, or every DOM mutation looks like a new video.
 *
 * The For You page URL has no video id in it, so item-scoped signals come first;
 * the URL is only right on a /@user/video/<id> page.
 */
export function getVideoId(item: HTMLElement): string | null {
  const wrapper = first(item, SELECTORS.playerWrapper);
  const fromId = `${wrapper?.id ?? ""} ${item.id}`.match(/\d{15,}/)?.[0];
  if (fromId) return fromId;

  const link = first<HTMLAnchorElement>(item, SELECTORS.videoLink);
  const fromLink = link?.href.match(/\/video\/(\d+)/)?.[1];
  if (fromLink) return fromLink;

  const fromUrl = location.pathname.match(/\/video\/(\d+)/)?.[1];
  if (fromUrl) return fromUrl;

  // No id anywhere: fingerprint the text. Stable per video, which is all we need.
  const fingerprint = [
    authorOf(item),
    textOf(item, SELECTORS.description),
    audioOf(item),
  ].join("\n");
  return fingerprint.trim() ? `text-${hash(fingerprint)}` : null;
}

export type SkipStrategy = "button" | "scroll" | "key";

/**
 * Advance the feed past `videoId`. Tries TikTok's own control first, then
 * fallbacks, checking after each attempt whether the active video actually
 * changed so we never fire two strategies for one skip.
 * Returns the strategy that worked, or null if the feed didn't move.
 */
export async function skipToNext(videoId: string): Promise<SkipStrategy | null> {
  const strategies: [SkipStrategy, () => boolean][] = [
    ["button", clickNextButton],
    ["scroll", scrollToNextItem],
    ["key", pressArrowDown],
  ];
  for (const [name, attempt] of strategies) {
    if (!attempt()) continue;
    if (await activeVideoLeaves(videoId)) return name;
  }
  return null;
}

function clickNextButton(): boolean {
  // The hook may be on a wrapper around the real <button>; clicking a wrapper doesn't reach it.
  const el = first(document, SELECTORS.nextButton);
  const btn = el?.matches("button") ? el : (el?.querySelector("button") ?? el);
  if (!btn || btn.matches(":disabled, [aria-disabled='true']")) return false;
  btn.click();
  return true;
}

function scrollToNextItem(): boolean {
  const { items } = getFeedItems();
  const active = mostVisible(items);
  if (!active) return false;
  const activeTop = active.getBoundingClientRect().top;
  let next: HTMLElement | null = null;
  let nextTop = Infinity;
  for (const el of items) {
    const top = el.getBoundingClientRect().top;
    if (top > activeTop + 1 && top < nextTop) {
      next = el;
      nextTop = top;
    }
  }
  if (!next) return false;
  next.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}

/** TikTok binds ArrowDown to "next video". Synthetic events are untrusted, so this may be ignored. */
function pressArrowDown(): boolean {
  const init = { key: "ArrowDown", code: "ArrowDown", keyCode: 40, bubbles: true };
  document.body.dispatchEvent(new KeyboardEvent("keydown", init));
  document.body.dispatchEvent(new KeyboardEvent("keyup", init));
  return true;
}

async function activeVideoLeaves(videoId: string, timeoutMs = 1000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
    const item = getActiveItem();
    if (item && getVideoId(item) !== videoId) return true;
  }
  return false;
}

/**
 * Debug snapshot of what the adapter sees right now: which selectors match,
 * which data-e2e hooks exist, and what would be scraped. Use it to fix
 * SELECTORS after a TikTok redesign.
 */
export function probe() {
  const { items, source } = getFeedItems();
  const item = mostVisible(items);
  const hooks = (root: ParentNode) =>
    [...new Set(Array.from(root.querySelectorAll("[data-e2e]"), (el) => el.getAttribute("data-e2e")))];

  return {
    url: location.href,
    feedItems: { source, count: items.length },
    activeItem: item,
    context: item && scrapeContext(item),
    selectorMatches: Object.fromEntries(
      Object.entries(SELECTORS).map(([key, candidates]) => [
        key,
        Object.fromEntries(candidates.map((sel) => [sel, document.querySelectorAll(sel).length])),
      ]),
    ),
    dataE2eInActiveItem: item ? hooks(item) : [],
    dataE2eOnPage: hooks(document),
    longNumericIdsInActiveItem: item
      ? Array.from(item.querySelectorAll("[id]"), (el) => el.id).filter((id) => /\d{15,}/.test(id))
      : [],
  };
}

function first<T extends Element = HTMLElement>(root: ParentNode, candidates: Candidates): T | null {
  for (const sel of candidates) {
    const el = root.querySelector<T>(sel);
    if (el) return el;
  }
  return null;
}

function textOf(root: ParentNode, candidates: Candidates): string | undefined {
  return first(root, candidates)?.textContent?.trim() || undefined;
}

function textsOf(root: ParentNode, candidates: Candidates): string[] {
  for (const sel of candidates) {
    const texts = Array.from(root.querySelectorAll(sel), (el) => el.textContent?.trim()).filter(
      (t): t is string => !!t,
    );
    if (texts.length > 0) return texts;
  }
  return [];
}

/** djb2 — tiny, stable, good enough for fingerprinting a caption. */
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}
