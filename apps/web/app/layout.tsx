import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["wdth", "opsz"],
});

const sans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Healthy Scroll: your prompt, your feed",
  description:
    "A Safari extension for iPhone that skips the Instagram Reels you asked not to see, before they get a chance to hook you. Decisions in about 200 ms. Frames are described, then discarded.",
  metadataBase: new URL("https://healthyscroll.net"),
  openGraph: {
    title: "Healthy Scroll",
    description: "Skip the Reels you never wanted to see. Before they hook you.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
