import { AuthButton } from "./AuthButton";
import { Dashboard } from "./Dashboard";

/**
 * Landing page. Placeholder copy + layout; the real design pass comes later.
 * Keep it to one idea: type what you don't want to see, and the feed obeys.
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-10 px-6 py-24">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs uppercase tracking-widest text-neutral-400">Healthy Scroll</p>
          <AuthButton />
        </div>
        <h1 className="text-4xl font-semibold tracking-tight leading-tight">
          Your prompt,
          <br />
          your feed.
        </h1>
        <p className="text-neutral-500 leading-relaxed">
          Tell it what you don't want to see. It skips those videos for you, in real time,
          before they get a chance to hook you.
        </p>
      </div>

      <Dashboard />

      <a
        href="#"
        className="inline-flex w-fit items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-800"
      >
        Add to Chrome
      </a>

      <p className="text-xs text-neutral-400 leading-snug">
        Frames are analysed on your device with Moondream. Decisions are made by Jev with zero data
        retention.
      </p>
    </main>
  );
}
