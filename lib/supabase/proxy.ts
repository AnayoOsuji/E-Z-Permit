import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "./env.ts";

/** Refreshes the auth cookies on every request and reports who is signed in (by user id). */
export async function updateSession(request: NextRequest): Promise<{ response: NextResponse; user: { id: string } | null }> {
  let response = NextResponse.next({ request });
  const env = supabaseEnv();
  if (!env) return { response, user: null };

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Don't put code between createServerClient and getClaims: it is what refreshes the session.
  // getClaims verifies the access token locally with the project's signing keys (ES256), so unlike getUser it
  // doesn't call the auth server on every request.
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return { response, user: sub ? { id: sub } : null };
}
