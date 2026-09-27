/**
 * A gradient + grain stand-in for a video frame. Shared by every mockup so
 * "footage" looks the same everywhere on the page.
 */

export const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function Footage({
  tone,
  image,
  className = "",
  children,
}: {
  tone: [string, string];
  /** Optional real frame. Layered over the gradient, so a missing file just shows the gradient. */
  image?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const gradient = `linear-gradient(160deg, ${tone[0]}, ${tone[1]})`;
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: image ? `center / cover no-repeat url("${image}"), ${gradient}` : gradient }}
    >
      <div className="absolute inset-0 opacity-[0.18] mix-blend-overlay" style={{ backgroundImage: GRAIN }} aria-hidden />
      {children}
    </div>
  );
}
