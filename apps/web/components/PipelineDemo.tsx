"use client";

import { useEffect, useState } from "react";
import { Footage } from "./Footage";
import { PixelHeart } from "./Mark";

/**
 * Looping, scripted trace of the real pipeline: a Reels-style feed on the left
 * that actually swipes, the decision log on the right. Mirrors
 * apps/extension/src/background/reels.ts:
 *
 *   text    Jev reads caption, tags, sound                       (~200 ms)
 *   frames  vision service checks a few frames vs. the prompt    (SigLIP 2, ~1 s)
 *   closer  only if frames are unsure: a VLM looks again         (Qwen3-VL, ~0.5 s)
 *
 * First "skip" wins and the feed swipes itself; otherwise the viewer watches and
 * swipes on. Probabilities sit on a meter with the two thresholds (0.2 / 0.8).
 * Covers are the real Reels in public/playground/ (same as the playground);
 * handles and captions are illustrative, written to match each cover.
 *
 * Under prefers-reduced-motion it renders one fully-resolved frame, static.
 */

const POLICY = "gambling, drinking, thirst-trap content";

type Verdict = "skip" | "keep" | "look";
type Stage = "text" | "frames" | "closer";

interface Clip {
  author: string;
  desc: string;
  sound: string;
  image: string;
  /** Fallback under the image while it loads. */
  tone: [string, string];
  text: { p: number; ms: number };
  frames?: { body: string; p: number; ms: number };
  closer?: { body: string; p: number; ms: number };
}

const CLIPS: Clip[] = [
  {
    // Caption says it all: text alone skips it before the frames finish.
    author: "casino.nights",
    desc: "slot wins all night 🎰 #slots #casino",
    sound: "original audio",
    image: "/playground/gambling.jpg",
    tone: ["#3b1d5a", "#0f0c1a"],
    text: { p: 0.96, ms: 184 },
  },
  {
    // Nothing to catch: the viewer watches, then swipes on.
    author: "boardwalk.miles",
    desc: "what people see vs. what it feels like 😅 #running",
    sound: "original audio",
    image: "/playground/run.jpg",
    tone: ["#d9c7a3", "#5e6a4e"],
    text: { p: 0.03, ms: 171 },
    frames: { body: "runners on a seaside path · no match", p: 0.02, ms: 940 },
  },
  {
    // Vague caption, unsure frames: the VLM reads the on-screen text and settles it.
    author: "friday.moods",
    desc: "me every friday 😂",
    sound: "trending audio",
    image: "/playground/drinking.jpg",
    tone: ["#1b2a44", "#0a0e17"],
    text: { p: 0.44, ms: 203 },
    frames: { body: "a man in a bar · unsure", p: 0.46, ms: 1010 },
    closer: { body: "on-screen text: “me after 3 margaritas” → drinking", p: 0.91, ms: 520 },
  },
  {
    // Caption is harmless; the frames give it away.
    author: "lift.with.jay",
    desc: "pump was unreal today 💪",
    sound: "phonk mix",
    image: "/playground/thirst-trap.jpg",
    tone: ["#2b2b2b", "#0d0d0d"],
    text: { p: 0.58, ms: 190 },
    frames: { body: "shirtless posing, frame 2 · matches thirst-trap", p: 0.9, ms: 980 },
  },
  {
    author: "weeknight.eats",
    desc: "flatbread + butter chicken in 30 min 🔥",
    sound: "Kitchen sounds",
    image: "/playground/food.jpg",
    tone: ["#e8b27a", "#7a4a22"],
    text: { p: 0.02, ms: 158 },
    frames: { body: "flatbread on a tray · no match", p: 0.01, ms: 900 },
  },
];

const MODEL: Record<Stage, string> = { text: "jev", frames: "siglip", closer: "qwen-vl" };

interface Line {
  stage: Stage;
  body: string;
  p?: number;
  ms?: number;
  verdict?: Verdict;
  pending?: boolean;
}

interface Frame {
  clip: number;
  lines: Line[];
  /** "out": the current Reel is swiping up and the next one is coming in. */
  card: "in" | "out";
  skipped: boolean;
  hold: number;
}

function verdictOf(p: number): Verdict {
  if (p >= 0.8) return "skip";
  if (p <= 0.2) return "keep";
  return "look";
}

/** Expand the script into timed frames. Built once at module load. */
function buildFrames(): Frame[] {
  const frames: Frame[] = [];
  CLIPS.forEach((c, i) => {
    const push = (lines: Line[], hold: number, card: Frame["card"] = "in", skipped = false) =>
      frames.push({ clip: i, lines, card, skipped, hold });

    const done = (stage: Stage, body: string, r: { p: number; ms: number }): Line => ({
      stage,
      body,
      p: r.p,
      ms: r.ms,
      verdict: verdictOf(r.p),
    });

    const textPending: Line = { stage: "text", body: "reading caption, tags, sound…", pending: true };
    const textDone = done("text", "does this match the prompt?", c.text);
    const framesPending: Line = { stage: "frames", body: "checking frames…", pending: true };

    push([], 520);
    // Both start at once; text usually answers first.
    push(c.frames ? [textPending, framesPending] : [textPending], 280);
    if (textDone.verdict === "skip") {
      push([textDone], 900);
      push([textDone], 560, "out", true);
      return;
    }
    if (!c.frames) {
      push([textDone], 1300);
      push([textDone], 700, "out");
      return;
    }

    const framesDone = done("frames", c.frames.body, c.frames);
    push([textDone, framesPending], 700);
    push([textDone, framesDone], framesDone.verdict === "look" ? 700 : framesDone.verdict === "skip" ? 900 : 1300);

    let lines = [textDone, framesDone];
    let verdict = framesDone.verdict;
    if (verdict === "look" && c.closer) {
      const closerPending: Line = { stage: "closer", body: "frames unsure · taking a closer look…", pending: true };
      const closerDone = done("closer", c.closer.body, c.closer);
      push([...lines, closerPending], 800);
      lines = [...lines, closerDone];
      verdict = closerDone.verdict;
      push(lines, verdict === "skip" ? 1000 : 1300);
    }

    if (verdict === "skip") push(lines, 560, "out", true);
    // Kept: the viewer watches a bit longer, then swipes on themselves.
    else push(lines, 700, "out", false);
  });
  return frames;
}

const FRAMES = buildFrames();
/** The most legible single frame for the static (reduced-motion / SSR-first) render: the three-stage one. */
const STATIC_FRAME = FRAMES.findLast((f) => f.clip === 2 && f.lines.length === 3 && !f.lines[2].pending)!;

export function PipelineDemo() {
  const [i, setI] = useState<number | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let idx = 0;
    let t: number;
    const tick = () => {
      setI(idx);
      t = window.setTimeout(() => {
        idx = (idx + 1) % FRAMES.length;
        tick();
      }, FRAMES[idx].hold);
    };
    tick();
    return () => window.clearTimeout(t);
  }, []);

  const frame = i === null ? STATIC_FRAME : FRAMES[i];
  const clip = CLIPS[frame.clip];

  return (
    <div
      className="rounded-2xl border border-line bg-mist p-3 sm:p-4"
      role="img"
      aria-label="Animated demo: a feed of Reels. For each one, Healthy Scroll asks Jev about its caption and checks its frames against the prompt; if the frames are unsure a vision model takes a closer look. Reels that match the prompt are swiped away automatically."
    >
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,260px)_1fr]">
        <Feed frame={frame} still={i === null} />
        <Trace lines={frame.lines} clip={clip} />
      </div>
    </div>
  );
}

/**
 * A vertical Reels feed. Every clip is a full-height card positioned by its
 * distance from the current one: current at 0, next just below. On "out" both
 * move up together, which is the swipe. Cards further away sit offscreen below
 * with no transition, so the loop back to the first clip never slides across.
 */
function Feed({ frame, still }: { frame: Frame; still: boolean }) {
  const n = CLIPS.length;
  const out = frame.card === "out";
  const skipped = frame.skipped || still;

  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-xl bg-ink lg:mx-0">
      {CLIPS.map((clip, idx) => {
        const offset = (idx - frame.clip + n) % n;
        const y = offset === 0 ? (out ? "-100%" : "0%") : offset === 1 ? (out ? "0%" : "100%") : "100%";
        const moving = offset <= 1;
        const current = offset === 0;
        return (
          <div
            key={clip.author}
            className="absolute inset-0"
            style={{
              transform: `translateY(${y})`,
              // A skip is a quick flick; the viewer's own swipe is a little slower.
              transition: moving
                ? `transform ${frame.skipped ? 420 : 560}ms cubic-bezier(0.2, 0.7, 0.2, 1)`
                : "none",
            }}
            aria-hidden={!current}
          >
            <Card clip={clip} playing={current && !out && !still} dimmed={current && skipped && (out || still)} />
          </div>
        );
      })}

      <div
        className={`absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-skip px-3 py-1 font-mono text-[11px] font-medium text-white shadow-lg transition-all duration-300 ${
          skipped && (out || still) ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
        }`}
      >
        skipped
      </div>
      <div
        className={`absolute bottom-24 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 font-mono text-[10px] text-white backdrop-blur transition-opacity duration-300 ${
          out && !frame.skipped ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
      >
        ↑ you swiped
      </div>
    </div>
  );
}

function Card({ clip, playing, dimmed }: { clip: Clip; playing: boolean; dimmed: boolean }) {
  return (
    <Footage
      tone={clip.tone}
      image={clip.image}
      className={`h-full w-full transition-[filter] duration-300 ${dimmed ? "brightness-75 grayscale" : ""}`}
    >
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4 pt-16 text-white">
        <p className="text-sm font-semibold">@{clip.author}</p>
        <p className="mt-1 text-sm leading-snug text-white/90">{clip.desc}</p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-white/70">
          <span aria-hidden>♪</span> {clip.sound}
        </p>
      </div>
      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-4 text-white/85" aria-hidden>
        {[<PixelHeart key="h" size={18} color="#fff" />, "💬", "↗"].map((g, k) => (
          <span key={k} className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-sm backdrop-blur">
            {g}
          </span>
        ))}
      </div>
      {/* Playback progress, like the thin bar at the bottom of a Reel. */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/20" aria-hidden>
        <div
          className="h-full bg-white/80"
          style={{
            width: playing ? "100%" : "0%",
            transition: playing ? "width 6s linear" : "none",
          }}
        />
      </div>
    </Footage>
  );
}

function Trace({ lines, clip }: { lines: Line[]; clip: Clip }) {
  return (
    <div className="flex min-h-[300px] flex-col rounded-xl border border-line bg-paper p-4 font-mono text-[13px] leading-relaxed sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3 text-xs">
        <span className="text-muted">
          skip anything that’s <span className="text-ink">{POLICY}</span>
        </span>
        <span className="text-faint">@{clip.author}</span>
      </div>

      <ol className="mt-3 flex flex-col gap-3">
        {lines.map((l, idx) => (
          <li key={`${l.stage}-${l.pending ? "p" : "d"}`} className="grid grid-cols-[64px_1fr] gap-3 animate-fade-up">
            <span className="pt-px text-[11px] uppercase tracking-wider text-faint">{l.stage}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className={l.stage === "text" ? "text-accent-ink" : "text-muted"}>{MODEL[l.stage]}</span>
                <span className={`min-w-0 ${l.pending ? "text-faint" : "text-ink"}`}>
                  {l.body}
                  {l.pending && <Dots />}
                </span>
              </div>
              {l.p !== undefined && l.verdict && <Meter p={l.p} verdict={l.verdict} ms={l.ms} />}
            </div>
          </li>
        ))}
        {lines.length === 0 && (
          <li className="text-faint">
            new reel
            <Dots />
          </li>
        )}
      </ol>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3 text-[11px] text-faint">
        <span>frames checked on our server, never stored</span>
        <span className="flex items-center gap-3">
          <Key color="bg-keep" label="keep" />
          <Key color="bg-faint" label="look closer" />
          <Key color="bg-skip" label="skip" />
        </span>
      </div>
    </div>
  );
}

const CELLS = 10;

function Meter({ p, verdict, ms }: { p: number; verdict: Verdict; ms?: number }) {
  const color = verdict === "skip" ? "bg-skip" : verdict === "keep" ? "bg-keep" : "bg-faint";
  const textColor = verdict === "skip" ? "text-skip" : verdict === "keep" ? "text-keep" : "text-muted";
  const lit = Math.round(p * CELLS);
  return (
    <div className="mt-2 flex items-center gap-3">
      {/* Ten cells, like a health bar. Cells 1–2 are "keep", 9–10 are "skip", the middle is "look closer". */}
      <div className="flex flex-1 gap-px" aria-hidden>
        {Array.from({ length: CELLS }, (_, k) => (
          <span
            key={k}
            className={`h-2 flex-1 transition-colors duration-300 ${k < lit ? color : "bg-mist"} ${
              k === 2 || k === 8 ? "ml-1" : ""
            }`}
          />
        ))}
      </div>
      <span className="w-10 text-right tabular-nums text-ink">{p.toFixed(2)}</span>
      <span className={`w-20 whitespace-nowrap ${textColor}`}>{verdict === "look" ? "look closer" : verdict}</span>
      {ms !== undefined && (
        <span className="hidden w-14 text-right tabular-nums text-faint sm:inline">
          {ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`}
        </span>
      )}
    </div>
  );
}

function Dots() {
  return (
    <span className="inline-flex w-4 justify-start" aria-hidden>
      <span className="animate-pulse">…</span>
    </span>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
