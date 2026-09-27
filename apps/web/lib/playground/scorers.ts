import type { PlaygroundClip } from "./clips";

/**
 * How the prompt playground turns a prompt into one probability per clip.
 *
 * The real thing sends the prompt to `/api/playground`, which runs every clip
 * through Jev server-side. A keyword lookup that runs in the browser stands in
 * when that route is unavailable (local dev without a gateway key, gateway
 * down, rate limited); the component switches over and says so.
 */
export interface Scorer {
  id: "keyword" | "jev";
  /** Wait this long after the last keystroke before scoring. */
  debounceMs: number;
  /**
   * One probability per clip, same order as `clips`. `null` means "couldn't
   * score this one" — shown as a dash, never as a skip (same rule as the extension).
   * Rejects when the scorer as a whole is unavailable.
   */
  score(prompt: string, clips: PlaygroundClip[], signal: AbortSignal): Promise<(number | null)[]>;
}

/* --------------------------------------------------------------- live jev */

/**
 * One request for the whole strip; the server fans out to Jev with text +
 * vision description per clip, the fully-informed pass of the pipeline.
 */
export const jevScorer: Scorer = {
  id: "jev",
  debounceMs: 600,
  async score(prompt, clips, signal) {
    const res = await fetch("/api/playground", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal,
    });
    if (!res.ok) throw new Error(`playground ${res.status}`);
    const { scores } = (await res.json()) as { scores: (number | null)[] };
    if (!Array.isArray(scores) || scores.length !== clips.length) throw new Error("playground: bad response");
    return scores;
  },
};

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
