import { CATEGORIES } from "./categories";
import type { EvaluateRequest } from "./types";

/**
 * Jev question schema and state builder.
 *
 * Jev (typesafe-ai/jev) is an evaluation model: it takes `state` plus typed
 * `questions` and returns probabilities — no prose. We ask TWO questions in the
 * one call:
 *
 *   violates  (boolean)  does this video conflict with the user's policy?
 *                        → the skip decision (see thresholds.ts)
 *   category  (choice)   what is this video about?
 *                        → the on-device tally (see docs/OBSERVABILITY.md)
 *
 * The second question rides along for free — same state, same round trip.
 *
 * The same builder is used for every stage; the visual stage just adds `frames`
 * to the state so Jev can reason over Moondream's captions too.
 *
 * Kept in `shared` so the extension and the API can never disagree on the schema.
 * The literal object shape matches `experimental_evaluate`'s `questions` param.
 */
export const JEV_MODEL = "typesafe-ai/jev";

/** What `state.policy` holds when the user hasn't written anything. Jev should never flag against it. */
export const NO_POLICY = "(none — the user has not written a policy; nothing violates it)";

export const jevQuestions = {
  violates: {
    type: "boolean",
    // Worded as "is it about / does it feature a topic in the policy", not "does it
    // conflict with the policy": on real Reels with policy "animals" (2026-09-26) this
    // moved cat/turtle/dog videos from ~0.72 to 0.99 while non-matches stayed <= 0.06.
    // "Features" is spelled out as presence: with policy "women", a travel Reel whose
    // description read "a young woman ... in front of Mount Rainier" was allowed
    // (2026-09-27) because Jev judged what the video was *about* (travel).
    instructions:
      "`policy` lists topics the viewer does not want to see. Is this short video about, or does it " +
      "feature, any of those topics? Judge from the video's description, hashtags, author, audio title, " +
      "comments and visual captions. A topic is featured when a person, thing or subject named in the " +
      "policy is visibly present in the video, even if the video is mainly about something else. " +
      "If the policy is empty or says none was written, the answer is false.",
    criteria: {
      true:
        "The video is about at least one topic listed in the policy, or clearly shows one: something the " +
        "policy names is present in the video, whatever the video is mainly about.",
      false: "The video is not about and does not show any topic listed in the policy, or there is no policy.",
    },
  },
  category: {
    type: "choice",
    instructions:
      "Which single category best describes what this video is about? Use the description, " +
      "hashtags, audio, comments and any visual captions. Ignore the policy entirely for this question. " +
      "Pick 'other' only if nothing else fits.",
    criteria: CATEGORIES,
  },
} as const;

/**
 * Build the `state` Jev evaluates. Plain object; Jev accepts structured state.
 * Order matters slightly for readability, not for the model.
 */
export function buildJevState(req: EvaluateRequest) {
  const { policy, context, frames } = req;
  // Jev rejects state that isn't strictly JSON-compatible, and `undefined`
  // fields (no comments, no frames on the text pass...) count. Drop them.
  return withoutUndefined({
    policy: policy.prompt.trim() || NO_POLICY,
    video: {
      author: context.author,
      description: context.description,
      hashtags: context.hashtags,
      audioTitle: context.audioTitle,
      onScreenText: context.onScreenText,
      comments: context.comments?.slice(0, 20),
    },
    // Only present on visual/monitor passes.
    visualFrames: frames?.map((f) => ({
      atMs: f.atMs,
      caption: f.caption,
      policyAnswer: f.policyAnswer,
    })),
  });
}

function withoutUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withoutUndefined) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, withoutUndefined(v)]),
    ) as T;
  }
  return value;
}
