import type { Decision, EvaluateRequest } from "@healthyscroll/shared";
import { API_BASE_URL } from "../lib/config";
import { authedFetch } from "./auth";

/**
 * Calls our own API, which calls Jev. The extension never holds the AI Gateway
 * key; it authenticates with the user's Supabase access token instead.
 * See apps/web/app/api/evaluate/route.ts for the server side.
 */
export async function evaluate(req: EvaluateRequest): Promise<Decision> {
  const res = await authedFetch(`${API_BASE_URL}/api/evaluate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    throw new Error(`evaluate failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as Decision;
}
