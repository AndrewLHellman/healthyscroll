import { MarkImage } from "./Mark";

/**
 * Three steps, one phone screen each. The numbers are a real sequence, so
 * they earn their place. Screens are sketches, not screenshots: enough iOS
 * to be recognisable, drawn in the page's own palette.
 */
const STEPS = [
  {
    title: "Install it",
    body: "From the App Store. Then, in Safari, tap aA → Manage Extensions and switch Healthy Scroll on. You do this once.",
    screen: <InstallScreen />,
  },
  {
    title: "Say what to skip",
    body: "One text box, your words. Whatever you’d rather not scroll past. Change it whenever; it takes effect on the next Reel.",
    screen: <PromptScreen />,
  },
  {
    title: "Open Instagram in Safari",
    body: "instagram.com, not the app. Scroll like you always do. Reels that match your rule are gone before they play.",
    screen: <FeedScreen />,
  },
];

export function GettingStarted() {
  return (
    <section id="getting-started" className="border-t border-line bg-mist/60">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wider text-faint">Getting started</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Set it up once. Then forget it’s there.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            It lives in Safari on your iPhone, next to Instagram. Nothing to keep open, nothing to check.
          </p>
        </div>

        <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-6 bg-paper p-7 sm:p-8">
              <div>
                <span className="font-display text-4xl font-semibold tracking-tight text-ink/90">0{i + 1}</span>
                <h3 className="mt-4 font-display text-xl font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-muted">{s.body}</p>
              </div>
              <div className="-mb-7 mt-auto sm:-mb-8">{s.screen}</div>
            </li>
          ))}
        </ol>

        <p className="mt-6 max-w-3xl text-sm text-muted">
          Under the hood: Jev decides from the words in about 200 ms. A vision model looks at a single frame only when
          the words can’t decide, and the frame isn’t kept. Errors never skip; if a model is unreachable, the Reel plays
          like normal.
        </p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- screens */

/** A phone screen, cropped: status bar on top, content, bottom edge open. */
function Screen({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div
      className={`overflow-hidden rounded-t-[1.25rem] border border-b-0 px-4 pt-2.5 ${
        dark ? "border-ink bg-ink text-paper" : "border-line bg-paper"
      }`}
      aria-hidden
    >
      <div className={`flex items-center justify-between font-mono text-[10px] ${dark ? "text-paper/60" : "text-faint"}`}>
        <span>9:41</span>
        <span className="flex items-center gap-1">
          <span className={`h-1.5 w-3 rounded-sm ${dark ? "bg-paper/60" : "bg-faint"}`} />
          <span className={`h-2 w-4 rounded-sm border ${dark ? "border-paper/60" : "border-faint"}`} />
        </span>
      </div>
      {children}
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span className={`relative inline-block h-5 w-8 rounded-full ${on ? "bg-ink" : "bg-line"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-paper ${on ? "right-0.5" : "left-0.5"}`} />
    </span>
  );
}

function InstallScreen() {
  return (
    <Screen>
      <p className="mt-4 text-center text-sm font-semibold">Extensions</p>
      <div className="mt-4 rounded-xl border border-line">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <MarkImage height={20} />
          <span className="flex-1 text-sm">Healthy Scroll</span>
          <Toggle on />
        </div>
        <div className="flex items-center gap-3 border-t border-line px-3 py-2.5 text-faint">
          <span className="h-5 w-4 rounded-sm bg-line" />
          <span className="flex-1 text-sm">Reader</span>
          <Toggle on={false} />
        </div>
      </div>
      <p className="mt-3 pb-4 text-[11px] leading-snug text-faint">
        Healthy Scroll can read and change instagram.com. Allowed: <span className="text-ink">Always</span>
      </p>
    </Screen>
  );
}

function PromptScreen() {
  return (
    <Screen>
      <div className="mt-4 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <MarkImage height={16} /> Healthy Scroll
        </span>
        <span className="text-xs text-muted">On</span>
      </div>
      <p className="mt-4 text-xs text-muted">Skip anything that’s…</p>
      <div className="mt-1.5 rounded-lg border border-ink p-3 text-sm leading-relaxed">
        gambling, drinking, thirst-trap content, anything that makes me feel worse about myself
        <span className="ml-px inline-block h-[1.1em] w-px translate-y-[3px] bg-ink" />
      </div>
      <div className="mt-3 rounded-lg bg-ink py-2 text-center text-sm text-paper">Save</div>
    </Screen>
  );
}

function FeedScreen() {
  return (
    <Screen dark>
      {/* A skipped Reel, collapsed to one line, and the next one loading in. */}
      <div className="mt-4 flex items-center justify-between rounded-lg border border-paper/15 px-3 py-2 font-mono text-[11px]">
        <span className="text-paper/60">
          <span className="text-skip">skipped</span> · gambling · 184 ms
        </span>
        <span className="text-paper/40">↓</span>
      </div>
      <div className="mt-3 h-40 rounded-t-xl bg-[linear-gradient(160deg,#d9c7a3,#5e6a4e)] p-3">
        <div className="flex h-full flex-col justify-end gap-1 text-white drop-shadow">
          <p className="text-xs font-semibold">trail.mornings</p>
          <p className="text-[11px] leading-snug">6am loop before work. always worth it</p>
        </div>
      </div>
    </Screen>
  );
}
