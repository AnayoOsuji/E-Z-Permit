import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "./env.ts";

/** Refreshes the auth cookies on every request and reports who is signed in. */
export async function updateSession(request: NextRequest): Promise<{ response: NextResponse; user: User | null }> {
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

  // Don't put code between createServerClient and getUser: getUser is what refreshes the session.
  const { data } = await supabase.auth.getUser();
  return { response, user: data.user };
}
