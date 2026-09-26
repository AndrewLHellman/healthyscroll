"use client";

import { useEffect, useState } from "react";
import { Footage } from "./Footage";
import { PixelHeart } from "./Mark";

/**
 * Looping, scripted trace of the real pipeline: a mock feed card on the left,
 * the decision log on the right. Probabilities are shown on a meter with the
 * two thresholds (0.2 / 0.8) so the mechanism is visible without explanation.
 *
 * Under prefers-reduced-motion it renders one fully-resolved frame, static.
 */

const POLICY = "gambling, drinking, thirst-trap content";

type Verdict = "skip" | "keep" | "look";

interface Clip {
  author: string;
  desc: string;
  sound: string;
  /** Two-stop gradient standing in for the video. */
  tone: [string, string];
  text: { p: number; ms: number };
  visual?: { caption: string; p: number; ms: number };
}

const CLIPS: Clip[] = [
  {
    author: "spinsdaily",
    desc: "late night spins hit different 🎰 #slots #bigwin",
    sound: "original sound",
    tone: ["#3b1d5a", "#0f0c1a"],
    text: { p: 0.96, ms: 184 },
  },
  {
    author: "trail.mornings",
    desc: "6am loop before work. always worth it",
    sound: "Avril 14th · Aphex Twin",
    tone: ["#d9c7a3", "#5e6a4e"],
    text: { p: 0.03, ms: 171 },
    visual: { caption: "a person running on a dirt trail at sunrise, trees on both sides", p: 0.02, ms: 1240 },
  },
  {
    author: "saturday.recap",
    desc: "and that was the night 🍾",
    sound: "trending audio",
    tone: ["#1b2a44", "#0a0e17"],
    text: { p: 0.54, ms: 203 },
    visual: { caption: "a crowded bar, several people holding drinks and shot glasses", p: 0.92, ms: 1310 },
  },
  {
    author: "ana.bakes",
    desc: "focaccia, day 3. the dimples are the whole point",
    sound: "Kitchen sounds",
    tone: ["#e8b27a", "#7a4a22"],
    text: { p: 0.02, ms: 158 },
    visual: { caption: "hands pressing dimples into bread dough on a wooden counter", p: 0.01, ms: 1190 },
  },
];

interface Line {
  stage: "text" | "visual";
  model: "jev" | "moondream";
  body: string;
  p?: number;
  ms?: number;
  verdict?: Verdict;
  pending?: boolean;
}

interface Frame {
  clip: number;
  lines: Line[];
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

    const textPending: Line = { stage: "text", model: "jev", body: "reading caption, tags, sound…", pending: true };
    const textDone: Line = {
      stage: "text",
      model: "jev",
      body: "does this match the policy?",
      p: c.text.p,
      ms: c.text.ms,
      verdict: verdictOf(c.text.p),
    };

    push([], 520);
    push([textPending], 260);
    push([textDone], textDone.verdict === "skip" ? 900 : 700);

    if (textDone.verdict === "skip") {
      push([textDone], 520, "out", true);
      return;
    }

    if (c.visual) {
      const mdPending: Line = { stage: "visual", model: "moondream", body: "describing frame on device…", pending: true };
      const mdDone: Line = { stage: "visual", model: "moondream", body: `“${c.visual.caption}”` };
      const jevDone: Line = {
        stage: "visual",
        model: "jev",
        body: "with the frame described, does it match?",
        p: c.visual.p,
        ms: c.visual.ms,
        verdict: verdictOf(c.visual.p),
      };
      push([textDone, mdPending], 900);
      push([textDone, mdDone], 600);
      push([textDone, mdDone, jevDone], jevDone.verdict === "skip" ? 900 : 1500);
      if (jevDone.verdict === "skip") {
        push([textDone, mdDone, jevDone], 520, "out", true);
        return;
      }
      // Kept: the user watches, then scrolls on themselves.
      push([textDone, mdDone, jevDone], 480, "out", false);
      return;
    }

    push([textDone], 480, "out", false);
  });
  return frames;
}

const FRAMES = buildFrames();
/** The most legible single frame for the static (reduced-motion / SSR-first) render. */
const STATIC_FRAME = FRAMES.findLast((f) => f.clip === 2 && f.lines.length === 3 && f.card === "in")!;

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
      aria-label="Animated demo: a TikTok video appears; Healthy Scroll reads its caption, asks Jev for a probability, optionally describes the frame with Moondream on device, and skips the video if it matches the user's policy."
    >
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,260px)_1fr]">
        <FeedCard clip={clip} card={frame.card} skipped={frame.skipped || i === null} clipIndex={frame.clip} />
        <Trace lines={frame.lines} clip={clip} />
      </div>
    </div>
  );
}

function FeedCard({
  clip,
  card,
  skipped,
  clipIndex,
}: {
  clip: Clip;
  card: Frame["card"];
  skipped: boolean;
  clipIndex: number;
}) {
  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-xl bg-ink lg:mx-0">
      <Footage
        key={clipIndex}
        tone={clip.tone}
        className={`absolute inset-0 animate-rise transition-all duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)] ${
          card === "out" ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-16 text-white">
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
      </Footage>

      <div
        className={`absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-skip px-3 py-1 font-mono text-[11px] font-medium text-white shadow-lg transition-all duration-300 ${
          skipped ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
        }`}
      >
        skipped
      </div>
    </div>
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
          <li key={idx} className="grid grid-cols-[64px_1fr] gap-3 animate-fade-up">
            <span className="pt-px text-[11px] uppercase tracking-wider text-faint">{l.stage}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className={l.model === "jev" ? "text-accent-ink" : "text-muted"}>{l.model}</span>
                <span className={`min-w-0 ${l.pending ? "text-faint" : "text-ink"}`}>
                  {l.body}
                  {l.pending && <Dots />}
                </span>
              </div>
              {l.p !== undefined && l.verdict && (
                <Meter p={l.p} verdict={l.verdict} ms={l.ms} />
              )}
            </div>
          </li>
        ))}
        {lines.length === 0 && (
          <li className="text-faint">
            new video
            <Dots />
          </li>
        )}
      </ol>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3 text-[11px] text-faint">
        <span>frames stay on this laptop</span>
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
