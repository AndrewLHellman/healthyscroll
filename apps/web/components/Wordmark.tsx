import { Mark } from "./Mark";

/** The mark plus the name. The mark is 2px per cell here so it stays crisp. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Mark height={28} className="shrink-0" />
      <span className="font-display text-[15px] font-semibold tracking-tight">Healthy Scroll</span>
    </span>
  );
}
