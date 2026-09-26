import type { Category, SkipRow } from "@healthyscroll/shared";

/**
 * Rollups over the `skips` table for the dashboard. Pure; runs in the browser
 * so hours and days are in the user's local time.
 *
 * Two figures: skips per day, stacked by what kind of video it was, and skips
 * by hour of day. Nothing about how the decision was made; that's pipeline
 * detail, not the user's.
 */

export type SkipLite = Pick<SkipRow, "skipped_at"> & { category?: Category | null };

/** Skips with no category (or beyond the top few) collapse into this. */
export const REST = "other" as const;

export interface DayStat {
  /** Local YYYY-MM-DD. */
  date: string;
  ts: number;
  total: number;
  byCategory: Partial<Record<Category, number>>;
}

export interface CategoryCount {
  category: Category;
  count: number;
}

export interface Peak {
  /** Local hours, inclusive start, exclusive end (may wrap past 24). */
  start: number;
  end: number;
  /** Share of all skips in the window that fell in these hours. */
  share: number;
}

export interface Stats {
  /** Skips inside the window. */
  total: number;
  days: DayStat[];
  /** Most-skipped first. */
  byCategory: CategoryCount[];
  /** Count per local hour, 0–23. */
  hours: number[];
  /** Densest three-hour block, or null if there's too little to say. */
  peak: Peak | null;
}

const DAY = 86_400_000;
const PEAK_HOURS = 3;
/** Below this many skips a "most of it lands between…" sentence is noise. */
const PEAK_MIN = 8;

export function computeStats(skips: SkipLite[], opts: { days?: number; now?: number } = {}): Stats {
  const now = opts.now ?? Date.now();
  const dayCount = opts.days ?? 28;
  const since = startOfDay(now) - (dayCount - 1) * DAY;

  const days: DayStat[] = [];
  for (let i = dayCount - 1; i >= 0; i--) {
    const ts = startOfDay(now - i * DAY);
    days.push({ date: dayKey(ts), ts, total: 0, byCategory: {} });
  }
  const byDate = new Map(days.map((d) => [d.date, d]));

  const hours = new Array<number>(24).fill(0);
  const cats = new Map<Category, number>();
  let total = 0;

  for (const s of skips) {
    const t = new Date(s.skipped_at).getTime();
    if (!Number.isFinite(t) || t < since || t > now + DAY) continue;
    const d = byDate.get(dayKey(t));
    if (!d) continue;
    const cat = s.category ?? REST;
    d.total += 1;
    d.byCategory[cat] = (d.byCategory[cat] ?? 0) + 1;
    cats.set(cat, (cats.get(cat) ?? 0) + 1);
    hours[new Date(t).getHours()] += 1;
    total += 1;
  }

  const byCategory = [...cats.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || (a.category === REST ? 1 : b.category === REST ? -1 : 0));

  return { total, days, byCategory, hours, peak: peakOf(hours, total) };
}

function peakOf(hours: number[], total: number): Peak | null {
  if (total < PEAK_MIN) return null;
  let best = -1;
  let start = 0;
  for (let h = 0; h < 24; h++) {
    let sum = 0;
    for (let k = 0; k < PEAK_HOURS; k++) sum += hours[(h + k) % 24];
    if (sum > best) {
      best = sum;
      start = h;
    }
  }
  return { start, end: start + PEAK_HOURS, share: best / total };
}

/* ------------------------------------------------------------ formatting */

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "23 Sep" */
export function shortDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTH[d.getMonth()]}`;
}

/** "Tue 23 Sep" */
export function longDate(ts: number): string {
  return `${WEEKDAY[new Date(ts).getDay()]} ${shortDate(ts)}`;
}

/** 0 → "12 am", 13 → "1 pm". Hours ≥ 24 wrap. */
export function hourLabel(h: number): string {
  const x = ((h % 24) + 24) % 24;
  const n = x % 12 === 0 ? 12 : x % 12;
  return `${n} ${x < 12 ? "am" : "pm"}`;
}

/** Compact axis tick: 0 → "12a", 18 → "6p". */
export function hourTick(h: number): string {
  const x = h % 24;
  const n = x % 12 === 0 ? 12 : x % 12;
  return `${n}${x < 12 ? "a" : "p"}`;
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
