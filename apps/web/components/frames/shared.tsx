import { Mark } from "@/components/Mark";
import { Footage } from "@/components/Footage";

/**
 * Fixed-size social graphics (Open Graph, Devpost), drawn in the landing page's
 * own palette and components. Each frame is exactly `W × H` CSS pixels; the
 * screenshot script renders them at 2×. Not linked from the site.
 */

export const OG = { w: 1200, h: 630 } as const;
export const SQUARE = { w: 1080, h: 1080 } as const;
/** Devpost gallery images want 3:2. */
export const DEVPOST = { w: 1500, h: 1000 } as const;
/** Backgrounds for the demo video, with the team's cameras along the bottom. */
export const VIDEO = { w: 1920, h: 1080 } as const;

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

/**
 * Where `scripts/demo-video.sh` drops the four camera tiles (CSS px in a VIDEO
 * frame). The tiles come straight out of the meeting recording at 1:1, which is
 * why they're different widths: the fourth camera is 4:3. Keep in sync with the
 * script.
 */
export const CAMERAS = [
  { x: 194, y: 814, w: 395, h: 218 },
  { x: 605, y: 814, w: 395, h: 218 },
  { x: 1016, y: 814, w: 395, h: 218 },
  { x: 1427, y: 814, w: 304, h: 218 },
] as const;
/** Top of the camera band; video frames keep their content above this. */
export const STAGE_H = 770;

/** A VIDEO frame: paper, with a shadowed placeholder under each camera tile so the overlay sits on something. */
export function Stage({ children }: { children: React.ReactNode }) {
  return (
    <Frame size={VIDEO}>
      <div className="absolute inset-x-0 top-0" style={{ height: STAGE_H }}>
        {children}
      </div>
      {CAMERAS.map((c, i) => (
        <div
          key={i}
          className="absolute rounded-[14px] bg-mist shadow-[0_24px_48px_-24px_rgba(18,20,26,0.45)]"
          style={{ left: c.x, top: c.y, width: c.w, height: c.h }}
        />
      ))}
    </Frame>
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

/* ----------------------------------------------------------------- reel */

/** One Reel on its way out, with the decision that sent it. Hero and the video title card. `k` scales the whole thing. */
export function SkippedReel({ k = 1 }: { k?: number }) {
  return (
    <div className="relative" style={{ width: 236 * k, fontSize: 16 * k }}>
      <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-ink shadow-[0_40px_80px_-40px_rgba(18,20,26,0.5)]">
        <Footage tone={["#3b1d5a", "#0f0c1a"]} className="h-full">
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-[1em] pt-[4em] text-white">
            <p className="text-[0.875em] font-semibold">@spinsdaily</p>
            <p className="mt-[0.25em] text-[0.875em] leading-snug text-white/90">late night spins hit different 🎰 #slots #bigwin</p>
            <p className="mt-[0.5em] text-[0.75em] text-white/70">♪ original sound</p>
          </div>
        </Footage>
        <div className="absolute left-1/2 top-[1em] -translate-x-1/2 rounded-full bg-skip px-[0.75em] py-[0.25em] font-mono text-[0.6875em] font-medium text-white shadow-lg">
          skipped
        </div>
      </div>
      <div
        className="absolute rounded-xl border border-line bg-paper p-[1em] shadow-[0_24px_60px_-28px_rgba(18,20,26,0.35)]"
        style={{ left: -150 * k, top: 150 * k, width: 300 * k }}
      >
        <p className="flex items-center gap-[0.5em] text-[0.8125em] text-muted">
          <span className="h-[0.5em] w-[0.5em] rounded-full bg-skip" /> Skipped because it matched
        </p>
        <p className="mt-[0.5em] text-[0.9375em] leading-snug">
          It matched your prompt: <span className="font-medium">“gambling”</span>
        </p>
      </div>
    </div>
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

export const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
