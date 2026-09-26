import type { VideoContext } from "@healthyscroll/shared";

/**
 * The mock feed behind the prompt playground on the landing page.
 *
 * Each clip carries a full `VideoContext` (what the extension would scrape off
 * the page) plus the sentence Moondream would produce for its frame, so the
 * live Jev scorer gets exactly the inputs the real pipeline does. The `mock`
 * block is only read by the keyword scorer.
 */
export interface PlaygroundClip {
  context: VideoContext;
  /** What Moondream would say about the first frame. Sent to Jev as a frame caption. */
  frameCaption: string;
  /** Two-stop gradient standing in for the video. */
  tone: [string, string];
  mock: {
    /** What this clip is "about"; matched against words in the prompt. */
    tags: string[];
    /** Probability shown when the prompt matches it. */
    hit: number;
    /** Probability shown when it doesn't. */
    miss: number;
  };
}

const clip = (
  author: string,
  description: string,
  hashtags: string[],
  audioTitle: string,
  frameCaption: string,
  tone: [string, string],
  mock: PlaygroundClip["mock"],
): PlaygroundClip => ({
  context: {
    videoId: `playground-${author}`,
    platform: "tiktok",
    url: `https://www.tiktok.com/@${author}/video/playground`,
    author,
    description,
    hashtags,
    audioTitle,
  },
  frameCaption,
  tone,
  mock,
});

export const CLIPS: PlaygroundClip[] = [
  clip(
    "spinsdaily",
    "late night spins 🎰 #bigwin",
    ["slots", "bigwin", "casino"],
    "original sound",
    "a slot machine screen with spinning reels and flashing lights",
    ["#3b1d5a", "#0f0c1a"],
    { tags: ["gambling"], hit: 0.96, miss: 0.02 },
  ),
  clip(
    "ana.bakes",
    "focaccia, day 3",
    ["sourdough", "baking"],
    "Kitchen sounds",
    "hands pressing dimples into bread dough on a wooden counter",
    ["#e8b27a", "#7a4a22"],
    { tags: ["food"], hit: 0.88, miss: 0.01 },
  ),
  clip(
    "saturday.recap",
    "and that was the night 🍾",
    ["nightout", "weekend"],
    "trending audio",
    "a crowded bar, several people holding drinks and shot glasses",
    ["#1b2a44", "#0a0e17"],
    { tags: ["drinking"], hit: 0.91, miss: 0.04 },
  ),
  clip(
    "trail.mornings",
    "6am loop before work",
    ["trailrunning", "morning"],
    "Avril 14th — Aphex Twin",
    "a person running on a dirt trail at sunrise, trees on both sides",
    ["#d9c7a3", "#5e6a4e"],
    { tags: [], hit: 0.5, miss: 0.03 },
  ),
  clip(
    "shredszn",
    "12 week transformation 🔥",
    ["transformation", "gym", "shredded"],
    "phonk mix",
    "a shirtless man flexing in a gym mirror, side-by-side before and after",
    ["#2b2b2b", "#0d0d0d"],
    { tags: ["body"], hit: 0.84, miss: 0.06 },
  ),
  clip(
    "ratio.king",
    "he really said that 💀 #debate",
    ["debate", "politics", "ratio"],
    "original sound",
    "a split-screen reaction video with large red caption text",
    ["#7a1f1f", "#1a0707"],
    { tags: ["rage"], hit: 0.89, miss: 0.02 },
  ),
  clip(
    "0xalpha",
    "this coin does 40x by friday",
    ["crypto", "altcoins", "100x"],
    "original sound",
    "a man talking to camera in front of a green candlestick chart",
    ["#0e3b2e", "#03110c"],
    { tags: ["crypto"], hit: 0.93, miss: 0.01 },
  ),
  clip(
    "pottery.hour",
    "centering, finally",
    ["pottery", "wheelthrowing"],
    "lo-fi beats",
    "hands shaping wet clay on a spinning pottery wheel",
    ["#b8a08a", "#4a3b30"],
    { tags: [], hit: 0.5, miss: 0.02 },
  ),
];
