"use client";

import { useEffect, useRef } from "react";

/**
 * The moving part of a mock Reel: a muted, looping clip over the cover. Plays
 * only while `playing` is true and rewinds when it stops, so every play starts
 * at the top. Under prefers-reduced-motion it never plays, whatever the parent
 * says, and the cover shows instead.
 */
export function ReelVideo({
  src,
  poster,
  playing,
  preload = "metadata",
}: {
  src: string;
  poster?: string;
  playing: boolean;
  preload?: "none" | "metadata" | "auto";
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (playing && !still) {
      // Autoplay can be refused (power saving, data saver); the cover is fine then.
      v.play().catch(() => {});
    } else {
      v.pause();
      if (v.currentTime > 0) v.currentTime = 0;
    }
  }, [playing]);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      preload={preload}
      muted
      loop
      playsInline
      disablePictureInPicture
      disableRemotePlayback
      tabIndex={-1}
      aria-hidden
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}
