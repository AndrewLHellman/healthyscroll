"use client";

import { useEffect, useState } from "react";
import { createClient, type User } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@healthyscroll/shared";

/**
 * Google sign-in for the landing page, via Supabase (same project as the
 * extension). PKCE: Google → Supabase → back here with ?code=, which the client
 * exchanges automatically on load (detectSessionInUrl).
 */
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true },
});

export function AuthButton() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      // Drop the one-time ?code= from the address bar after the exchange.
      if (session && window.location.search.includes("code=")) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

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
