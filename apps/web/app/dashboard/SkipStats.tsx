import { CATEGORY_LABELS, type Category } from "@healthyscroll/shared";
import { hourLabel, hourTick, longDate, pct, REST, shortDate, type DayStat, type Peak, type Stats } from "./stats";

import { CATEGORY_COLORS, REST_COLOR } from "@/lib/categoryColors";

/** Top categories get their own colour; everything else is one grey band. */
const TOP_N = 4;

export type Palette = Record<Category, string>;

/**
 * The analytics half of the dashboard: one headline count and two figures.
 * Everything here is derived from the `skips` table alone — that's all the
 * server has. Dwell and categories stay on the phone, so they aren't shown.
 */
export function SkipStats({ stats, allTime }: { stats: Stats; allTime: number | null }) {
  const empty = allTime === 0 || (allTime === null && stats.total === 0);

  return (
    <div className="flex flex-col gap-12">
      <Headline stats={stats} allTime={allTime} empty={empty} />
      <PerDay stats={stats} empty={empty} />
      <Figure title="By time of day" hint="your local time">
        <Hours hours={stats.hours} peak={stats.peak} empty={empty} />
        <PeakSentence stats={stats} empty={empty} />
      </Figure>
    </div>
  );
}

/** The per-day figure on its own, so it can be rendered with a different palette (see /palettes). */
export function PerDay({ stats, empty = false, palette = CATEGORY_COLORS }: { stats: Stats; empty?: boolean; palette?: Palette }) {
  const top = stats.byCategory.filter((c) => c.category !== REST).slice(0, TOP_N).map((c) => c.category);
  return (
    <Figure
      title="Per day"
      hint={`${shortDate(stats.days[0].ts)} – today`}
      aside={stats.total > 0 ? <Legend stats={stats} top={top} palette={palette} /> : undefined}
    >
      <Days days={stats.days} top={top} empty={empty} palette={palette} />
    </Figure>
  );
}

/* ------------------------------------------------------------ headline */

function Headline({ stats, allTime, empty }: { stats: Stats; allTime: number | null; empty: boolean }) {
  if (empty) {
    return (
      <p className="max-w-xl text-lg leading-relaxed text-muted">
        <span className="text-ink">Nothing skipped yet.</span> Save a prompt, open Instagram in Safari, and each skip
        is counted here.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-baseline gap-x-10 gap-y-4">
      <Stat n={stats.total} label={`in the last ${stats.days.length / 7 === 4 ? "four weeks" : `${stats.days.length} days`}`} />
      {allTime !== null && allTime !== stats.total && <Stat n={allTime} label="all time" dim />}
    </div>
  );
}

function Stat({ n, label, dim = false }: { n: number; label: string; dim?: boolean }) {
  return (
    <p className="flex items-baseline gap-3">
      <span
        className={`font-display text-5xl font-semibold tracking-[-0.03em] tabular-nums sm:text-6xl ${
          dim ? "text-faint" : "text-ink"
        }`}
      >
        {n.toLocaleString()}
      </span>
      <span className="text-sm text-muted">{label}</span>
    </p>
  );
}

/* -------------------------------------------------------------- figure */

function Figure({
  title,
  hint,
  aside,
  children,
}: {
  title: string;
  hint?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <figure className="flex flex-col gap-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-xs font-medium uppercase tracking-wider text-faint">{title}</span>
        {hint && <span className="font-mono text-[11px] text-faint">{hint}</span>}
      </figcaption>
      {children}
      {aside}
    </figure>
  );
}

function Legend({ stats, top, palette }: { stats: Stats; top: Category[]; palette: Palette }) {
  const busiest = stats.days.reduce((a, d) => (d.total > a.total ? d : a), stats.days[0]);
  const shown = stats.byCategory.filter((c) => top.includes(c.category));
  const rest = stats.total - shown.reduce((a, c) => a + c.count, 0);
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[11px] text-muted">
        {shown.map((c) => (
          <li key={c.category} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: palette[c.category] }} aria-hidden />
            {CATEGORY_LABELS[c.category]} <span className="text-faint">{c.count}</span>
          </li>
        ))}
        {rest > 0 && (
          <li className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: REST_COLOR }} aria-hidden />
            {top.length ? "everything else" : "uncategorised"} <span className="text-faint">{rest}</span>
          </li>
        )}
      </ul>
      <p className="font-mono text-[11px] text-faint">
        most in a day: {busiest.total}, {longDate(busiest.ts)}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- days */

function Days({ days, top, empty, palette }: { days: DayStat[]; top: Category[]; empty: boolean; palette: Palette }) {
  const max = Math.max(...days.map((d) => d.total), 1);
  const colorOf = (cat: Category) => (top.includes(cat) ? palette[cat] : REST_COLOR);
  const rank = (cat: Category) => {
    const i = top.indexOf(cat);
    return i >= 0 ? i : top.length;
  };
  // A tick every week, and one for today if it's not already on a tick.
  const tickAt = (i: number) => i % 7 === 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-36 items-end gap-1 border-b border-line sm:gap-1.5" role="img" aria-label={daysLabel(days)}>
        {days.map((d) => (
          <div
            key={d.date}
            className="group relative flex h-full flex-1 flex-col justify-end"
            title={dayTitle(d)}
          >
            {d.total > 0 ? (
              // Legend order top-down, so the darkest band is always at the top of the bar.
              <div className="flex flex-col overflow-hidden rounded-t-sm" style={{ height: `${(d.total / max) * 100}%` }}>
                {(Object.entries(d.byCategory) as [Category, number][])
                  .sort((a, b) => rank(a[0]) - rank(b[0]))
                  .map(([cat, n]) => (
                    <div key={cat} style={{ flexGrow: n, background: colorOf(cat) }} />
                  ))}
              </div>
            ) : (
              <div className={`h-px ${empty ? "bg-line" : "bg-faint/60"}`} />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-1 font-mono text-[10px] text-faint sm:gap-1.5" aria-hidden>
        {days.map((d, i) => (
          <span key={d.date} className="flex-1 whitespace-nowrap">
            {tickAt(i) ? shortDate(d.ts) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function dayTitle(d: DayStat): string {
  if (!d.total) return `${longDate(d.ts)} · nothing skipped`;
  const parts = (Object.entries(d.byCategory) as [Category, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([cat, n]) => `${CATEGORY_LABELS[cat]} ${n}`);
  return `${longDate(d.ts)} · ${d.total} skipped · ${parts.join(", ")}`;
}

function daysLabel(days: DayStat[]): string {
  const total = days.reduce((a, d) => a + d.total, 0);
  const busiest = days.reduce((a, d) => (d.total > a.total ? d : a), days[0]);
  return total
    ? `${total} skips over ${days.length} days; busiest day ${longDate(busiest.ts)} with ${busiest.total}.`
    : `No skips in the last ${days.length} days.`;
}

/* --------------------------------------------------------------- hours */

function Hours({ hours, peak, empty }: { hours: number[]; peak: Peak | null; empty: boolean }) {
  const max = Math.max(...hours, 1);
  const inPeak = (h: number) => !!peak && ((h - peak.start + 24) % 24) < peak.end - peak.start;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-px" role="img" aria-label={hoursLabel(hours)}>
        {hours.map((n, h) => (
          <span
            key={h}
            className={`h-7 flex-1 first:rounded-l-sm last:rounded-r-sm ${
              empty || n === 0 ? "bg-mist" : inPeak(h) ? "bg-skip" : "bg-ink"
            }`}
            style={n ? { opacity: 0.18 + 0.82 * (n / max) } : undefined}
            title={`${hourLabel(h)} – ${hourLabel(h + 1)} · ${n} skipped`}
          />
        ))}
      </div>
      <div className="flex font-mono text-[10px] text-faint" aria-hidden>
        {hours.map((_, h) => (
          <span key={h} className="flex-1">
            {h % 6 === 0 ? hourTick(h) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function hoursLabel(hours: number[]): string {
  const total = hours.reduce((a, b) => a + b, 0);
  if (!total) return "No skips yet.";
  const top = hours.indexOf(Math.max(...hours));
  return `Skips by hour of day; the busiest hour is ${hourLabel(top)} to ${hourLabel(top + 1)}.`;
}

function PeakSentence({ stats, empty }: { stats: Stats; empty: boolean }) {
  if (empty) {
    return null;
  }
  if (!stats.peak) {
    return (
      <p className="text-[15px] leading-relaxed text-muted">
        Not enough skips yet to show a pattern.
      </p>
    );
  }
  const { start, end, share } = stats.peak;
  return (
    <p className="text-[15px] leading-relaxed text-muted">
      <span className="text-ink">{pct(share)}</span> of your skips were between{" "}
      <span className="text-skip">{hourLabel(start)}</span> and <span className="text-skip">{hourLabel(end)}</span>.
    </p>
  );
}
