"use client";

import { supabase, useUser } from "@/lib/supabaseBrowser";

/** Google sign-in / sign-out, lives in the nav. Signing in unlocks the saved prompt in the final section. */
export function AuthButton() {
  const user = useUser();

  if (user === undefined) return <span className="hidden h-5 w-14 md:block" aria-hidden />;

  if (!user) {
    return (
      <button
        onClick={() =>
          void supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: window.location.origin },
          })
        }
        className="hidden rounded-md text-sm text-muted transition-colors hover:text-ink md:block"
      >
        Sign in
      </button>
    );
  }

  return (
    <span className="hidden items-center gap-3 text-sm text-muted md:flex">
      <span className="max-w-[16ch] truncate" title={user.email}>
        {user.email}
      </span>
      <button onClick={() => void supabase.auth.signOut()} className="rounded-md transition-colors hover:text-ink">
        Sign out
      </button>
    </span>
  );
}
