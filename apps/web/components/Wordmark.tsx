/** The mark is a feed with one card struck out — the whole product in 18px. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden className="shrink-0">
        <rect x="2" y="1" width="14" height="4" rx="1.5" fill="currentColor" />
        <rect x="2" y="7" width="14" height="4" rx="1.5" fill="currentColor" opacity="0.28" />
        <path d="M3 9h12" stroke="#e5484d" strokeWidth="1.6" strokeLinecap="round" />
        <rect x="2" y="13" width="14" height="4" rx="1.5" fill="currentColor" />
      </svg>
      <span className="font-display text-[15px] font-semibold tracking-tight">Healthy Scroll</span>
    </span>
  );
}
