// The public Supabase settings. Null when they haven't been configured yet, so
// the app can still run (signed out) without them.
// Supabase now calls the public key the "publishable" key; the older "anon" name also works.
// Each variable is referenced by its full name so Next.js can inline it into the browser bundle.
export function supabaseEnv(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}
