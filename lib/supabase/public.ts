import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env.ts";

/**
 * A signed-out Supabase client that never reads cookies, so pages that use it can stay statically
 * generated. It only sees what the anon role may see (RLS applies). Null when Supabase isn't configured.
 */
export function createPublicClient(): SupabaseClient | null {
  const env = supabaseEnv();
  return env ? createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}
