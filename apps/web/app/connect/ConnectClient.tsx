"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  CONNECT_EXTENSION_SOURCE,
  CONNECT_PAGE_SOURCE,
  EXTENSION_AUTH_STORAGE_KEY,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  type ConnectExtensionMessage,
} from "@healthyscroll/shared";

/**
 * A second Supabase client, just for the extension's session (see
 * packages/shared/src/connect.ts). Its own storageKey keeps it apart from the
 * website's session; no auto-refresh because once handed off, the extension
 * owns the refresh token and a refresh here would rotate it out from under it.
 */
const extensionAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: "pkce",
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: false,
    storageKey: EXTENSION_AUTH_STORAGE_KEY,
  },
});

type State =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "handing-off"; extensionSeen: boolean; slow: boolean }
  | { kind: "connected"; email: string | null }
  | { kind: "failed"; error: string };

export function ConnectClient() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const poke = useRef<number | undefined>(undefined);

  useEffect(() => {
    // Replies from the extension's content script on this page (content/connect.ts).
    const onMessage = (e: MessageEvent) => {
      const msg = e.data as ConnectExtensionMessage | undefined;
      if (e.source !== window || msg?.source !== CONNECT_EXTENSION_SOURCE) return;
      if (msg.type === "PRESENT") setState((s) => (s.kind === "handing-off" ? { ...s, extensionSeen: true } : s));
      if (msg.type === "CONNECTED" || msg.type === "FAILED") clearInterval(poke.current);
      if (msg.type === "CONNECTED") setState({ kind: "connected", email: msg.email });
      if (msg.type === "FAILED") setState({ kind: "failed", error: msg.error });
    };
    window.addEventListener("message", onMessage);

    let slowTimer: number | undefined;
    // getSession waits for the ?code= exchange when we've just come back from Google.
    void extensionAuth.auth.getSession().then(({ data }) => {
      if (window.location.search.includes("code=")) window.history.replaceState(null, "", window.location.pathname);
      if (!data.session) {
        setState({ kind: "signed-out" });
        return;
      }
      setState({ kind: "handing-off", extensionSeen: false, slow: false });
      // The content script may load before or after us; keep nudging until it answers.
      const ready = () => window.postMessage({ source: CONNECT_PAGE_SOURCE, type: "SESSION_READY" }, window.location.origin);
      ready();
      poke.current = window.setInterval(ready, 1000);
      slowTimer = window.setTimeout(() => setState((s) => (s.kind === "handing-off" ? { ...s, slow: true } : s)), 4000);
    });

    return () => {
      window.removeEventListener("message", onMessage);
      clearInterval(poke.current);
      clearTimeout(slowTimer);
    };
  }, []);

  function signIn() {
    void extensionAuth.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/connect` },
    });
  }

  return (
    <div className="flex flex-1 flex-col justify-center gap-6 py-16">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        {state.kind === "connected" ? "You’re connected" : "Connect the extension"}
      </h1>

      {state.kind === "loading" && <p className="text-lg text-muted" aria-busy>Checking…</p>}

      {state.kind === "signed-out" && (
        <>
          <p className="text-lg leading-relaxed text-muted">
            Sign in so Healthy Scroll in Safari can use your account and the prompt you saved on the website.
          </p>
          <button
            onClick={signIn}
            className="w-fit rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink/85"
          >
            Sign in with Google
          </button>
        </>
      )}

      {state.kind === "handing-off" && (
        <>
          <p className="text-lg leading-relaxed text-muted" aria-busy>
            Handing your sign-in to the extension…
          </p>
          {state.slow && (
            <p className="text-sm leading-relaxed text-muted">
              {state.extensionSeen
                ? "The extension is here but hasn’t answered. Try reloading this page."
                : "Can’t reach the extension. In Safari, tap the page menu (the AA or puzzle icon), choose Healthy Scroll, allow it on healthyscroll.net, then reload this page."}
            </p>
          )}
        </>
      )}

      {state.kind === "connected" && (
        <>
          <p className="text-lg leading-relaxed text-muted">
            Healthy Scroll is signed in{state.email ? ` as ${state.email}` : ""}. You can close this tab.
          </p>
          <a
            href="https://www.instagram.com/reels/"
            className="w-fit rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink/85"
          >
            Open Instagram Reels
          </a>
        </>
      )}

      {state.kind === "failed" && (
        <>
          <p className="text-lg leading-relaxed text-muted">The extension couldn’t sign in: {state.error}</p>
          <button
            onClick={signIn}
            className="w-fit rounded-full border border-ink px-5 py-2.5 text-sm font-medium transition-colors hover:bg-ink hover:text-paper"
          >
            Try again
          </button>
        </>
      )}
    </div>
  );
}
