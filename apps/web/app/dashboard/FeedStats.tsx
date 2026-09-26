import { CATEGORY_LABELS, formatDuration, type Category } from "@healthyscroll/shared";
import { compactDuration, longDate, pct, REST, shortDate, weekday, type DayStat, type Stats } from "./stats";

import { CATEGORY_COLORS, REST_COLOR } from "@/lib/categoryColors";

/** Top categories get their own colour; everything else is one grey band. */
const TOP_N = 4;
/** The share-skipped figure shows the most recent fortnight, so each column has room for a time label. */
const SHARE_DAYS = 14;

/**
 * The analytics half of the dashboard: three numbers and two figures. The
 * main one is what got skipped, per day, stacked by kind. Under it, how much
 * of each day's scrolling was skipped, with the day's watch time on top of
 * each column.
 */
export function FeedStats({ stats, allTime }: { stats: Stats; allTime: number | null }) {
  const empty = allTime === 0 || (allTime === null && stats.seen === 0);

  return (
    <div className="flex flex-col gap-14">
      <Headline stats={stats} empty={empty} />
      <SkippedByKind stats={stats} empty={empty} />
      {stats.tracked && <ShareSkipped days={stats.days.slice(-SHARE_DAYS)} />}
    </div>
  );
}

/* ------------------------------------------------------------ headline */

function Headline({ stats, empty }: { stats: Stats; empty: boolean }) {
  if (empty) {
    return (
      <p className="max-w-xl text-lg leading-relaxed text-muted">
        <span className="text-ink">Nothing to show yet.</span> Save a prompt, open Instagram in Safari, and every Reel
        you scroll past is counted here.
      </p>
    );
  }
  if (!stats.tracked) {
    return (
      <div className="flex flex-wrap gap-x-12 gap-y-6">
        <Stat value={stats.skipped.toLocaleString()} label="Reels skipped" />
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-x-12 gap-y-6">
      <Stat
        value={stats.skipped.toLocaleString()}
        label="Reels skipped"
        note={`${pct(stats.skipped / stats.seen)} of ${stats.seen.toLocaleString()} seen`}
      />
      <Stat
        value={formatDuration(stats.seconds * 1000)}
        label="watching"
        note={`about ${formatDuration((stats.seconds / stats.days.length) * 1000)} a day`}
      />
    </div>
  );
}

function Stat({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <p className="flex flex-col gap-1">
      <span className="flex items-baseline gap-2.5">
        <span className="font-display text-4xl font-semibold tracking-[-0.03em] tabular-nums text-ink sm:text-5xl">
          {value}
        </span>
        <span className="text-sm text-muted">{label}</span>
      </span>
      {note && <span className="font-mono text-[11px] text-faint">{note}</span>}
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

function Swatch({ color }: { color: string }) {
  return <span className="h-2 w-2 rounded-sm" style={{ background: color }} aria-hidden />;
}

/* ----------------------------------------------------- skipped by kind */

function SkippedByKind({ stats, empty }: { stats: Stats; empty: boolean }) {
  const top = stats.skippedByCategory.filter((c) => c.category !== REST).slice(0, TOP_N).map((c) => c.category);
  return (
    <Figure
      title="Skipped, by kind"
      hint={`${shortDate(stats.days[0].ts)} – today`}
      aside={stats.skipped > 0 ? <Legend stats={stats} top={top} /> : undefined}
    >
      <Days days={stats.days} top={top} empty={empty} />
    </Figure>
  );
}

function Legend({ stats, top }: { stats: Stats; top: Category[] }) {
  const busiest = stats.days.reduce((a, d) => (d.skipped > a.skipped ? d : a), stats.days[0]);
  const shown = stats.skippedByCategory.filter((c) => top.includes(c.category));
  const rest = stats.skipped - shown.reduce((a, c) => a + c.count, 0);
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[11px] text-muted">
        {shown.map((c) => (
          <li key={c.category} className="flex items-center gap-1.5">
            <Swatch color={CATEGORY_COLORS[c.category]} />
            {CATEGORY_LABELS[c.category]} <span className="text-faint">{c.count}</span>
          </li>
        ))}
        {rest > 0 && (
          <li className="flex items-center gap-1.5">
            <Swatch color={REST_COLOR} />
            {top.length ? "everything else" : "uncategorised"} <span className="text-faint">{rest}</span>
          </li>
        )}
      </ul>
      <p className="font-mono text-[11px] text-faint">
        most in a day: {busiest.skipped}, {longDate(busiest.ts)}
      </p>
    </div>
  );
}

function Days({ days, top, empty }: { days: DayStat[]; top: Category[]; empty: boolean }) {
  const max = Math.max(...days.map((d) => d.skipped), 1);
  const colorOf = (cat: Category) => (top.includes(cat) ? CATEGORY_COLORS[cat] : REST_COLOR);
  const rank = (cat: Category) => {
    const i = top.indexOf(cat);
    return i >= 0 ? i : top.length;
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-40 items-end gap-1 border-b border-line sm:gap-1.5" role="img" aria-label={daysLabel(days)}>
        {days.map((d) => (
          <div key={d.date} className="flex h-full flex-1 flex-col justify-end" title={dayTitle(d)}>
            {d.skipped > 0 ? (
              // Legend order top-down, so the biggest kind is always the top band.
              <div className="flex flex-col overflow-hidden rounded-t-sm" style={{ height: `${(d.skipped / max) * 100}%` }}>
                {(Object.entries(d.skippedByCategory) as [Category, number][])
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
            {i % 7 === 0 ? shortDate(d.ts) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function dayTitle(d: DayStat): string {
  if (!d.skipped) return `${longDate(d.ts)} · nothing skipped`;
  const parts = (Object.entries(d.skippedByCategory) as [Category, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([cat, n]) => `${CATEGORY_LABELS[cat]} ${n}`);
  return `${longDate(d.ts)} · ${d.skipped} skipped · ${parts.join(", ")}`;
}

function daysLabel(days: DayStat[]): string {
  const total = days.reduce((a, d) => a + d.skipped, 0);
  if (!total) return `No skips in the last ${days.length} days.`;
  const busiest = days.reduce((a, d) => (d.skipped > a.skipped ? d : a), days[0]);
  return `${total} skips over ${days.length} days; busiest day ${longDate(busiest.ts)} with ${busiest.skipped}.`;
}

/* ------------------------------------------------------- share skipped */

function ShareSkipped({ days }: { days: DayStat[] }) {
  const share = (d: DayStat) => (d.seen ? d.skipped / d.seen : 0);
  const seen = days.reduce((a, d) => a + d.seen, 0);
  const skipped = days.reduce((a, d) => a + d.skipped, 0);

  return (
    <Figure
      title="Share of each day skipped"
      hint={`last ${days.length} days · time watching above each day`}
      aside={
        <p className="font-mono text-[11px] text-faint">
          {pct(seen ? skipped / seen : 0)} over the fortnight · {formatDuration(days.reduce((a, d) => a + d.seconds, 0) * 1000)}{" "}
          watching
        </p>
      }
    >
      <div className="flex h-44 items-end gap-1.5 sm:gap-3" role="img" aria-label={shareLabel(days, seen, skipped)}>
        {days.map((d) => (
          <div key={d.date} className="flex h-full flex-1 flex-col justify-end gap-1.5" title={shareTitle(d)}>
            <p className="text-center font-mono text-[10px] tabular-nums text-faint">{compactDuration(d.seconds)}</p>
            {/* The whole column is the day's scrolling; the filled part is what got skipped. */}
            <div className="relative flex flex-1 flex-col justify-end overflow-hidden rounded-sm bg-mist">
              {d.seen > 0 && (
                <>
                  <span
                    className="absolute inset-x-0 text-center font-mono text-[10px] tabular-nums text-ink"
                    style={{ bottom: `calc(${share(d) * 100}% + 4px)` }}
                  >
                    {pct(share(d))}
                  </span>
                  <div className="bg-skip" style={{ height: `${Math.max(share(d) * 100, 1)}%` }} />
                </>
              )}
            </div>
            <p className="text-center font-mono text-[10px] text-faint">{weekday(d.ts).slice(0, 2)}</p>
          </div>
        ))}
      </div>
    </Figure>
  );
}

function shareTitle(d: DayStat): string {
  if (!d.seen) return `${longDate(d.ts)} · nothing`;
  return `${longDate(d.ts)} · ${pct(d.skipped / d.seen)} skipped (${d.skipped} of ${d.seen}) · ${formatDuration(d.seconds * 1000)} watching`;
}

function shareLabel(days: DayStat[], seen: number, skipped: number): string {
  if (!seen) return `No Reels in the last ${days.length} days.`;
  return `Share of Reels skipped each day for the last ${days.length} days, ${pct(skipped / seen)} overall, with time spent watching above each column.`;
}
