"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { GOOGLE_CLIENT_ID } from "@healthyscroll/shared";

/**
 * Google sign-in without Supabase's hosted OAuth page, so the consent screen
 * says healthyscroll.net rather than <project>.supabase.co. We send the browser
 * to Google ourselves (OpenID Connect implicit flow: response_type=id_token),
 * Google returns to the same path with #id_token=, and we hand that token to
 * Supabase with signInWithIdToken. Every path passed to startGoogleSignIn must
 * be an Authorized redirect URI on the Google OAuth client, for each origin.
 *
 * Nonce: Google gets sha256(nonce) and embeds it in the token; Supabase gets the
 * raw nonce, hashes it and compares, which ties the token to this browser tab.
 * A full-page redirect keeps sessionStorage, so the nonce is kept there.
 */

const NONCE_KEY = "healthyscroll-google-nonce";

export async function startGoogleSignIn(returnPath: string): Promise<void> {
  if (!GOOGLE_CLIENT_ID) throw new Error("GOOGLE_CLIENT_ID is not set (packages/shared/src/supabase.ts)");
  const nonce = randomHex(16);
  sessionStorage.setItem(NONCE_KEY, nonce);

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${window.location.origin}${returnPath}`,
    response_type: "id_token",
    scope: "openid email profile",
    nonce: await sha256Hex(nonce),
    prompt: "select_account",
  }).toString();
  window.location.assign(url.toString());
}

/**
 * Finish a sign-in Google redirected back from, if this page load is one:
 * null when the URL carries no Google response, otherwise the outcome. Clears
 * the fragment either way, so a reload doesn't retry a spent token.
 */
export async function finishGoogleSignIn(
  client: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string } | null> {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const token = params.get("id_token");
  const error = params.get("error");
  if (!token && !error) return null;

  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  const nonce = sessionStorage.getItem(NONCE_KEY);
  sessionStorage.removeItem(NONCE_KEY);

  if (!token) return { ok: false, error: params.get("error_description") ?? error ?? "sign-in failed" };
  if (!nonce) return { ok: false, error: "sign-in started in another tab; try again" };

  const result = await client.auth.signInWithIdToken({ provider: "google", token, nonce });
  return result.error ? { ok: false, error: result.error.message } : { ok: true };
}

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
