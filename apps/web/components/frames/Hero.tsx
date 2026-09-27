import { PixelHeart } from "@/components/Mark";
import { Footage } from "@/components/Footage";
import { BigWordmark, Frame, OG } from "./shared";

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

      {/* One Reel on its way out, with the decision that sent it. */}
      <div className="absolute right-14 top-[108px] w-[236px]">
        <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-ink shadow-[0_40px_80px_-40px_rgba(18,20,26,0.5)]">
          <Footage tone={["#3b1d5a", "#0f0c1a"]} className="h-full">
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-16 text-white">
              <p className="text-sm font-semibold">@spinsdaily</p>
              <p className="mt-1 text-sm leading-snug text-white/90">late night spins hit different 🎰 #slots #bigwin</p>
              <p className="mt-2 text-xs text-white/70">♪ original sound</p>
            </div>
          </Footage>
          <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-skip px-3 py-1 font-mono text-[11px] font-medium text-white shadow-lg">
            skipped
          </div>
        </div>
        <div className="absolute -left-[150px] top-[150px] w-[300px] rounded-xl border border-line bg-paper p-4 shadow-[0_24px_60px_-28px_rgba(18,20,26,0.35)]">
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <span className="h-2 w-2 rounded-full bg-skip" /> Skipped because it matched
          </p>
          <p className="mt-2 text-[15px] leading-snug">
            It matched your prompt: <span className="font-medium">“gambling”</span>
          </p>
        </div>
      </div>
    </Frame>
  );
}
