import type { Decision, PolicyRow, UserPolicy, VideoContext } from "@healthyscroll/shared";
import { getUserId, supabase } from "./auth";
import { getPolicy, onPolicyChange, replacePolicy } from "./policyStore";

/**
 * Keeps the local policy (chrome.storage.sync, read by the pipeline) in step with
 * the user's row in Supabase, and logs skips. Background-only. Every call here
 * is best-effort: failures are logged and never block or cause a skip.
 *
 * Conflict rule: whichever side has the newer updatedAt wins.
 */

const PULL_THROTTLE_MS = 60_000;
let lastPullAt = 0;
/** updatedAt of the last policy we wrote locally from Supabase, so we don't echo it back. */
let lastPulledUpdatedAt = -1;

export async function pullPolicy(): Promise<void> {
  lastPullAt = Date.now();
  if (!(await getUserId())) return;

  const { data, error } = await supabase
    .from("policies")
    .select("prompt, enabled, updated_at")
    .maybeSingle<Pick<PolicyRow, "prompt" | "enabled" | "updated_at">>();
  if (error) {
    console.error("[sync] pull policy failed", error);
    return;
  }

  const local = await getPolicy();
  if (!data) {
    // First sign-in on this account: seed Supabase with whatever is local.
    if (local.prompt.trim()) await pushPolicy(local);
    return;
  }

  const remoteUpdatedAt = Date.parse(data.updated_at);
  if (remoteUpdatedAt > local.updatedAt) {
    lastPulledUpdatedAt = remoteUpdatedAt;
    await replacePolicy({ prompt: data.prompt, enabled: data.enabled, updatedAt: remoteUpdatedAt });
  } else if (local.updatedAt > remoteUpdatedAt) {
    await pushPolicy(local);
  }
}

/** Pull at most once a minute; called on each new video so website edits reach the pipeline. */
export function maybePullPolicy(): void {
  if (Date.now() - lastPullAt < PULL_THROTTLE_MS) return;
  void pullPolicy();
}

async function pushPolicy(policy: UserPolicy): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  const { error } = await supabase.from("policies").upsert({
    user_id: userId,
    prompt: policy.prompt,
    enabled: policy.enabled,
    updated_at: new Date(policy.updatedAt).toISOString(),
  } satisfies PolicyRow);
  if (error) console.error("[sync] push policy failed", error);
}

export async function recordSkip(context: VideoContext, decision: Decision): Promise<void> {
  if (!(await getUserId())) return;
  const { error } = await supabase.from("skips").insert({
    platform: context.platform,
    video_id: context.videoId,
    stage: decision.stage,
    violates_probability: decision.violatesProbability,
  });
  if (error) console.error("[sync] record skip failed", error);
}

/** Push local edits (popup Save) to Supabase. */
export function startPolicySync(): void {
  onPolicyChange((policy) => {
    if (policy.updatedAt === lastPulledUpdatedAt) return;
    void pushPolicy(policy);
  });
  void pullPolicy();
}
