import { Mark } from "@/components/Mark";
import { BigWordmark, Frame, OG, Url } from "./shared";

/** The whole setup is one text box. */
export function Prompt() {
  return (
    <Frame size={OG}>
      <div className="absolute inset-0 grid grid-cols-[1fr_440px] gap-16 p-14">
        <div className="flex flex-col">
          <BigWordmark />
          <div className="mt-auto">
            <p className="text-[13px] font-medium uppercase tracking-wider text-faint">Setup</p>
            <h2 className="mt-3 font-display text-[56px] font-semibold leading-[1.02] tracking-[-0.03em]">
              Decide what belongs
              <br />
              in your feed.
            </h2>
            <p className="mt-5 max-w-[520px] text-[19px] leading-relaxed text-muted">
              Describe what you’d like to see less of. You can change your prompt whenever you want.
            </p>
          </div>
          <div className="mt-8">
            <Url />
          </div>
        </div>

        {/* The popup, drawn at 1.3× so it reads across a feed. */}
        <div className="relative self-center">
          <div className="flex items-center justify-end gap-3 rounded-t-xl border border-b-0 border-line bg-mist px-4 py-2.5">
            <span className="h-2.5 w-32 rounded-full bg-line" />
            <Mark height={16} />
          </div>
          <div className="rounded-b-xl border border-line bg-paper p-6 shadow-[0_32px_80px_-32px_rgba(18,20,26,0.35)]">
            <div className="flex items-center justify-between">
              <p className="text-[19px] font-semibold tracking-tight">Healthy Scroll</p>
              <span className="flex items-center gap-2 text-[14px] text-muted">
                On
                <span className="grid h-5 w-5 place-items-center rounded-sm bg-ink text-[12px] text-paper">✓</span>
              </span>
            </div>
            <p className="mt-5 text-[14px] text-muted">Skip anything that’s…</p>
            <div className="mt-2 rounded-lg border border-line p-4 font-display text-[22px] font-medium leading-snug tracking-tight">
              gambling, drinking, thirst-trap content, anything that makes me feel worse about myself
              <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] bg-ink" />
            </div>
            <div className="mt-4 rounded-lg bg-ink py-2.5 text-center text-[15px] text-paper">Save</div>
            <p className="mt-5 flex items-baseline justify-between border-t border-line pt-4 font-mono text-[13px] text-muted">
              <span>
                today: 22m, 8 skipped, mostly <span className="text-ink">comedy</span>
              </span>
              <span>→</span>
            </p>
          </div>
        </div>
      </div>
    </Frame>
  );
}
