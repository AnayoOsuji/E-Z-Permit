import { paystackSecretKey, verifySignature } from "../../../../lib/paystack.ts";
import { premiumUserIdFromCharge, type PaystackCharge } from "../../../../lib/premium.ts";
import { createAdminClient, grantPremium } from "../../../../lib/supabase/admin.ts";

export const runtime = "nodejs";

// Paystack calls this after a payment. It checks Paystack's signature (HMAC-SHA512 of the raw body,
// keyed with the secret key), then uses the service role key (which bypasses RLS) to set
// profiles.is_premium = true. Users can't set that flag themselves: they have no update policy on `profiles`.
export async function POST(req: Request) {
  const secret = paystackSecretKey();
  if (!secret) {
    console.error("paystack webhook: PAYSTACK_SECRET_KEY is missing or not a test key");
    return Response.json({ error: "Webhook isn't configured." }, { status: 503 });
  }

  // The signature covers the exact bytes Paystack sent, so read the raw body (not parsed JSON).
  const payload = await req.text();
  if (!verifySignature(payload, req.headers.get("x-paystack-signature"), secret)) {
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: { event?: string; data?: PaystackCharge };
  try {
    event = JSON.parse(payload);
  } catch {
    return Response.json({ error: "Invalid payload." }, { status: 400 });
  }
  if (event.event !== "charge.success" || !event.data) return Response.json({ received: true, ignored: event.event ?? "unknown event" });

  const userId = premiumUserIdFromCharge(event.data);
  if (!userId) return Response.json({ received: true, ignored: "not a successful premium purchase" });

  const admin = createAdminClient();
  if (!admin) {
    // A 5xx makes Paystack retry, so the payment isn't lost once the key is added.
    console.error("paystack webhook: SUPABASE_SERVICE_ROLE_KEY is missing, can't grant premium");
    return Response.json({ error: "Server isn't configured to grant premium." }, { status: 500 });
  }

  try {
    await grantPremium(admin, userId, event.data.customer?.email);
  } catch (err) {
    console.error("paystack webhook: granting premium failed", err);
    return Response.json({ error: "Couldn't update the account." }, { status: 500 });
  }
  return Response.json({ received: true });
}
