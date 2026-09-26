import { notFound } from "next/navigation";
import { FRAMES } from "@/components/frames";

/** One graphic at its exact pixel size, for the screenshot script. */
export default async function GraphicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const frame = FRAMES.find((f) => f.slug === slug);
  if (!frame) notFound();
  return (
    <>
      {/* Hide the Next dev indicator so it doesn't land in the screenshot. */}
      <style>{`nextjs-portal { display: none !important; }`}</style>
      <div style={{ width: frame.size.w, height: frame.size.h }}>{frame.render()}</div>
    </>
  );
}
