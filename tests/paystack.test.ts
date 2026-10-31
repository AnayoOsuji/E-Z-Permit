import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, test } from "node:test";
import {
  PaystackError,
  initializeTransaction,
  isReference,
  isTestSecretKey,
  newReference,
  paystackSecretKey,
  verifySignature,
  verifyTransaction,
} from "../lib/paystack.ts";
import { DEFAULT_PRICE, PREMIUM_PRODUCT, premiumPrice, premiumUserIdFromCharge, returnPaths } from "../lib/premium.ts";
import { grantPremium } from "../lib/supabase/admin.ts";

const USER = "3f2b8c1e-9a4d-4e6f-8b1a-0c9d7e5f4a3b";
const ROADMAP = "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d";
const SECRET = "sk_test_abc123def456";

const realFetch = globalThis.fetch;
const savedEnv = { ...process.env };
afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...savedEnv };
});

test("only test-mode Paystack keys are accepted", () => {
  assert.ok(isTestSecretKey("sk_test_abc123"));
  for (const bad of ["sk_live_abc123", "pk_test_abc123", "sk_test_", "", "whsec_abc"]) assert.ok(!isTestSecretKey(bad), bad);
  assert.equal(paystackSecretKey({}), null);
  assert.equal(paystackSecretKey({ PAYSTACK_SECRET_KEY: "  " }), null);
  assert.equal(paystackSecretKey({ PAYSTACK_SECRET_KEY: SECRET }), SECRET);
  const quiet = console.error;
  console.error = () => {};
  try {
    assert.equal(paystackSecretKey({ PAYSTACK_SECRET_KEY: "sk_live_abc123" }), null, "a live key is refused");
  } finally {
    console.error = quiet;
  }
});

test("webhook signature: HMAC-SHA512 of the raw body with the secret key", () => {
  const body = JSON.stringify({ event: "charge.success", data: { amount: 1900 } });
  const sig = createHmac("sha512", SECRET).update(body).digest("hex");
  assert.ok(verifySignature(body, sig, SECRET));
  assert.ok(verifySignature(body, sig.toUpperCase(), SECRET), "hex case doesn't matter");
  assert.ok(!verifySignature(body, sig, "sk_test_other"), "wrong secret");
  assert.ok(!verifySignature(body.replace("1900", "1"), sig, SECRET), "tampered body");
  assert.ok(!verifySignature(body, null, SECRET), "missing header");
  assert.ok(!verifySignature(body, "", SECRET));
  assert.ok(!verifySignature(body, "abc", SECRET), "wrong length");
  assert.ok(!verifySignature(body, "z".repeat(128), SECRET), "right length, not the signature");
  assert.ok(!verifySignature(body, createHmac("sha256", SECRET).update(body).digest("hex"), SECRET), "wrong algorithm");
});

test("references", () => {
  assert.ok(isReference(newReference()));
  assert.notEqual(newReference(), newReference());
  for (const bad of ["short", "has space in it", "../../etc/passwd", "a/b/c/d/e/f/g", "x".repeat(101), "ref?x=1&y=2"]) assert.ok(!isReference(bad), bad);
});

test("price: $19 USD by default, and a misconfigured override is rejected, not guessed", () => {
  assert.deepEqual(DEFAULT_PRICE, { currency: "USD", minor: 1900 });
  assert.deepEqual(premiumPrice({}), { currency: "USD", minor: 1900 });
  assert.deepEqual(premiumPrice({ PAYSTACK_PRICE_CURRENCY: "ngn", PAYSTACK_PRICE_MINOR: "3000000" }), { currency: "NGN", minor: 3000000 });
  assert.equal(premiumPrice({ PAYSTACK_PRICE_CURRENCY: "NGN" }), null);
  assert.equal(premiumPrice({ PAYSTACK_PRICE_MINOR: "1900" }), null);
  assert.equal(premiumPrice({ PAYSTACK_PRICE_CURRENCY: "EUR", PAYSTACK_PRICE_MINOR: "1900" }), null);
  assert.equal(premiumPrice({ PAYSTACK_PRICE_CURRENCY: "USD", PAYSTACK_PRICE_MINOR: "12.5" }), null);
  assert.equal(premiumPrice({ PAYSTACK_PRICE_CURRENCY: "USD", PAYSTACK_PRICE_MINOR: "5" }), null, "amounts under 1.00 are refused");
});

test("return paths only ever point at our own dashboard", () => {
  assert.deepEqual(returnPaths(null), { callback: "/dashboard", cancel: "/dashboard?canceled=1" });
  assert.deepEqual(returnPaths(ROADMAP), { callback: `/dashboard/roadmaps/${ROADMAP}`, cancel: `/dashboard/roadmaps/${ROADMAP}?canceled=1` });
  for (const evil of ["https://evil.example", "../../x", `${ROADMAP}/../..`, "javascript:alert(1)", ""]) {
    assert.equal(returnPaths(evil).callback, "/dashboard", evil);
  }
});

const charge = (over: Record<string, unknown> = {}) => ({
  status: "success",
  reference: "ezp-1",
  amount: 1900,
  currency: "USD",
  metadata: { user_id: USER, product: PREMIUM_PRODUCT },
  customer: { email: "a@example.com" },
  ...over,
});

test("a successful premium charge names the user to upgrade", () => {
  assert.equal(premiumUserIdFromCharge(charge()), USER);
  assert.equal(premiumUserIdFromCharge(charge({ currency: "usd" })), USER);
  assert.equal(premiumUserIdFromCharge(charge({ metadata: JSON.stringify({ user_id: USER, product: PREMIUM_PRODUCT }) })), USER, "metadata sent back as a JSON string");
  assert.equal(premiumUserIdFromCharge(charge({ amount: 3000000, currency: "NGN" }), { currency: "NGN", minor: 3000000 }), USER);
});

test("anything that isn't a successful premium purchase is ignored", () => {
  for (const status of ["failed", "abandoned", "pending", "ongoing", undefined]) assert.equal(premiumUserIdFromCharge(charge({ status })), null, String(status));
  assert.equal(premiumUserIdFromCharge(charge({ metadata: { user_id: USER } })), null);
  assert.equal(premiumUserIdFromCharge(charge({ metadata: { user_id: USER, product: "something-else" } })), null);
  assert.equal(premiumUserIdFromCharge(charge({ metadata: null })), null);
  assert.equal(premiumUserIdFromCharge(charge({ metadata: "not json" })), null);
  assert.equal(premiumUserIdFromCharge(charge({ amount: 100 })), null, "wrong amount");
  assert.equal(premiumUserIdFromCharge(charge({ currency: "NGN" })), null, "wrong currency");
  assert.equal(premiumUserIdFromCharge(charge({ metadata: { user_id: "not-a-uuid", product: PREMIUM_PRODUCT } })), null);
  assert.equal(premiumUserIdFromCharge(charge({ metadata: { user_id: "'; update profiles set is_premium=true; --", product: PREMIUM_PRODUCT } })), null);
  assert.equal(premiumUserIdFromCharge(charge(), null), null, "invalid price config");
});

// --- the HTTP client, against a stubbed fetch ---
const reply = (status: number, body: unknown) => (async () => Response.json(body, { status })) as typeof fetch;
const quietly = async <T>(fn: () => Promise<T>) => {
  const q = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = q;
  }
};

test("initializeTransaction sends the server-defined amount and the secret key, and returns the payment link", async () => {
  let seen: { url: string; init: RequestInit } | undefined;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return Response.json({ status: true, data: { authorization_url: "https://checkout.paystack.com/abc", reference: "ezp-xyz", access_code: "ac" } });
  }) as typeof fetch;
  const out = await initializeTransaction(SECRET, { email: "a@example.com", amountMinor: 1900, currency: "USD", reference: "ezp-xyz", callbackUrl: "http://localhost:3000/dashboard", metadata: { user_id: USER } });
  assert.deepEqual(out, { authorizationUrl: "https://checkout.paystack.com/abc", reference: "ezp-xyz" });
  assert.equal(seen?.url, "https://api.paystack.co/transaction/initialize");
  assert.equal((seen?.init.headers as Record<string, string>).Authorization, `Bearer ${SECRET}`);
  assert.deepEqual(JSON.parse(seen?.init.body as string), { email: "a@example.com", amount: 1900, currency: "USD", reference: "ezp-xyz", callback_url: "http://localhost:3000/dashboard", metadata: { user_id: USER } });
});

test("PAYSTACK_API_BASE redirects the client (used for testing)", async () => {
  process.env.PAYSTACK_API_BASE = "http://127.0.0.1:9999/";
  let url = "";
  globalThis.fetch = (async (u: string) => {
    url = u;
    return Response.json({ status: true, data: { status: "success" } });
  }) as typeof fetch;
  await verifyTransaction(SECRET, "ezp-1");
  assert.equal(url, "http://127.0.0.1:9999/transaction/verify/ezp-1");
});

test("verifyTransaction encodes the reference", async () => {
  let url = "";
  globalThis.fetch = (async (u: string) => {
    url = u;
    return Response.json({ status: true, data: {} });
  }) as typeof fetch;
  await verifyTransaction(SECRET, "a/b?c=d");
  assert.equal(url, "https://api.paystack.co/transaction/verify/a%2Fb%3Fc%3Dd");
});

test("API failures become friendly messages without internals", async () => {
  const args = { email: "a@b.co", amountMinor: 1900, currency: "USD", reference: "ezp-1", callbackUrl: "http://x", metadata: {} };
  const msg = (status: number, message: string) =>
    quietly(async () => {
      globalThis.fetch = reply(status, { status: false, message });
      try {
        await initializeTransaction(SECRET, args);
        return "no error";
      } catch (e) {
        assert.ok(e instanceof PaystackError);
        return (e as Error).message;
      }
    });
  assert.match(await msg(400, "Currency not supported by merchant"), /PAYSTACK_PRICE_CURRENCY/);
  assert.match(await msg(401, "Invalid key"), /key was rejected/);
  assert.match(await msg(500, "boom stack trace at file.js:1"), /couldn't process/);
  assert.ok(!/boom|trace|file.js/.test(await msg(500, "boom stack trace at file.js:1")));
  globalThis.fetch = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;
  await assert.rejects(initializeTransaction(SECRET, args), /couldn't reach Paystack/);
  globalThis.fetch = reply(200, { status: true, data: {} });
  await assert.rejects(initializeTransaction(SECRET, args), /no checkout link/);
});

// --- grantPremium against a fake Supabase client ---
function fakeAdmin(opts: { updateRows?: { id: string }[]; updateError?: string; insertError?: string }) {
  const calls: { op: string; arg: unknown }[] = [];
  const client = {
    from: (table: string) => ({
      update: (v: unknown) => ({
        eq: (col: string, val: string) => ({
          select: async () => {
            calls.push({ op: "update", arg: { table, v, col, val } });
            return { data: opts.updateRows ?? [], error: opts.updateError ? { message: opts.updateError } : null };
          },
        }),
      }),
      insert: async (v: unknown) => {
        calls.push({ op: "insert", arg: { table, v } });
        return { error: opts.insertError ? { message: opts.insertError } : null };
      },
    }),
  };
  return { client: client as never, calls };
}

test("grantPremium updates the profile, or creates it when the row is missing", async () => {
  const a = fakeAdmin({ updateRows: [{ id: USER }] });
  await grantPremium(a.client, USER, "a@example.com");
  assert.deepEqual(a.calls.map((c) => c.op), ["update"]);
  assert.deepEqual(a.calls[0].arg, { table: "profiles", v: { is_premium: true }, col: "id", val: USER });
  const b = fakeAdmin({ updateRows: [] });
  await grantPremium(b.client, USER, "a@example.com");
  assert.deepEqual(b.calls.map((c) => c.op), ["update", "insert"]);
  assert.deepEqual(b.calls[1].arg, { table: "profiles", v: { id: USER, email: "a@example.com", is_premium: true } });
});

test("grantPremium throws on database errors so the webhook can answer 500 and Paystack retries", async () => {
  await assert.rejects(grantPremium(fakeAdmin({ updateError: "boom" }).client, USER), /boom/);
  await assert.rejects(grantPremium(fakeAdmin({ updateRows: [], insertError: "fk violation" }).client, USER), /fk violation/);
});

// --- Secrets stay on the server ---
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (["node_modules", ".next", ".git", "tests", "scripts"].includes(name)) return [];
    const p = join(dir, name);
    return statSync(p).isDirectory() ? sourceFiles(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}
const files = () => sourceFiles(ROOT).map((f) => ({ path: relative(ROOT, f).replace(/\\/g, "/"), src: readFileSync(f, "utf8") }));

test("no Client Component imports the Paystack, premium-price or service-role modules", () => {
  const offenders = files()
    .filter(({ src }) => /^\s*["']use client["']/m.test(src) && /supabase\/admin|lib\/paystack(\.ts)?["']|lib\/premium(\.ts)?["']/.test(src))
    .map(({ path }) => path);
  assert.deepEqual(offenders, []);
});

test("secret keys are read in one place each, and nothing Stripe-related is left", () => {
  const using = (needle: string) => files().filter(({ src }) => src.includes(needle)).map(({ path }) => path).sort();
  assert.deepEqual(using("process.env.SUPABASE_SERVICE_ROLE_KEY"), ["lib/supabase/admin.ts"]);
  assert.deepEqual(using("NEXT_PUBLIC_SUPABASE_SERVICE"), []);
  assert.deepEqual(using("NEXT_PUBLIC_PAYSTACK_SECRET"), []);
  // Only the guard that refuses live keys may mention them.
  assert.deepEqual(using("sk_live_"), ["lib/paystack.ts"]);
  assert.deepEqual(using("stripe"), [], "no source file should mention stripe any more");
  assert.deepEqual(using("Stripe"), []);
});
