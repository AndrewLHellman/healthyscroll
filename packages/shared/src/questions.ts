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
    instructions:
      "The user wrote a policy describing content they do NOT want to see while scrolling. " +
      "Does this video conflict with that policy? Judge the video, not the policy. " +
      "If the policy is empty or says none was written, the answer is false.",
    criteria: {
      true:
        "The video's description, hashtags, comments, audio, or visual captions indicate content " +
        "the policy asks to filter out, or content clearly in the same category.",
      false:
        "Nothing in the available signals suggests the video matches what the policy filters. " +
        "Unrelated or benign content, or no policy.",
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
  return {
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
  };
}
