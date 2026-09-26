import { CATEGORY_LABELS, formatDuration, type Category, type Summary } from "@healthyscroll/shared";
import { buildMockWeek } from "@/lib/mockWeek";

/**
 * A static rendering of the extension's "Your week" page, fed by a seeded
 * fabricated week that runs through the real `summarize()`. Mirrors
 * apps/extension/src/insights/Insights.tsx — same three panels, same maths.
 *
 * The one thing we add for the landing page is the sentence under "what holds
 * you": share of videos vs share of time for the top hold. That gap is the
 * whole point of tracking dwell instead of counting.
 */

/** Categories beyond the top N collapse into one grey band so the stack stays legible. */
const TOP_N = 5;
const RAMP = ["#12141a", "#3d434e", "#6c727f", "#9aa0ab", "#c4c8cf"];
const REST = "#e6e8ec";
const WEEKDAY = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function WeekMock() {
  const week = buildMockWeek();
  const first = week.days[0].date;
  const last = week.days[week.days.length - 1].date;

  return (
    <figure className="overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_24px_60px_-32px_rgba(18,20,26,0.25)]">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-line px-6 py-4 sm:px-8">
        <p className="font-display text-lg font-semibold tracking-tight">
          Your week
          <span className="ml-3 font-sans text-sm font-normal text-muted">
            {formatDuration(week.totalMs)} across {week.watched} videos
          </span>
        </p>
        <p className="font-mono text-[11px] text-faint">
          {dayLabel(first)} – {dayLabel(last)} · stays in this browser
        </p>
      </header>

      <div className="grid gap-px bg-line lg:grid-cols-[1.1fr_1fr]">
        <Panel title="Where the time went">
          <Days week={week} />
        </Panel>
        <Panel title="What holds you" hint="how long you stay, relative to your average">
          <Holds week={week} />
        </Panel>
        <div className="bg-paper px-6 py-5 sm:px-8 lg:col-span-2">
          <Skipped week={week} />
        </div>
      </div>
    </figure>
  );
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5 bg-paper px-6 py-6 sm:px-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-xs font-medium uppercase tracking-wider text-faint">{title}</h3>
        {hint && <p className="font-mono text-[11px] text-faint">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------- panels */

function Days({ week }: { week: Summary }) {
  const top = week.byCategory.slice(0, TOP_N).map((c) => c.category);
  const color = (cat: Category) => {
    const i = top.indexOf(cat);
    return i >= 0 ? RAMP[i] : REST;
  };
  const max = Math.max(...week.days.map((d) => d.totalMs), 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid h-44 grid-cols-7 items-end gap-2.5 sm:gap-3">
        {week.days.map((d) => {
          // Top categories first so the stack reads top-down in legend order; rest at the bottom.
          const segs = (Object.entries(d.byCategory) as [Category, number][]).sort(
            (a, b) => rank(a[0], top) - rank(b[0], top),
          );
          return (
            <div key={d.date} className="flex h-full flex-col justify-end gap-1.5">
              <p className="text-center font-mono text-[10px] tabular-nums text-faint">{formatDuration(d.totalMs)}</p>
              <div
                className="flex flex-col overflow-hidden rounded-sm"
                style={{ height: `${(d.totalMs / max) * 100}%` }}
                title={`${d.date}: ${formatDuration(d.totalMs)}`}
              >
                {segs.map(([cat, ms]) => (
                  <div key={cat} style={{ height: `${(ms / d.totalMs) * 100}%`, background: color(cat) }} />
                ))}
              </div>
              <p className="text-center font-mono text-[10px] text-faint">{WEEKDAY[weekday(d.date)]}</p>
            </div>
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[11px] text-muted">
        {week.byCategory.slice(0, TOP_N).map((c, i) => (
          <li key={c.category} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: RAMP[i] }} aria-hidden />
            {CATEGORY_LABELS[c.category]} <span className="text-faint">{formatDuration(c.ms)}</span>
          </li>
        ))}
        {week.byCategory.length > TOP_N && (
          <li className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: REST }} aria-hidden />
            everything else
          </li>
        )}
      </ul>
    </div>
  );
}

function Holds({ week }: { week: Summary }) {
  const holds = week.holds.slice(0, TOP_N);
  const maxRatio = Math.max(...holds.map((h) => h.ratio), 2);
  const avgMs = week.watched ? week.totalMs / week.watched : 0;
  const tick = (1 / maxRatio) * 100;

  // The sentence: top hold's share of videos vs share of time.
  const top = holds[0];
  const topTotal = week.byCategory.find((c) => c.category === top?.category);
  const countShare = top ? top.count / week.watched : 0;

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-2.5">
        {holds.map((h) => {
          const width = (h.ratio / maxRatio) * 100;
          const over = h.ratio > 1;
          return (
            <li key={h.category} className="grid grid-cols-[minmax(0,9.5rem)_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate">{CATEGORY_LABELS[h.category]}</span>
              <div className="relative h-1.5 rounded-full bg-mist">
                {/* Ink up to your average; the red part is the extra hold past it. */}
                <div className="absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: `${Math.min(width, tick)}%` }} />
                {over && (
                  <div
                    className="absolute inset-y-0 rounded-r-full bg-skip"
                    style={{ left: `${tick}%`, width: `${width - tick}%` }}
                  />
                )}
                <span
                  className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-ink/40"
                  style={{ left: `${tick}%` }}
                  aria-hidden
                />
              </div>
              <span className="font-mono text-[11px] tabular-nums text-muted">
                <span className={over ? "text-skip" : "text-ink"}>{h.ratio.toFixed(1)}×</span>
                <span className="hidden sm:inline"> · {formatDuration(h.avgMs)}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="font-mono text-[11px] text-faint">1× = your average, {formatDuration(avgMs)} a video</p>
      {top && topTotal && (
        <p className="border-t border-line pt-4 text-[15px] leading-relaxed text-muted">
          <span className="text-ink">{cap(CATEGORY_LABELS[top.category])}</span> is{" "}
          <span className="text-ink">{pct(countShare)}</span> of what you scrolled past and{" "}
          <span className="text-skip">{pct(topTotal.share)}</span> of your time.
        </p>
      )}
    </div>
  );
}

function Skipped({ week }: { week: Summary }) {
  const { count, savedMs, byCategory } = week.skipped;
  return (
    <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
      <h3 className="basis-full text-xs font-medium uppercase tracking-wider text-faint sm:basis-auto sm:self-center">
        Skipped
      </h3>
      <p className="font-display text-2xl font-semibold tracking-tight">
        {count} <span className="font-sans text-sm font-normal text-muted">videos</span>
      </p>
      <p className="font-display text-2xl font-semibold tracking-tight">
        ~{formatDuration(savedMs)} <span className="font-sans text-sm font-normal text-muted">not spent</span>
      </p>
      <p className="font-mono text-[11px] text-faint sm:ml-auto">
        {byCategory.slice(0, 3).map((c) => `${CATEGORY_LABELS[c.category]} ${c.count}`).join(" · ")}
        {" · "}estimate = skips × your median watch ({formatDuration(week.medianMs)})
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ helpers */

function rank(cat: Category, top: Category[]): number {
  const i = top.indexOf(cat);
  return i >= 0 ? i : top.length;
}

function weekday(date: string): number {
  return new Date(`${date}T12:00:00`).getDay();
}

function dayLabel(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return `${WEEKDAY[d.getDay()]} ${d.getDate()}`;
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
