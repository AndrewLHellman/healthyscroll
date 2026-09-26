"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { summarizeDays, type FeedDayEntry, type FeedDayRow, type PolicyRow, type SkipRow } from "@healthyscroll/shared";
import { supabase, useUser } from "@/lib/supabaseBrowser";
import { signIn } from "@/app/AuthButton";
import { MarkImage } from "@/components/Mark";
import { WeekView } from "@/components/WeekMock";
import { FeedStats } from "./FeedStats";
import { computeStats, dayKey, entriesFromReels, entryFromRow, longDate, statsFromEntries, type ReelLite } from "./stats";
import { buildSampleReels, SAMPLE_ALL_TIME, SAMPLE_PROMPT } from "./sample";

const WINDOW_DAYS = 28;
const PLACEHOLDER = "e.g. gambling, rage bait, anything that makes me compare my body to someone else’s";

/**
 * Two parts, in the order they matter: the prompt (the one thing you control)
 * and what it has done for you. Signed out, the page offers Google sign-in and a
 * `?sample=1` view so the dashboard can be seen without an account.
 */
export function DashboardClient() {
  const user = useUser();
  const sample = useSearchParams().get("sample");

  // ?sample=1 shows a fabricated month; ?sample=empty shows a fresh account.
  if (sample !== null) return <SampleDashboard empty={sample === "empty"} />;
  if (user === undefined) return <Shell />;
  if (user === null) return <SignedOut />;
  return <LiveDashboard userId={user.id} />;
}

/* ------------------------------------------------------------- states */

/** Same bones as the dashboard, no content: keeps the page from jumping while auth resolves. */
function Shell() {
  return <div className="min-h-[60vh]" aria-busy />;
}

function SignedOut() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-start justify-center gap-6 py-20">
      <MarkImage height={40} />
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Your dashboard</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          Choose what you’d like less of in your feed and see what Healthy Scroll has skipped. Sign in with the Google account you use in the extension.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-5">
        <button
          onClick={signIn}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink/85"
        >
          Sign in with Google
        </button>
        <a href="/dashboard?sample=1" className="rounded-md text-sm text-muted transition-colors hover:text-ink">
          Preview the dashboard →
        </a>
      </div>
    </div>
  );
}

function SampleDashboard({ empty }: { empty: boolean }) {
  // Same sample month for every figure, as the daily totals the extension would sync.
  const entries = useMemo(() => (empty ? [] : entriesFromReels(buildSampleReels())), [empty]);
  return (
    <Dashboard
      prompt={empty ? "" : SAMPLE_PROMPT}
      updatedAt={empty ? null : new Date(Date.now() - 9 * 86_400_000).toISOString()}
      reels={[]}
      entries={entries}
      allTime={empty ? 0 : SAMPLE_ALL_TIME}
      readOnly
    />
  );
}

function LiveDashboard({ userId }: { userId: string }) {
  const [policy, setPolicy] = useState<Pick<PolicyRow, "prompt" | "updated_at"> | null | undefined>(undefined);
  const [reels, setReels] = useState<ReelLite[] | undefined>(undefined);
  const [entries, setEntries] = useState<FeedDayEntry[] | undefined>(undefined);
  const [allTime, setAllTime] = useState<number | null>(null);

  useEffect(() => {
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
    // RLS scopes all three to the signed-in user.
    void supabase
      .from("policies")
      .select("prompt, updated_at")
      .maybeSingle<Pick<PolicyRow, "prompt" | "updated_at">>()
      .then(({ data }) => setPolicy(data ?? null));
    void supabase
      .from("skips")
      .select("skipped_at")
      .gte("skipped_at", since)
      .order("skipped_at", { ascending: false })
      .limit(5000)
      .returns<Pick<SkipRow, "skipped_at">[]>()
      // Only skips are recorded server-side, so the feed is known one-sided
      // for now; the figures that need watched Reels stay hidden.
      .then(({ data }) => setReels((data ?? []).map((s) => ({ seen_at: s.skipped_at, skipped: true, seconds: 0 }))));
    // Daily watch totals synced by the extension (background/sync.ts). If there are
    // none yet (or the table is missing), the figures fall back to skips alone.
    void supabase
      .from("feed_days")
      .select("day, category, seen, skipped, seconds, buckets")
      .gte("day", dayKey(Date.now() - (WINDOW_DAYS - 1) * 86_400_000))
      .returns<Pick<FeedDayRow, "day" | "category" | "seen" | "skipped" | "seconds" | "buckets">[]>()
      .then(({ data }) => setEntries((data ?? []).map(entryFromRow)));
    void supabase
      .from("skips")
      .select("*", { count: "exact", head: true })
      .then(({ count, error }) => setAllTime(error ? null : (count ?? 0)));
  }, [userId]);

  if (policy === undefined || reels === undefined || entries === undefined) return <Shell />;

  return (
    <Dashboard
      userId={userId}
      prompt={policy?.prompt ?? ""}
      updatedAt={policy?.updated_at ?? null}
      reels={reels}
      entries={entries}
      allTime={allTime}
    />
  );
}

/* ---------------------------------------------------------- dashboard */

function Dashboard({
  userId,
  prompt,
  updatedAt,
  reels,
  entries,
  allTime,
  readOnly = false,
}: {
  userId?: string;
  prompt: string;
  updatedAt: string | null;
  /** Skips only (from `skips`): the fallback when there are no daily totals. */
  reels: ReelLite[];
  /** Daily watch totals (from `feed_days`, or the sample). */
  entries: FeedDayEntry[];
  allTime: number | null;
  readOnly?: boolean;
}) {
  const stats = useMemo(
    () => (entries.length ? statsFromEntries(entries, { days: WINDOW_DAYS }) : computeStats(reels, { days: WINDOW_DAYS })),
    [entries, reels],
  );
  const week = useMemo(() => summarizeDays(entries, { days: 7 }), [entries]);

  return (
    <div className="flex flex-col">
      {readOnly && (
        <p className="mb-8 inline-flex w-fit items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-skip" aria-hidden />
          Dashboard preview.{" "}
          <a href="/dashboard" className="rounded-md text-ink underline decoration-line underline-offset-2 hover:decoration-ink">
            Sign in
          </a>{" "}
          to see yours.
        </p>
      )}

      <section aria-labelledby="prompt-heading" className="pb-14">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h1 id="prompt-heading" className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Set your own limits
          </h1>
          <p className="font-mono text-[11px] text-faint">
            {updatedAt ? `saved ${longDate(new Date(updatedAt).getTime())}` : "not saved yet"}
          </p>
        </div>
        <p className="mt-3 max-w-xl text-lg leading-relaxed text-muted">
          What would you like less of in your feed? Describe it below, whether you’re changing a habit or just tired of seeing the same thing.
        </p>
        <div className="mt-8">
          <PromptEditor key={prompt} userId={userId} initial={prompt} readOnly={readOnly} />
        </div>
      </section>

      {week.watched > 0 && (
        <section aria-label="Your week" className="border-t border-line py-14">
          <WeekView week={week} note={readOnly ? "sample data" : "synced from your phone"} />
        </section>
      )}

      <section aria-labelledby="feed-heading" className="border-t border-line pt-14">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="feed-heading" className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Last four weeks
          </h2>
          {!!allTime && <p className="font-mono text-[11px] text-faint">{allTime.toLocaleString()} skipped in total</p>}
        </div>
        <div className="mt-10">
          <FeedStats stats={stats} allTime={allTime} />
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------- prompt */

function PromptEditor({ userId, initial, readOnly }: { userId?: string; initial: string; readOnly: boolean }) {
  const [prompt, setPrompt] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty = prompt !== saved;

  const save = async () => {
    if (!userId || !dirty) return;
    setStatus("saving");
    const { error } = await supabase
      .from("policies")
      .upsert({ user_id: userId, prompt, updated_at: new Date().toISOString() });
    if (error) {
      setStatus("error");
      return;
    }
    setSaved(prompt);
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 1600);
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">Skip Reels about…</span>
        <textarea
          className="min-h-32 w-full resize-y rounded-lg border border-line bg-paper p-4 text-base leading-relaxed outline-none transition-colors focus:border-ink disabled:text-ink"
          placeholder={PLACEHOLDER}
          maxLength={2000}
          value={prompt}
          disabled={readOnly}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void save();
          }}
        />
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={() => void save()}
          disabled={readOnly || !dirty || status === "saving"}
          className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/85 disabled:cursor-default disabled:opacity-40"
        >
          {status === "saving" ? "Saving…" : "Save prompt"}
        </button>
        <span className="text-xs text-faint" role="status">
          {status === "error" ? (
            <span className="text-skip">Couldn’t save your prompt. Please try again.</span>
          ) : status === "saved" ? (
            <span className="text-keep">Prompt saved.</span>
          ) : dirty ? (
            "Unsaved changes"
          ) : null}
        </span>
      </div>
    </div>
  );
}
