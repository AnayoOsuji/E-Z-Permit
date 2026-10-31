import { newReference, initializeTransaction, paystackSecretKey, PaystackError } from "../../../lib/paystack.ts";
import { PREMIUM_PRODUCT, premiumPrice, returnPaths } from "../../../lib/premium.ts";
import { createClient } from "../../../lib/supabase/server.ts";

export const runtime = "nodejs";

const fail = (error: string, status: number) => Response.json({ error }, { status });

// Starts a Paystack transaction for the one-time premium unlock and returns { url } to pay at.
// Body (optional): { roadmapId } so the buyer comes back to the roadmap they were looking at.
// Whether they paid is decided by Paystack's webhook / the verify route, never by anything here.
export async function POST(req: Request) {
  const supabase = await createClient();
  if (!supabase) return fail("Sign-in isn't configured on this server.", 503);
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return fail("Sign in to unlock premium.", 401);
  if (!user.email) return fail("Your account needs an email address to pay.", 400);

  const secret = paystackSecretKey();
  const price = premiumPrice();
  if (!secret || !price) return fail("Checkout isn't set up on this server yet.", 503);

  const { data: profile } = await supabase.from("profiles").select("is_premium").eq("id", user.id).maybeSingle();
  if (profile?.is_premium === true) return fail("You already have premium.", 409);

  const body = (await req.json().catch(() => null)) as { roadmapId?: unknown } | null;
  const roadmapId = typeof body?.roadmapId === "string" ? body.roadmapId : null;
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/+$/, "");
  const paths = returnPaths(roadmapId);

  try {
    // Amount, currency and product come from the server (lib/premium.ts); nothing priced or targeted by the client is used.
    const tx = await initializeTransaction(secret, {
      email: user.email,
      amountMinor: price.minor,
      currency: price.currency,
      reference: newReference(),
      callbackUrl: `${origin}${paths.callback}`,
      metadata: { user_id: user.id, product: PREMIUM_PRODUCT, cancel_action: `${origin}${paths.cancel}` },
    });
    return Response.json({ url: tx.authorizationUrl });
  } catch (err) {
    console.error("checkout: could not start the transaction", err);
    return fail(err instanceof PaystackError ? err.message : "We couldn't start checkout. Please try again in a moment.", 502);
  }
}
