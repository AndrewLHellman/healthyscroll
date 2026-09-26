import type { Decision, EvaluateRequest } from "@healthyscroll/shared";
import type { PlaygroundClip } from "./clips";

/**
 * How the prompt playground turns a prompt into one probability per clip.
 *
 * Two implementations: a keyword lookup that runs in the browser (demo default)
 * and the real thing, which sends each clip through `/api/evaluate` → Jev.
 * The component doesn't know which one it has. Switch with
 * `NEXT_PUBLIC_PLAYGROUND_SCORER=jev` in `apps/web/.env.local`.
 */
export interface Scorer {
  id: "keyword" | "jev";
  /** Wait this long after the last keystroke before scoring. */
  debounceMs: number;
  /**
   * One probability per clip, same order as `clips`. `null` means "couldn't
   * score this one" — shown as a dash, never as a skip (same rule as the extension).
   */
  score(prompt: string, clips: PlaygroundClip[], signal: AbortSignal): Promise<(number | null)[]>;
}

/* ----------------------------------------------------------- keyword mock */

/** Words a person might type → the tag they mean. */
const SYNONYMS: Record<string, string> = {
  gambling: "gambling", gamble: "gambling", casino: "gambling", slots: "gambling", betting: "gambling", bets: "gambling", poker: "gambling",
  drinking: "drinking", drinks: "drinking", drunk: "drinking", alcohol: "drinking", partying: "drinking", party: "drinking", hangover: "drinking", shots: "drinking", wine: "drinking", beer: "drinking",
  food: "food", eating: "food", snacks: "food", cooking: "food", baking: "food", recipes: "food", bread: "food",
  body: "body", bodies: "body", gym: "body", transformation: "body", weight: "body", compare: "body", comparing: "body", shredded: "body", abs: "body", thirst: "body", provocative: "body",
  rage: "rage", ragebait: "rage", political: "rage", politics: "rage", debate: "rage", drama: "rage", dunking: "rage", arguing: "rage", outrage: "rage",
  crypto: "crypto", coin: "crypto", coins: "crypto", hustle: "crypto", rich: "crypto", money: "crypto", trading: "crypto", forex: "crypto", grind: "crypto",
};

function tagsIn(prompt: string): Set<string> {
  const out = new Set<string>();
  for (const w of prompt.toLowerCase().split(/[^a-z]+/)) {
    const t = SYNONYMS[w] ?? SYNONYMS[w.replace(/s$/, "")];
    if (t) out.add(t);
  }
  return out;
}

export const keywordScorer: Scorer = {
  id: "keyword",
  debounceMs: 0,
  async score(prompt, clips) {
    const active = tagsIn(prompt);
    return clips.map((c) => (c.mock.tags.some((t) => active.has(t)) ? c.mock.hit : c.mock.miss));
  },
};

/* --------------------------------------------------------------- live jev */

/**
 * One request per clip, in parallel, through the same route the extension
 * uses. Text + the frame caption, so it's the "visual" stage of the pipeline —
 * the fully-informed answer, not the 200 ms first pass.
 */
export const jevScorer: Scorer = {
  id: "jev",
  debounceMs: 600,
  async score(prompt, clips, signal) {
    return Promise.all(
      clips.map(async (c) => {
        const body: EvaluateRequest = {
          policy: { prompt },
          context: c.context,
          frames: [{ videoId: c.context.videoId, atMs: 0, caption: c.frameCaption }],
        };
        try {
          const res = await fetch("/api/evaluate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
            signal,
          });
          if (!res.ok) return null;
          const d = (await res.json()) as Decision;
          return d.violatesProbability;
        } catch (err) {
          if (signal.aborted) throw err;
          return null;
        }
      }),
    );
  },
};

export function getScorer(): Scorer {
  return process.env.NEXT_PUBLIC_PLAYGROUND_SCORER === "jev" ? jevScorer : keywordScorer;
}
