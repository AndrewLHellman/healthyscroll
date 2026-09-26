import { PixelHeart } from "@/components/Mark";
import { Footage } from "@/components/Footage";
import { categoryColor } from "@/lib/categoryColors";
import { BigWordmark, Frame, OG, TraceLine, WEEKDAY } from "./shared";

/** The same Reel the pipeline frame uses, followed from the phone to the server to the account and back. */
const ARCH_COMMENTS = ["not the tequila shots 😭", "you said one more round 😂"];

/** Technical: one Reel followed from phone to server to account. */
export function Architecture() {
  return (
    <Frame size={OG}>
      <div className="absolute inset-0 flex flex-col p-14">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[13px] font-medium uppercase tracking-wider text-faint">Under the hood</p>
            <h2 className="mt-3 max-w-[820px] font-display text-[40px] font-semibold leading-[1.05] tracking-[-0.03em]">
              Why this Reel gets skipped.
            </h2>
          </div>
          <BigWordmark height={32} />
        </div>

        <div className="mt-7 grid flex-1 grid-cols-[204px_78px_1fr_78px_260px] items-stretch">
          {/* 1 · the Reel, on the phone */}
          <Stage label="on your phone" title="Safari reads the text">
            <div className="relative flex-1 overflow-hidden rounded-lg bg-ink">
              <Footage tone={["#1b2a44", "#0a0e17"]} className="h-full">
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 pt-10 text-white">
                  <p className="text-[12px] font-semibold">@lastnight.out</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-white/90">last night, ten seconds 🍾</p>
                  <p className="mt-1.5 text-[10px] text-white/70">♪ original audio</p>
                </div>
              </Footage>
              <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-skip px-2.5 py-0.5 font-mono text-[10px] font-medium text-white shadow-lg">
                skipped
              </div>
            </div>
            <ul className="mt-3 flex flex-col gap-1 font-mono text-[11px] leading-snug text-muted">
              <li className="flex gap-2"><span className="text-faint">caption</span> last night, ten seconds 🍾</li>
              {ARCH_COMMENTS.map((c) => (
                <li key={c} className="flex gap-2"><span className="text-faint">comment</span> {c}</li>
              ))}
            </ul>
          </Stage>

          <Arrow label="text only. no video." />

          {/* 2 · the decision, on the server */}
          <Stage label="healthyscroll.net" title="Jev decides" hint="sign-in required">
            <div className="flex flex-1 flex-col font-mono text-[13px] leading-relaxed">
              <p className="border-b border-line pb-2.5 text-[12px] text-muted">
                skip reels about <span className="text-ink">gambling, drinking, or thirst traps</span>
              </p>
              <ol className="mt-4 flex flex-col gap-5">
                <TraceLine stage="text" model="jev" body="do the words match?" p={0.54} verdict="look" ms={203} />
                <TraceLine stage="visual" model="moondream" body="“several friends hold drinks and shot glasses at a bar”" ms={1310} />
                <TraceLine stage="visual" model="jev" body="does that sentence change the answer?" p={0.92} verdict="skip" ms={1310} />
              </ol>
              <p className="mt-auto flex items-center gap-2 pt-3 text-[11px] text-faint">
                <PixelHeart size={9} /> one frame is described, then discarded.
              </p>
            </div>
          </Stage>

          <Arrow label="skip sent back. log saved." />

          {/* 3 · the account: a miniature of the real dashboard */}
          <Stage label="your account" title="Your dashboard" hint={<SignedIn />}>
            <div className="flex flex-1 flex-col">
              <p className="flex items-baseline gap-2">
                <span className="font-display text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums">50</span>
                <span className="text-[13px] text-muted">Reels skipped this week</span>
              </p>
              <p className="mt-1 font-mono text-[11px] text-faint">12% of 412 seen</p>

              {/* Skips per day, stacked by what the rule caught. */}
              <div className="mt-4 grid h-[88px] grid-cols-7 items-end gap-1.5">
                {SKIPS_BY_DAY.map((d, i) => {
                  const total = d.gambling + d.drinking;
                  return (
                    <div key={i} className="flex h-full flex-col justify-end gap-1">
                      <div className="flex flex-col gap-px overflow-hidden rounded-sm" style={{ height: `${(total / SKIPS_MAX) * 100}%` }}>
                        <div style={{ flex: d.gambling, background: categoryColor("gambling") }} />
                        <div style={{ flex: d.drinking, background: categoryColor("drinking_nightlife") }} />
                      </div>
                      <p className="text-center font-mono text-[10px] text-faint">{WEEKDAY[(i + 1) % 7]}</p>
                    </div>
                  );
                })}
              </div>
              <ul className="mt-2 flex gap-3 font-mono text-[11px] text-muted">
                <li className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ background: categoryColor("gambling") }} /> gambling
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ background: categoryColor("drinking_nightlife") }} /> drinking
                </li>
              </ul>

              {/* The saved rule, as the dashboard shows it. */}
              <div className="mt-auto border-t border-line pt-3">
                <p className="flex items-baseline justify-between font-mono text-[11px] text-faint">
                  <span>your rule</span>
                  <span>synced to your phone</span>
                </p>
                <p className="mt-1.5 rounded-md border border-line px-2.5 py-2 text-[12px] leading-snug">
                  gambling, drinking, thirst-trap content
                </p>
              </div>
            </div>
          </Stage>
        </div>

        <div className="mt-5 flex items-center justify-between font-mono text-[12px] text-faint">
          <span>errors never skip a Reel. if anything fails, it keeps playing.</span>
          <span>Jev by TypeSafe AI · Moondream · Supabase · Vercel AI Gateway</span>
        </div>
      </div>
    </Frame>
  );
}

function Stage({ label, title, hint, children }: { label: string; title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-xl border border-line bg-paper p-4">
      <div className="border-b border-line pb-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[11px] uppercase tracking-wider text-faint">{label}</p>
          {hint && <span className="flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 font-mono text-[10px] text-muted">{hint}</span>}
        </div>
        <p className="mt-1 font-display text-[18px] font-semibold tracking-tight">{title}</p>
      </div>
      <div className="flex flex-1 flex-col pt-3">{children}</div>
    </div>
  );
}

/** Skipped Reels per weekday, Mon→Sun, split by which part of the rule caught them. */
const SKIPS_BY_DAY = [
  { gambling: 3, drinking: 2 },
  { gambling: 4, drinking: 1 },
  { gambling: 5, drinking: 3 },
  { gambling: 2, drinking: 2 },
  { gambling: 6, drinking: 4 },
  { gambling: 7, drinking: 6 },
  { gambling: 3, drinking: 2 },
];
const SKIPS_MAX = Math.max(...SKIPS_BY_DAY.map((d) => d.gambling + d.drinking));

function SignedIn() {
  return (
    <>
      <GoogleG size={11} /> you@gmail.com
    </>
  );
}

/** Google's "G", flat, so the sign-in row reads as Google without the full button. */
function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.7 1.2 9.2 3.6l6.9-6.9C35.9 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l8 6.2C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.6 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.8-4.6l-8-6.2A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l8-6.2z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.2 0-11.5-4.1-13.4-9.9l-8 6.2C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-2 text-center font-mono text-[11px] leading-snug text-faint">
      <svg width="72" height="10" viewBox="0 0 72 10" aria-hidden className="text-ink">
        <line x1="0" y1="5" x2="64" y2="5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M63 0.5 L72 5 L63 9.5 Z" fill="currentColor" />
      </svg>
      <span>{label}</span>
    </div>
  );
}
