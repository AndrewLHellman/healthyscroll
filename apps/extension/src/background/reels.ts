import type { Decision, UserPolicy, VideoContext } from "@healthyscroll/shared";
import { sendToTab, type ReelInfo } from "../lib/messages";
import { evaluate } from "./jevClient";
import { recordSkip } from "./sync";
import { analyze, waitForCaption } from "./visionClient";

/**
 * Instagram Reels pipeline. Every Reel is judged as soon as the page loads it —
 * usually several Reels before the viewer gets there — so the decision is
 * waiting when it comes on screen.
 *
 *   in parallel:  Jev on text (caption, hashtags, author, audio)      ~300 ms
 *                 vision /analyze: SigLIP on frames (cached per Reel)  ~1 s cold
 *   skip as soon as either says skip (a slow one never holds up a fast one).
 *   vision already resolves its own "uncertain" with its VLM (deep: true), so it
 *                 normally answers skip/allow. Only if the server has no VLM
 *                 does it stay "uncertain": then wait for the Reel's caption and
 *                 let Jev decide from it.
 *   anything else, or any error -> leave the Reel alone (never skip on error).
 *
 * The TikTok pipeline (orchestrator.ts) is separate and unchanged.
 */

export interface Judgement {
  verdict: "skip" | "allow";
  /** Which signal decided: text-only Jev, SigLIP, or Jev on the Reel's caption. */
  stage: "text" | "visual" | "caption" | "none";
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
  if (!record) return; // no media data yet; onReelsDiscovered will call back
  // Policy edited since this Reel was judged -> judge again.
  const current = record.policyPrompt === policy.prompt ? record : judge(record.info, policy, true);
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

async function decide(info: ReelInfo, context: VideoContext, policy: UserPolicy): Promise<Judgement> {
  if (!policy.enabled || !policy.prompt.trim()) {
    return { verdict: "allow", stage: "none", reason: "filter off or no policy" };
  }

  const hasMedia = Boolean(info.manifest || info.videoUrl);
  const textP = evaluate({ policy: { prompt: policy.prompt }, context });
  const visionP = hasMedia
    ? analyze({
        videoId: info.id,
        platform: "instagram",
        policy: policy.prompt,
        // Prefer the manifest: the server range-fetches only what it needs.
        ...(info.manifest ? { manifest: info.manifest } : { videoUrl: info.videoUrl }),
        posterUrl: info.posterUrl,
        // If the fast frame score is unsure, the server's VLM settles it in the same call.
        deep: true,
      })
    : Promise.reject(new Error("no media in capture"));
  textP.catch((err) => console.warn("[reels] text pass failed", info.code, err));
  visionP.catch((err) => console.warn("[reels] vision failed", info.code, err));

  // Skip on whichever answers "skip" first; don't let a slow signal hold up a fast one.
  const textSkip = textP.then((d): Judgement => {
    if (d.verdict !== "skip") throw new Error("not skip");
    return {
      verdict: "skip",
      stage: "text",
      reason: `text p=${d.violatesProbability.toFixed(2)}`,
      decision: { ...d, stage: "text" },
    };
  });
  const visionSkip = visionP.then((v): Judgement => {
    if (v.verdict !== "skip") throw new Error("not skip");
    return {
      verdict: "skip",
      stage: "visual",
      reason:
        v.deepProbability != null
          ? `VLM p=${v.deepProbability.toFixed(2)} (frames unsure)`
          : `frames matched ${v.matched ?? "policy"}`,
      decision: {
        videoId: info.id,
        verdict: "skip",
        violatesProbability: v.violatesProbability,
        stage: "visual",
        latencyMs: v.totalMs,
      },
    };
  });
  const firstSkip = await Promise.any([textSkip, visionSkip]).catch(() => null);
  if (firstSkip) return firstSkip;

  // Neither said skip. Vision only stays "uncertain" when the server has no VLM to
  // settle it; then it's captioning the Reel, and Jev makes the call from that.
  const [text, vision] = await Promise.allSettled([textP, visionP]);
  if (vision.status === "fulfilled" && vision.value.verdict === "uncertain") {
    const v = vision.value;
    const caption =
      v.captionStatus === "ready" && v.caption ? v.caption : await waitForCaption("instagram", info.id);
    if (caption) {
      try {
        const withCaption = await evaluate({
          policy: { prompt: policy.prompt },
          context,
          frames: [{ videoId: info.id, atMs: 0, caption }],
        });
        if (withCaption.verdict === "skip") {
          return {
            verdict: "skip",
            stage: "caption",
            reason: `caption p=${withCaption.violatesProbability.toFixed(2)}: ${caption.slice(0, 80)}`,
            // The skips table knows text/visual/monitor; a caption is a visual signal.
            decision: { ...withCaption, stage: "visual" },
          };
        }
        return { verdict: "allow", stage: "caption", reason: `caption p=${withCaption.violatesProbability.toFixed(2)}` };
      } catch (err) {
        console.warn("[reels] caption pass failed (Jev unavailable?)", info.code, err);
      }
    }
  }

  const tp = text.status === "fulfilled" ? text.value.violatesProbability.toFixed(2) : "failed";
  const vv = vision.status === "fulfilled" ? vision.value.verdict : "failed";
  return { verdict: "allow", stage: "none", reason: `text p=${tp}, vision ${vv}` };
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
