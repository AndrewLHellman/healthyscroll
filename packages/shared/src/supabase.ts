/**
 * Supabase project used for sign-in. Both values are public by design (the anon
 * key only grants what RLS allows), so they live here rather than in env files.
 * The service_role / secret key must never appear in this repo.
 */
export const SUPABASE_URL = "https://ikwvesahfsjpwdnwdfos.supabase.co";

export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlrd3Zlc2FoZnNqcHdkbndkZm9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzOTM4NTUsImV4cCI6MjEwNTk2OTg1NX0.5kCPdtvG8S01CKeakyRBsZL9XQmT92xjGByHJuqWlF0";
