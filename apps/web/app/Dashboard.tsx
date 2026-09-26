"use client";

import { useEffect, useState } from "react";
import type { PolicyRow } from "@healthyscroll/shared";
import { supabase, useUser } from "@/lib/supabaseBrowser";

const PLACEHOLDER =
  "e.g. gambling, drinking, thirst-trap content, anything that makes me feel worse about myself";

/**
 * Signed out: a read-only preview of the prompt box.
 * Signed in: the user's saved prompt (editable; the extension pulls it on its
 * next sync) and how many videos the extension has skipped for them.
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

  if (!user) {
    return (
      <label className="flex flex-col gap-2">
        <span className="text-xs text-neutral-500">Skip anything that's…</span>
        <textarea
          className="min-h-32 resize-none rounded-xl border border-neutral-200 p-4 text-sm leading-relaxed outline-none"
          placeholder={PLACEHOLDER}
          readOnly
        />
        {user === null && (
          <span className="text-xs text-neutral-400">Sign in to save this and see your stats.</span>
        )}
      </label>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="text-4xl font-semibold tabular-nums tracking-tight">
          {skipCount === null ? "–" : skipCount.toLocaleString()}
        </span>
        <span className="text-sm text-neutral-500">
          {skipCount === 1 ? "video skipped" : "videos skipped"} for you so far
        </span>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-xs text-neutral-500">Skip anything that's…</span>
        <textarea
          className="min-h-32 resize-none rounded-xl border border-neutral-200 p-4 text-sm leading-relaxed outline-none focus:border-neutral-400"
          placeholder={PLACEHOLDER}
          maxLength={2000}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          onClick={() => void save()}
          disabled={status === "saving"}
          className="rounded-lg border border-neutral-200 px-4 py-2 text-sm hover:border-neutral-400 disabled:opacity-60"
        >
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save"}
        </button>
        {status === "error" && <span className="text-xs text-red-600">Couldn't save. Try again.</span>}
      </div>
    </section>
  );
}
