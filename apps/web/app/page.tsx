import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { PipelineDemo } from "@/components/PipelineDemo";
import { GettingStarted } from "@/components/GettingStarted";
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
        <GettingStarted />
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
          <a href="#getting-started" className="rounded-md text-sm text-muted transition-colors hover:text-ink">
            How to set it up ↓
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
    a: "Instagram Reels in Safari on iPhone. It’s a browser extension, so it can’t reach inside the Instagram app; open instagram.com in Safari instead. TikTok in Chrome works too. YouTube Shorts is next.",
  },
  {
    q: "Do I need anything else?",
    a: "No. Sign in with Google if you want your prompt to follow you between devices; otherwise just write it and go.",
  },
  {
    q: "Does it slow scrolling down?",
    a: "No. The check runs alongside the Reel, not in front of it. It takes about 200 ms, so a skipped Reel is usually gone before you see it.",
  },
  {
    q: "Will it skip things I wanted?",
    a: "Sometimes, early on. Only confident matches get skipped; anything in the middle gets a second look rather than a guess. Change a word in your prompt and it follows.",
  },
  {
    q: "What’s doing the deciding?",
    a: "Jev, an evaluation model by TypeSafe AI, reads the caption and comments and returns a probability, not prose. When the words aren’t enough, Moondream, a small vision model, describes one frame in a sentence and Jev decides again.",
  },
  {
    q: "Where does my data go?",
    a: "Captions and comments go to our server as text and aren’t kept. When a frame is needed, the server fetches it, describes it, and throws it away. If you sign in, we store your prompt and a log of what was skipped so your dashboard can count it. Your week’s tally stays on your phone.",
  },
  {
    q: "What does the tally track?",
    a: "Per Reel: its category, how long it was on screen, and whether it was skipped. Not who posted it, not what you liked. Categories are broad on purpose: “relationships & drama”, not a profile of you.",
  },
  {
    q: "What does it cost?",
    a: "Nothing. Open source, built at TigerHacks 2026. Jev costs fractions of a cent per thousand Reels.",
  },
];

function Faq() {
  return (
    <section id="faq" className="border-t border-line">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-faint">FAQ</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              It sees your feed. It doesn’t keep it.
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
