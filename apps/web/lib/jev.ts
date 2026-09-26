import { experimental_evaluate as evaluate } from "ai";
import {
  JEV_MODEL,
  buildJevState,
  isCategory,
  jevQuestions,
  toVerdict,
  type Decision,
  type EvaluateRequest,
} from "@healthyscroll/shared";

/**
 * The one place we talk to Jev.
 *
 * Jev is TypeSafe AI's evaluation model on the Vercel AI Gateway. Passing the
 * `creator/model` string routes through the gateway automatically using
 * AI_GATEWAY_API_KEY (or VERCEL_OIDC_TOKEN when deployed on Vercel).
 *
 * It answers typed questions with probabilities and generates no prose, which
 * is why it's fast and cheap enough to run on every single video.
 *
 * One call answers both questions (violates + category); see shared/questions.ts.
 *
 * https://vercel.com/kb/guide/typesafe-jev-and-ai-sdk
 */
export async function decide(req: EvaluateRequest, stage: Decision["stage"]): Promise<Decision> {
  const started = Date.now();

  const result = await evaluate({
    model: JEV_MODEL,
    state: buildJevState(req),
    questions: jevQuestions,
    providerOptions: {
      // We're processing what people watch; don't let it be retained anywhere.
      gateway: { zeroDataRetention: true },
    },
  });

  const violatesProbability = result.answers.violates.probability;

  // With no policy there's nothing to violate — force allow so a stray
  // probability can never turn into a skip in tally-only mode.
  const hasPolicy = req.policy.prompt.trim().length > 0;

  const cat = result.answers.category;
  const category =
    cat && isCategory(cat.choice)
      ? { label: cat.choice, probability: cat.probabilities?.[cat.choice] ?? 1 }
      : undefined;

  return {
    videoId: req.context.videoId,
    verdict: hasPolicy ? toVerdict(violatesProbability) : "allow",
    violatesProbability: hasPolicy ? violatesProbability : 0,
    category,
    stage,
    latencyMs: Date.now() - started,
  };
}
