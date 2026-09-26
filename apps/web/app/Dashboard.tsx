"use client";

import { useEffect, useState } from "react";
import type { PolicyRow } from "@healthyscroll/shared";
import { supabase, useUser } from "@/lib/supabaseBrowser";

const PLACEHOLDER =
  "e.g. gambling, drinking, thirst-trap content, anything that makes me feel worse about myself";

/**
 * Signed in: the user's saved prompt (editable; the extension pulls it on its
 * next sync) and how many videos the extension has skipped for them.
 * Signed out: nothing — the prompt playground above already shows the box,
 * and the nav has the sign-in link.
 */
export function Dashboard() {
  const user = useUser();
  const [prompt, setPrompt] = useState("");
  const [skipCount, setSkipCount] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (!user) return;
    // RLS scopes both queries to the signed-in user.
    void supabase
      .from("policies")
      .select("prompt")
      .maybeSingle<Pick<PolicyRow, "prompt">>()
      .then(({ data }) => setPrompt(data?.prompt ?? ""));
    void supabase
      .from("skips")
      .select("*", { count: "exact", head: true })
      .then(({ count, error }) => setSkipCount(error ? null : (count ?? 0)));
  }, [user]);

  const save = async () => {
    if (!user) return;
    setStatus("saving");
    const { error } = await supabase
      .from("policies")
      .upsert({ user_id: user.id, prompt, updated_at: new Date().toISOString() });
    setStatus(error ? "error" : "saved");
    if (!error) setTimeout(() => setStatus("idle"), 1200);
  };

  if (!user) return null;

  return (
    <section className="mt-12 flex flex-col gap-5 border-t border-line pt-8" aria-label="Your prompt">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-faint">Your prompt</p>
        <p className="font-mono text-[11px] text-faint">
          {skipCount === null ? "–" : skipCount.toLocaleString()} {skipCount === 1 ? "video" : "videos"} skipped for
          you so far
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Skip anything that’s…</span>
        <textarea
          className="min-h-28 resize-none rounded-lg border border-line bg-paper p-3 text-sm leading-relaxed outline-none transition-colors focus:border-ink"
          placeholder={PLACEHOLDER}
          maxLength={2000}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </label>

      <div className="flex items-center gap-4">
        <button
          onClick={() => void save()}
          disabled={status === "saving"}
          className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/85 disabled:opacity-60"
        >
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save"}
        </button>
        <span className="text-xs text-faint">
          {status === "error" ? (
            <span className="text-skip">Couldn’t save. Try again.</span>
          ) : (
            "The extension picks this up on its next sync."
          )}
        </span>
      </div>
    </section>
  );
}
