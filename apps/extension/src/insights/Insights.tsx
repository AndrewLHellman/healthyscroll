import { useEffect, useState } from "react";
import {
  CATEGORY_LABELS,
  MIN_SAMPLE,
  formatDuration,
  summarize,
  type Category,
  type Summary,
} from "@healthyscroll/shared";
import { clearAll, getRecords } from "../background/ledger";

/**
 * "Your week" — the insights page (opened from the popup's today line, or via
 * the extension's Options entry). Three panels and nothing else:
 *
 *   where the time went    7 days, stacked by category
 *   what holds you         dwell relative to your own average
 *   skipped                count, and an estimate of time not spent
 *
 * Reads chrome.storage.local only. No network.
 */

const DAYS = 7;
/** Categories beyond the top N collapse into one grey band so the stack stays legible. */
const TOP_N = 5;
const RAMP = ["#12141a", "#3d434e", "#6c727f", "#9aa0ab", "#c4c8cf"];
const REST = "#e6e8ec";

export function Insights() {
  const [summary, setSummary] = useState<Summary | null>(null);

  const load = () => getRecords(DAYS).then((rs) => setSummary(summarize(rs, { days: DAYS })));

  useEffect(() => {
    void load();
    const onChange = () => void load();
    chrome.storage.local.onChanged.addListener(onChange);
    return () => chrome.storage.local.onChanged.removeListener(onChange);
  }, []);

  if (!summary) return null;
  const empty = summary.watched === 0 && summary.skipped.count === 0;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-12 px-6 py-14">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">Healthy Scroll · last {DAYS} days</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Your week</h1>
          {!empty && (
            <p className="mt-2 font-mono text-sm text-neutral-500">
              {formatDuration(summary.totalMs)} across {summary.watched} videos
            </p>
          )}
        </div>
        <p className="font-mono text-[11px] text-neutral-400">
          stays in this browser ·{" "}
          <button
            type="button"
            className="underline decoration-neutral-300 underline-offset-2 hover:text-neutral-900"
            onClick={() => {
              if (confirm("Clear your whole tally? This can't be undone.")) void clearAll().then(load);
            }}
          >
            clear
          </button>
        </p>
      </header>

      {empty ? (
        <p className="text-neutral-500">
          Nothing tallied yet. Scroll TikTok with Healthy Scroll switched on and come back.
        </p>
      ) : (
        <>
          <Panel title="Where the time went">
            <Days summary={summary} />
          </Panel>
          <Panel title="What holds you" hint="how long you stay on each kind of video, relative to your average">
            <Holds summary={summary} />
          </Panel>
          <Panel title="Skipped">
            <Skipped summary={summary} />
          </Panel>
        </>
      )}
    </main>
  );
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5 border-t border-neutral-200 pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {hint && <p className="font-mono text-[11px] text-neutral-400">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------- panels */

function Days({ summary }: { summary: Summary }) {
  const top = summary.byCategory.slice(0, TOP_N).map((c) => c.category);
  const color = (cat: Category) => {
    const i = top.indexOf(cat);
    return i >= 0 ? RAMP[i] : REST;
  };
  const max = Math.max(...summary.days.map((d) => d.totalMs), 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid h-40 grid-cols-7 items-end gap-3">
        {summary.days.map((d) => {
          // Top categories first so the stack reads top-down in legend order; rest at the bottom.
          const segs = (Object.entries(d.byCategory) as [Category, number][])
            .sort((a, b) => rank(a[0], top) - rank(b[0], top));
          return (
            <div key={d.date} className="flex h-full flex-col justify-end gap-1.5">
              <div
                className="flex flex-col overflow-hidden rounded-sm"
                style={{ height: `${(d.totalMs / max) * 100}%` }}
                title={`${d.date}: ${formatDuration(d.totalMs)}`}
              >
                {segs.map(([cat, ms]) => (
                  <div key={cat} style={{ height: `${(ms / d.totalMs) * 100}%`, background: color(cat) }} />
                ))}
              </div>
              <p className="text-center font-mono text-[10px] text-neutral-400">{weekday(d.date)}</p>
            </div>
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[11px] text-neutral-500">
        {summary.byCategory.slice(0, TOP_N).map((c, i) => (
          <li key={c.category} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: RAMP[i] }} />
            {CATEGORY_LABELS[c.category]} <span className="text-neutral-400">{formatDuration(c.ms)}</span>
          </li>
        ))}
        {summary.byCategory.length > TOP_N && (
          <li className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: REST }} />
            everything else
          </li>
        )}
      </ul>
    </div>
  );
}

function Holds({ summary }: { summary: Summary }) {
  if (summary.holds.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Needs a few more videos — at least {MIN_SAMPLE} in a category before it's ranked.
      </p>
    );
  }
  const maxRatio = Math.max(...summary.holds.map((h) => h.ratio), 2);
  return (
    <ol className="flex flex-col gap-3">
      {summary.holds.map((h) => (
        <li key={h.category} className="grid grid-cols-[150px_1fr_auto] items-center gap-4 text-sm">
          <span className="truncate">{CATEGORY_LABELS[h.category]}</span>
          <div className="relative h-1.5 rounded-full bg-neutral-100">
            {/* 1.0× = your average. Right of it holds you longer than usual. */}
            <span
              className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-neutral-300"
              style={{ left: `${(1 / maxRatio) * 100}%` }}
              aria-hidden
            />
            <div
              className="h-full rounded-full"
              style={{ width: `${(h.ratio / maxRatio) * 100}%`, background: h.ratio >= 1.5 ? "#e5484d" : "#12141a" }}
            />
          </div>
          <span className="font-mono text-[11px] tabular-nums text-neutral-500">
            <span className={h.ratio >= 1.5 ? "text-[#e5484d]" : "text-neutral-900"}>{h.ratio.toFixed(1)}×</span>
            {" · "}
            {formatDuration(h.avgMs)} avg · {h.count}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Skipped({ summary }: { summary: Summary }) {
  const { count, savedMs, byCategory } = summary.skipped;
  if (count === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Nothing skipped this week. Write a prompt in the popup and switch it on.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
      <p className="text-3xl font-semibold tracking-tight">
        {count} <span className="text-base font-normal text-neutral-500">skipped</span>
      </p>
      <p className="text-3xl font-semibold tracking-tight">
        ~{formatDuration(savedMs)} <span className="text-base font-normal text-neutral-500">not spent</span>
      </p>
      <p className="basis-full font-mono text-[11px] text-neutral-400">
        mostly {byCategory.slice(0, 3).map((c) => `${CATEGORY_LABELS[c.category]} (${c.count})`).join(", ")}
        {" · "}estimate = skips × your median watch ({formatDuration(summary.medianMs)})
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ helpers */

function rank(cat: Category, top: Category[]): number {
  const i = top.indexOf(cat);
  return i >= 0 ? i : top.length;
}

function weekday(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2);
}
