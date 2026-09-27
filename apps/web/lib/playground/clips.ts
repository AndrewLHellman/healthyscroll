import type { VideoContext } from "@healthyscroll/shared";

/**
 * The mock feed behind the prompt playground on the landing page.
 *
 * Each clip carries the `VideoContext` the content script would scrape off a
 * Reel (author, caption, hashtags, audio) plus the description the vision
 * service would write for its video, so Jev gets exactly the inputs the real
 * text+description pass does (see background/reels.ts). Scoring happens
 * server-side in `app/api/playground/route.ts` against this fixed list, so a
 * visitor can only ever ask about these eight Reels. The `mock` block is only
 * read by the keyword fallback.
 */
export interface PlaygroundClip {
  context: VideoContext;
  /** What `/describe` would say about the video. Sent to Jev as the visual caption. */
  visionDescription: string;
  /** Two-stop gradient standing in for the video (and the fallback under the cover). */
  tone: [string, string];
  /** A real Reel for this slot: its cover (in public/playground/) and link. */
  reel?: { href: string; poster: string };
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
  visionDescription: string,
  tone: [string, string],
  mock: PlaygroundClip["mock"],
  reel?: PlaygroundClip["reel"],
): PlaygroundClip => ({
  context: {
    videoId: `playground-${author}`,
    platform: "instagram",
    url: `https://www.instagram.com/reel/playground-${author}/`,
    author,
    description,
    hashtags,
    audioTitle,
  },
  visionDescription,
  tone,
  mock,
  reel,
});

/** Example Reels per slot, picked by the team. Covers live in public/playground/. */
const reel = (code: string, name: string): PlaygroundClip["reel"] => ({
  href: `https://www.instagram.com/p/${code}/`,
  poster: `/playground/${name}.jpg`,
});

export const CLIPS: PlaygroundClip[] = [
  clip(
    "spinsdaily",
    "late night spins 🎰 #bigwin",
    ["slots", "bigwin", "casino"],
    "original sound",
    "A phone screen recording of an online slot machine. Reels spin and stop on matching symbols while gold coins and a flashing 'BIG WIN' banner fill the screen; the balance in the corner jumps up.",
    ["#3b1d5a", "#0f0c1a"],
    { tags: ["gambling"], hit: 0.96, miss: 0.02 },
    reel("DYH_SnMRkZw", "gambling"),
  ),
  clip(
    "ana.bakes",
    "focaccia, day 3",
    ["sourdough", "baking"],
    "Kitchen sounds",
    "Close-up of hands pressing dimples into oiled bread dough in a metal pan on a wooden counter. Rosemary and coarse salt are scattered on top, then the pan goes into an oven.",
    ["#e8b27a", "#7a4a22"],
    { tags: ["food"], hit: 0.88, miss: 0.01 },
    reel("DTxgqPPgdsr", "food"),
  ),
  clip(
    "saturday.recap",
    "and that was the night 🍾",
    ["nightout", "weekend"],
    "trending audio",
    "Handheld footage inside a crowded, dimly lit bar. A group of friends clink shot glasses and drink, someone sprays a bottle of champagne, and the clip ends with them singing in the back of a taxi.",
    ["#1b2a44", "#0a0e17"],
    { tags: ["drinking"], hit: 0.91, miss: 0.04 },
    reel("CtrGRgVA3_V", "drinking"),
  ),
  clip(
    "trail.mornings",
    "6am loop before work",
    ["trailrunning", "morning"],
    "Avril 14th — Aphex Twin",
    "A person in running gear jogs along a dirt trail at sunrise with trees on both sides. Wide shots of mist over a valley, then a watch face showing distance and pace.",
    ["#d9c7a3", "#5e6a4e"],
    { tags: [], hit: 0.5, miss: 0.03 },
    reel("DTaa_I7jJAC", "run"),
  ),
  clip(
    "shredszn",
    "12 week transformation 🔥",
    ["transformation", "gym", "shredded"],
    "phonk mix",
    "A shirtless man flexes in a gym mirror. A side-by-side before-and-after compares his physique, with on-screen text reading 'week 1' and 'week 12', then he poses under bright lights showing defined abs.",
    ["#2b2b2b", "#0d0d0d"],
    { tags: ["body"], hit: 0.84, miss: 0.06 },
    reel("CzraHyGJsJ_", "thirst-trap"),
  ),
  clip(
    "ratio.king",
    "he really said that 💀 #debate",
    ["debate", "politics", "ratio"],
    "original sound",
    "A split-screen reaction video: on one side a clip of a politician speaking at a podium, on the other a man reacting with exaggerated disbelief. Large red caption text mocks the quote and the comments count is highlighted.",
    ["#7a1f1f", "#1a0707"],
    { tags: ["rage"], hit: 0.89, miss: 0.02 },
    reel("DXd8jAyjhuM", "rage-bait"),
  ),
  clip(
    "0xalpha",
    "this coin does 40x by friday",
    ["crypto", "altcoins", "100x"],
    "original sound",
    "A man talks to the camera in front of a green candlestick chart. He points at a coin's ticker and price target, and on-screen text urges viewers to buy before the weekend.",
    ["#0e3b2e", "#03110c"],
    { tags: ["crypto"], hit: 0.93, miss: 0.01 },
    reel("DaqfH-3vCx6", "crypto"),
  ),
  clip(
    "pottery.hour",
    "centering, finally",
    ["pottery", "wheelthrowing"],
    "lo-fi beats",
    "Close-up of hands shaping wet clay on a spinning pottery wheel. The lump slowly rises into a bowl, then the potter trims the rim with a wooden tool.",
    ["#b8a08a", "#4a3b30"],
    { tags: [], hit: 0.5, miss: 0.02 },
    reel("DWAs_s3jPFw", "pottery"),
  ),
];
