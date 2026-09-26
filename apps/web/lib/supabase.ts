import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@healthyscroll/shared";

/**
 * Server-side Supabase client, used only to verify access tokens sent by the
 * extension. Stateless: no session is stored or refreshed here.
 */
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

/** Returns the user id for a valid `Authorization: Bearer <token>` header, else null. */
export async function verifyRequest(authorization: string | null): Promise<string | null> {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
