import {
  RETENTION_DAYS,
  dayKey,
  type Decision,
  type VideoContext,
  type WatchRecord,
} from "@healthyscroll/shared";

/**
 * The on-device tally. One WatchRecord per video shown, bucketed by local day
 * in chrome.storage.local under `watch:YYYY-MM-DD`. Never leaves the browser.
 *
 * Dwell is wall-clock time while the tab is visible. The content script tells
 * us about visibility; we do the arithmetic here. A record is written the
 * moment a video appears (dwell 0) and updated when it ends, so a killed
 * service worker loses at most the tail of one video.
 */

interface Open {
  record: WatchRecord;
  /** When the current visible stretch began; null while hidden. */
  visibleSince: number | null;
}

const open = new Map<number /* tabId */, Open>();

const keyFor = (ts: number) => `watch:${dayKey(ts)}`;

/**
 * Registers synchronously so an `annotate` from a fast Jev response can't
 * arrive before the record exists; persistence happens after.
 */
export function openWatch(tabId: number, context: VideoContext): void {
  const prev = open.get(tabId);
  const now = Date.now();
  const record: WatchRecord = {
    videoId: context.videoId,
    author: context.author,
    startedAt: now,
    dwellMs: 0,
    skipped: false,
  };
  open.set(tabId, { record, visibleSince: now });
  if (prev) {
    stopClock(prev);
    void upsert(prev.record);
  }
  void upsert(record);
}

/** Attach what the pipeline learned. Called after every Jev response. */
export async function annotate(tabId: number, decision: Decision): Promise<void> {
  const o = open.get(tabId);
  if (!o || o.record.videoId !== decision.videoId) return;
  if (decision.category) {
    o.record.category = decision.category.label;
    o.record.categoryP = decision.category.probability;
  }
  o.record.verdict = decision.verdict;
  if (decision.verdict === "skip") o.record.skipped = true;
  await upsert(o.record);
}

/** Pause/resume the dwell clock. Hidden time doesn't count as watching. */
export function setVisible(tabId: number, visible: boolean): void {
  const o = open.get(tabId);
  if (!o) return;
  if (visible) {
    if (o.visibleSince === null) o.visibleSince = Date.now();
  } else {
    stopClock(o);
  }
}

export async function closeWatch(tabId: number): Promise<void> {
  const o = open.get(tabId);
  if (!o) return;
  open.delete(tabId);
  stopClock(o);
  await upsert(o.record);
}

function stopClock(o: Open): void {
  if (o.visibleSince === null) return;
  o.record.dwellMs += Date.now() - o.visibleSince;
  o.visibleSince = null;
}

/**
 * Insert or replace by (startedAt, videoId) in the day bucket. Writes are
 * read-modify-write on one key, so they're serialised through a queue —
 * open/close of adjacent videos fire back to back.
 */
let queue: Promise<void> = Promise.resolve();
function upsert(record: WatchRecord): Promise<void> {
  const snapshot = { ...record };
  queue = queue.then(async () => {
    try {
      const key = keyFor(snapshot.startedAt);
      const got = await chrome.storage.local.get(key);
      const list = (got[key] as WatchRecord[] | undefined) ?? [];
      const i = list.findIndex((r) => r.startedAt === snapshot.startedAt && r.videoId === snapshot.videoId);
      if (i >= 0) list[i] = snapshot;
      else list.push(snapshot);
      await chrome.storage.local.set({ [key]: list });
    } catch (err) {
      // The tally is best-effort; never let it break the pipeline.
      console.warn("[healthyscroll] ledger write failed", err);
    }
  });
  return queue;
}

/** Every record from the last `days` local days (inclusive of today), oldest first. */
export async function getRecords(days: number): Promise<WatchRecord[]> {
  const keys: string[] = [];
  const now = Date.now();
  for (let i = 0; i < days; i++) keys.push(keyFor(now - i * 86_400_000));
  const got = await chrome.storage.local.get(keys);
  return keys
    .reverse()
    .flatMap((k) => (got[k] as WatchRecord[] | undefined) ?? []);
}

/** Drop day buckets older than RETENTION_DAYS. Cheap; run on SW startup. */
export async function prune(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const cutoff = dayKey(Date.now() - RETENTION_DAYS * 86_400_000);
  const stale = Object.keys(all).filter((k) => k.startsWith("watch:") && k.slice(6) < cutoff);
  if (stale.length) await chrome.storage.local.remove(stale);
}

/** Wipe the tally entirely. Exposed in the insights page. */
export async function clearAll(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith("watch:"));
  if (keys.length) await chrome.storage.local.remove(keys);
}
