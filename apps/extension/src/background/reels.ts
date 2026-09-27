import { MIN_CATEGORY_PROBABILITY, type Decision, type UserPolicy, type VideoContext } from "@healthyscroll/shared";
import { sendToTab, type ReelInfo } from "../lib/messages";
import { evaluate } from "./jevClient";
import { recordSkip } from "./sync";
import { rememberCategory } from "./tally";
import { describeAndWait } from "./visionClient";

/**
 * Instagram Reels pipeline. Every Reel is judged as soon as the page loads it —
 * usually several Reels before the viewer gets there — so the decision is
 * waiting when it comes on screen.
 *
 * Jev makes every decision. The vision service only turns the video into text.
 *
 *   in parallel:  Jev on the Reel's text (caption, hashtags, author, audio)  ~300 ms
 *                 vision /describe: frames -> a short description            ~1-3 s cold
 *   a text-only "skip" from Jev skips right away (a slow signal never holds up a
 *   fast one). Once the description is in, Jev runs again on text + description,
 *   and that answer is final.
 *   no description (no media, or the service failed) -> Jev's text answer stands.
 *   any error -> leave the Reel alone (never skip on error).
 *
 * The TikTok pipeline (orchestrator.ts) is separate and unchanged.
 */

export interface Judgement {
  verdict: "skip" | "allow";
  /** What Jev saw when it decided: the Reel's text only, or text + what's on screen. */
  stage: "text" | "visual" | "none";
  reason: string;
  decision?: Decision;
}

interface ReelRecord {
  info: ReelInfo;
  context: VideoContext;
  policyPrompt: string;
  judgement: Promise<Judgement>;
  settled?: Judgement;
}

const reels = new Map<string /* code */, ReelRecord>();
const activeByTab = new Map<number, string>();
const skipped = new Set<string>(); // `${tabId}:${code}`
const MAX_REELS = 500;

// Prefetch sends every Reel in a feed page at once; don't flood the servers.
const MAX_CONCURRENT = 3;
let running = 0;
const queue: (() => void)[] = [];
async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT) await new Promise<void>((r) => queue.push(r));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    queue.shift()?.();
  }
}

export function onReelsDiscovered(tabId: number, infos: ReelInfo[], policy: UserPolicy): void {
  for (const info of infos) judge(info, policy);
  // A Reel can come into view before its data arrives; re-check the active one.
  const active = activeByTab.get(tabId);
  if (active) onReelActive(tabId, active, policy);
}

export function onReelActive(tabId: number, code: string, policy: UserPolicy): void {
  activeByTab.set(tabId, code);
  const record = reels.get(code);
  if (!record) {
    // Either the hook hasn't parsed this Reel yet (onReelsDiscovered will call
    // back), or this background was just (re)started and lost every judgement.
    // Ask the page to send it again; judge() dedupes if both arrive.
    console.log(`[reels] active ${code}: no data, asking the page for it`);
    sendToTab(tabId, { type: "REEL_WANTED", code }).catch(() => {});
    return;
  }
  // Policy edited since this Reel was judged -> judge again.
  const current = record.policyPrompt === policy.prompt ? record : judge(record.info, policy, true);
  console.log(
    `[reels] active ${code}: ${
      current !== record ? "policy changed, judging again" : current.settled ? `already ${current.settled.verdict} (${current.settled.stage}) ${current.settled.reason}` : "still judging"
    }`,
  );
  void current.judgement.then(async (j) => {
    if (j.verdict !== "skip" || activeByTab.get(tabId) !== code) return;
    // One skip per Reel per tab: a second message mid-scroll would skip two Reels.
    const key = `${tabId}:${code}`;
    if (skipped.has(key)) return;
    skipped.add(key);
    if (skipped.size > MAX_REELS) skipped.delete(skipped.values().next().value!);
    console.log(`[reels] skip ${code} (${j.stage}): ${j.reason}`);
    try {
      await sendToTab(tabId, { type: "SKIP_REEL", code, reason: j.reason });
      if (j.decision) void recordSkip(current.context, j.decision);
    } catch (err) {
      console.warn("[reels] skip message failed", err);
    }
  });
}

export function forgetTab(tabId: number): void {
  activeByTab.delete(tabId);
}

function judge(info: ReelInfo, policy: UserPolicy, force = false): ReelRecord {
  const existing = reels.get(info.code);
  if (existing && !force && existing.policyPrompt === policy.prompt) return existing;

  const context = toContext(info);
  const record: ReelRecord = {
    info,
    context,
    policyPrompt: policy.prompt,
    judgement: limited(() => decide(info, context, policy)).catch((err) => {
      console.error("[reels] judge failed", info.code, err);
      return { verdict: "allow", stage: "none", reason: "error" } as Judgement;
    }),
  };
  void record.judgement.then((j) => {
    record.settled = j;
    console.log(`[reels] ${info.code} -> ${j.verdict} (${j.stage}) ${j.reason}`);
  });
  reels.set(info.code, record);
  if (reels.size > MAX_REELS) reels.delete(reels.keys().next().value!);
  return record;
}

/** Jev's category for the tally ("Your week"); a low-confidence guess counts as "other". */
function noteCategory(code: string, decision: Decision): void {
  const c = decision.category;
  if (c) rememberCategory(code, c.probability >= MIN_CATEGORY_PROBABILITY ? c.label : "other");
}

async function decide(info: ReelInfo, context: VideoContext, policy: UserPolicy): Promise<Judgement> {
  if (!policy.enabled) {
    return { verdict: "allow", stage: "none", reason: "filter off" };
  }
  if (!policy.prompt.trim()) {
    // Switched on with no prompt: nothing to skip, but still ask Jev what the Reel is
    // about so "Your week" works. The server forces allow when there's no policy.
    const d = await evaluate({ policy: { prompt: "" }, context });
    noteCategory(info.code, d);
    return { verdict: "allow", stage: "none", reason: "no policy (category only)" };
  }

  const hasMedia = Boolean(info.manifest || info.videoUrl);
  const t0 = performance.now();
  const ms = () => `${Math.round(performance.now() - t0)}ms`;

  console.log(`[reels] ${info.code} jev(text) ->`);
  const textP = evaluate({ policy: { prompt: policy.prompt }, context });
  // The category rides on the text pass; keep it whichever pass decides.
  textP.then((d) => noteCategory(info.code, d), () => {});
  textP.then(
    (d) => console.log(`[reels] ${info.code} jev(text) <- ${d.verdict} p=${d.violatesProbability.toFixed(2)} in ${ms()}`),
    (err) => console.warn(`[reels] ${info.code} jev(text) failed after ${ms()}`, err),
  );

  // What's on screen, as text. Never throws: null means Jev goes on the Reel's text alone.
  let descriptionP: Promise<string | null> = Promise.resolve(null);
  if (hasMedia) {
    console.log(`[reels] ${info.code} vision ->`, info.manifest ? "manifest" : "videoUrl");
    descriptionP = describeAndWait({
      videoId: info.id,
      platform: "instagram",
      // Prefer the manifest: the server range-fetches only what it needs.
      ...(info.manifest ? { manifest: info.manifest } : { videoUrl: info.videoUrl }),
      posterUrl: info.posterUrl,
    }).then(
      (description) => {
        console.log(`[reels] ${info.code} vision <- ${description ? `"${description}"` : "no description"} in ${ms()}`);
        return description;
      },
      (err) => {
        console.warn(`[reels] ${info.code} vision failed after ${ms()}`, err);
        return null;
      },
    );
  } else {
    console.log(`[reels] ${info.code} vision skipped: no media`);
  }

  // Jev on text + description is the final word; it needs the description first.
  const fullP = descriptionP.then(async (description): Promise<Judgement | null> => {
    if (!description) return null;
    try {
      console.log(`[reels] ${info.code} jev(text+description) ->`);
      const d = await evaluate({
        policy: { prompt: policy.prompt },
        context,
        frames: [{ videoId: info.id, atMs: 0, caption: description }],
      });
      console.log(`[reels] ${info.code} jev(text+description) <- ${d.verdict} p=${d.violatesProbability.toFixed(2)} in ${ms()}`);
      return {
        verdict: d.verdict === "skip" ? "skip" : "allow",
        stage: "visual",
        reason: `text+frames p=${d.violatesProbability.toFixed(2)}: ${description.slice(0, 80)}`,
        decision: { ...d, stage: "visual" },
      };
    } catch (err) {
      console.warn("[reels] text+frames pass failed", info.code, err);
      return null;
    }
  });

  // A text-only skip is enough to act on; don't wait for the video to be described.
  const textSkip = textP.then((d): Judgement => {
    if (d.verdict !== "skip") throw new Error("not skip");
    return {
      verdict: "skip",
      stage: "text",
      reason: `text p=${d.violatesProbability.toFixed(2)}`,
      decision: { ...d, stage: "text" },
    };
  });
  const fullSkip = fullP.then((j): Judgement => {
    if (j?.verdict !== "skip") throw new Error("not skip");
    return j;
  });
  const firstSkip = await Promise.any([textSkip, fullSkip]).catch(() => null);
  if (firstSkip) return firstSkip;

  const [text, full] = await Promise.allSettled([textP, fullP]);
  if (full.status === "fulfilled" && full.value) return full.value;
  if (text.status === "fulfilled") {
    return { verdict: "allow", stage: "text", reason: `text p=${text.value.violatesProbability.toFixed(2)}, no description` };
  }
  return { verdict: "allow", stage: "none", reason: "Jev unavailable" };
}

function toContext(info: ReelInfo): VideoContext {
  const caption = info.caption ?? "";
  return {
    videoId: info.id,
    platform: "instagram",
    url: `https://www.instagram.com/reel/${info.code}/`,
    author: info.author,
    description: caption || undefined,
    hashtags: [...caption.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1]),
    audioTitle: info.audioTitle,
  };
}
