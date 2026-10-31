import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env.ts";

/** Supabase client for Client Components. Null when Supabase isn't configured. */
export function createClient(): SupabaseClient | null {
  const env = supabaseEnv();
  return env ? createBrowserClient(env.url, env.anonKey) : null;
}
