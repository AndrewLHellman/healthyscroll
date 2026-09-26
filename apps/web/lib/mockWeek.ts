import { summarize, type Category, type Summary, type WatchRecord } from "@healthyscroll/shared";

/**
 * A fabricated week of WatchRecords for the landing page, run through the same
 * `summarize()` the extension uses. Seeded so server and client render the
 * same numbers. Shaped like a real feed: comedy is most of the volume, drama
 * and outrage are what actually hold attention, gambling/drinking get skipped.
 */

/** Per category: share of the feed, mean dwell (s), and whether the hero policy skips it. */
const PROFILE: Partial<Record<Category, { share: number; dwell: number; skipped?: boolean }>> = {
  comedy: { share: 0.26, dwell: 14 },
  drama: { share: 0.09, dwell: 41 },
  politics_outrage: { share: 0.08, dwell: 33 },
  food: { share: 0.1, dwell: 22 },
  music_dance: { share: 0.1, dwell: 9 },
  learn: { share: 0.07, dwell: 19 },
  fitness_body: { share: 0.06, dwell: 12 },
  animals: { share: 0.06, dwell: 11 },
  beauty_fashion: { share: 0.04, dwell: 8 },
  gaming: { share: 0.03, dwell: 10 },
  gambling: { share: 0.05, dwell: 1.2, skipped: true },
  drinking_nightlife: { share: 0.04, dwell: 1.4, skipped: true },
  other: { share: 0.02, dwell: 7 },
};

/** Videos per day, Mon→Sun. Weekend heavier. */
const PER_DAY = [62, 58, 71, 55, 84, 112, 96];

/** Fixed "now" so the week is stable: a Sunday evening. */
export const MOCK_NOW = new Date(2026, 8, 27, 21, 0, 0).getTime();

export function buildMockWeek(): Summary {
  const rand = mulberry32(7);
  const cats = Object.entries(PROFILE) as [Category, NonNullable<(typeof PROFILE)[Category]>][];
  const records: WatchRecord[] = [];

  PER_DAY.forEach((n, dayIdx) => {
    const dayStart = MOCK_NOW - (6 - dayIdx) * 86_400_000;
    for (let i = 0; i < n; i++) {
      const cat = pick(cats, rand);
      const dwellMs = Math.max(500, cat[1].dwell * 1000 * lognormal(rand));
      // Evenings mostly, spread over the day a little.
      const startedAt = dayStart - (4 + rand() * 6) * 3_600_000 + i * 2000;
      records.push({
        videoId: `mock-${dayIdx}-${i}`,
        startedAt,
        dwellMs,
        category: cat[0],
        categoryP: 0.7 + rand() * 0.29,
        verdict: cat[1].skipped ? "skip" : "allow",
        skipped: !!cat[1].skipped,
      });
    }
  });

  return summarize(records, { days: 7, now: MOCK_NOW });
}

function pick<T extends [Category, { share: number }]>(cats: T[], rand: () => number): T {
  let r = rand();
  for (const c of cats) {
    r -= c[1].share;
    if (r <= 0) return c;
  }
  return cats[cats.length - 1];
}

/** Dwell is right-skewed: most short, a few long. Multiplier around 1. */
function lognormal(rand: () => number): number {
  const u = 1 - rand();
  const v = rand();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.exp(0.6 * z - 0.18);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
