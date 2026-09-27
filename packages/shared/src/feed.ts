import type { Category } from "./categories";

/**
 * Watch-time tally for Reels: what came on screen, what we skipped, and how
 * long the rest held you, kept as per-day, per-category totals.
 *
 * Totals rather than one record per Reel, so the phone does one tiny storage
 * write per batch, and the server (only if the user signs in) sees daily sums
 * per topic, never which Reels.
 *
 * Flow: content script times each Reel (ReelView) -> background adds it to the
 * day's FeedDay in chrome.storage.local -> sync.ts upserts the day's rows to
 * Supabase `feed_days` -> `summarizeDays()` (insights.ts) draws "Your week".
 */

/** One Reel's time on screen, measured by the content script. */
export interface ReelView {
  /** Instagram shortcode; the background maps it to a category. */
  code: string;
  /** Epoch ms when it came on screen. Decides which local day it counts toward. */
  seenAt: number;
  /** Seconds it was on screen while the page was visible, capped at MAX_VIEW_SECONDS. */
  seconds: number;
  /** Healthy Scroll skipped it (as opposed to the viewer scrolling on). */
  skipped: boolean;
}

/** Shorter than this and not skipped by us: a swipe-through, not counted as seen. */
export const MIN_VIEW_SECONDS = 1;

/** A Reel looping on a phone left on the table stops counting after this. */
export const MAX_VIEW_SECONDS = 180;

/**
 * Below this confidence Jev's category is a guess; count the Reel as "other".
 * Jev's `choice` is already the most likely of ~20 categories, so its probability
 * is spread thin: 0.35 sent over half of a real week to "other" (2026-09-27).
 */
export const MIN_CATEGORY_PROBABILITY = 0.2;

/**
 * Upper bounds (seconds) of the watch-time buckets. Counting watched Reels per
 * bucket lets us estimate the median watch without keeping every Reel.
 */
export const WATCH_BUCKETS = [2, 4, 6, 8, 10, 15, 20, 30, 45, 60, 90, 120, MAX_VIEW_SECONDS] as const;

export interface FeedTotals {
  /** Reels that came on screen, skipped ones included. */
  seen: number;
  skipped: number;
  /** Seconds on Reels that weren't skipped. */
  seconds: number;
  /** Watched (not skipped) Reels per WATCH_BUCKETS bucket. */
  buckets: number[];
}

/** One local day's totals by category. */
export type FeedDay = Partial<Record<Category, FeedTotals>>;

/** A day's totals for one category, as stored and as synced (one `feed_days` row). */
export interface FeedDayEntry {
  /** Local YYYY-MM-DD. */
  date: string;
  category: Category;
  totals: FeedTotals;
}

/** chrome.storage.local key holding one day's FeedDay. */
export function feedKey(date: string): string {
  return `feed:${date}`;
}

/** Whether a view counts at all: long enough to be seen, or skipped by us. */
export function countsAsSeen(view: Pick<ReelView, "seconds" | "skipped">): boolean {
  return view.skipped || view.seconds >= MIN_VIEW_SECONDS;
}

export function emptyTotals(): FeedTotals {
  return { seen: 0, skipped: 0, seconds: 0, buckets: WATCH_BUCKETS.map(() => 0) };
}

/** Adds one view to a day's totals, in place. */
export function addView(day: FeedDay, category: Category, view: ReelView): void {
  const t = (day[category] ??= emptyTotals());
  t.seen += 1;
  if (view.skipped) {
    t.skipped += 1;
    return;
  }
  const seconds = Math.min(view.seconds, MAX_VIEW_SECONDS);
  t.seconds = Math.round((t.seconds + seconds) * 10) / 10;
  t.buckets[bucketOf(seconds)] += 1;
}

function bucketOf(seconds: number): number {
  const i = WATCH_BUCKETS.findIndex((upper) => seconds <= upper);
  return i >= 0 ? i : WATCH_BUCKETS.length - 1;
}

/** Median watch in seconds, interpolated within its bucket. 0 if nothing was watched. */
export function medianFromBuckets(buckets: number[]): number {
  const total = buckets.reduce((a, b) => a + b, 0);
  if (!total) return 0;
  const half = total / 2;
  let before = 0;
  for (let i = 0; i < WATCH_BUCKETS.length; i++) {
    const n = buckets[i] ?? 0;
    if (before + n >= half && n > 0) {
      const lower = i === 0 ? 0 : WATCH_BUCKETS[i - 1];
      return lower + ((half - before) / n) * (WATCH_BUCKETS[i] - lower);
    }
    before += n;
  }
  return WATCH_BUCKETS[WATCH_BUCKETS.length - 1];
}
