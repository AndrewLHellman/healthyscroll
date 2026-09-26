import { Suspense } from "react";
import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { DashboardClient } from "./DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard · Healthy Scroll",
  description: "Your prompt, and what Healthy Scroll has skipped for you.",
  robots: { index: false },
};

export default function DashboardPage() {
  return (
    <>
      <Nav variant="app" />
      <main className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
        <Suspense fallback={<div className="min-h-[60vh]" aria-busy />}>
          <DashboardClient />
        </Suspense>
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-5 py-6 text-xs text-faint sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>© 2026 Healthy Scroll. Open source.</span>
          <span>Frames are described and discarded, never stored.</span>
        </div>
      </footer>
    </>
  );
}
