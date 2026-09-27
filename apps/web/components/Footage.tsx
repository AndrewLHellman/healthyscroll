import { ReelVideo } from "./ReelVideo";

/**
 * A gradient + grain stand-in for a video frame. Shared by every mockup so
 * "footage" looks the same everywhere on the page. Given a real cover it shows
 * that; given a clip too, the clip plays over the cover while `playing`.
 */

export const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function Footage({
  tone,
  image,
  video,
  playing = false,
  preload,
  className = "",
  children,
}: {
  tone: [string, string];
  /** Optional real frame. Layered over the gradient, so a missing file just shows the gradient. */
  image?: string;
  /** Optional real clip (muted, looping), layered over the frame. */
  video?: string;
  /** Whether the clip is playing right now; it rewinds when it stops. */
  playing?: boolean;
  preload?: "none" | "metadata" | "auto";
  className?: string;
  children?: React.ReactNode;
}) {
  const gradient = `linear-gradient(160deg, ${tone[0]}, ${tone[1]})`;
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: image ? `center / cover no-repeat url("${image}"), ${gradient}` : gradient }}
    >
      {video && <ReelVideo src={video} poster={image} playing={playing} preload={preload} />}
      <div className="absolute inset-0 opacity-[0.18] mix-blend-overlay" style={{ backgroundImage: GRAIN }} aria-hidden />
      {children}
    </div>
  );
}
