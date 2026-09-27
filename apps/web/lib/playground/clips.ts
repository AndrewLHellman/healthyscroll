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
  /** A real Reel for this slot: its cover and a short muted clip (in public/playground/), and link. */
  reel?: { href: string; poster: string; video: string };
  mock: {
    /** What this clip is "about"; matched against words in the prompt. */
    tags: string[];
    /** Probability shown when the prompt matches it. */
    hit: number;
    /** Probability shown when it doesn't. */
    miss: number;
  };
}

/** Example Reels per slot, picked by the team. Covers and clips live in public/playground/. */
const reel = (code: string, name: string): PlaygroundClip["reel"] => ({
  href: `https://www.instagram.com/p/${code}/`,
  poster: `/playground/${name}.jpg`,
  video: `/playground/${name}.mp4`,
});

/**
 * `author`, `description`, `hashtags` are the Reel's real ones (yt-dlp, 2026-09-27);
 * `onScreenText` is read off its frames. `visionDescription` is written to the
 * vision service's describe prompt (apps/vision/vision/prompt.py: under 60
 * words, concrete about people, genre, names, quoted on-screen text) from the
 * same frames, since the landing page can't call Gemini itself.
 */
const clip = (c: {
  author: string;
  description: string;
  hashtags: string[];
  audioTitle: string;
  onScreenText?: string[];
  visionDescription: string;
  tone: [string, string];
  mock: PlaygroundClip["mock"];
  reel?: PlaygroundClip["reel"];
}): PlaygroundClip => ({
  context: {
    videoId: `playground-${c.author}`,
    platform: "instagram",
    url: `https://www.instagram.com/reel/playground-${c.author}/`,
    author: c.author,
    description: c.description,
    hashtags: c.hashtags,
    audioTitle: c.audioTitle,
    onScreenText: c.onScreenText,
  },
  visionDescription: c.visionDescription,
  tone: c.tone,
  mock: c.mock,
  reel: c.reel,
});

export const CLIPS: PlaygroundClip[] = [
  clip({
    author: "missluckycharm77",
    description: "Slot wins! #slots #casino #gambling",
    hashtags: ["slots", "casino", "gambling"],
    audioTitle: "original sound",
    visionDescription:
      "Gambling: a phone recording of a casino slot machine. Reels spin and stop on matching symbols, gold coins rain across the screen, and the jackpot counter at the top reads \"$25,274.93\" while the credit balance below ticks up. No people visible; a hand taps the bet buttons.",
    tone: ["#3b1d5a", "#0f0c1a"],
    mock: { tags: ["gambling"], hit: 0.96, miss: 0.02 },
    reel: reel("DYH_SnMRkZw", "gambling"),
  }),
  clip({
    author: "kookmutsjes",
    description:
      "• FLATBREAD MET BUTTER CHICKEN •\n\nMaak thuis de lekkerste flatbread met butter chicken! Deze panbroodjes zijn makkelijk te bereiden en perfect voor iedereen die houdt van veel smaak!",
    hashtags: ["kookmutsjes", "bread", "ramadan", "butterchicken", "food"],
    audioTitle: "Kitchen sounds",
    visionDescription:
      "Cooking / food video. Overhead shot of golden pan-fried stuffed flatbreads on a wooden board beside a bowl of cherry tomatoes. A woman's hands tear one open, pulling apart melted cheese and butter chicken filling, then dip it in sauce. No on-screen text.",
    tone: ["#e8b27a", "#7a4a22"],
    mock: { tags: ["food"], hit: 0.88, miss: 0.01 },
    reel: reel("DTxgqPPgdsr", "food"),
  }),
  clip({
    author: "daveyboyyyyyy",
    description: "Spicy margs> #reels #drinks #memes",
    hashtags: ["reels", "drinks", "memes"],
    audioTitle: "trending audio",
    onScreenText: ["“Drinking won’t make you feel any better about it…”", "Also me after 3 margaritas:"],
    visionDescription:
      "Comedy meme about drinking alcohol. A young man in a grey sweater stands at a bar backed by shelves of liquor bottles and hanging lights; he turns away, then spins back grinning with both arms raised. On-screen text: \"Drinking won't make you feel any better about it...\" and \"Also me after 3 margaritas:\".",
    tone: ["#1b2a44", "#0a0e17"],
    mock: { tags: ["drinking"], hit: 0.91, miss: 0.04 },
    reel: reel("CtrGRgVA3_V", "drinking"),
  }),
  clip({
    author: "akak_akram",
    description: "Same direction. Same pace. Same mission.\n#running #fyp #sport #motivation #trending",
    hashtags: ["running", "fyp", "sport", "motivation", "trending"],
    audioTitle: "Avril 14th — Aphex Twin",
    onScreenText: ["What people see:", "How we feel:"],
    visionDescription:
      "Running / fitness motivation. Two young men in black shorts and t-shirts run side by side along a paved seaside promenade under a cloudy sky, palm trees behind, on-screen text \"What people see:\"; then a dark rainy night shot labelled \"How we feel:\".",
    tone: ["#d9c7a3", "#5e6a4e"],
    mock: { tags: [], hit: 0.5, miss: 0.03 },
    reel: reel("DTaa_I7jJAC", "run"),
  }),
  clip({
    author: "davidlaid",
    description: "",
    hashtags: [],
    audioTitle: "phonk mix",
    visionDescription:
      "Fitness / physique showcase. A shirtless, heavily muscled young man (fitness influencer David Laid) in black trousers and headphones stands in a gym in front of squat racks and weight plates, facing the camera and flexing his abs, chest and shoulders under warm light. No on-screen text.",
    tone: ["#2b2b2b", "#0d0d0d"],
    mock: { tags: ["body"], hit: 0.84, miss: 0.06 },
    reel: reel("CzraHyGJsJ_", "thirst-trap"),
  }),
  clip({
    author: "_laugh_adicts",
    description:
      "This clip is a short, looped video that has been edited to provoke a specific reaction from viewers—a tactic commonly known as \"ragebait.\"",
    hashtags: [],
    audioTitle: "original sound",
    onScreenText: ["this is how perfect ragebait looks like 😭🥀"],
    visionDescription:
      "Viral animal clip / rage-bait meme. A macaque monkey and a dog face off in a backyard: the dog barks with its mouth wide open while the monkey calmly puts a hand on its chest, mimics the bark, then shoves it away. Looped. On-screen text: \"this is how perfect ragebait looks like 😭🥀\".",
    tone: ["#7a1f1f", "#1a0707"],
    mock: { tags: ["rage"], hit: 0.89, miss: 0.02 },
    reel: reel("DXd8jAyjhuM", "rage-bait"),
  }),
  clip({
    author: "overkilltrading",
    description: "CRYPTO BULL RUN LOADING 📈 JULY 11",
    hashtags: [],
    audioTitle: "original sound",
    onScreenText: ["CRYPTO IS ABOUT TO EXPLODE!"],
    visionDescription:
      "Crypto trading / finance hype. Handheld footage of a monitor running TradingView with candlestick charts, moving averages and indicators, and a watchlist of crypto tickers (ETHUSDT, SOLUSDT, LINKUSDT) down the side. Large white caption \"CRYPTO IS ABOUT TO EXPLODE!\", then a total crypto market cap chart. No people.",
    tone: ["#0e3b2e", "#03110c"],
    mock: { tags: ["crypto"], hit: 0.93, miss: 0.01 },
    reel: reel("DaqfH-3vCx6", "crypto"),
  }),
  clip({
    author: "klei.by.cerinna",
    description: "Honestly, if pottery doesnt give me a backache, id be on it 16/7. (I still need my sleep) 😂\n\n#pottery #ceramics #moonjar",
    hashtags: ["pottery", "ceramics", "moonjar"],
    audioTitle: "lo-fi beats",
    onScreenText: ["Me 5 min into pottery:"],
    visionDescription:
      "Pottery / crafts. Close-up of a woman's hands shaping a round clay jar on a spinning pottery wheel, smoothing the sides with a yellow sponge and a rib tool in a home studio. On-screen text: \"Me 5 min into pottery:\".",
    tone: ["#b8a08a", "#4a3b30"],
    mock: { tags: [], hit: 0.5, miss: 0.02 },
    reel: reel("DWAs_s3jPFw", "pottery"),
  }),
];
