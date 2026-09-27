import { Footage } from "@/components/Footage";
import { categoryColor } from "@/lib/categoryColors";
import { CLIPS } from "@/lib/playground/clips";
import { BigWordmark, DEVPOST, Frame, Meter, WEEKDAY, fmtMs } from "./shared";

/**
 * Devpost gallery slide (3:2): the system as three tiers, following one video
 * from the phone to the two services and into the account. Every label is a
 * real component, endpoint or table, and the prompt reads the same in all three.
 */

const PROMPT = "gambling, drinking, thirst-trap content";
/** The slot-machine Reel from the prompt playground, so the slide shows a real one. */
const CLIP = CLIPS.find((c) => c.mock.tags.includes("gambling"))!;

export function Architecture() {
  return (
    <Frame size={DEVPOST}>
      <div className="absolute inset-0 flex flex-col p-16">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[15px] font-medium uppercase tracking-wider text-faint">Architecture</p>
            <h2 className="mt-3 font-display text-[46px] font-semibold leading-[1.05] tracking-[-0.03em]">
              How we decide which videos get skipped.
            </h2>
            <p className="mt-3 max-w-[960px] text-[17px] leading-snug text-muted">
              Safari reads each video, Jev checks your prompt, and Supabase stores the totals. Your screen stays on your phone.
            </p>
          </div>
          <BigWordmark height={36} />
        </div>

        <div className="mt-9 grid flex-1 grid-cols-[300px_92px_1fr_92px_320px] items-stretch">
          {/* 1 · the phone: Safari extension */}
          <Tier n={1} label="Your phone" title="Safari extension" icon={<img src="/graphics/safari.png" alt="" width={26} height={26} className="shrink-0" />}>
            {/* The playground's real gambling Reel, at a Reel's own 9:16, as tall as the column allows. */}
            <div className="flex min-h-0 flex-1 justify-center">
              <div className="relative aspect-[9/16] h-full overflow-hidden rounded-xl bg-ink">
                <Footage tone={CLIP.tone} image={CLIP.reel?.poster} className="h-full">
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3.5 pt-14 text-white">
                    <p className="text-[13px] font-semibold">@{CLIP.context.author}</p>
                    <p className="mt-1 text-[13px] leading-snug text-white/90">{CLIP.context.description}</p>
                    <p className="mt-1.5 text-[11px] text-white/70">♪ {CLIP.context.audioTitle}</p>
                  </div>
                </Footage>
                <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-skip px-2.5 py-0.5 font-mono text-[11px] font-medium text-white shadow-lg">
                  skipped
                </div>
              </div>
            </div>

            <Rows
              className="mt-4"
              rows={[
                ["content", "Reads the caption, comments and video URL. Performs the skip."],
                ["background", "Calls Jev and vision as each video loads. At most one skip per video."],
              ]}
            />
          </Tier>

          <Flow up="caption · comments · video URL" down="skip or keep" />

          {/* 2 · the server: two services, called in parallel */}
          <Tier n={2} label="healthyscroll.net" title="Server" hint="sign-in required">
            <Service name="POST /api/evaluate" role="Jev decides" meta="TypeSafe AI">
              <p className="text-[13px] text-muted">
                your prompt <span className="text-ink">{PROMPT}</span>
              </p>
              <ol className="mt-3 flex flex-col gap-3.5">
                <Pass stage="text" q="does the text match your prompt?" p={0.91} verdict="skip" ms={203} />
                <Pass stage="text + description" q="with the description, does it match?" p={0.97} verdict="skip" ms={187} />
              </ol>
            </Service>

            <Service name="POST /describe" role="Vision describes the video" meta="Gemini via AI Gateway" className="mt-3">
              <p className="font-sans text-[13px] leading-snug text-muted">
                ffmpeg fetches frames from the video on Instagram’s CDN with range requests. Gemini describes them without ever seeing your prompt.
              </p>
              <p className="mt-2.5 flex items-baseline gap-2 text-[13px]">
                <span className="text-ink">“a casino slot machine, reels landing on matching symbols”</span>
                <span className="ml-auto whitespace-nowrap text-[12px] text-faint">{fmtMs(1310)} · cached per video</span>
              </p>
            </Service>

            <Service name="POST /transcribe" role="ElevenLabs transcribes audio" meta="Scribe v2" className="mt-3 border-dashed">
              <p className="font-sans text-[13px] leading-snug text-muted">
                If Jev is still unsure after both passes, transcribe the first 30 s of the video on screen and ask Jev once more. Not needed here.
              </p>
            </Service>
          </Tier>

          <Flow up="skip log · totals" down="your prompt" />

          {/* 3 · the account: Supabase, one row per thing */}
          <Tier n={3} label="Your account" title="Supabase" hint="Postgres · RLS">
            <Table name="policies" note="one row per user">
              <p className="rounded-md border border-line px-2.5 py-2 text-[13px] leading-snug">{PROMPT}</p>
            </Table>

            <Table name="skips" note="which video, and why" className="mt-4">
              <p className="flex items-baseline gap-2 font-mono text-[12px] text-muted">
                <span className="text-ink">@{CLIP.context.author}</span>
                <span className="text-skip">0.97 skip</span>
                <span className="ml-auto flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ background: categoryColor("gambling") }} /> gambling
                </span>
              </p>
            </Table>

            <Table name="feed_days" note="daily totals by topic" className="mt-4">
              <p className="flex items-baseline gap-2">
                <span className="font-display text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums">50</span>
                <span className="text-[13px] text-muted">videos skipped this week</span>
              </p>
              <p className="mt-1 font-mono text-[12px] text-faint">12% of 412 seen</p>
              <div className="mt-3 grid h-[84px] grid-cols-7 items-end gap-1.5">
                {SKIPS_BY_DAY.map((d, i) => {
                  const total = d.gambling + d.drinking;
                  return (
                    <div key={i} className="flex h-full flex-col justify-end gap-1">
                      <div className="flex flex-col gap-px overflow-hidden rounded-sm" style={{ height: `${(total / SKIPS_MAX) * 100}%` }}>
                        <div style={{ flex: d.gambling, background: categoryColor("gambling") }} />
                        <div style={{ flex: d.drinking, background: categoryColor("drinking_nightlife") }} />
                      </div>
                      <p className="text-center font-mono text-[11px] text-faint">{WEEKDAY[(i + 1) % 7].slice(0, 2)}</p>
                    </div>
                  );
                })}
              </div>
              <ul className="mt-2.5 flex gap-4 font-mono text-[12px] text-muted">
                <li className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ background: categoryColor("gambling") }} /> gambling
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ background: categoryColor("drinking_nightlife") }} /> drinking
                </li>
              </ul>
            </Table>

            <p className="mt-auto border-t border-line pt-3 font-mono text-[12px] text-faint">
              the dashboard reads these tables. watch totals hold no video history.
            </p>
          </Tier>
        </div>

        <p className="mt-7 text-right font-mono text-[13px] text-faint">Jev by TypeSafe AI · Gemini via Vercel AI Gateway · ElevenLabs · Supabase</p>
      </div>
    </Frame>
  );
}

/* ------------------------------------------------------------- pieces */

function Tier({ n, label, title, hint, icon, children }: { n: number; label: string; title: string; hint?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-xl border border-line bg-paper p-5">
      <div className="border-b border-line pb-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-wider text-faint">
            <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-ink text-[10px] font-medium text-paper">{n}</span>
            {label}
          </p>
          {hint && <span className="font-mono text-[12px] text-faint">{hint}</span>}
        </div>
        <p className="mt-1.5 flex items-center gap-2.5 font-display text-[22px] font-semibold tracking-tight">
          {icon}
          {title}
        </p>
      </div>
      <div className="flex flex-1 flex-col pt-4">{children}</div>
    </div>
  );
}

/** Label / description pairs in one aligned column, so the phone card reads like a spec, not a caption. */
function Rows({ rows, className = "" }: { rows: [string, string][]; className?: string }) {
  return (
    <dl className={`grid grid-cols-[84px_1fr] gap-x-3 gap-y-2.5 text-[13px] leading-snug ${className}`}>
      {rows.map(([k, v]) => (
        <Row key={k} k={k} v={v} />
      ))}
    </dl>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="font-mono text-[12px] text-faint">{k}</dt>
      <dd className="text-muted">{v}</dd>
    </>
  );
}

/** A server endpoint: what it's called, who answers, what backs it. */
function Service({ name, role, meta, className = "", children }: { name: string; role: string; meta: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-lg border border-line bg-mist/60 p-4 font-mono ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-baseline gap-3 text-[13px]">
          <span className="text-ink">{name}</span>
          <span className="font-display text-[14px] font-medium tracking-tight text-accent-ink">{role}</span>
        </p>
        <span className="whitespace-nowrap text-[12px] text-faint">{meta}</span>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

/** One Jev pass: what was asked and how sure it came back. */
function Pass({ stage, q, p, verdict, ms }: { stage: string; q: string; p: number; verdict: "skip" | "look"; ms: number }) {
  return (
    <li className="grid grid-cols-[124px_1fr] gap-3 text-[13px]">
      <span className="pt-px text-[12px] text-faint">{stage}</span>
      <div>
        <p className="text-ink">{q}</p>
        <Meter p={p} verdict={verdict} ms={ms} />
      </div>
    </li>
  );
}

function Table({ name, note, className = "", children }: { name: string; note: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <p className="flex items-baseline gap-2 font-mono text-[12px]">
        <span className="text-ink">{name}</span>
        <span className="text-faint">{note}</span>
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/** Two-way arrow between tiers, with what travels each way. */
function Flow({ up, down }: { up: string; down: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 px-2 text-center font-mono text-[12px] leading-snug text-faint">
      <span>{up}</span>
      <svg width="76" height="28" viewBox="0 0 76 28" aria-hidden className="text-ink">
        <line x1="0" y1="7" x2="68" y2="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M67 2.5 L76 7 L67 11.5 Z" fill="currentColor" />
        <line x1="8" y1="21" x2="76" y2="21" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M9 16.5 L0 21 L9 25.5 Z" fill="currentColor" />
      </svg>
      <span>{down}</span>
    </div>
  );
}

/** Skipped videos per weekday, Mon→Sun, by which part of the prompt caught them. Sums to 50. */
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
