import {
  CONNECT_EXTENSION_SOURCE,
  CONNECT_PAGE_SOURCE,
  EXTENSION_AUTH_STORAGE_KEY,
  type ConnectExtensionMessage,
} from "@healthyscroll/shared";
import { sendAuthMessage } from "../lib/messages";

/**
 * Content script on healthyscroll.net/connect (Safari target only): Safari has
 * no chrome.identity, so the extension signs in on the website instead. The
 * page (apps/web/app/connect) keeps the extension's session in localStorage
 * under its own key; this script passes it to the background worker and then
 * deletes it, so the extension is the only holder of that refresh token.
 * Protocol: packages/shared/src/connect.ts.
 */

type Reply<M = ConnectExtensionMessage> = M extends unknown ? Omit<M, "source"> : never;
const reply = (msg: Reply) => window.postMessage({ source: CONNECT_EXTENSION_SOURCE, ...msg }, window.location.origin);

let handingOff = false;
let done = false;

async function handOff(): Promise<void> {
  if (handingOff || done) return;
  const raw = localStorage.getItem(EXTENSION_AUTH_STORAGE_KEY);
  const session = raw ? (JSON.parse(raw) as { access_token?: string; refresh_token?: string }) : null;
  if (!session?.access_token || !session.refresh_token) return; // page not signed in yet

  handingOff = true;
  try {
    const res = await sendAuthMessage({
      type: "AUTH_HANDOFF",
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
    });
    if (!res.ok) throw new Error(res.error);
    localStorage.removeItem(EXTENSION_AUTH_STORAGE_KEY);
    done = true;
    reply({ type: "CONNECTED", email: res.auth.email });
  } catch (err) {
    reply({ type: "FAILED", error: err instanceof Error ? err.message : String(err) });
  } finally {
    handingOff = false;
  }
}

if (import.meta.env.VITE_HS_DEBUG === "true") console.log("[healthyscroll] connect script loaded");

window.addEventListener("message", (e) => {
  if (e.source !== window || e.data?.source !== CONNECT_PAGE_SOURCE || e.data.type !== "SESSION_READY") return;
  reply({ type: "PRESENT" });
  void handOff();
});
reply({ type: "PRESENT" });
