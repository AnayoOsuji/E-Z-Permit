# CLAUDE.md

> **Read this file before writing code.** New features, files and dependencies must follow the rules below. If a request conflicts with them, point it out and ask first.

## Project
E-Z Permit: a US founder enters a city and business type and gets an ordered permit/licensing roadmap (permits, costs, departments). Built in a 6-day sprint (all days done).

**Stack:** Next.js 16 App Router + Tailwind CSS v4 (hand-written components and `app/globals.css`; no Shadcn, no Lucide), TypeScript, Supabase (Postgres + email/password auth), Vercel AI SDK with OpenRouter free models, Paystack test-mode payments.

**Live:** https://ez-permit.vercel.app (Vercel project `ez-permit`, linked via `.vercel/`, git-ignored).

## Rules

### Next.js
- App Router only (no `pages/`). Server Components by default; `"use client"` only for state, effects or browser APIs.
- Endpoints are Route Handlers (`app/api/**/route.ts`); Server Actions for form mutations where they fit.
- Next 16: `proxy.ts` replaces `middleware.ts`. Check `node_modules/next/dist/docs/` before using older conventions.
- `lib/` modules use relative imports with explicit `.ts` extensions (so Node type stripping can run tests/scripts).
- Preflight is not imported; element defaults live in `@layer base`, `.wrap` in `@layer components`.

### Auth and database (Supabase)
- Email/password only (sign up, in, out, reset). No OAuth or magic links unless asked.
- `@supabase/ssr` with separate browser/server clients (`lib/supabase/`); session refresh in `proxy.ts`. Clients return `null` if env vars are missing.
- Protect data with RLS, not just app code. `SUPABASE_SERVICE_ROLE_KEY` is server-only and read only in `lib/supabase/admin.ts`.
- Migrations in `supabase/migrations/` are the schema source of truth and are **not applied automatically**: run in order in the Supabase SQL editor. Test SQL (including RLS) on PGlite before asking the owner to run it.

### AI: OpenRouter, free models only
- Do not reintroduce Gemini, add another provider, or use any paid model/plugin/feature.
- Free is enforced in `lib/openrouter.ts` (the only place a model is created): only `openrouter/free` or ids ending `:free` (`isFreeModel`), else null; every request sends `provider.max_price = {prompt: 0, completion: 0}`; no plugins, no `:online` web search (billed).
- AI is always optional: no key or a failed call falls back to built-in city data (`lib/seed/`, `lib/seed-roadmap.ts`). Never make a feature depend on it.
- Free models are slow/flaky: `lib/roadmap-generate.ts` and `lib/research.ts` try twice, validate with Zod. Links/sources from the model are dropped; a "confirm with the agency" caveat is added.
- Prompts contain only city and business type, never personal data.

### Payments: Paystack (test mode only)
- Do not reintroduce Stripe. Only `sk_test_` keys; `lib/paystack.ts` refuses others. Never add live keys.
- Start transactions on the server; never trust client price, amount, email or redirect URL (`lib/premium.ts` defines them: $19 USD, override with `PAYSTACK_PRICE_CURRENCY` + `PAYSTACK_PRICE_MINOR` together).
- Status is decided server-side: `app/api/paystack/webhook/route.ts` (HMAC-SHA512 of raw body with the secret key, `x-paystack-signature`) and `app/api/paystack/verify/route.ts` (upgrades only the signed-in user for their own payment). Both use the service role key.

### Paywall (currently OFF)
`PAYWALL_ENABLED` in `lib/roadmap-view.ts` is `false` (2026-11-05): all steps show, no payment prompt; the roadmap page reads steps 4+ with the service role. Set it to `true` to restore the lock. Design when on, enforced in the database: `roadmaps.steps` holds steps 1-3; steps 4+ live in `roadmap_premium_steps`, readable only by owners with `profiles.is_premium` (RLS). Users have no update policy on `profiles`.

### Working rules
- **Tests never touch real services.** Blank/override every real key (`PAYSTACK_SECRET_KEY=`, `OPENROUTER_API_KEY=`, fake Supabase URL) because Next loads `.env.local`. Use `OPENROUTER_API_BASE` and `PAYSTACK_API_BASE` with fakes. Real OpenRouter tests: free models only, check `GET https://openrouter.ai/api/v1/key` before/after.
- Real keys never go in `.env.example` (blank placeholders) or source. `.env.local` is git-ignored.
- After changes run `npm run typecheck`, `npm test`, `npm run build`.
- Keep this file current: update "Decisions" and "Open items" when something changes.

## Code map
- Pages: `/`, `/about`, `/how-it-works`, `/login` + `/signup` (one `AuthForm`), `/dashboard` (wizard + recent roadmaps), `/dashboard/roadmaps/[id]`.
- `app/api/`: `generate-roadmap` (signed-in only; daily limit 3/24 h, 20 premium; saves as the user), `checklist` (home page, NDJSON; modes `auto`/`live`/`seed`), `checkout`, `paystack/webhook`, `paystack/verify`. `proxy.ts` skips `/api/checklist` and the webhook.
- UI: `PermitWizard` (draft kept in `localStorage`, `lib/wizard-storage.ts`), `AnalysisOverlay`, `RoadmapTimeline`, `UnlockButton`, `UpgradeStatus`, `Snackbar` (`useSnackbar().notify`).
- Schemas: `lib/checklist.ts`, `lib/roadmap.ts`. Roadmap display and placeholders: `lib/roadmap-view.ts`.

## Decisions
| Date | Decision |
|---|---|
| 2026-10-28 | App Router, TS, Supabase email/password + RLS; `proxy.ts`; one `AuthForm` for login/signup |
| 2026-10-29 | JSON column stays `steps`; `profiles.is_premium` via trigger; steps 4+ in `roadmap_premium_steps`; daily limits; built-in fallback saved as `source='built-in'` |
| 2026-10-30 | Stripe → Paystack (owner's choice); $19 USD defined server-side; only paid, correct-product/amount payments upgrade |
| 2026-10-31 | Gemini → OpenRouter, free models only, enforced in code; no web search; research mode also on OpenRouter (Anthropic removed); retry once then fall back |
| 2026-11-03 | Deployed to Vercel production; env vars set there |
| 2026-11-05 | Paywall switched off via `PAYWALL_ENABLED=false`; payment code and schema left untouched |

## Open items
- **Paystack account can't take USD** ("Currency not supported by merchant"). Set `PAYSTACK_PRICE_CURRENCY` + `PAYSTACK_PRICE_MINOR` (e.g. `NGN`, `3000000`) in `.env.local` and Vercel; the upgrade card still says "$19".
- Run all three migrations in Supabase if not done.
- Supabase Auth: add `https://ez-permit.vercel.app` to Site URL / redirect URLs. Paystack test webhook URL: `https://ez-permit.vercel.app/api/paystack/webhook`. Consider setting `NEXT_PUBLIC_SITE_URL`.
- Stale `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` in `.env.local` are unused; delete and revoke.
- Free OpenRouter limit: ~20 req/min, ~50/day without purchased credits; beyond that the built-in data is used.
- Not built: password reset (required by the auth rule), deleting roadmaps, refunds/billing page.
- End-to-end tests (fake servers, headless Chrome, PGlite) were run from a scratch folder, not in the repo; only `tests/` unit tests are.

## Env vars (`.env.local`; template `.env.example`)
- Supabase: `NEXT_PUBLIC_SUPABASE_URL` (project URL), `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `..._ANON_KEY`), `SUPABASE_SERVICE_ROLE_KEY` (server only).
- AI: `OPENROUTER_API_KEY`; optional `OPENROUTER_MODEL` (free only), `OPENROUTER_API_BASE` (tests).
- Payments: `PAYSTACK_SECRET_KEY` (`sk_test_`, also signs webhooks), `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`; optional `PAYSTACK_PRICE_CURRENCY` + `PAYSTACK_PRICE_MINOR`, `NEXT_PUBLIC_SITE_URL`, `PAYSTACK_API_BASE` (tests).
- Restart the dev server after changing `.env.local`. Supabase's built-in email is rate-limited: disable "Confirm email" in dev or add SMTP.

## Commands
`npm run dev` · `npm run build` · `npm run typecheck` · `npm test` · `npm run check-links` (seed city URLs)
