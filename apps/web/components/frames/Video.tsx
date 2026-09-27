import { PixelHeart } from "@/components/Mark";
import { Footage } from "@/components/Footage";
import { CLIPS, type PlaygroundClip } from "@/lib/playground/clips";
import { Week } from "./Week";
import { BigWordmark, OG, SkippedReel, Stage, Url } from "./shared";

/**
 * 16:9 backgrounds for the demo video's intro (`scripts/demo-video.sh`). Each
 * keeps its content above the camera band and matches the landing page, so
 * cutting to the screen recording of the site feels like the same room.
 */

/** The prompt the "problem → solution" pair is judged against. */
const PROMPT = "gambling, drinking, thirst-trap content, rage bait, crypto hype";
/** Which of the playground Reels that prompt would skip (their `mock.tags`). */
const SKIPPED = new Set(["gambling", "drinking", "body", "rage", "crypto"]);
const matches = (c: PlaygroundClip) => c.mock.tags.some((t) => SKIPPED.has(t));

/** Opening card: who we are and what it is. */
export function VideoTitle() {
  return (
    <Stage>
      <div className="absolute inset-0 flex flex-col px-16 pt-14 pb-12">
        <div className="flex items-center justify-between">
          <BigWordmark height={44} />
          <span className="inline-flex items-center gap-2.5 rounded-full border border-line px-4 py-2 text-[16px] text-muted">
            <PixelHeart size={12} /> Built at TigerHacks 2026
          </span>
        </div>
        <div className="mt-auto">
          <h1 className="font-display text-[104px] font-semibold leading-[0.98] tracking-[-0.035em]">
            Take back your feed.
          </h1>
          <p className="mt-7 max-w-[900px] text-[28px] leading-relaxed text-muted">
            A Safari extension for iPhone. Decide what belongs in your Instagram feed, and skip the Reels that don’t.
          </p>
        </div>
        <div className="mt-8">
          <Url size={17} />
        </div>
      </div>
      <div className="absolute right-16 top-[140px]">
        <SkippedReel k={1.35} />
      </div>
    </Stage>
  );
}

/** The problem: the feed is chosen for you. Every Reel shown as it arrives. */
export function VideoProblem() {
  return (
    <Stage>
      <div className="absolute inset-0 flex flex-col px-16 pt-14">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[15px] font-medium uppercase tracking-wider text-faint">The problem</p>
            <h2 className="mt-3 font-display text-[56px] font-semibold leading-[1.02] tracking-[-0.03em]">
              The algorithm decides what you watch.
              <br />
              <span className="text-muted">You just keep scrolling.</span>
            </h2>
          </div>
          <BigWordmark height={36} />
        </div>
        <div className="mt-auto">
          <Feed />
        </div>
      </div>
    </Stage>
  );
}

/** The solution: the same feed, after one sentence. */
export function VideoSolution() {
  return (
    <Stage>
      <div className="absolute inset-0 flex flex-col px-16 pt-14">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[15px] font-medium uppercase tracking-wider text-faint">Healthy Scroll</p>
            <h2 className="mt-3 font-display text-[56px] font-semibold leading-[1.02] tracking-[-0.03em]">
              Say what you don’t want, in plain English.
              <br />
              <span className="text-muted">Matching Reels are skipped before you see them.</span>
            </h2>
          </div>
          <BigWordmark height={36} />
        </div>
        <div className="mt-8 flex items-center gap-4 rounded-2xl border border-line bg-paper px-6 py-4 shadow-[0_24px_60px_-32px_rgba(18,20,26,0.3)]">
          <span className="whitespace-nowrap text-[18px] text-muted">Skip anything that’s…</span>
          <span className="font-display text-[26px] font-medium tracking-tight">
            {PROMPT}
            <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[4px] bg-ink" />
          </span>
        </div>
        <div className="mt-auto">
          <Feed filtered />
        </div>
      </div>
    </Stage>
  );
}

/** Empty stage: the screen recording of the site goes in `WINDOW`. */
export function VideoStage({ children }: { children?: React.ReactNode }) {
  return (
    <Stage>
      <div
        className="absolute overflow-hidden rounded-2xl border border-line bg-mist shadow-[0_48px_96px_-40px_rgba(18,20,26,0.45)]"
        style={{ left: WINDOW.x, top: WINDOW.y, width: WINDOW.w, height: WINDOW.h }}
      >
        {children}
      </div>
    </Stage>
  );
}

/** Where the recording lands in VideoStage (CSS px). Keep in sync with `scripts/demo-video.sh`. */
export const WINDOW = { x: 304, y: 28, w: 1312, h: 738 } as const;

/** "Your week" graphic, scaled into the stage window. */
export function VideoWeek() {
  const k = WINDOW.w / OG.w;
  return (
    <VideoStage>
      <div style={{ transform: `scale(${k})`, transformOrigin: "top left", width: OG.w, height: OG.h }}>
        <Week />
      </div>
    </VideoStage>
  );
}

/* ------------------------------------------------------------------ feed */

const CARD_H = 373;

/** The eight playground Reels in a row. `filtered` dims the ones the prompt would skip. */
function Feed({ filtered = false }: { filtered?: boolean }) {
  return (
    <ul className="flex gap-4" style={{ height: CARD_H + 24 }}>
      {CLIPS.map((c) => {
        const skip = filtered && matches(c);
        return (
          <li key={c.context.videoId} className="relative flex-1">
            <div
              className={`relative h-full overflow-hidden rounded-xl bg-ink shadow-[0_32px_64px_-36px_rgba(18,20,26,0.5)] transition-opacity ${skip ? "opacity-[0.28] grayscale" : ""}`}
              style={{ height: CARD_H }}
            >
              <Footage tone={c.tone} image={c.reel?.poster} className="h-full">
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3.5 pt-14 text-white">
                  <p className="text-[13px] font-semibold">@{c.context.author}</p>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-white/90">{c.context.description}</p>
                  <p className="mt-1.5 truncate text-[11px] text-white/70">♪ {c.context.audioTitle}</p>
                </div>
              </Footage>
            </div>
            {skip && (
              <span className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-skip px-3 py-1 font-mono text-[12px] font-medium text-white shadow-lg">
                skipped
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
