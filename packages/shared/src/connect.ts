/**
 * Sign-in handoff for the Safari extension (it has no chrome.identity).
 *
 * healthyscroll.net/connect signs in with a *separate* Supabase client that
 * stores its session under EXTENSION_AUTH_STORAGE_KEY in localStorage, so the
 * extension gets its own session rather than sharing the website's (two
 * clients rotating one refresh token makes Supabase revoke it). The
 * extension's content script on that page reads the key, hands the session to
 * the background worker, and deletes the key.
 *
 * Page and content script talk with window.postMessage:
 *   page -> extension  { source: CONNECT_PAGE_SOURCE, type: "SESSION_READY" }
 *   extension -> page  { source: CONNECT_EXTENSION_SOURCE, type: "PRESENT" }
 *                      { source: CONNECT_EXTENSION_SOURCE, type: "CONNECTED", email }
 *                      { source: CONNECT_EXTENSION_SOURCE, type: "FAILED", error }
 */
export const EXTENSION_AUTH_STORAGE_KEY = "healthyscroll-extension-auth";
export const CONNECT_PAGE_SOURCE = "healthyscroll-connect-page";
export const CONNECT_EXTENSION_SOURCE = "healthyscroll-connect-extension";

export type ConnectExtensionMessage =
  | { source: typeof CONNECT_EXTENSION_SOURCE; type: "PRESENT" }
  | { source: typeof CONNECT_EXTENSION_SOURCE; type: "CONNECTED"; email: string | null }
  | { source: typeof CONNECT_EXTENSION_SOURCE; type: "FAILED"; error: string };
