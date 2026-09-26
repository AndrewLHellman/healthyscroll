import {
  MAX_FRAMES_PER_VIDEO,
  MONITOR_INTERVAL_MS,
  type Decision,
  type FrameDescription,
  type UserPolicy,
  type VideoContext,
} from "@healthyscroll/shared";
import { evaluate } from "./jevClient";
import * as moondream from "./moondreamClient";
import { captureFrame } from "./frameCapture";
import { sendToTab } from "../lib/messages";

/**
 * The decision pipeline, per video. See docs/DECISION_PIPELINE.md.
 *
 *   1. text pass     — Jev on DOM text only. Instant skip/allow if confident.
 *   2. visual pass   — if uncertain: capture frame → Moondream caption → Jev again.
 *   3. monitor       — while the video plays: repeat (2) every MONITOR_INTERVAL_MS,
 *                      up to MAX_FRAMES_PER_VIDEO, so mid-video changes still get caught.
 *
 * One Session per tab. A new VIDEO_CHANGED cancels the previous session.
 */

interface Session {
  tabId: number;
  windowId: number;
  context: VideoContext;
  policy: UserPolicy;
  frames: FrameDescription[];
  startedAt: number;
  cancelled: boolean;
}

const sessions = new Map<number /* tabId */, Session>();

export async function onVideoChanged(
  tabId: number,
  windowId: number,
  context: VideoContext,
  policy: UserPolicy,
): Promise<void> {
  cancel(tabId);
  if (!policy.enabled || !policy.prompt.trim()) return;

  const session: Session = {
    tabId,
    windowId,
    context,
    policy,
    frames: [],
    startedAt: Date.now(),
    cancelled: false,
  };
  sessions.set(tabId, session);

  // Stage 1 — fast text-only decision.
  const textDecision = await runJev(session, "text");
  if (session.cancelled) return;
  if (await applyDecision(session, textDecision)) return;

  // Stage 2/3 — visual pass now, then keep monitoring while it plays.
  if (!(await moondream.isAvailable())) {
    // No local VLM: we can't do better than the text pass. Leave the video alone.
    return;
  }
  await monitorLoop(session, textDecision.verdict === "uncertain" ? 0 : MONITOR_INTERVAL_MS);
}

export function cancel(tabId: number): void {
  const s = sessions.get(tabId);
  if (s) s.cancelled = true;
  sessions.delete(tabId);
}

async function monitorLoop(session: Session, initialDelayMs: number): Promise<void> {
  await sleep(initialDelayMs);
  while (!session.cancelled && session.frames.length < MAX_FRAMES_PER_VIDEO) {
    const frame = await describeCurrentFrame(session);
    if (session.cancelled) return;
    session.frames.push(frame);

    const decision = await runJev(session, session.frames.length === 1 ? "visual" : "monitor");
    if (session.cancelled) return;
    if (await applyDecision(session, decision)) return;

    await sleep(MONITOR_INTERVAL_MS);
  }
}

async function describeCurrentFrame(session: Session): Promise<FrameDescription> {
  const imageDataUrl = await captureFrame(session.windowId);
  const atMs = Date.now() - session.startedAt;
  // Caption is generic; the policy-specific query gives Jev a directly relevant signal.
  const [caption, policyAnswer] = await Promise.all([
    moondream.caption({ imageDataUrl, length: "short" }),
    moondream.query({
      imageDataUrl,
      question: `A user does not want to see: "${session.policy.prompt}". Describe anything in this image related to that, or say "nothing relevant".`,
    }),
  ]);
  return { videoId: session.context.videoId, atMs, caption, policyAnswer };
}

async function runJev(session: Session, stage: Decision["stage"]): Promise<Decision> {
  const decision = await evaluate({
    policy: { prompt: session.policy.prompt },
    context: session.context,
    frames: stage === "text" ? undefined : session.frames,
  });
  return { ...decision, stage };
}

/** Sends the decision to the tab. Returns true if the session is finished (skipped or confidently allowed w/o vision). */
async function applyDecision(session: Session, decision: Decision): Promise<boolean> {
  if (decision.verdict === "skip") {
    await sendToTab(session.tabId, { type: "SKIP_VIDEO", videoId: session.context.videoId, decision });
    cancel(session.tabId);
    return true;
  }
  await sendToTab(session.tabId, { type: "DECISION", decision });
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
