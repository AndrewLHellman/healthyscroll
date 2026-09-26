"use client";

import { supabase, useUser } from "@/lib/supabaseBrowser";
import { startGoogleSignIn } from "@/lib/googleSignIn";

/** Google sign-in always lands on the dashboard, wherever it was started. */
export function signIn() {
  void startGoogleSignIn("/dashboard");
}

/**
 * Account link in the nav. On the landing page it's one word: "Sign in" (which
 * goes straight to the dashboard) or "Dashboard" when already signed in. On the
 * dashboard itself it's the way out: "Sign out".
 */
export function AuthButton({ variant = "landing" }: { variant?: "landing" | "app" }) {
  const user = useUser();
  const link = "rounded-md text-sm text-muted transition-colors hover:text-ink";
  const show = variant === "app" ? "" : "hidden md:block";

  if (user === undefined) return <span className={`h-5 w-14 ${show}`} aria-hidden />;

  if (variant === "app") {
    if (!user) return null;
    return (
      <button onClick={() => void supabase.auth.signOut()} className={link} title={user.email}>
        Sign out
      </button>
    );
  }

  if (!user) {
    return (
      <button onClick={signIn} className={`${show} ${link}`}>
        Sign in
      </button>
    );
  }
  return (
    <a href="/dashboard" className={`${show} ${link}`} title={user.email}>
      Dashboard
    </a>
  );
}
