"use client";

import { useEffect, useState } from "react";
import { createClient, type User } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@healthyscroll/shared";
import { finishGoogleSignIn } from "./googleSignIn";

/**
 * Browser-side Supabase client for the website (same project as the extension).
 * Sign-in goes straight to Google (lib/googleSignIn.ts), which returns to
 * /dashboard with an ID token that becomes a Supabase session. Queries run as
 * the signed-in user, so RLS limits them to that user's rows.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, detectSessionInUrl: false },
});

// One exchange per page load, however many components ask for the user.
let finished: Promise<unknown> | undefined;

/** Current user: undefined while loading, null when signed out. */
export function useUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    finished ??= finishGoogleSignIn(supabase).then((r) => {
      if (r && !r.ok) console.warn("[healthyscroll] sign-in failed:", r.error);
    });
    void finished
      .then(() => supabase.auth.getSession())
      .then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  return user;
}
