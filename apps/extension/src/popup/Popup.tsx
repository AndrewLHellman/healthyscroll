import { useEffect, useState } from "react";
import { CATEGORY_LABELS, formatDuration, summarize, type Summary, type UserPolicy } from "@healthyscroll/shared";
import { getPolicy, setPolicy } from "../background/policyStore";
import { getRecords } from "../background/ledger";
import { sendAuthMessage, type AuthState, type PopupToBackground } from "../lib/messages";

/**
 * The whole UI: one switch, one text box — plus one line about today that
 * opens the insights page. Deliberately minimal.
 * The policy is synced to Supabase by the background worker (background/sync.ts),
 * so it's also editable on the website.
 */
export function Popup() {
  const [policy, setLocal] = useState<UserPolicy | null>(null);
  const [saved, setSaved] = useState(false);
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [today, setToday] = useState<Summary | null>(null);

  useEffect(() => {
    void runAuth({ type: "AUTH_GET" });
    void getRecords(1).then((rs) => setToday(summarize(rs, { days: 1 })));
  }, []);

  // Sign-in runs in the background worker; if the popup closes mid-flow it
  // picks up the new session next time it opens. The background pulls the
  // saved policy from Supabase before replying, so read it afterwards.
  async function runAuth(msg: PopupToBackground) {
    setAuthBusy(true);
    setAuthError(null);
    const res = await sendAuthMessage(msg);
    if (res.ok) {
      setAuth(res.auth);
    } else {
      setAuthError(res.error);
      setAuth((a) => a ?? { email: null }); // show the sign-in screen rather than nothing
    }
    setLocal(await getPolicy());
    setAuthBusy(false);
  }

  if (!policy || !auth) return null;

  if (!auth.email) {
    return (
      <main className="p-5 flex flex-col gap-4 bg-white text-neutral-900">
        <h1 className="text-base font-semibold tracking-tight">Healthy Scroll</h1>
        <p className="text-sm text-neutral-500 leading-snug">Sign in to start filtering your feed.</p>
        <button
          onClick={() => void runAuth({ type: "AUTH_SIGN_IN" })}
          disabled={authBusy}
          className="rounded-lg bg-neutral-900 text-white text-sm py-2 hover:bg-neutral-800 active:bg-neutral-700 disabled:opacity-60 transition-colors"
        >
          {authBusy ? "Signing in…" : "Sign in with Google"}
        </button>
        {authError && <p className="text-xs text-red-600 leading-snug">{authError}</p>}
      </main>
    );
  }

  const save = async () => {
    const next = await setPolicy({ prompt: policy.prompt, enabled: policy.enabled });
    setLocal(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  return (
    <main className="p-5 flex flex-col gap-4 bg-white text-neutral-900">
      <header className="flex items-center justify-between">
        <h1 className="text-base font-semibold tracking-tight">Healthy Scroll</h1>
        <label className="flex items-center gap-2 text-xs text-neutral-500 cursor-pointer select-none">
          {policy.enabled ? "On" : "Off"}
          <input
            type="checkbox"
            className="accent-neutral-900 h-4 w-4"
            checked={policy.enabled}
            onChange={(e) => setLocal({ ...policy, enabled: e.target.checked })}
          />
        </label>
      </header>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-neutral-500">Skip anything that's…</span>
        <textarea
          className="min-h-28 resize-none rounded-lg border border-neutral-200 p-3 text-sm leading-relaxed outline-none focus:border-neutral-400"
          placeholder="e.g. gambling, drinking, thirst-trap content, anything that makes me feel worse about myself"
          value={policy.prompt}
          onChange={(e) => setLocal({ ...policy, prompt: e.target.value })}
        />
      </label>

      <button
        onClick={save}
        className="rounded-lg bg-neutral-900 text-white text-sm py-2 hover:bg-neutral-800 active:bg-neutral-700 transition-colors"
      >
        {saved ? "Saved" : "Save"}
      </button>

      <TodayLine summary={today} />

      <p className="text-[11px] text-neutral-400 leading-snug">
        Video frames are analysed on your device. Only text and short captions leave your machine.
        Your tally stays in this browser.
      </p>

      <footer className="flex items-center justify-between gap-2 text-[11px] text-neutral-400">
        <span className="truncate">{auth.email}</span>
        <button
          onClick={() => void runAuth({ type: "AUTH_SIGN_OUT" })}
          disabled={authBusy}
          className="shrink-0 underline hover:text-neutral-600"
        >
          Sign out
        </button>
      </footer>
    </main>
  );
}

/** "today · 42m · 31 skipped · mostly comedy, food →" — or nothing, if nothing yet. */
function TodayLine({ summary }: { summary: Summary | null }) {
  if (!summary || (summary.watched === 0 && summary.skipped.count === 0)) return null;
  const top = summary.byCategory.slice(0, 2).map((c) => CATEGORY_LABELS[c.category]);
  const parts = [
    "today",
    formatDuration(summary.totalMs),
    summary.skipped.count ? `${summary.skipped.count} skipped` : null,
    top.length ? `mostly ${top.join(", ")}` : null,
  ].filter(Boolean);
  return (
    <button
      type="button"
      onClick={() => chrome.runtime.openOptionsPage()}
      className="flex items-center justify-between gap-3 rounded-md text-left font-mono text-[11px] text-neutral-500 hover:text-neutral-900 transition-colors"
    >
      <span className="truncate">{parts.join(" · ")}</span>
      <span aria-hidden>→</span>
    </button>
  );
}
