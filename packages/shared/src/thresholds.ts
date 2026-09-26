import type { Verdict } from "./types";

/**
 * Probability bands for turning Jev's `violates` probability into a verdict.
 * Anything in the middle band is "uncertain" and triggers the Moondream visual pass.
 * Tune these against real feeds; they are the main knob for false-skip vs. missed-skip.
 */
export const THRESHOLDS = {
  /** p >= this → skip immediately, no vision needed. */
  skip: 0.8,
  /** p <= this → allow (but keep monitoring frames while it plays). */
  allow: 0.2,
} as const;

export function toVerdict(violatesProbability: number): Verdict {
  if (violatesProbability >= THRESHOLDS.skip) return "skip";
  if (violatesProbability <= THRESHOLDS.allow) return "allow";
  return "uncertain";
}

/** How often (ms) the extension re-captures a frame while a video plays. */
export const MONITOR_INTERVAL_MS = 1500;

/** Max frames to describe per video before we stop polling (cost/latency cap). */
export const MAX_FRAMES_PER_VIDEO = 8;
