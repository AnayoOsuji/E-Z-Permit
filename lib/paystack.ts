import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaystackCharge } from "./premium.ts";

// A small Paystack client over fetch (no SDK needed). Server only: it uses PAYSTACK_SECRET_KEY.
// Test mode only: a live key (sk_live_…) is refused. PAYSTACK_API_BASE points it at a fake server for testing.

const DEFAULT_BASE = "https://api.paystack.co";
const TIMEOUT_MS = 15_000;

export const isTestSecretKey = (key: string) => /^sk_test_[A-Za-z0-9]+/.test(key);

/** The secret key, or null when it's missing or isn't a test-mode key. */
export function paystackSecretKey(env: Record<string, string | undefined> = process.env): string | null {
  const key = env.PAYSTACK_SECRET_KEY?.trim();
  if (!key) return null;
  if (!isTestSecretKey(key)) {
    console.error("PAYSTACK_SECRET_KEY must be a test-mode key (sk_test_…). Refusing to use it.");
    return null;
  }
  return key;
}

/** An error whose message is safe to show to the user. */
export class PaystackError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "PaystackError";
    this.status = status;
  }
}

async function call<T>(secret: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const base = (process.env.PAYSTACK_API_BASE || DEFAULT_BASE).replace(/\/+$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new PaystackError("We couldn't reach Paystack. Please try again in a moment.");
  }
  const json = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
  if (!res.ok || !json || json.status === false || json.data === undefined) {
    const detail = json?.message ?? "";
    console.error("paystack error", res.status, path, detail);
    if (/currency/i.test(detail)) throw new PaystackError("Paystack can't take this currency on your account. Set PAYSTACK_PRICE_CURRENCY and PAYSTACK_PRICE_MINOR to one it supports.", res.status);
    if (res.status === 401 || /invalid key/i.test(detail)) throw new PaystackError("The Paystack key was rejected. Check PAYSTACK_SECRET_KEY on the server.", res.status);
    throw new PaystackError("Paystack couldn't process this request. Please try again.", res.status);
  }
  return json.data;
}

export type InitializeArgs = {
  email: string;
  amountMinor: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
};

/** Starts a transaction; the buyer pays at `authorizationUrl`. */
export async function initializeTransaction(secret: string, args: InitializeArgs): Promise<{ authorizationUrl: string; reference: string }> {
  const data = await call<{ authorization_url?: string; reference?: string }>(secret, "/transaction/initialize", {
    method: "POST",
    body: { email: args.email, amount: args.amountMinor, currency: args.currency, reference: args.reference, callback_url: args.callbackUrl, metadata: args.metadata },
  });
  if (!data.authorization_url) throw new PaystackError("Paystack returned no checkout link. Please try again.");
  return { authorizationUrl: data.authorization_url, reference: data.reference ?? args.reference };
}

/** Asks Paystack (server to server) what happened to a transaction. This is how we know it was really paid. */
export function verifyTransaction(secret: string, reference: string): Promise<PaystackCharge> {
  return call<PaystackCharge>(secret, `/transaction/verify/${encodeURIComponent(reference)}`);
}

/** Paystack signs each webhook body with HMAC-SHA512 using your secret key, in the x-paystack-signature header. */
export function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const given = header.trim().toLowerCase();
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/** Our own unique reference for a transaction. */
export const newReference = () => `ezp-${crypto.randomUUID()}`;
export const isReference = (value: string) => /^[A-Za-z0-9._=-]{8,100}$/.test(value);
