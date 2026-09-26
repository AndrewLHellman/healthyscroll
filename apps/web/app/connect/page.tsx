import type { Metadata } from "next";
import { Wordmark } from "@/components/Wordmark";
import { ConnectClient } from "./ConnectClient";

export const metadata: Metadata = {
  title: "Connect · Healthy Scroll",
  description: "Sign the Healthy Scroll Safari extension in to your account.",
  robots: { index: false },
};

/**
 * Where the Safari extension signs in (it can't run OAuth itself). Deliberately
 * not using <Nav>: that pulls in the site's own Supabase client, which would
 * race ConnectClient's to exchange the one-time ?code= from Google.
 */
export default function ConnectPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-10 sm:px-8">
      <a href="/" className="w-fit">
        <Wordmark />
      </a>
      <ConnectClient />
    </main>
  );
}
