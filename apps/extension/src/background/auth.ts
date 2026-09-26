import { createClient, type SupportedStorage } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@healthyscroll/shared";
import type { AuthState } from "../lib/messages";

/**
 * Supabase auth for the extension. Only the background worker uses this client:
 * the popup closes as soon as the Google window takes focus, so the OAuth flow
 * has to run here. The popup asks for sign-in / state via messages.
 */

// Service workers have no localStorage; persist the session in chrome.storage.local.
const storage: SupportedStorage = {
  async getItem(key) {
    const result = await chrome.storage.local.get(key);
    return (result[key] as string | undefined) ?? null;
  },
  setItem: (key, value) => chrome.storage.local.set({ [key]: value }),
  removeItem: (key) => chrome.storage.local.remove(key),
};

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

/**
 * Google sign-in via Supabase. launchWebAuthFlow opens the Supabase → Google
 * page and resolves once it redirects to https://<extension-id>.chromiumapp.org/,
 * which must be in Supabase's Redirect URLs allow list.
 */
export async function signIn(): Promise<AuthState> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: chrome.identity.getRedirectURL(), skipBrowserRedirect: true },
  });
  if (error) throw error;

  const redirect = await chrome.identity.launchWebAuthFlow({ url: data.url, interactive: true });
  if (!redirect) throw new Error("sign-in cancelled");

  const params = new URL(redirect).searchParams;
  const code = params.get("code");
  if (!code) throw new Error(params.get("error_description") ?? "sign-in failed: no code returned");

  const exchanged = await supabase.auth.exchangeCodeForSession(code);
  if (exchanged.error) throw exchanged.error;
  return getAuthState();
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getAuthState(): Promise<AuthState> {
  const { data } = await supabase.auth.getSession();
  return { email: data.session?.user.email ?? null };
}

/** Current access token (refreshed if expired), or null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
