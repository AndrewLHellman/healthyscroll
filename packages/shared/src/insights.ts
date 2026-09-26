import type { Category } from "./categories";
import { medianFromBuckets, WATCH_BUCKETS, type FeedDayEntry } from "./feed";
import type { WatchRecord } from "./types";

/**
 * Rollups over WatchRecords. Pure functions, no storage — the extension's
 * popup and insights page run these over chrome.storage.local; the landing
 * page runs them over a fabricated week so its mock is honest math.
 *
 * Three things are computed, matching the three panels we show:
 *   days      time by category, per day            "where the time went"
 *   holds     dwell relative to your own average    "what actually holds you"
 *   skipped   count and an estimate of time not spent
 */

/** Keep this many days of records. Older ones are pruned on startup. */
export const RETENTION_DAYS = 60;

/** A category needs at least this many watched videos before we rank it in `holds`. */
export const MIN_SAMPLE = 3;

/** If nothing has been watched yet, assume a skipped video would have cost this long. */
const FALLBACK_DWELL_MS = 15_000;

export interface DaySummary {
  /** Local date, YYYY-MM-DD. */
  date: string;
  totalMs: number;
  byCategory: Partial<Record<Category, number>>;
}

export interface CategoryTotal {
  category: Category;
  ms: number;
  count: number;
  /** ms / total watched ms. */
  share: number;
}

export interface Hold {
  category: Category;
  count: number;
  avgMs: number;
  /** avgMs / overall average dwell. >1 means it holds you longer than your norm. */
  ratio: number;
}

export interface Summary {
  /** Videos actually watched (not skipped by us). */
  watched: number;
  totalMs: number;
  /** Median dwell of watched videos, ms. */
  medianMs: number;
  byCategory: CategoryTotal[];
  holds: Hold[];
  skipped: { count: number; savedMs: number; byCategory: CategoryTotal[] };
  days: DaySummary[];
}

/** Local-time YYYY-MM-DD for a timestamp. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function summarize(records: WatchRecord[], opts: { days?: number; now?: number } = {}): Summary {
  const now = opts.now ?? Date.now();
  const dayCount = opts.days ?? 7;
  const since = startOfDay(now) - (dayCount - 1) * 86_400_000;
  const inWindow = records.filter((r) => r.startedAt >= since);

  const watched = inWindow.filter((r) => !r.skipped);
  const skipped = inWindow.filter((r) => r.skipped);

  const totalMs = sum(watched.map((r) => r.dwellMs));
  const medianMs = watched.length ? median(watched.map((r) => r.dwellMs)) : 0;
  const avgMs = watched.length ? totalMs / watched.length : 0;

  const byCategory = totals(watched, totalMs);

  const holds: Hold[] = byCategory
    .filter((c) => c.count >= MIN_SAMPLE && avgMs > 0)
    .map((c) => ({ category: c.category, count: c.count, avgMs: c.ms / c.count, ratio: c.ms / c.count / avgMs }))
    .sort((a, b) => b.ratio - a.ratio);

  // Days, oldest → newest, every day present even if empty so charts line up.
  const days: DaySummary[] = [];
  for (let i = dayCount - 1; i >= 0; i--) {
    days.push({ date: dayKey(now - i * 86_400_000), totalMs: 0, byCategory: {} });
  }
  const byDate = new Map(days.map((d) => [d.date, d]));
  for (const r of watched) {
    const d = byDate.get(dayKey(r.startedAt));
    if (!d) continue;
    const cat = r.category ?? "other";
    d.totalMs += r.dwellMs;
    d.byCategory[cat] = (d.byCategory[cat] ?? 0) + r.dwellMs;
  }

  return {
    watched: watched.length,
    totalMs,
    medianMs,
    byCategory,
    holds,
    skipped: {
      count: skipped.length,
      savedMs: skipped.length * (medianMs || FALLBACK_DWELL_MS),
      // For skipped videos "ms" is meaningless (we cut them off); rank by count.
      byCategory: totals(skipped, 0).sort((a, b) => b.count - a.count),
    },
    days,
  };
}

/**
 * Same Summary as `summarize()`, from per-day, per-category totals (feed.ts)
 * instead of one record per video. This is what the Reels tally stores, on the
 * phone and in Supabase. The median watch is estimated from duration buckets.
 */
export function summarizeDays(entries: FeedDayEntry[], opts: { days?: number; now?: number } = {}): Summary {
  const now = opts.now ?? Date.now();
  const dayCount = opts.days ?? 7;

  const days: DaySummary[] = [];
  for (let i = dayCount - 1; i >= 0; i--) {
    days.push({ date: dayKey(now - i * 86_400_000), totalMs: 0, byCategory: {} });
  }
  const byDate = new Map(days.map((d) => [d.date, d]));

  const watchedBy = new Map<Category, { ms: number; count: number }>();
  const skippedBy = new Map<Category, number>();
  const buckets = WATCH_BUCKETS.map(() => 0);

  for (const { date, category, totals: t } of entries) {
    const d = byDate.get(date);
    if (!d) continue;
    const ms = t.seconds * 1000;
    const watched = t.seen - t.skipped;
    if (watched > 0) {
      d.totalMs += ms;
      d.byCategory[category] = (d.byCategory[category] ?? 0) + ms;
      const cur = watchedBy.get(category) ?? { ms: 0, count: 0 };
      cur.ms += ms;
      cur.count += watched;
      watchedBy.set(category, cur);
    }
    if (t.skipped > 0) skippedBy.set(category, (skippedBy.get(category) ?? 0) + t.skipped);
    t.buckets.forEach((n, i) => (buckets[i] += n));
  }

  const totalMs = sum([...watchedBy.values()].map((v) => v.ms));
  const watched = sum([...watchedBy.values()].map((v) => v.count));
  const medianMs = medianFromBuckets(buckets) * 1000;
  const avgMs = watched ? totalMs / watched : 0;

  const byCategory: CategoryTotal[] = [...watchedBy.entries()]
    .map(([category, v]) => ({ category, ms: v.ms, count: v.count, share: totalMs ? v.ms / totalMs : 0 }))
    .sort((a, b) => b.ms - a.ms);

  const holds: Hold[] = byCategory
    .filter((c) => c.count >= MIN_SAMPLE && avgMs > 0)
    .map((c) => ({ category: c.category, count: c.count, avgMs: c.ms / c.count, ratio: c.ms / c.count / avgMs }))
    .sort((a, b) => b.ratio - a.ratio);

  const skippedCount = sum([...skippedBy.values()]);

  return {
    watched,
    totalMs,
    medianMs,
    byCategory,
    holds,
    skipped: {
      count: skippedCount,
      savedMs: skippedCount * (medianMs || FALLBACK_DWELL_MS),
      byCategory: [...skippedBy.entries()]
        .map(([category, count]) => ({ category, ms: 0, count, share: 0 }))
        .sort((a, b) => b.count - a.count),
    },
    days,
  };
}

function totals(records: WatchRecord[], totalMs: number): CategoryTotal[] {
  const acc = new Map<Category, { ms: number; count: number }>();
  for (const r of records) {
    const cat = r.category ?? "other";
    const cur = acc.get(cat) ?? { ms: 0, count: 0 };
    cur.ms += r.dwellMs;
    cur.count += 1;
    acc.set(cat, cur);
  }
  return [...acc.entries()]
    .map(([category, v]) => ({ category, ms: v.ms, count: v.count, share: totalMs ? v.ms / totalMs : 0 }))
    .sort((a, b) => b.ms - a.ms);
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** "1h 12m", "48m", "35s" — for chart labels and the popup line. */
export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}
