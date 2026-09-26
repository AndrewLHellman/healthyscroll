import {
  addView,
  dayKey,
  feedKey,
  RETENTION_DAYS,
  type Category,
  type FeedDay,
  type FeedDayEntry,
  type ReelView,
} from "@healthyscroll/shared";

/**
 * On-device watch tally for Instagram Reels: per-day, per-category totals in
 * chrome.storage.local (`feed:YYYY-MM-DD`). See shared/feed.ts for the shapes.
 *
 * Categories come from Jev (reels.ts calls rememberCategory as each Reel is
 * judged, usually before it's on screen); times come from the content script
 * (REELS_WATCHED). The code -> category map is persisted too, because iOS can
 * stop this background script between a Reel being judged and being watched.
 *
 * Best-effort throughout: a failed write is logged and never touches the pipeline.
 */

const CATEGORIES_KEY = "feed:categories";
/** Enough to cover the Reels a feed preloads ahead of the viewer, many times over. */
const MAX_CATEGORIES = 300;
const DAY_KEY = /^feed:\d{4}-\d{2}-\d{2}$/;

let categories: Map<string, Category> | null = null;

// Every storage read-modify-write goes through here, one at a time.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn);
  queue = next.catch((err) => console.warn("[tally] storage failed", err));
  return next;
}

async function loadCategories(): Promise<Map<string, Category>> {
  if (!categories) {
    const got = await chrome.storage.local.get(CATEGORIES_KEY);
    categories = new Map(Object.entries((got[CATEGORIES_KEY] as Record<string, Category> | undefined) ?? {}));
  }
  return categories;
}

/** What Jev said a Reel is about. Called for every judged Reel. */
export function rememberCategory(code: string, category: Category): void {
  void serial(async () => {
    const map = await loadCategories();
    map.delete(code); // re-insert so it's the newest
    map.set(code, category);
    while (map.size > MAX_CATEGORIES) map.delete(map.keys().next().value!);
    await chrome.storage.local.set({ [CATEGORIES_KEY]: Object.fromEntries(map) });
  });
}

/** Add finished views to their days' totals. Reels Jev never categorised count as "other". */
export function recordViews(views: ReelView[]): Promise<void> {
  return serial(async () => {
    const map = await loadCategories();
    const keys = [...new Set(views.map((v) => feedKey(dayKey(v.seenAt))))];
    const got = await chrome.storage.local.get(keys);
    const days: Record<string, FeedDay> = Object.fromEntries(keys.map((k) => [k, (got[k] as FeedDay) ?? {}]));
    for (const v of views) addView(days[feedKey(dayKey(v.seenAt))], map.get(v.code) ?? "other", v);
    await chrome.storage.local.set(days);
  });
}

/** Totals for the last `days` local days (today included), one entry per day and category. */
export async function getEntries(days: number): Promise<FeedDayEntry[]> {
  const dates = Array.from({ length: days }, (_, i) => dayKey(Date.now() - i * 86_400_000));
  const got = await chrome.storage.local.get(dates.map(feedKey));
  return dates.flatMap((date) =>
    Object.entries((got[feedKey(date)] as FeedDay | undefined) ?? {}).map(
      ([category, totals]) => ({ date, category: category as Category, totals: totals! }),
    ),
  );
}

/** Drop days older than RETENTION_DAYS. Cheap; run on startup. */
export function pruneTally(): Promise<void> {
  return serial(async () => {
    const cutoff = feedKey(dayKey(Date.now() - RETENTION_DAYS * 86_400_000));
    const all = await chrome.storage.local.get(null);
    const stale = Object.keys(all).filter((k) => DAY_KEY.test(k) && k < cutoff);
    if (stale.length) await chrome.storage.local.remove(stale);
  });
}
