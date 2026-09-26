import {
  addView,
  emptyTotals,
  isCategory,
  type Category,
  type FeedDay,
  type FeedDayEntry,
  type FeedDayRow,
} from "@healthyscroll/shared";

/**
 * Rollups for the dashboard. Pure; runs in the browser so days are in the
 * user's local time.
 *
 * The unit is a Reel that came on screen. Some were skipped, the rest were
 * watched for some number of seconds. From that: how much you scrolled, what
 * got skipped, and how long you spent watching.
 */

export interface ReelLite {
  /** ISO timestamp of when the Reel came on screen. */
  seen_at: string;
  skipped: boolean;
  /** Seconds it was on screen. Skipped Reels are on screen for about a second. */
  seconds: number;
  category?: Category | null;
}

/** Skips with no category (or beyond the top few) collapse into this. */
export const REST = "other" as const;

export interface DayStat {
  /** Local YYYY-MM-DD. */
  date: string;
  ts: number;
  seen: number;
  skipped: number;
  /** Seconds spent on Reels that weren't skipped. */
  seconds: number;
  skippedByCategory: Partial<Record<Category, number>>;
}

export interface CategoryCount {
  category: Category;
  count: number;
}

export interface Stats {
  seen: number;
  skipped: number;
  /** Seconds spent on Reels that weren't skipped. */
  seconds: number;
  days: DayStat[];
  /** Most-skipped first. */
  skippedByCategory: CategoryCount[];
  /**
   * False when only skips are known (nothing about the Reels that were
   * watched). Figures that need the whole feed stay hidden.
   */
  tracked: boolean;
}

const DAY = 86_400_000;

export function computeStats(reels: ReelLite[], opts: { days?: number; now?: number } = {}): Stats {
  const now = opts.now ?? Date.now();
  const dayCount = opts.days ?? 28;
  const since = startOfDay(now) - (dayCount - 1) * DAY;

  const days: DayStat[] = [];
  for (let i = dayCount - 1; i >= 0; i--) {
    const ts = startOfDay(now - i * DAY);
    days.push({ date: dayKey(ts), ts, seen: 0, skipped: 0, seconds: 0, skippedByCategory: {} });
  }
  const byDate = new Map(days.map((d) => [d.date, d]));

  const cats = new Map<Category, number>();
  let seen = 0;
  let skipped = 0;
  let seconds = 0;
  let watched = 0;

  for (const r of reels) {
    const t = new Date(r.seen_at).getTime();
    if (!Number.isFinite(t) || t < since || t > now + DAY) continue;
    const d = byDate.get(dayKey(t));
    if (!d) continue;
    d.seen += 1;
    seen += 1;
    if (r.skipped) {
      const cat = r.category ?? REST;
      d.skipped += 1;
      d.skippedByCategory[cat] = (d.skippedByCategory[cat] ?? 0) + 1;
      cats.set(cat, (cats.get(cat) ?? 0) + 1);
      skipped += 1;
    } else {
      d.seconds += r.seconds;
      seconds += r.seconds;
      watched += 1;
    }
  }

  const skippedByCategory = [...cats.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || (a.category === REST ? 1 : b.category === REST ? -1 : 0));

  return { seen, skipped, seconds, days, skippedByCategory, tracked: watched > 0 };
}

/**
 * Same Stats from the synced daily totals (`feed_days`), which know every Reel
 * that came on screen, not just the skips. That's what makes `tracked` true.
 */
export function statsFromEntries(entries: FeedDayEntry[], opts: { days?: number; now?: number } = {}): Stats {
  const now = opts.now ?? Date.now();
  const dayCount = opts.days ?? 28;

  const days: DayStat[] = [];
  for (let i = dayCount - 1; i >= 0; i--) {
    const ts = startOfDay(now - i * DAY);
    days.push({ date: dayKey(ts), ts, seen: 0, skipped: 0, seconds: 0, skippedByCategory: {} });
  }
  const byDate = new Map(days.map((d) => [d.date, d]));

  const cats = new Map<Category, number>();
  let seen = 0;
  let skipped = 0;
  let seconds = 0;

  for (const { date, category, totals: t } of entries) {
    const d = byDate.get(date);
    if (!d) continue;
    d.seen += t.seen;
    d.skipped += t.skipped;
    d.seconds += t.seconds;
    seen += t.seen;
    skipped += t.skipped;
    seconds += t.seconds;
    if (t.skipped) {
      d.skippedByCategory[category] = (d.skippedByCategory[category] ?? 0) + t.skipped;
      cats.set(category, (cats.get(category) ?? 0) + t.skipped);
    }
  }

  const skippedByCategory = [...cats.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || (a.category === REST ? 1 : b.category === REST ? -1 : 0));

  return { seen, skipped, seconds, days, skippedByCategory, tracked: seen > skipped };
}

/** A `feed_days` row as a FeedDayEntry. Unknown categories (renamed since) count as "other". */
export function entryFromRow(row: Pick<FeedDayRow, "day" | "category" | "seen" | "skipped" | "seconds" | "buckets">): FeedDayEntry {
  const totals = emptyTotals();
  totals.seen = row.seen;
  totals.skipped = row.skipped;
  totals.seconds = row.seconds;
  (row.buckets ?? []).forEach((n, i) => {
    if (i < totals.buckets.length) totals.buckets[i] = n;
  });
  return { date: row.day, category: isCategory(row.category) ? row.category : REST, totals };
}

/** Per-Reel records (the sample month) as daily totals, the shape the extension syncs. */
export function entriesFromReels(reels: ReelLite[]): FeedDayEntry[] {
  const days = new Map<string, FeedDay>();
  for (const r of reels) {
    const t = new Date(r.seen_at).getTime();
    const date = dayKey(t);
    const day = days.get(date) ?? {};
    addView(day, r.category ?? REST, { code: "", seenAt: t, seconds: r.seconds, skipped: r.skipped });
    days.set(date, day);
  }
  return [...days.entries()].flatMap(([date, day]) =>
    (Object.entries(day) as [Category, FeedDayEntry["totals"]][]).map(([category, totals]) => ({ date, category, totals })),
  );
}

/* ------------------------------------------------------------ formatting */

const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "September 23" */
export function shortDate(ts: number): string {
  const d = new Date(ts);
  return `${MONTH[d.getMonth()]} ${d.getDate()}`;
}

/** "September 23" */
export function longDate(ts: number): string {
  return shortDate(ts);
}

/** "Tuesday" */
export function weekday(ts: number): string {
  return WEEKDAY[new Date(ts).getDay()];
}

/** Fits above a narrow column: 5400 → "1.5h", 1500 → "25m", 0 → "–". */
export function compactDuration(sec: number): string {
  if (sec < 30) return "–";
  const m = Math.round(sec / 60);
  if (m < 60) return `${Math.max(m, 1)}m`;
  const h = sec / 3600;
  return `${h >= 10 ? Math.round(h) : h.toFixed(1).replace(/\.0$/, "")}h`;
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
