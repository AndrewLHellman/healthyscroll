"use client";

import { useEffect, useState } from "react";
import { createClient, type User } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@healthyscroll/shared";

/**
 * Browser-side Supabase client for the website (same project as the extension).
 * PKCE: Google → Supabase → back here with ?code=, which the client exchanges
 * automatically on load (detectSessionInUrl). Queries run as the signed-in user,
 * so RLS limits them to that user's rows.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true },
});

/** Current user: undefined while loading, null when signed out. */
export function useUser(): User | null | undefined {
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

  return user;
}
