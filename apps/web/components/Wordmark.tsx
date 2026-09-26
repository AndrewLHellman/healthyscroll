import { MarkImage } from "./Mark";

/** The mark plus the name. The mark is the bitmap so it looks the same on every screen. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <MarkImage height={28} className="shrink-0" />
      <span className="font-display text-[15px] font-semibold tracking-tight">Healthy Scroll</span>
    </span>
  );
}
