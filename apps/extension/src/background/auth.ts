import { createClient, type SupportedStorage } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@healthyscroll/shared";
import type { AuthState } from "../lib/messages";
import { API_BASE_URL } from "../lib/config";

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

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

/**
 * Google sign-in via Supabase. On Chrome, launchWebAuthFlow opens the Supabase → Google
 * page and resolves once it redirects to https://<extension-id>.chromiumapp.org/,
 * which must be in Supabase's Redirect URLs allow list.
 */
export async function signIn(): Promise<AuthState> {
  // Safari has no chrome.identity: sign in on the website, which hands the
  // session back through content/connect.ts (AUTH_HANDOFF -> adoptSession).
  if (import.meta.env.VITE_HS_TARGET === "safari") {
    await chrome.tabs.create({ url: `${API_BASE_URL}/connect` });
    return getAuthState();
  }

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

/** Adopt a session signed in on healthyscroll.net/connect (Safari). The extension owns it from here. */
export async function adoptSession(accessToken: string, refreshToken: string): Promise<AuthState> {
  const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (error) throw error;
  return getAuthState();
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getAuthState(): Promise<AuthState> {
  const { data } = await supabase.auth.getSession();
  return { email: data.session?.user.email ?? null };
}

export async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Current access token (refreshed if expired), or null when signed out. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

// One refresh at a time: every in-flight Reel may hit a 401 at once.
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  refreshing ??= supabase.auth
    .refreshSession()
    .then(async ({ data, error }) => {
      if (error || !data.session) {
        // The refresh token is dead too (expired/revoked). Drop the local session so
        // the popup shows "Sign in" instead of every Reel failing silently.
        console.warn("[auth] session expired and couldn't be refreshed; sign in again", error);
        await supabase.auth.signOut({ scope: "local" });
        return null;
      }
      return data.session.access_token;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/**
 * fetch() with the user's Supabase token. On 401 (seen 2026-09-26: the service
 * worker kept sending an expired token and both APIs rejected every Reel), force
 * one token refresh and retry once.
 */
export async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  if (!token) throw new Error("not signed in");
  const withToken = (t: string) =>
    fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), authorization: `Bearer ${t}` } });

  const res = await withToken(token);
  if (res.status !== 401) return res;
  const fresh = await refreshAccessToken();
  if (!fresh) throw new Error("not signed in (session expired)");
  return withToken(fresh);
}
