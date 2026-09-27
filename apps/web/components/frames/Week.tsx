import { CATEGORY_LABELS, formatDuration, type Category } from "@healthyscroll/shared";
import { buildMockWeek } from "@/lib/mockWeek";
import { categoryColor, REST_COLOR } from "@/lib/categoryColors";
import { BigWordmark, Frame, OG, WEEKDAY } from "./shared";

const TOP_N = 5;

/** Usage graph: where the time went + what holds you. */
export function Week() {
  const week = buildMockWeek();
  const top = week.byCategory.slice(0, TOP_N).map((c) => c.category);
  const color = (cat: Category) => (top.includes(cat) ? categoryColor(cat) : REST_COLOR);
  const max = Math.max(...week.days.map((d) => d.totalMs), 1);

  const holds = week.holds.slice(0, 4);
  const maxRatio = Math.max(...holds.map((h) => h.ratio), 2);
  const tick = (1 / maxRatio) * 100;
  const topHold = holds[0];
  const topTotal = week.byCategory.find((c) => c.category === topHold.category)!;

  return (
    <Frame size={OG}>
      <div className="absolute inset-0 flex flex-col p-14">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[13px] font-medium uppercase tracking-wider text-faint">Your week</p>
            <h2 className="mt-3 max-w-[820px] font-display text-[44px] font-semibold leading-[1.05] tracking-[-0.03em]">
              Get to know your scrolling habits.
            </h2>
          </div>
          <BigWordmark height={32} />
        </div>

        <figure className="mt-8 grid flex-1 grid-cols-[1.15fr_1fr] gap-px overflow-hidden rounded-2xl border border-line bg-line">
          <section className="flex flex-col bg-paper px-7 py-6">
            <div className="flex items-baseline justify-between">
              <h3 className="text-[12px] font-medium uppercase tracking-wider text-faint">Where the time went</h3>
              <p className="font-mono text-[12px] text-faint">
                {formatDuration(week.totalMs)} across {week.watched} videos
              </p>
            </div>
            <div className="mt-5 grid flex-1 grid-cols-7 items-end gap-3">
              {week.days.map((d) => {
                const entries = Object.entries(d.byCategory) as [Category, number][];
                const rest = entries.filter(([c]) => !top.includes(c)).reduce((sum, [, ms]) => sum + ms, 0);
                const segs: [Category, number][] = [
                  ...entries.filter(([c]) => top.includes(c)).sort((a, b) => rank(a[0], top) - rank(b[0], top)),
                  ...(rest > 0 ? ([["other", rest]] as [Category, number][]) : []),
                ];
                return (
                  <div key={d.date} className="flex h-full flex-col justify-end gap-1.5">
                    <p className="text-center font-mono text-[11px] tabular-nums text-faint">{formatDuration(d.totalMs)}</p>
                    <div className="flex flex-col gap-px overflow-hidden rounded-sm" style={{ height: `${(d.totalMs / max) * 100}%` }}>
                      {segs.map(([cat, ms]) => (
                        <div key={cat} style={{ height: `${(ms / d.totalMs) * 100}%`, background: color(cat) }} />
                      ))}
                    </div>
                    <p className="text-center font-mono text-[11px] text-faint">{WEEKDAY[weekday(d.date)]}</p>
                  </div>
                );
              })}
            </div>
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[12px] text-muted">
              {week.byCategory.slice(0, TOP_N).map((c) => (
                <li key={c.category} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ background: categoryColor(c.category) }} />
                  {CATEGORY_LABELS[c.category]}
                </li>
              ))}
              <li className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: REST_COLOR }} />
                everything else
              </li>
            </ul>
          </section>

          <section className="flex flex-col bg-paper px-7 py-6">
            <div className="flex items-baseline justify-between">
              <h3 className="text-[12px] font-medium uppercase tracking-wider text-faint">What you watch longest</h3>
              <p className="font-mono text-[12px] text-faint">1× = your average, {formatDuration(week.totalMs / week.watched)}</p>
            </div>
            <ol className="mt-5 flex flex-col gap-3.5">
              {holds.map((h) => {
                const width = (h.ratio / maxRatio) * 100;
                const over = h.ratio > 1;
                return (
                  <li key={h.category} className="grid grid-cols-[11rem_1fr_auto] items-center gap-3 text-[15px]">
                    <span className="truncate">{CATEGORY_LABELS[h.category]}</span>
                    <div className="relative h-2 rounded-full bg-mist">
                      <div className="absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: `${Math.min(width, tick)}%` }} />
                      {over && <div className="absolute inset-y-0 rounded-r-full bg-skip" style={{ left: `${tick}%`, width: `${width - tick}%` }} />}
                      <span className="absolute top-1/2 h-3.5 w-px -translate-y-1/2 bg-ink/40" style={{ left: `${tick}%` }} />
                    </div>
                    <span className={`w-11 text-right font-mono text-[13px] tabular-nums ${over ? "text-skip" : "text-ink"}`}>
                      {h.ratio.toFixed(1)}×
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-auto border-t border-line pt-4 text-[17px] leading-relaxed text-muted">
              <span className="text-ink">{cap(CATEGORY_LABELS[topHold.category])}</span> is{" "}
              <span className="text-ink">{pct(topHold.count / week.watched)}</span> of what you scrolled past and{" "}
              <span className="text-skip">{pct(topTotal.share)}</span> of your time.
            </p>
            <div className="mt-4 flex items-baseline gap-6 border-t border-line pt-4">
              <p className="whitespace-nowrap font-display text-[26px] font-semibold tracking-tight">
                {week.skipped.count} <span className="font-sans text-[13px] font-normal text-muted">skipped</span>
              </p>
              <p className="whitespace-nowrap font-display text-[26px] font-semibold tracking-tight">
                ~{formatDuration(week.skipped.savedMs)} <span className="font-sans text-[13px] font-normal text-muted">estimated time saved</span>
              </p>
              <p className="ml-auto max-w-[150px] text-right font-mono text-[12px] leading-snug text-faint">only daily totals by topic are synced</p>
            </div>
          </section>
        </figure>
      </div>
    </Frame>
  );
}

function rank(cat: Category, top: Category[]) {
  const i = top.indexOf(cat);
  return i >= 0 ? i : top.length;
}
function weekday(date: string) {
  return new Date(`${date}T12:00:00`).getDay();
}
function pct(x: number) {
  return `${Math.round(x * 100)}%`;
}
function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
