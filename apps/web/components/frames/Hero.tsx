import { PixelHeart } from "@/components/Mark";
import { BigWordmark, Frame, OG, SkippedReel } from "./shared";

/** Default OG image: headline + one skipped Reel. */
export function Hero() {
  return (
    <Frame size={OG}>
      <div className="absolute inset-0 flex flex-col p-14">
        <div className="flex items-center justify-between">
          <BigWordmark />
          <span className="inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-[13px] text-muted">
            <PixelHeart size={10} /> Free for iPhone
          </span>
        </div>
        <div className="mt-auto max-w-[660px]">
          <h1 className="font-display text-[60px] font-semibold leading-[1.02] tracking-[-0.03em]">
            Take back your feed.
            <br />
            <span className="text-muted">Make room for what you want to watch.</span>
          </h1>
          <p className="mt-6 max-w-[560px] text-[21px] leading-relaxed text-muted">
            A Safari extension for iPhone. Decide what belongs in your feed, and skip matching Reels.
          </p>
        </div>
        <p className="mt-8 font-mono text-[14px] text-faint">
          healthyscroll.net <span className="mx-2">·</span> free <span className="mx-2">·</span> open source{" "}
          <span className="mx-2">·</span> sign in with Google
        </p>
      </div>

      <div className="absolute right-14 top-[108px]">
        <SkippedReel />
      </div>
    </Frame>
  );
}
