/**
 * Supabase project used for sign-in. Both values are public by design (the anon
 * key only grants what RLS allows), so they live here rather than in env files.
 * The service_role / secret key must never appear in this repo.
 */
export const SUPABASE_URL = "https://ikwvesahfsjpwdnwdfos.supabase.co";

/**
 * Table rows, mirroring supabase/migrations/*_policies_and_skips.sql.
 * user_id defaults to auth.uid() on insert, so callers can omit it.
 */
export interface PolicyRow {
  user_id: string;
  prompt: string;
  enabled: boolean;
  updated_at: string;
}

export interface SkipRow {
  id: number;
  user_id: string;
  platform: string;
  video_id: string;
  stage: "text" | "visual" | "monitor";
  violates_probability: number | null;
  skipped_at: string;
}

export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlrd3Zlc2FoZnNqcHdkbndkZm9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzOTM4NTUsImV4cCI6MjEwNTk2OTg1NX0.5kCPdtvG8S01CKeakyRBsZL9XQmT92xjGByHJuqWlF0";
