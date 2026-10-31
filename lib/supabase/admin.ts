import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env.ts";

// A Supabase client that BYPASSES Row Level Security, using SUPABASE_SERVICE_ROLE_KEY.
// Server only: import it from Route Handlers (like the Paystack webhook), never from a
// Client Component. The variable has no NEXT_PUBLIC_ prefix, so it isn't sent to the browser.
export function createAdminClient(): SupabaseClient | null {
  const env = supabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env || !serviceKey) return null;
  return createClient(env.url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Sets profiles.is_premium = true for the user, creating the profile row if the sign-up trigger hadn't. Throws on failure. */
export async function grantPremium(admin: SupabaseClient, userId: string, email?: string | null): Promise<void> {
  const { data, error } = await admin.from("profiles").update({ is_premium: true }).eq("id", userId).select("id");
  if (error) throw new Error(`Could not update the profile: ${error.message}`);
  if (data && data.length > 0) return;

  const { error: insertError } = await admin.from("profiles").insert({ id: userId, email: email ?? "", is_premium: true });
  if (insertError) throw new Error(`Could not create the profile: ${insertError.message}`);
}
