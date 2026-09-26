/**
 * Endpoints the background worker talks to.
 * Dev builds hit local servers; prod hits healthyscroll.net. Either can be
 * overridden at build time (e.g. VITE_API_BASE_URL=http://localhost:3000 for a
 * production build that still talks to a local stack).
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:3000" : "https://healthyscroll.net");

/**
 * apps/vision (FastAPI): frames -> SigLIP -> caption. Not deployed yet; the
 * prod default is a placeholder until it has a home.
 */
export const VISION_BASE_URL =
  import.meta.env.VITE_VISION_URL ||
  (import.meta.env.DEV ? "http://localhost:8000" : "https://vision.healthyscroll.net");

/** Moondream Station default local endpoint. */
export const MOONDREAM_ENDPOINT = "http://localhost:2020/v1";
