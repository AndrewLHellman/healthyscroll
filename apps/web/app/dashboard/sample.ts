import type { Category } from "@healthyscroll/shared";
import type { ReelLite } from "./stats";

/**
 * A fabricated month of Reels for `/dashboard?sample=1`, so the page can be
 * shown without signing in. Seeded, so it's stable across renders. Shaped like
 * a real month: sixty-odd Reels most days, more on weekends, a little less
 * each week, and skips concentrated in the things the sample prompt names.
 */

export const SAMPLE_PROMPT = "gambling, drinking, thirst-trap content, anything that makes me feel worse about myself";
export const SAMPLE_ALL_TIME = 2_080;

const DAY = 86_400_000;
const DAYS = 28;

/** What a feed serves, by share. */
const FEED: [Category, number][] = [
  ["comedy", 0.18],
  ["music_dance", 0.1],
  ["fitness_body", 0.1],
  ["food", 0.08],
  ["beauty_fashion", 0.08],
  ["animals", 0.07],
  ["gambling", 0.07],
  ["learn", 0.06],
  ["drama", 0.06],
  ["gaming", 0.05],
  ["money_hustle", 0.05],
  ["drinking_nightlife", 0.05],
  ["politics_outrage", 0.04],
  ["other", 0.01],
];

/** Chance the sample prompt skips a Reel of each kind. Unlisted: a stray 3%. */
const SKIP_RATE: Partial<Record<Category, number>> = {
  gambling: 0.95,
  drinking_nightlife: 0.9,
  fitness_body: 0.55,
  beauty_fashion: 0.35,
  drama: 0.3,
  money_hustle: 0.3,
};

/** Relative weight of each local hour. Lunch bump, big evening peak, tail past midnight. */
const HOUR_WEIGHT = [
  4, 2, 1, 0.3, 0.2, 0.2, 0.5, 1, 1.5, 2, 2.5, 3.5, //
  4, 3, 2.5, 2.5, 3, 4, 5, 6, 8, 11, 13, 9,
];

export function buildSampleReels(now = Date.now()): ReelLite[] {
  const rand = mulberry32(11);
  const out: ReelLite[] = [];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  for (let i = DAYS - 1; i >= 0; i--) {
    const dayStart = today.getTime() - i * DAY;
    const weekend = [0, 6].includes(new Date(dayStart).getDay());
    // Tapers from ~1.25× in the first week to ~0.8× in the last.
    const trend = 1.25 - 0.45 * ((DAYS - 1 - i) / (DAYS - 1));
    const n = Math.round((weekend ? 110 : 70) * trend * (0.6 + rand() * 0.8));
    for (let k = 0; k < n; k++) {
      const at = dayStart + pickHour(rand) * 3_600_000 + rand() * 3_600_000;
      if (at > now) continue;
      const category = pick(FEED, rand);
      const skipped = rand() < (SKIP_RATE[category] ?? 0.03);
      out.push({
        seen_at: new Date(at).toISOString(),
        category,
        skipped,
        // A skip lands a second or so in; a watched Reel runs 6–60 s, mostly ~25.
        seconds: skipped ? 0.8 + rand() * 0.8 : 6 + 54 * Math.pow(rand(), 1.4),
      });
    }
  }
  return out;
}

function pick(weights: [Category, number][], rand: () => number): Category {
  let r = rand();
  for (const [cat, w] of weights) {
    r -= w;
    if (r <= 0) return cat;
  }
  return "other";
}

function pickHour(rand: () => number): number {
  const total = HOUR_WEIGHT.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let h = 0; h < 24; h++) {
    r -= HOUR_WEIGHT[h];
    if (r <= 0) return h;
  }
  return 23;
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
