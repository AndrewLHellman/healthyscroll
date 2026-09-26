"use client";

import { supabase, useUser } from "@/lib/supabaseBrowser";

/** Google sign-in / sign-out for the landing page. */
export function AuthButton() {
  const user = useUser();

  if (user === undefined) return <div className="h-8" />;

  if (!user) {
    return (
      <button
        onClick={() =>
          void supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: window.location.origin },
          })
        }
        className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm hover:border-neutral-400"
      >
        Sign in with Google
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm text-neutral-500">
      <span className="truncate">{user.email}</span>
      <button onClick={() => void supabase.auth.signOut()} className="underline hover:text-neutral-900">
        Sign out
      </button>
    </div>
  );
}
