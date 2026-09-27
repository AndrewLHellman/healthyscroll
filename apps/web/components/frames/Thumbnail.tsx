import { Mark } from "@/components/Mark";
import { BigWordmark, Frame, OG, Url, type Size } from "./shared";

/** Brand card: wordmark, tagline, and the mark at whole-pixel scale. Light by default; `dark` for dark surfaces. */
export function Thumbnail({
  dark = false,
  size = OG,
  cell = 12,
  type = 1,
  top = 1,
  body = 1,
}: {
  dark?: boolean;
  size?: Size;
  /** CSS px per mark cell; the mark is 28 cells tall. */
  cell?: number;
  /** Extra multiplier on the type only, for frames with more room than the OG card. */
  type?: number;
  /** Further multiplier on the top row (wordmark + url), which otherwise reads small at 3:2. */
  top?: number;
  /** Multiplier on the subtitle only. */
  body?: number;
}) {
  /** Padding scales with the frame width; type scales with that times `type`. */
  const k = size.w / OG.w;
  const t = k * type;
  return (
    <Frame size={size} dark={dark}>
      <div className="absolute inset-0 flex flex-col" style={{ padding: 56 * k }}>
        <div className="flex items-center justify-between">
          <BigWordmark dark={dark} height={Math.round(32 * t * top)} />
          <Url dark={dark} size={Math.round(14 * t * top)} />
        </div>
        <div className="mt-auto flex items-end justify-between" style={{ gap: 48 * k }}>
          <div>
            <h1 className="font-display font-semibold leading-[0.98] tracking-[-0.035em]" style={{ fontSize: 68 * t }}>
              Take back
              <br />
              your feed.
            </h1>
            <p
              className={`leading-relaxed ${dark ? "text-paper/60" : "text-muted"}`}
              style={{ fontSize: 22 * t * body, marginTop: 20 * t, maxWidth: 560 * t * body }}
            >
              Healthy Scroll is a social media filter that makes your Instagram Reels algorithm work for you.
            </p>
          </div>
          {/* Whole units per cell, so the pixels stay crisp. */}
          <Mark
            height={28 * cell}
            frame={dark ? "#ffffff" : "#12141a"}
            card={dark ? "#5a5f6b" : "#c4c8cf"}
            className="shrink-0"
          />
        </div>
      </div>
    </Frame>
  );
}
