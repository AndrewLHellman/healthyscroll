"use client";

import { useEffect, useRef, useState } from "react";
import { toVerdict, type Verdict } from "@healthyscroll/shared";
import { Footage } from "./Footage";
import { CLIPS } from "@/lib/playground/clips";
import { jevScorer, keywordScorer, type Scorer } from "@/lib/playground/scorers";

/**
 * The prompt is one text box, so this section is one text box. Type (or pick)
 * a prompt and a strip of mock Reels re-scores. Scoring goes through a
 * `Scorer` (lib/playground/scorers.ts): real Jev via `/api/playground`, with a
 * keyword lookup as the fallback if that route is unavailable. Verdicts come
 * from the same thresholds the extension uses.
 */

const PRESETS = [
  "gambling, drinking, thirst traps",
  "anything that makes me compare my body to someone else’s",
  "rage-bait, political dunking, comment-section drama",
  "crypto, get-rich-quick, hustle culture",
  "food, especially late at night",
];

type Score = number | null;

export function PromptPlayground() {
  // Starts live; drops to the keyword mock for the rest of the visit if the
  // route fails (no gateway key locally, gateway down, rate limited).
  const [scorer, setScorer] = useState<Scorer>(jevScorer);
  const [prompt, setPrompt] = useState(PRESETS[0]);
  const [scores, setScores] = useState<Score[]>(() => CLIPS.map(() => null));
  const [pending, setPending] = useState(true);
  const live = scorer.id === "jev";
  // Bumped per request so a slow response can't overwrite a newer one.
  const seq = useRef(0);
  // The default prompt is scored as soon as the page loads; only edits wait.
  const mounted = useRef(false);

  useEffect(() => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setScores(CLIPS.map(() => null));
      setPending(false);
      return;
    }
    const id = ++seq.current;
    const ctrl = new AbortController();
    const delay = mounted.current ? scorer.debounceMs : 0;
    mounted.current = true;
    const t = window.setTimeout(async () => {
      if (live) setPending(true);
      try {
        const next = await scorer.score(trimmed, CLIPS, ctrl.signal);
        if (id === seq.current) setScores(next);
      } catch {
        // Aborted by a newer keystroke: nothing to show. Anything else means
        // the live route is out; the mock takes over and the effect re-runs.
        if (!ctrl.signal.aborted && live) setScorer(keywordScorer);
      } finally {
        if (id === seq.current) setPending(false);
      }
    }, delay);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [prompt, scorer, live]);

  const verdicts = scores.map((p) => (p === null ? null : toVerdict(p)));
  const skipped = verdicts.filter((v) => v === "skip").length;

  const status = !prompt.trim()
    ? "type something to score the feed"
    : pending
      ? `asking jev about ${CLIPS.length} reels…`
      : skipped === 0
        ? "nothing in this feed matches · try adding a word"
        : `${skipped} of ${CLIPS.length} skipped · edit a word and watch it change`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPrompt(p)}
              aria-pressed={p === prompt}
              className={`rounded-full border px-3 py-1 text-[13px] transition-colors ${
                p === prompt ? "border-ink bg-ink text-paper" : "border-line text-muted hover:border-ink/40 hover:text-ink"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <label className="relative block">
          <span className="sr-only">Your prompt</span>
          <span className="pointer-events-none absolute left-5 top-4 font-mono text-[13px] text-faint">skip anything that’s…</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            spellCheck={false}
            className="w-full resize-none rounded-2xl border border-line bg-paper px-5 pb-5 pt-10 font-display text-2xl font-medium leading-snug tracking-tight outline-none transition-colors focus:border-ink sm:text-3xl"
          />
        </label>
        <p className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 font-mono text-xs text-faint">
          <span aria-live="polite">{status}</span>
          <span>
            {live ? (
              <>
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-keep align-middle" aria-hidden />
                live · scored by jev
              </>
            ) : (
              "offline demo · keyword match, not jev"
            )}
          </span>
        </p>
      </div>

      <ul className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-8">
        {CLIPS.map((c, i) => {
          const p = scores[i];
          const v = verdicts[i];
          return (
            <li key={c.context.author} className={`w-[112px] shrink-0 transition-opacity sm:w-auto ${pending ? "opacity-70" : ""}`}>
              <div className="relative">
                <Footage
                  tone={c.tone}
                  className={`aspect-[9/16] rounded-lg transition-all duration-500 ${v === "skip" ? "opacity-30 grayscale" : "opacity-100"}`}
                >
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-8 text-white">
                    <p className="truncate text-[10px] font-semibold">@{c.context.author}</p>
                    <p className="line-clamp-2 text-[10px] leading-tight text-white/85">{c.context.description}</p>
                  </div>
                </Footage>
                <div
                  className={`absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-skip px-2 py-0.5 font-mono text-[9px] font-medium text-white shadow transition-all duration-300 ${
                    v === "skip" ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
                  }`}
                >
                  skipped
                </div>
              </div>
              <ScoreLine p={p} v={v} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ScoreLine({ p, v }: { p: Score; v: Verdict | null }) {
  const color = v === "skip" ? "text-skip" : v === "allow" ? "text-keep" : "text-muted";
  const label = v === "skip" ? "skip" : v === "allow" ? "keep" : v === "uncertain" ? "look closer" : "·";
  return (
    <p className="mt-1.5 flex items-center justify-between font-mono text-[11px] tabular-nums">
      <span className={p === null ? "text-faint" : color}>{p === null ? "·" : p.toFixed(2)}</span>
      <span className="text-faint">{label}</span>
    </p>
  );
}
