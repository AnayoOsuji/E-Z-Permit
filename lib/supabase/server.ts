import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
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

export type CurrentUser = { id: string; email: string | null };

/**
 * The signed-in user, or null. Verified from the session token's signature (getClaims), which needs no call to the
 * auth server with this project's asymmetric signing keys. A sign-out elsewhere takes effect when the token expires
 * (at most an hour); payment routes use the stricter getUser() instead.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}
