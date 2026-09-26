import { Footage } from "@/components/Footage";
import { BigWordmark, Frame, Key, OG, TraceLine } from "./shared";

/** Technical: the two-pass decision as a trace. */
export function Pipeline() {
  return (
    <Frame size={OG}>
      <div className="absolute inset-0 flex flex-col p-14">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[13px] font-medium uppercase tracking-wider text-faint">How it decides</p>
            <h2 className="mt-3 max-w-[820px] font-display text-[44px] font-semibold leading-[1.05] tracking-[-0.03em]">
              Words first. If they’re not enough, it checks one frame.
            </h2>
          </div>
          <BigWordmark height={32} />
        </div>

        <div className="mt-9 grid flex-1 grid-cols-[220px_1fr] gap-4 rounded-2xl border border-line bg-mist p-4">
          <div className="relative overflow-hidden rounded-xl bg-ink">
            <Footage tone={["#1b2a44", "#0a0e17"]} className="h-full">
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-14 text-white">
                <p className="text-sm font-semibold">@saturday.recap</p>
                <p className="mt-1 text-sm leading-snug text-white/90">and that was the night 🍾</p>
                <p className="mt-2 text-xs text-white/70">♪ trending audio</p>
              </div>
            </Footage>
            <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-skip px-3 py-1 font-mono text-[11px] font-medium text-white shadow-lg">
              skipped
            </div>
          </div>

          <div className="flex flex-col rounded-xl border border-line bg-paper p-5 font-mono text-[14px] leading-relaxed">
            <div className="flex items-baseline justify-between border-b border-line pb-3 text-[13px]">
              <span className="text-muted">
                skip anything that’s <span className="text-ink">gambling, drinking, thirst-trap content</span>
              </span>
              <span className="text-faint">@saturday.recap</span>
            </div>
            <ol className="mt-4 flex flex-col gap-4">
              <TraceLine stage="text" model="jev" body="does this match your rule?" p={0.54} verdict="look" ms={203} />
              <TraceLine stage="visual" model="moondream" body="“a crowded bar, several people holding drinks and shot glasses”" ms={1310} />
              <TraceLine stage="visual" model="jev" body="the frame is described. does it match now?" p={0.92} verdict="skip" ms={1310} />
            </ol>
            <div className="mt-auto flex items-center justify-between border-t border-line pt-3 text-[12px] text-faint">
              <span>frames are described, then discarded · errors never cause a skip</span>
              <span className="flex items-center gap-4">
                <Key color="bg-keep" label="keep ≤ 0.2" />
                <Key color="bg-faint" label="look closer" />
                <Key color="bg-skip" label="skip ≥ 0.8" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}
