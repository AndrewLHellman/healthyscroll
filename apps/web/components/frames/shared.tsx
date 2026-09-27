import { Mark } from "@/components/Mark";

/**
 * Fixed-size social graphics (Open Graph, Devpost), drawn in the landing page's
 * own palette and components. Each frame is exactly `W × H` CSS pixels; the
 * screenshot script renders them at 2×. Not linked from the site.
 */

export const OG = { w: 1200, h: 630 } as const;
export const SQUARE = { w: 1080, h: 1080 } as const;
/** Devpost gallery images want 3:2. */
export const DEVPOST = { w: 1500, h: 1000 } as const;

export type Size = { w: number; h: number };

export interface FrameDef {
  slug: string;
  title: string;
  note: string;
  size: Size;
  render: () => React.ReactNode;
}

/* ---------------------------------------------------------------- shell */

export function Frame({ size, dark = false, children }: { size: Size; dark?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`relative overflow-hidden ${dark ? "bg-ink text-paper" : "bg-paper text-ink"}`}
      style={{ width: size.w, height: size.h }}
    >
      {children}
    </div>
  );
}

export function BigWordmark({ dark = false, height = 40 }: { dark?: boolean; height?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-3.5 whitespace-nowrap">
      <Mark height={height} frame={dark ? "#ffffff" : "currentColor"} card={dark ? "#5a5f6b" : "#c4c8cf"} />
      <span className="font-display font-semibold tracking-tight" style={{ fontSize: height * 0.55 }}>
        Healthy Scroll
      </span>
    </span>
  );
}

export function Url({ dark = false, size = 14 }: { dark?: boolean; size?: number }) {
  return (
    <span className={`font-mono ${dark ? "text-paper/45" : "text-faint"}`} style={{ fontSize: size }}>
      healthyscroll.net
    </span>
  );
}

/* ---------------------------------------------------------------- trace */

export type Verdict = "skip" | "keep" | "look";

export function TraceLine({
  stage,
  model,
  body,
  p,
  verdict,
  ms,
}: {
  stage: string;
  model: "jev" | "gemini" | "moondream";
  body: string;
  p?: number;
  verdict?: Verdict;
  ms?: number;
}) {
  return (
    <li className="grid grid-cols-[72px_1fr] gap-3">
      <span className="pt-px text-[12px] uppercase tracking-wider text-faint">{stage}</span>
      <div>
        <div className="flex items-baseline gap-x-2">
          <span className={model === "jev" ? "text-accent-ink" : "text-muted"}>{model}</span>
          <span className="text-ink">{body}</span>
          {p === undefined && ms !== undefined && <span className="ml-auto whitespace-nowrap pl-2 text-[12px] text-faint">{fmtMs(ms)}</span>}
        </div>
        {p !== undefined && verdict && <Meter p={p} verdict={verdict} ms={ms} />}
      </div>
    </li>
  );
}

const CELLS = 10;

export function Meter({ p, verdict, ms }: { p: number; verdict: Verdict; ms?: number }) {
  const color = verdict === "skip" ? "bg-skip" : verdict === "keep" ? "bg-keep" : "bg-faint";
  const textColor = verdict === "skip" ? "text-skip" : verdict === "keep" ? "text-keep" : "text-muted";
  const lit = Math.round(p * CELLS);
  return (
    <div className="mt-2 flex items-center gap-3">
      <div className="flex flex-1 gap-px" aria-hidden>
        {Array.from({ length: CELLS }, (_, k) => (
          <span key={k} className={`h-2 flex-1 ${k < lit ? color : "bg-mist"} ${k === 2 || k === 8 ? "ml-1" : ""}`} />
        ))}
      </div>
      <span className="w-10 text-right tabular-nums text-ink">{p.toFixed(2)}</span>
      <span className={`w-20 whitespace-nowrap ${textColor}`}>{verdict === "look" ? "look closer" : verdict}</span>
      {ms !== undefined && <span className="w-14 whitespace-nowrap text-right tabular-nums text-faint">{fmtMs(ms)}</span>}
    </div>
  );
}

export function fmtMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}

export function Key({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

export const WEEKDAY = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
