import { Mark } from "@/components/Mark";
import { Frame, SQUARE } from "./shared";

/** The mark alone, centred on white. 30 units per cell so it stays crisp at 2×. */
export function MarkOnly() {
  return (
    <Frame size={SQUARE}>
      <div className="absolute inset-0 grid place-items-center">
        <Mark height={28 * 30} />
      </div>
    </Frame>
  );
}
