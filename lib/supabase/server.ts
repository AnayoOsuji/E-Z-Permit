import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env.ts";

/** Supabase client for Server Components, Server Actions and Route Handlers. */
export async function createClient(): Promise<SupabaseClient | null> {
  // Read cookies first so callers always render per request, even before Supabase is configured.
  const cookieStore = await cookies();
  const env = supabaseEnv();
  if (!env) return null;
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components can't set cookies; proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

/** The signed-in user, verified with Supabase Auth, or null. */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}
