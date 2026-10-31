import { isUuid } from "./roadmap-view.ts";

// The premium purchase, defined once on the server. The price is never taken from the client.
export const PREMIUM_PRODUCT = "ez-permit-premium";
export const PREMIUM_NAME = "E-Z Permit: complete local permit guide";

// $19, one time. Amounts are in the currency's smallest unit (cents for USD).
export const DEFAULT_PRICE = { currency: "USD", minor: 1900 };
const CURRENCIES = ["USD", "NGN", "GHS", "ZAR", "KES"];

/**
 * The price to charge. USD $19 by default. A Paystack account that can't take USD can set both
 * PAYSTACK_PRICE_CURRENCY and PAYSTACK_PRICE_MINOR (for example NGN and 3000000 for ₦30,000).
 * Returns null when those variables are set but invalid, so a typo can't silently change the price.
 */
export function premiumPrice(env: Record<string, string | undefined> = process.env): { currency: string; minor: number } | null {
  const currency = env.PAYSTACK_PRICE_CURRENCY?.trim().toUpperCase();
  const minorRaw = env.PAYSTACK_PRICE_MINOR?.trim();
  if (!currency && !minorRaw) return DEFAULT_PRICE;
  const minor = Number(minorRaw);
  if (!currency || !CURRENCIES.includes(currency) || !Number.isInteger(minor) || minor < 100) return null;
  return { currency, minor };
}

/** Where Paystack sends the buyer afterwards: back to the roadmap they were on, or the dashboard. */
export function returnPaths(roadmapId?: string | null): { callback: string; cancel: string } {
  const base = roadmapId && isUuid(roadmapId) ? `/dashboard/roadmaps/${roadmapId}` : "/dashboard";
  return { callback: base, cancel: `${base}?canceled=1` };
}

/** A Paystack transaction, as returned by /transaction/verify and in `charge.success` webhooks. */
export type PaystackCharge = {
  status?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  metadata?: unknown;
  customer?: { email?: string | null } | null;
};

function metadataOf(charge: PaystackCharge): { user_id?: unknown; product?: unknown } {
  let m = charge.metadata;
  if (typeof m === "string") {
    try {
      m = JSON.parse(m);
    } catch {
      return {};
    }
  }
  return m && typeof m === "object" ? (m as { user_id?: unknown; product?: unknown }) : {};
}

/**
 * The user to make premium for a Paystack transaction, or null when it isn't a successful
 * premium purchase made through our checkout route (right product, amount and currency).
 */
export function premiumUserIdFromCharge(charge: PaystackCharge, price = premiumPrice()): string | null {
  if (!price || charge.status !== "success") return null;
  const meta = metadataOf(charge);
  if (meta.product !== PREMIUM_PRODUCT) return null;
  if (charge.amount !== price.minor || charge.currency?.toUpperCase() !== price.currency) return null;
  return typeof meta.user_id === "string" && isUuid(meta.user_id) ? meta.user_id : null;
}
