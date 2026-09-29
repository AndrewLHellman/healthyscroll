"use client";

import { useEffect, useState } from "react";
import { Footage } from "./Footage";

/**
 * Looping, scripted trace of the real pipeline: a Reels-style feed on the left
 * that actually swipes, the decision log on the right. Probabilities are shown
 * on a meter with the two thresholds (0.2 / 0.8) so the mechanism is visible
 * without explanation. The Reels are real, from public/playground/ (same as the
 * prompt playground), muted and looping, with their real handles and captions;
 * probabilities, timings, descriptions and the transcript are illustrative.
 *
 * Three stages, like reels.ts: Jev on the text; Jev again once Gemini has
 * described the images; and, only when that still lands in the middle band,
 * ElevenLabs transcribes what's said and Jev decides with the transcript.
 *
 * Under prefers-reduced-motion it renders one fully-resolved frame, static.
 */

const POLICY = "gambling, drinking, thirst-trap content";

type Verdict = "skip" | "keep" | "look";

interface Clip {
  author: string;
  desc: string;
  sound: string;
  /** Real Reel, by file name in public/playground/ (`<reel>.jpg` cover, `<reel>.mp4` clip). */
  reel: string;
  /** Fallback under the cover while it loads. */
  tone: [string, string];
  text: { p: number; ms: number };
  visual?: { caption: string; p: number; ms: number };
  /** Last resort, only reached when `visual` is still "look closer". */
  audio?: { transcript: string; p: number; ms: number };
}

const CLIPS: Clip[] = [
  {
    author: "missluckycharm77",
    desc: "Slot wins! #slots #casino #gambling",
    sound: "original sound",
    reel: "gambling",
    tone: ["#3b1d5a", "#0f0c1a"],
    text: { p: 0.96, ms: 184 },
  },
  {
    author: "akak_akram",
    desc: "Same direction. Same pace. Same mission. #running #motivation",
    sound: "Avril 14th · Aphex Twin",
    reel: "run",
    tone: ["#d9c7a3", "#5e6a4e"],
    text: { p: 0.03, ms: 171 },
    visual: { caption: "two men running along a seaside promenade; on-screen text: ‘What people see:’", p: 0.02, ms: 1240 },
  },
  {
    author: "daveyboyyyyyy",
    desc: "Spicy margs> #reels #drinks #memes",
    sound: "trending audio",
    reel: "drinking",
    tone: ["#1b2a44", "#0a0e17"],
    text: { p: 0.54, ms: 203 },
    visual: { caption: "a man in a busy bar; on-screen text: ‘Also me after 3 margaritas’", p: 0.92, ms: 1310 },
  },
  {
    // Is a crypto Reel "gambling"? Text and images can't settle it; what he says can.
    author: "overkilltrading",
    desc: "CRYPTO BULL RUN LOADING 📈 JULY 11",
    sound: "original sound",
    reel: "crypto",
    tone: ["#0e3b2e", "#03110c"],
    text: { p: 0.46, ms: 192 },
    visual: { caption: "a trading chart on a monitor; on-screen text: ‘CRYPTO IS ABOUT TO EXPLODE!’", p: 0.57, ms: 1280 },
    audio: {
      transcript: "…I put my whole paycheck on this one. Is it a coin flip? Sure. But if it hits, I never work again…",
      p: 0.91,
      ms: 2860,
    },
  },
  {
    author: "kookmutsjes",
    desc: "• FLATBREAD MET BUTTER CHICKEN • Maak thuis de lekkerste flatbread met butter chicken!",
    sound: "Kitchen sounds",
    reel: "food",
    tone: ["#e8b27a", "#7a4a22"],
    text: { p: 0.02, ms: 158 },
    visual: { caption: "stuffed flatbreads on a board, one torn open to show melted cheese and chicken", p: 0.01, ms: 1190 },
  },
];

interface Line {
  stage: "text" | "visual" | "audio";
  model: "jev" | "gemini" | "elevenlabs";
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
      push([textDone], 560, "out", true);
      return;
    }

    if (c.visual) {
      const mdPending: Line = { stage: "visual", model: "gemini", body: "describing the Reel’s images…", pending: true };
      const mdDone: Line = { stage: "visual", model: "gemini", body: `“${c.visual.caption}”` };
      const jevDone: Line = {
        stage: "visual",
        model: "jev",
        body: "with the video described, does it match?",
        p: c.visual.p,
        ms: c.visual.ms,
        verdict: verdictOf(c.visual.p),
      };
      push([textDone, mdPending], 900);
      push([textDone, mdDone], 600);
      push([textDone, mdDone, jevDone], jevDone.verdict === "skip" ? 900 : 1500);
      if (jevDone.verdict === "skip") {
        push([textDone, mdDone, jevDone], 560, "out", true);
        return;
      }
      if (jevDone.verdict === "look" && c.audio) {
        // Still in the middle band with the Reel on screen: hear it out.
        const elPending: Line = { stage: "audio", model: "elevenlabs", body: "transcribing what’s said…", pending: true };
        const elDone: Line = { stage: "audio", model: "elevenlabs", body: `“${c.audio.transcript}”` };
        const jevAudio: Line = {
          stage: "audio",
          model: "jev",
          body: "with the transcript too, does it match?",
          p: c.audio.p,
          ms: c.audio.ms,
          verdict: verdictOf(c.audio.p),
        };
        const seen = [textDone, mdDone, jevDone];
        push([...seen, elPending], 1400);
        push([...seen, elDone], 700);
        push([...seen, elDone, jevAudio], jevAudio.verdict === "skip" ? 1100 : 1500);
        push([...seen, elDone, jevAudio], 560, "out", jevAudio.verdict === "skip");
        return;
      }
      // Kept: the user watches, then scrolls on themselves.
      push([textDone, mdDone, jevDone], 700, "out", false);
      return;
    }

    push([textDone], 700, "out", false);
  });
  return frames;
}

const FRAMES = buildFrames();
/** The static (reduced-motion / SSR-first) render: the one clip that goes through all three stages. */
const STATIC_FRAME = FRAMES.findLast((f) => f.clip === 3 && f.lines.length === 5 && f.card === "in")!;

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
      aria-label="Illustrative demo: Healthy Scroll checks upcoming Reels with Jev while Gemini describes their images. Jev uses the text and descriptions to decide what matches your prompt; if it is still unsure, ElevenLabs transcribes what is said in the Reel and Jev decides with the transcript."
    >
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,260px)_1fr]">
        <Feed frame={frame} still={i === null} />
        <div className="relative min-w-0">
          {/* Reserve the full trace height before the animation starts, including on narrow screens. */}
          <div className="invisible" aria-hidden="true">
            <Trace lines={STATIC_FRAME.lines} clip={CLIPS[STATIC_FRAME.clip]} />
          </div>
          <div className="absolute inset-0">
            <Trace lines={frame.lines} clip={clip} />
          </div>
        </div>
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
        // The Reel on screen plays, including through the swipe; the one sliding in starts as it appears.
        const playing = !still && (current || (offset === 1 && out));
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
            <Card
              clip={clip}
              playing={playing}
              // Buffer the Reel on screen and the next one; the rest can wait their turn.
              preload={moving ? "auto" : "metadata"}
              dimmed={current && skipped && (out || still)}
            />
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

function Card({
  clip,
  playing,
  preload,
  dimmed,
}: {
  clip: Clip;
  playing: boolean;
  preload: "auto" | "metadata";
  dimmed: boolean;
}) {
  return (
    <Footage
      tone={clip.tone}
      image={`/playground/${clip.reel}.jpg`}
      video={`/playground/${clip.reel}.mp4`}
      playing={playing}
      preload={preload}
      className={`h-full w-full transition-[filter] duration-300 ${dimmed ? "brightness-75 grayscale" : ""}`}
    >
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4 pt-16 text-white">
        <p className="text-sm font-semibold">@{clip.author}</p>
        <p className="mt-1 text-sm leading-snug text-white/90">{clip.desc}</p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-white/70">
          <span aria-hidden>♪</span> {clip.sound}
        </p>
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
    <div className="flex h-full min-h-[300px] flex-col rounded-xl border border-line bg-paper p-4 font-mono text-[13px] leading-relaxed sm:p-5">
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
                <span className={`inline-flex items-center gap-1 ${l.model === "jev" ? "text-accent-ink" : "text-muted"}`}>
                  {l.model === "elevenlabs" && <ElevenLabsMark />}
                  {l.model}
                </span>
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
            new reel
            <Dots />
          </li>
        )}
      </ol>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3 text-[11px] text-faint">
        <span>Reel images and audio analyzed on the server</span>
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

/** ElevenLabs' mark: two vertical bars, in the current text colour. */
function ElevenLabsMark({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden className="shrink-0">
      <rect x="3" y="1.5" width="3.6" height="13" rx="0.6" />
      <rect x="9.4" y="1.5" width="3.6" height="13" rx="0.6" />
    </svg>
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
