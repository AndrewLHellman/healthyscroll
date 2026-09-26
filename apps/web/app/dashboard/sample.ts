import type { Category } from "@healthyscroll/shared";
import type { SkipLite } from "./stats";

/**
 * A fabricated skip log for `/dashboard?sample=1`, so the page can be shown
 * without signing in. Seeded, so it's stable across renders. Shaped like a real
 * month: a few skips most days, more on weekends, mostly late evening, and
 * mostly the things the sample prompt names.
 */

export const SAMPLE_PROMPT = "gambling, drinking, thirst-trap content, anything that makes me feel worse about myself";
export const SAMPLE_ALL_TIME = 312;

const DAY = 86_400_000;
const DAYS = 28;

/** What the sample prompt catches, by share. */
const CATEGORY_WEIGHT: [Category, number][] = [
  ["gambling", 0.38],
  ["drinking_nightlife", 0.27],
  ["fitness_body", 0.14],
  ["beauty_fashion", 0.08],
  ["drama", 0.06],
  ["money_hustle", 0.04],
  ["other", 0.03],
];

/** Relative weight of each local hour. Lunch bump, big evening peak, tail past midnight. */
const HOUR_WEIGHT = [
  4, 2, 1, 0.3, 0.2, 0.2, 0.5, 1, 1.5, 2, 2.5, 3.5, //
  4, 3, 2.5, 2.5, 3, 4, 5, 6, 8, 11, 13, 9,
];

export function buildSampleSkips(now = Date.now()): SkipLite[] {
  const rand = mulberry32(11);
  const out: SkipLite[] = [];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  for (let i = DAYS - 1; i >= 0; i--) {
    const dayStart = today.getTime() - i * DAY;
    const weekend = [0, 6].includes(new Date(dayStart).getDay());
    // Poisson-ish: weekdays ~3, weekends ~6, with the odd zero day.
    const n = Math.max(0, Math.round((weekend ? 6 : 3) * (0.4 + rand() * 1.3) - (rand() < 0.1 ? 3 : 0)));
    for (let k = 0; k < n; k++) {
      const hour = pickHour(rand);
      const at = dayStart + hour * 3_600_000 + rand() * 3_600_000;
      if (at > now) continue;
      out.push({ skipped_at: new Date(at).toISOString(), category: pickCategory(rand) });
    }
  }
  return out;
}

function pickCategory(rand: () => number): Category {
  let r = rand();
  for (const [cat, w] of CATEGORY_WEIGHT) {
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
