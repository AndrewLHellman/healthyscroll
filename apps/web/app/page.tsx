import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { PipelineDemo } from "@/components/PipelineDemo";
import { GettingStarted } from "@/components/GettingStarted";
import { PromptPlayground } from "@/components/PromptPlayground";
import { WeekMock } from "@/components/WeekMock";
import { PopupMock } from "@/components/PopupMock";
import { PixelHeart } from "@/components/Mark";

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
          Built at TigerHacks 2026
        </p>
        <h1 className="mt-6 font-display text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-6xl">
          Take back your feed.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          You should have a say in what keeps showing up in your feed. Whether you’re cutting
          back on drinking or tired of comparing yourself to strangers, Healthy Scroll lets you
          decide what to avoid and automatically skips Reels that match.
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
          Free and open source. Sign in with Google to get started.
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
          title="Decide what belongs in your feed."
          body="Maybe you’re cutting back on drinking, tired of political arguments, or done comparing yourself to strangers. Describe what you’d like to see less of. Try your own prompt or choose an example below."
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
          title="Get to know your scrolling habits."
          body="See which topics take up your time and which ones you tend to linger on. Your weekly summary can help you decide whether your feed is how you want to spend that time, and what you’d like to change."
        />
        <div className="mt-12">
          <WeekMock />
        </div>
        <p className="mt-6 max-w-3xl text-sm text-muted">
          Here’s an example week. In the extension, tap today’s summary to see your own.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ faq */

const FAQ = [
  {
    q: "Where does it work?",
    a: "On instagram.com in Safari on iPhone, and on TikTok in Chrome. It doesn’t work inside the Instagram app. Support for YouTube Shorts is planned.",
  },
  {
    q: "Do I need an account?",
    a: "Yes. Sign in with Google in the extension to turn on filtering. Your weekly summary also appears on your dashboard.",
  },
  {
    q: "Does it slow scrolling down?",
    a: "Healthy Scroll checks upcoming Reels as Instagram loads them. Reels keep playing during checks, so you may see part of one before it gets skipped. A failed check won’t trigger a skip.",
  },
  {
    q: "Will it skip things I wanted?",
    a: "It can make mistakes. Healthy Scroll skips a Reel only when it’s confident the content matches your prompt. If it skips too much, try making your prompt more specific.",
  },
  {
    q: "What’s doing the deciding?",
    a: "Jev checks each Reel’s text against your prompt. At the same time, our server uses Gemini to describe its cover image and video frames. Jev uses those descriptions to refine its decision.",
  },
  {
    q: "Where does my data go?",
    a: "Your prompt and Reel text go to our server for evaluation. Visual checks use the Reel’s own images and video, without uploading your screen. If a Reel is still unclear, ElevenLabs transcribes its audio. The weekly summary keeps only daily totals by topic.",
  },
  {
    q: "What does the weekly summary track?",
    a: "For each day and topic, such as “relationships & drama”: how many Reels came on screen, how many were skipped, and how long you watched the rest. It doesn’t keep which Reels, creators, or likes.",
  },
  {
    q: "What does it cost?",
    a: "Healthy Scroll is free and open source. We built it at TigerHacks 2026.",
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
              A few things to know.
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
            Make room for what you want to watch.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            You can enjoy Reels and still set limits on what you see. Start with something
            you’d like less of in your feed. You can change your prompt whenever you want.
          </p>
          <a
            href="#install"
            className="mt-8 inline-block rounded-full bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-ink"
          >
            Get it for iPhone
          </a>
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
