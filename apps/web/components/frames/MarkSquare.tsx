import { Mark } from "@/components/Mark";
import { Frame, SQUARE, Url } from "./shared";

/** Square brand tile: mark, name, tagline. */
export function MarkSquare() {
  return (
    <Frame size={SQUARE}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-14 p-20">
        <Mark height={28 * 18} />
        <div className="text-center">
          <p className="font-display text-[72px] font-semibold leading-none tracking-[-0.035em]">Healthy Scroll</p>
          <p className="mt-5 text-[26px] text-muted">Decide what belongs in your feed.</p>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex justify-center px-14 py-10">
        <Url />
      </div>
    </Frame>
  );
}
