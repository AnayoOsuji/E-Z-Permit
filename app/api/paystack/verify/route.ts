import { isReference, paystackSecretKey, PaystackError, verifyTransaction } from "../../../../lib/paystack.ts";
import { premiumUserIdFromCharge } from "../../../../lib/premium.ts";
import { createAdminClient, grantPremium } from "../../../../lib/supabase/admin.ts";
import { createClient } from "../../../../lib/supabase/server.ts";

export const runtime = "nodejs";

const fail = (error: string, status: number) => Response.json({ error }, { status });

// Called by the roadmap page when the buyer comes back from Paystack. It asks Paystack directly (server to
// server, with the secret key) whether this transaction succeeded, so premium works even before, or without,
// the webhook (for example on localhost). It only ever upgrades the signed-in user, and only for their own payment.
// Body: { reference }. Returns { status: "success" | "pending" | "failed", premium }.
export async function POST(req: Request) {
  const supabase = await createClient();
  if (!supabase) return fail("Sign-in isn't configured on this server.", 503);
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return fail("Sign in first.", 401);

  const secret = paystackSecretKey();
  if (!secret) return fail("Checkout isn't set up on this server yet.", 503);

  const body = (await req.json().catch(() => null)) as { reference?: unknown } | null;
  const reference = typeof body?.reference === "string" ? body.reference : "";
  if (!isReference(reference)) return fail("That payment reference doesn't look right.", 400);

  let charge;
  try {
    charge = await verifyTransaction(secret, reference);
  } catch (err) {
    return fail(err instanceof PaystackError ? err.message : "We couldn't check your payment. Please try again.", 502);
  }

  if (charge.status !== "success") {
    const stillOpen = ["pending", "ongoing", "processing", "queued"].includes(charge.status ?? "");
    return Response.json({ status: stillOpen ? "pending" : "failed", premium: false });
  }

  // A successful payment, but is it ours and is it this user's?
  const userId = premiumUserIdFromCharge(charge);
  if (!userId || userId !== user.id) return fail("This payment doesn't match your account.", 403);

  const admin = createAdminClient();
  if (!admin) {
    console.error("paystack verify: SUPABASE_SERVICE_ROLE_KEY is missing, can't grant premium");
    return fail("We confirmed your payment but couldn't unlock your account yet. Please contact support.", 500);
  }
  try {
    await grantPremium(admin, user.id, user.email);
  } catch (err) {
    console.error("paystack verify: granting premium failed", err);
    return fail("We confirmed your payment but couldn't unlock your account yet. Please try again.", 500);
  }
  return Response.json({ status: "success", premium: true });
}
