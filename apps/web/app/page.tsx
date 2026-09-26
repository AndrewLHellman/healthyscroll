import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { PipelineDemo } from "@/components/PipelineDemo";
import { PromptPlayground } from "@/components/PromptPlayground";
import { WeekMock } from "@/components/WeekMock";
import { PopupMock } from "@/components/PopupMock";
import { PixelHeart } from "@/components/Mark";
import { Dashboard } from "./Dashboard";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <Prompts />
        <Week />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}

/* ---------------------------------------------------------------- hero */

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-16 pt-16 sm:px-8 sm:pt-24">
      <div className="max-w-3xl">
        <p className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-muted">
          <PixelHeart size={9} />
          TigerHacks 2026 · Health track
        </p>
        <h1 className="mt-6 font-display text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-6xl">
          Skip the Reels you never wanted to see. Before they hook you.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          Healthy Scroll is a Safari extension for iPhone. It reads each Reel as it lands in your
          Instagram feed and skips anything that matches what you asked to avoid, in about 200
          milliseconds, without you lifting a finger. You write the rule in plain English. It does
          the scrolling.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a
            id="install"
            href="#"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-ink"
          >
            Get it for iPhone
          </a>
          <a href="#how-it-works" className="rounded-md text-sm text-muted transition-colors hover:text-ink">
            See how it works ↓
          </a>
        </div>
        <p className="mt-5 text-xs text-faint">
          Free. Open source. Frames are described, then discarded.
        </p>
      </div>

      <div className="mt-14">
        <PipelineDemo />
      </div>
    </section>
  );
}

/* -------------------------------------------------------- how it works */

const STAGES = [
  {
    n: "01",
    time: "~200 ms",
    title: "Read the words",
    body: "The moment a new Reel lands, its caption, hashtags, audio and visible comments go to Jev, a model that answers one question with a calibrated probability: does this match what you asked to skip? No prose, nothing to parse. Most videos are decided right here, before you’ve registered them.",
    trace: [
      ["text", "jev", "does this match the policy?"],
      ["", "", "0.96 · skip · 184 ms"],
    ],
  },
  {
    n: "02",
    time: "< 3 s",
    title: "Look closer if it’s unsure",
    body: "Captions lie. When Jev lands in the middle, Healthy Scroll sends the Reel’s video link to our server, which pulls a single frame and hands it to Moondream, a small vision model. Moondream describes what it sees; that one sentence goes back to Jev with the rest. The frame is discarded the moment it’s described.",
    trace: [
      ["visual", "moondream", "“a crowded bar, people holding drinks”"],
      ["", "jev", "0.92 · skip · 2.1 s"],
    ],
  },
  {
    n: "03",
    time: "a few s in",
    title: "Take a second look as it plays",
    body: "Reels turn. A cooking clip becomes a drinking clip at second eight. So a few seconds into anything still playing, one more frame gets the same treatment. If it’s become something you skipped, it’s gone, mid-sentence.",
    trace: [
      ["monitor", "moondream", "“two people pouring shots at a counter”"],
      ["", "jev", "0.88 · skip · 6.2 s in"],
    ],
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-line bg-mist/60">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <SectionHeading
          eyebrow="How it works"
          title="Three checks. A few seconds at most. Frames are described, not kept."
          body="Fast and cheap first, careful only when it has to be. Each stage only runs if the one before it couldn’t decide."
        />

        <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-3">
          {STAGES.map((s) => (
            <li key={s.n} className="flex flex-col gap-6 bg-paper p-7 sm:p-8">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-4xl font-semibold tracking-tight text-ink/90">{s.n}</span>
                <span className="font-mono text-xs text-faint">{s.time}</span>
              </div>
              <div>
                <h3 className="font-display text-xl font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-muted">{s.body}</p>
              </div>
              <div className="mt-auto flex flex-col gap-1.5 rounded-lg border border-line bg-mist/70 p-3 font-mono text-xs leading-relaxed">
                {s.trace.map(([stage, model, text], i) => (
                  <div key={i} className="grid grid-cols-[60px_1fr] gap-2">
                    <span className="uppercase tracking-wider text-faint">{stage}</span>
                    <span className="min-w-0">
                      <span className={`mr-2 ${model === "jev" ? "text-accent-ink" : "text-muted"}`}>{model}</span>
                      <span className={text.includes("skip") ? "text-skip" : "text-ink"}>{text}</span>
                    </span>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-6 text-sm text-muted">
          Errors never skip. If a model is unreachable, the Reel plays like normal.
        </p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- prompts */

function Prompts() {
  return (
    <section id="prompts" className="border-t border-line">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <SectionHeading
          eyebrow="Your prompt"
          title="Write it like you’d say it."
          body="No categories to tick, no sliders. One box, your words. Jev reads intent, so “stuff that makes me feel worse about myself” works as well as a list. Edit the prompt and watch the feed change."
        />
        <div className="mt-12">
          <PromptPlayground />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ your week */

function Week() {
  return (
    <section id="insights" className="border-t border-line bg-mist/60">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <SectionHeading
          eyebrow="Your week"
          title="It also keeps a tally. Of what actually holds you."
          body="The same Jev call that decides skip-or-keep also says what kind of video it was, for free. Add how long you stayed on each one and you get a week you can read: not a screen-time number, but which Reels you can’t put down. The dwell tally stays on your phone."
        />
        <div className="mt-12">
          <WeekMock />
        </div>
        <p className="mt-6 max-w-3xl text-sm text-muted">
          Nothing to check daily. The popup shows one line about today; the full week is a click away when you want it.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ faq */

const FAQ = [
  {
    q: "Where does it work?",
    a: "Instagram Reels, in Safari on iPhone. Open instagram.com in Safari, turn the extension on once, and scroll like normal. It’s a browser extension, so Safari is the way in; it can’t reach inside the Instagram app. TikTok in Chrome works too, and YouTube Shorts is next.",
  },
  {
    q: "Do I need anything else?",
    a: "No. Safari, an Instagram account, and the extension. Sign in with Google if you want your prompt to follow you between devices.",
  },
  {
    q: "Does it slow scrolling down?",
    a: "No. Decisions run alongside the Reel, not in front of it. The text check returns in about 200 ms; when that says skip, you rarely see the first frame.",
  },
  {
    q: "Will it skip things I wanted?",
    a: "Occasionally, at first. Only confident matches get skipped; the uncertain middle gets a second look, not a guess. Tighten or loosen a word and it follows.",
  },
  {
    q: "What’s doing the deciding?",
    a: "Jev, an evaluation model by TypeSafe AI, through Vercel AI Gateway. It returns probabilities instead of prose, which is why it’s fast and nearly free per video. Moondream, a small vision model, describes a frame in one sentence when the text alone can’t decide.",
  },
  {
    q: "Where does my data go?",
    a: "Caption, hashtags and comments go to our server as text, for the decision, and aren’t kept. When the text can’t decide, the server fetches one frame of the Reel, has Moondream describe it, and discards it; frames are never stored. If you sign in, we store your prompt and a log of skips (which Reel, when, which check caught it) so your dashboard can count them. The week’s dwell tally lives on your phone. Clear it any time.",
  },
  {
    q: "What does the tally track?",
    a: "Per Reel: which of fourteen categories Jev put it in, how long it was on screen, and whether it was skipped. Not the video itself, not who posted it, not what you liked. Categories are broad on purpose: “relationships & drama”, not a profile of you.",
  },
  {
    q: "What does it cost?",
    a: "Nothing. Open source, built over a weekend at TigerHacks 2026. Jev costs us fractions of a cent per thousand videos.",
  },
];

function Faq() {
  return (
    <section id="faq" className="border-t border-line">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-faint">Straight answers</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Nothing to click open.
            </h2>
          </div>
          <dl className="grid gap-x-10 gap-y-9 sm:grid-cols-2">
            {FAQ.map((f) => (
              <div key={f.q} className="border-t border-line pt-4">
                <dt className="font-display text-lg font-semibold tracking-tight">{f.q}</dt>
                <dd className="mt-2 text-[15px] leading-relaxed text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ final cta */

function FinalCta() {
  return (
    <section className="border-t border-line bg-mist/60">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1fr_auto]">
        <div className="max-w-xl">
          <p className="text-xs font-medium uppercase tracking-wider text-faint">Setup</p>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            One text box. That’s the setup.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            No streaks, no scores, no nagging. The algorithm already optimises for your attention;
            this adds one rule you wrote, and a tally you can look at when you feel like it.
          </p>
          <a
            href="#install"
            className="mt-8 inline-block rounded-full bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-ink"
          >
            Get it for iPhone
          </a>
          <Dashboard />
        </div>
        <div className="justify-self-start lg:justify-self-end">
          <PopupMock />
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- shared */

function SectionHeading({
  eyebrow,
  title,
  body,
  dark = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  dark?: boolean;
}) {
  return (
    <div className="max-w-3xl">
      <p className={`text-xs font-medium uppercase tracking-wider ${dark ? "text-paper/50" : "text-faint"}`}>
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
        {title}
      </h2>
      <p className={`mt-5 text-lg leading-relaxed ${dark ? "text-paper/65" : "text-muted"}`}>{body}</p>
    </div>
  );
}
