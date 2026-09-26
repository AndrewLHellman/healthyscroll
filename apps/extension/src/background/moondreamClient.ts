import { MOONDREAM_ENDPOINT } from "../lib/config";

/**
 * Minimal fetch client for Moondream Station's local REST API.
 *
 * We don't use the `moondream` npm package here because the background
 * service worker has no Node `Buffer`/`fs`; the REST surface is tiny anyway.
 * Station and Cloud share the same routes, so swapping the endpoint is enough
 * to fall back to Cloud (server-side) if Station isn't running.
 *
 * Docs: https://docs.moondream.ai/station/
 */

export interface CaptionOptions {
  /** Data URL (`data:image/jpeg;base64,...`) as returned by captureVisibleTab. */
  imageDataUrl: string;
  length?: "short" | "normal" | "long";
}

export interface QueryOptions {
  imageDataUrl: string;
  question: string;
}

export async function caption({ imageDataUrl, length = "short" }: CaptionOptions): Promise<string> {
  const res = await post("/caption", { image_url: imageDataUrl, length, stream: false });
  return (res as { caption: string }).caption;
}

export async function query({ imageDataUrl, question }: QueryOptions): Promise<string> {
  const res = await post("/query", { image_url: imageDataUrl, question, stream: false });
  return (res as { answer: string }).answer;
}

/** True if Moondream Station is reachable; used to decide whether the visual pass is possible. */
export async function isAvailable(): Promise<boolean> {
  try {
    const res = await fetch(MOONDREAM_ENDPOINT.replace(/\/v1$/, "/"), { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

async function post(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${MOONDREAM_ENDPOINT}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`moondream ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
