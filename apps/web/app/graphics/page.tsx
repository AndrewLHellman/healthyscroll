import { FRAMES } from "@/components/frames";

/** Contact sheet of every graphic, scaled to fit. Each links to its full-size page. */
export default function GraphicsGallery() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-12 px-8 py-16">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Social graphics</h1>
      {FRAMES.map((f) => {
        const scale = 1024 / f.size.w;
        return (
          <section key={f.slug} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <a href={`/graphics/${f.slug}`} className="font-display text-lg font-semibold tracking-tight underline decoration-line underline-offset-4">
                {f.title}
              </a>
              <p className="font-mono text-xs text-faint">
                {f.slug} · {f.size.w}×{f.size.h} · {f.note}
              </p>
            </div>
            <div className="overflow-hidden rounded-xl border border-line" style={{ width: f.size.w * scale, height: f.size.h * scale }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>{f.render()}</div>
            </div>
          </section>
        );
      })}
    </main>
  );
}
