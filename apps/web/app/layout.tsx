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
  title: "Healthy Scroll: Take back your feed",
  description:
    "Set your own limits on your Instagram feed. Tell Healthy Scroll what you’d like to avoid, and it skips matching Reels in Safari on your iPhone.",
  metadataBase: new URL("https://healthyscroll.net"),
  openGraph: {
    title: "Healthy Scroll",
    description: "Take back your feed.",
    type: "website",
    url: "/",
    siteName: "Healthy Scroll",
    // Rendered from components/frames/Thumbnail.tsx by scripts/shoot-graphics.sh.
    images: [{ url: "/graphics/thumbnail-devpost.png", width: 3000, height: 2000, alt: "Healthy Scroll: Take back your feed." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Healthy Scroll",
    description: "Take back your feed.",
    images: ["/graphics/thumbnail-devpost.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
