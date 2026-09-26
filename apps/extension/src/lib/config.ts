/**
 * Endpoints the background worker talks to.
 * Dev builds hit the local Next.js server; prod hits healthyscroll.net.
 */
export const API_BASE_URL = import.meta.env.DEV
  ? "http://localhost:3000"
  : "https://healthyscroll.net";

/** Moondream Station default local endpoint. */
export const MOONDREAM_ENDPOINT = "http://localhost:2020/v1";
