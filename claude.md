# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Always read this file before writing new code.** Every new feature, file or dependency must follow the preferences below. If a request conflicts with them, point out the conflict and ask before proceeding.

## Project Overview: EZ-Permit (Claude Code)
EZ-Permit is a lightweight web application that helps US entrepreneurs instantly generate a step-by-step permit and licensing roadmap for launching local businesses. 

### Tech Stack Targets
- **Frontend & Backend:** Next.js (App Router, Shadcn UI / Tailwind CSS, Lucide React).
  > **Current implementation:** Next.js 16 App Router + Tailwind CSS v4 only. Shadcn UI and Lucide React are **not** used (hand-written components and `app/globals.css`).
- **Database & Auth:** Supabase (PostgreSQL) + Supabase Auth (**Standard Email/Password**).
- **AI Processing:** OpenAI GPT-4o-mini (via Vercel AI SDK or official openai package).
  > **Current implementation:** the Vercel AI SDK (`ai`) with **OpenRouter** (`@openrouter/ai-sdk-provider`), using **only free models** (default `openrouter/free`), so no OpenRouter call ever costs money. Replaced Gemini on 2026-10-31.
- **Payments:** Stripe Checkout.
  > **Current implementation:** **Paystack** (test mode), chosen by the project owner on 2026-10-30 instead of Stripe.

---

## 1. System Prompt & Global Rules for Claude Code
```text
You are an expert full-stack engineer running in Claude Code. 
We are building "EZ-Permit" in a strict 6-day sprint.
- Always use standard email and password authentication fields for login/signup.
- Prioritize modular components in the Next.js App Router structure.
- Write clean, type-safe code using TypeScript where applicable.
```

---

## Project preferences

### Framework: Next.js App Router
- Use the App Router (`app/`) only. Do not add a `pages/` directory.
- Server Components by default; add `"use client"` only when a component needs state, effects or browser APIs.
- API endpoints are Route Handlers (`app/api/**/route.ts`). Use Server Actions for form mutations where they fit.
- TypeScript everywhere.
- Next.js is v16. Check `node_modules/next/dist/docs/` before relying on older conventions (for example `middleware.ts` is now `proxy.ts`).

### Auth and database: Supabase (email/password)
- Use Supabase for authentication and data storage.
- Authentication is standard **email/password** only (sign up, sign in, sign out, password reset). Do not add OAuth/social providers or magic links unless explicitly asked.
- Use `@supabase/ssr` with separate browser and server clients; handle session refresh in `proxy.ts`.
- Protect data with Row Level Security policies, not only with checks in application code.
- Env vars: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (client-safe; the older name `NEXT_PUBLIC_SUPABASE_ANON_KEY` also works). `SUPABASE_SERVICE_ROLE_KEY` is server-only, is read only in `lib/supabase/admin.ts`, and must never be imported into client components.

### AI: OpenRouter, free models only
- Changed from Gemini to **OpenRouter** on 2026-10-31, and restricted to **strictly free models** the same day, at the project owner's request. Do not reintroduce Gemini, add another AI provider, or use any paid OpenRouter model, plugin or feature unless asked.
- **Free is enforced in code, not by convention** (`lib/openrouter.ts`, the only place a model is created):
  1. only `openrouter/free` (OpenRouter's router over its free models, the default) or an id ending in `:free` is accepted (`isFreeModel`); anything else makes `openRouterModel` return null, so the caller falls back to the built-in data;
  2. `OPENROUTER_MODEL` may name another free model; a paid one is ignored with a logged warning;
  3. every request sends `provider.max_price = { prompt: 0, completion: 0 }` so OpenRouter can't route to a paid endpoint;
  4. no OpenRouter plugins and no web search: the `:online` web-search add-on is billed per request even on a free model.
- Because there is no web search, the AI only drafts roadmaps from what the model already knows (the prompt tells it to say "Check with the agency" when unsure). The home page's research mode uses the same free OpenRouter model (`lib/research.ts`); there is no Anthropic/Claude path and no `ANTHROPIC_API_KEY`. Links and sources the model returns are always dropped (it can't verify URLs) and a caveat says to confirm with the agency.
- AI is always optional: when the key is missing or a call fails, the app falls back to the free built-in city data. Never make a feature depend on the AI being available.
- Free models are sometimes slow (10-40 s) or return JSON that doesn't parse, so `lib/roadmap-generate.ts` tries twice (50 s each) before falling back. Models return JSON through a Zod schema (`Output.array`); always validate the result.
- Free-model limits: about 20 requests/minute, and about 50/day on an account with no purchased credits (1,000/day after buying $10 of credits, which are not spent on free models). Hitting a limit just means the built-in data is used.
- Free models may log prompts. Our prompts contain only a city and a business type, never personal data; keep it that way.

### Payments: Paystack (test mode)
- Changed from Stripe to **Paystack** on 2026-10-30 at the project owner's request. Do not reintroduce Stripe unless asked.
- Paystack runs in **test mode only**: use `sk_test_` / `pk_test_` keys and Paystack's test cards (success: 4084 0840 8408 4081, any future expiry, CVV 408, PIN 0000, OTP 123456). Never add or reference live keys; `lib/paystack.ts` refuses `sk_live_`.
- Start transactions on the server (Route Handler); never trust prices, amounts, emails or redirect URLs sent from the client.
- Payment status is decided on the server: the webhook (`app/api/paystack/webhook/route.ts`) and the verify route (`app/api/paystack/verify/route.ts`, which asks Paystack directly) are the sources of truth. Paystack signs webhooks with HMAC-SHA512 of the raw body using the **secret key** (`x-paystack-signature`), so there is no separate webhook secret.
- Env vars: `PAYSTACK_SECRET_KEY`, `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`.

### Working rules
- **Tests never touch real services.** When running the app for tests, blank or override every real key (`PAYSTACK_SECRET_KEY=`, `OPENROUTER_API_KEY=`, and point the Supabase vars at a fake; OpenRouter tests may use the real key only for free models and should check the account's spend with `GET https://openrouter.ai/api/v1/key` before and after), because Next loads `.env.local` automatically. Use `OPENROUTER_API_BASE`, `PAYSTACK_API_BASE` and a fake Supabase to test end to end.
- Keep real keys out of `.env.example` (blank placeholders only) and out of source files. `.env.local` is git-ignored.
- Run `npm run typecheck`, `npm test` and `npm run build` after changes. For database changes, test the SQL (including RLS) on a real Postgres such as PGlite before asking the owner to run it.
- Keep `claude.md` current: when a decision changes, update "Decisions log", "Current state" and the sprint statuses in the same change.

---

## Decisions log

Decisions made while building, with the reason. Newest last.

| Date | Decision | Why |
|---|---|---|
| 2026-10-28 | App Router, TypeScript, Supabase email/password, Row Level Security | Owner's preferences (see above). |
| 2026-10-28 | Use `proxy.ts`, not `middleware.ts` | Next.js 16 renamed it; same behaviour. |
| 2026-10-28 | One `AuthForm` serves `/login` and `/signup`; the URL is the mode | Toggle keeps the typed email and is shareable. |
| 2026-10-29 | Keep the JSON column name `steps` (not the blueprint's `checklist_json`) | The code already used it; renaming gained nothing. |
| 2026-10-29 | Add a `profiles` table with `is_premium`, created by a trigger; users have no update policy | Needed for the paywall; stops users upgrading themselves. |
| 2026-10-29 | Roadmap model is the cheapest tier, with no web search | Owner asked for free tier or minimal pay. |
| 2026-10-29 | Daily roadmap limit: 3 per rolling 24 h (20 for premium) | Caps AI spend per user. |
| 2026-10-29 | Home page defaults to the free built-in database; live research is opt-in | Live research costs money per search. |
| 2026-10-29 | Free fallback: if AI is missing or fails, build the roadmap from the built-in city data and save `source = 'built-in'` | Keeps the app working at no cost; the roadmap page shows a notice. Difficulty is a rough estimate from fee size and paperwork. |
| 2026-10-29 | Steps 4+ live in `roadmap_premium_steps`, readable only by premium owners (RLS) | A CSS blur is only cosmetic; this makes the paywall real even against direct Supabase queries. Verified on a real Postgres. |
| 2026-10-30 | **Stripe → Paystack** | Owner's choice. |
| 2026-10-30 | Webhook at `app/api/paystack/webhook/route.ts`; add `app/api/paystack/verify/route.ts` | Paystack can't reach localhost, so the buyer's return also verifies with Paystack server to server. |
| 2026-10-30 | Price is $19 USD, defined on the server; `PAYSTACK_PRICE_CURRENCY` + `PAYSTACK_PRICE_MINOR` override it together | Some Paystack accounts can't take USD. A half-set override disables checkout instead of guessing. |
| 2026-10-30 | Only paid, correct-product, correct-amount payments upgrade a user; the verify route upgrades only the signed-in user for their own payment | Stops forged, replayed, cheap or borrowed payments. |
| 2026-10-31 | **Gemini → OpenRouter** (removed `@ai-sdk/google` and `lib/gemini.ts`) | Owner's choice: one key, many models. |
| 2026-10-31 | **OpenRouter free models only** (`openrouter/free` by default), enforced in `lib/openrouter.ts` with a `:free` allow-list and a $0 `max_price` on every request | Owner: users must never pay for an OpenRouter call. Tested against the real account: 0 spend. |
| 2026-10-31 | Dropped OpenRouter live research (the `:online` web search is billed) and `sanitizeChecklistLinks`; live research is Claude-only | Web search can't be free. Without it, AI "research" would invent links. |
| 2026-10-31 | **Home-page research mode runs on OpenRouter free models; Anthropic removed** (`@anthropic-ai/sdk` uninstalled). No web search, so links/sources are stripped and a caveat added | Owner: research mode must use OpenRouter, not an Anthropic key. |
| 2026-10-31 | Retry a failed AI roadmap once (50 s per attempt), then use the built-in data | Free models are less reliable at JSON; a retry costs nothing. |

---

## Current state of the codebase

Built and tested: auth, dashboard wizard, AI roadmap generation with a free fallback, roadmap timeline with a database-enforced premium lock, and Paystack payments. Not yet run against live services: see "Open items".

- **Product:** E-Z Permit. A founder enters a US city and a business and gets an ordered list of permits, estimated costs and departments.
- **Pages:** `/` (checklist form), `/about`, `/how-it-works`, `/login` and `/signup` (one `AuthForm`, toggled by URL), `/dashboard` (signed-in only; the `PermitWizard` and the user's recent roadmaps). `components/Navbar.tsx` is in the root layout.
- **Auth** (email/password only):
  - `lib/supabase/`: `client.ts` (browser), `server.ts` (server), `proxy.ts` (session refresh), `admin.ts` (service role, server only), `env.ts`. The clients return `null` when the Supabase env vars are missing, so the app still runs signed out.
  - `proxy.ts` refreshes the session, sends signed-out visitors from `/dashboard` to `/login?next=…`, sends signed-in users away from `/login` and `/signup`, and skips static files, `/api/checklist` and `/api/paystack/webhook`.
  - `app/auth/confirm/route.ts` handles the email-confirmation link; `app/auth/actions.ts` is the sign-out Server Action.
  - `lib/auth.ts` holds the validation rules and friendly error messages (unit tested).
- **Dashboard wizard:** `components/PermitWizard.tsx` (City, State dropdown, Business Type; rules in `lib/wizard.ts`) calls `/api/generate-roadmap` (`lib/roadmap-client.ts`), shows `components/AnalysisOverlay.tsx` (full-screen loading skeleton) while it runs, then opens the saved roadmap. API errors (including the daily limit) show on the form.
- **`app/api/generate-roadmap/route.ts`:** signed-in users only (401 otherwise, checked before any AI call). Takes `{ city, state, business_type }`, enforces the daily limit (`lib/roadmap.ts`), then asks a **free** OpenRouter model (`lib/roadmap-model.ts` → `lib/openrouter.ts`) through the Vercel AI SDK, acting as a "US Municipal Licensing Expert", for an array of `{ step_number, title, department, estimated_cost, difficulty: Low|Medium|High, description }` (`lib/roadmap-generate.ts`: two attempts). If there is no `OPENROUTER_API_KEY`, the model isn't free, or both attempts fail, it falls back to the built-in city data (`lib/seed-roadmap.ts`) and saves `source = 'built-in'`. It saves the first 3 steps in `roadmaps` and steps 4+ in `roadmap_premium_steps`, as the user (RLS applies); if the second save fails it deletes the first. Returns `{ id, source, roadmap }` with steps 4+ redacted for free users.
- **`app/api/checklist/route.ts`** (home page): streams NDJSON events (`status`, `result`, `error`). `mode: "auto"` uses live research when a provider is configured and **falls back to the built-in database if live research fails**; `mode: "live"` shows the error instead; `mode: "seed"` never calls an AI.
  - **Research mode** (`lib/live-research.ts` → `lib/research.ts`): available when `OPENROUTER_API_KEY` is set; a free OpenRouter model drafts the checklist from its own knowledge (no web search) as a Zod `Checklist` object, two attempts. Links/sources are removed and a "confirm with the agency" caveat is added. `lib/research-prompt.ts` holds the instructions.
  - **Built-in database** (`lib/seed/`): `categories.ts` classifies the description; `cities.ts` holds per-city steps; `index.ts` assembles them, or builds a generic checklist for unseeded cities (Austin, Houston, NYC, LA, Chicago, Seattle and Denver are detailed).
- **Roadmap page:** `app/dashboard/roadmaps/[id]/page.tsx` (server component) loads the roadmap through RLS and reads `profiles.is_premium`. Free accounts get steps 1–3 and **placeholders** for the rest (`lib/roadmap-view.ts` `buildDisplaySteps`, using `roadmaps.step_count`); the real steps 4+ are only fetched for premium users. `components/RoadmapTimeline.tsx` shows the placeholders with `blur-sm`, `pointer-events-none`, `inert` and `aria-hidden` behind the upgrade card ("Unlock your complete local permit guide for a one-time payment of $19"). Built-in roadmaps show a notice that they come from the built-in city guide.
- **Payments (Paystack, test mode only):**
  - `app/api/checkout/route.ts` (signed-in users only) starts a one-time Paystack transaction on the server and returns the payment link. The price (USD $19 = 1900 cents by default), product and metadata come from `lib/premium.ts`; nothing priced or targeted by the client is used. A user who is already premium gets 409.
  - `components/UnlockButton.tsx` calls it and sends the buyer to Paystack. Paystack returns them to the roadmap with `?trxref=…&reference=…`; `components/UpgradeStatus.tsx` then asks `/api/paystack/verify` (every 2 s, up to 10 times) until Paystack confirms the payment, then the page shows a success banner. A made-up or someone else's reference never upgrades anyone.
  - Two server-side paths make a user premium, both through `lib/supabase/admin.ts` (the **service role key**, which bypasses RLS): `app/api/paystack/webhook/route.ts` (checks `x-paystack-signature`; accepts only a successful `charge.success` for our product, amount and currency) and `app/api/paystack/verify/route.ts` (upgrades only the signed-in user, only for their own payment). Database or config failures answer 5xx so Paystack retries.
  - `lib/paystack.ts` is a small fetch client (no SDK) that refuses any key that isn't `sk_test_`. `lib/premium.ts` holds the price, product and the checks on a charge.
- **How the paywall is enforced:** in the database, not just the UI. `roadmaps.steps` holds only the free preview; steps 4+ are in `roadmap_premium_steps`, whose RLS policy lets only an owner with `profiles.is_premium = true` read them, so even a direct Supabase query by a free user returns nothing. Users have no policy to update `profiles`, so they can't flip `is_premium`; only the Paystack webhook and verify route do (service role key).
- **Database:** `supabase/migrations/` creates `roadmaps`, `profiles` and `roadmap_premium_steps`; see section 2. **Migrations are not applied automatically**: run each file, in order, in the Supabase SQL editor.
- **Schemas and validation:** `lib/checklist.ts` (Zod `Checklist` shared by live research, the built-in data and the home page), `lib/roadmap.ts` (`RoadmapStep`, request parsing, system prompt, daily limits).
- **Styling:** Tailwind v4 (`postcss.config.mjs`). Preflight is deliberately not imported, so the hand-written classes in `app/globals.css` keep their look; element defaults live in `@layer base` and `.wrap` in `@layer components` so utilities can override them. Theme tokens map the existing CSS variables (`bg-paper`, `text-ink`, `border-rule`, `text-stamp`, …).
- **Imports:** `lib/` modules use relative imports with explicit `.ts` extensions so Node's type stripping can run them directly (tests and scripts). Keep that convention.
- **Cost choices (free tier / minimal pay):** everything runs at no cost. Supabase and Paystack test mode are on free tiers (Paystack charges only a per-transaction fee on real payments). OpenRouter is **free-models-only** and verified at $0 (your OpenRouter account usage does not move); every AI path falls back to free built-in data, each user has a daily cap, and the home page defaults to the built-in database. Supabase's built-in email sender is heavily rate-limited on the free plan, so turn off "Confirm email" (Authentication → Sign In / Providers → Email) while developing, or add custom SMTP before launch.
- **Day 6 polish (done 2026-10-31):** `components/Snackbar.tsx` (`SnackbarProvider` in the root layout, `useSnackbar().notify(message, kind)`) replaces the inline error/notice boxes in the wizard, auth form, unlock button and home page (top of the screen on phones so it never covers the submit button, bottom right on larger screens). Field-level validation messages and page-state notices stay inline. The dashboard wizard keeps its draft (answers + step) in `localStorage` per user (`lib/wizard-storage.ts`), restores it after a refresh and clears it once the roadmap is saved. Layouts were checked at 320, 375 and 768 px (no horizontal scroll; tap targets >= 44 px).
- **Not built yet:** password reset (required by the auth preference above), deleting roadmaps from the UI, refunds and a billing page.

### Open items
- **The owner's Paystack account can't take USD.** Paystack answered "Currency not supported by merchant" to a real test request. Checkout shows a clear message until `PAYSTACK_PRICE_CURRENCY` and `PAYSTACK_PRICE_MINOR` are set together to a supported currency (for example `NGN` and `3000000` for ₦30,000). The upgrade card text still says "$19" (the exact wording was specified), so decide whether to change it for a non-USD price.
- Run all three Supabase migrations in the SQL editor if not done yet (the app saves to the new columns and table).
- Add `PAYSTACK_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (done in `.env.local` on the owner's machine as of 2026-10-31) and restart the dev server after any `.env.local` change.
- `GEMINI_API_KEY` may still sit in `.env.local`; nothing reads it any more. Delete it and revoke the key if it's no longer wanted.
- **OpenRouter free limits:** the account is on the free tier, so free models allow about 50 requests/day in total across all users; beyond that roadmaps use the built-in data. Buying $10 of OpenRouter credits (never spent on free models) raises it to about 1,000/day.
- **Earlier paid test calls:** before the free-only rule, two of my test calls used `openai/gpt-4o-mini` and web search and cost the account about $0.0086. Nothing paid is possible now.
- Paystack's webhook URL must be public to receive real webhooks; locally the verify route covers the buyer's return.
- The repo has no commits yet.
- End-to-end tests (fake Paystack, Supabase and OpenRouter servers, headless Chrome, PGlite for the SQL) were run from a scratch folder and are **not** in the repo. Only the unit tests in `tests/` are.

### Env vars (`.env.local`, template in `.env.example`)

- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL` (must be the project URL, like `https://<project-id>.supabase.co`), `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`), and `SUPABASE_SERVICE_ROLE_KEY` (**server only**, no `NEXT_PUBLIC_` prefix).
- **AI:** `OPENROUTER_API_KEY`; optional `OPENROUTER_MODEL` (must be `openrouter/free` or end in `:free`, otherwise it is ignored; default `openrouter/free`), `OPENROUTER_API_BASE` (testing only).- **Payments:** `PAYSTACK_SECRET_KEY` (must be `sk_test_…`; it also signs webhooks), `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` (not used by the hosted-checkout redirect, kept for later), optional `PAYSTACK_PRICE_CURRENCY` + `PAYSTACK_PRICE_MINOR` (set both or neither), optional `NEXT_PUBLIC_SITE_URL`, optional `PAYSTACK_API_BASE` (testing only). Test Webhook URL (Paystack dashboard → Settings → API Keys & Webhooks) must be public, e.g. a tunnel to `/api/paystack/webhook`.
- Keep real keys out of `.env.example`.

## Commands

```bash
npm run dev          # start dev server
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm test             # node:test suite in tests/ (auth, wizard, roadmap, roadmap generation/retry, roadmap view, seed roadmap, openrouter free-only guards, paystack, seed)
npm run check-links  # verify URLs in the seeded city data
```

---

## 2. Database Schema (Supabase)
*Decided 2026-10-29. The SQL files in `supabase/migrations/` are the source of truth: run them in order in the Supabase SQL editor (Supabase free tier is enough).*

- **`profiles`** (`20261029010000_create_profiles.sql`): `id` (= `auth.users.id`), `email`, `is_premium boolean default false`, `created_at`. A trigger creates the row on sign-up, and existing users are back-filled. RLS: users can **read** only their own row and have **no insert or update policy**, so nobody can make themselves premium; only the Paystack webhook / verify route change `is_premium`, using `SUPABASE_SERVICE_ROLE_KEY` on the server.
- **`roadmaps`** (`20261029000000_create_roadmaps.sql`): `id`, `user_id` (→ `auth.users`, default `auth.uid()`), `city`, `state`, `business_type`, **`steps jsonb`** (only the free preview, steps 1–3), `step_count`, `source`, `created_at`. RLS: users read, insert and delete only their own rows.
- **`roadmap_premium_steps`** (`20261029020000_lock_premium_steps.sql`): `roadmap_id` (PK, → `roadmaps`, cascade), `user_id`, `steps jsonb` (steps 4+). RLS: an owner can **insert** but can **read only if `profiles.is_premium`**; no update or delete policy (rows go away with their roadmap). The same migration adds `roadmaps.step_count` and `roadmaps.source` (`'ai'` or `'built-in'`) and moves any existing roadmaps' steps 4+ into this table.
- The original blueprint's `checklist_json` column was replaced by `steps`, which the code already uses. `roadmaps.user_id` points at `auth.users` rather than `profiles`; both cascade on user deletion, so the effect is the same.

---

## 3. 6-Day Agile Sprint Plan for Claude Code

### Day 1: Project Setup & Email/Password Authentication
*   **Prompt to Claude Code:** 
    ```text
    Initialize a new Next.js project using Tailwind CSS in the current directory if not already created. Install `@supabase/supabase-js`. Build a standard Email and Password login and signup interface. Create custom state handlers to handle login errors, password criteria checks, and toggle seamlessly between 'Sign In' and 'Create Account'. Once authenticated, route the user to `/dashboard` it should have a navbar of Home, about, how it works, signup and login.
    ```

> **Status (added):** ✅ Done. Sign in / create account toggle, password checks, error handling, `/dashboard` redirect, navbar. Tested end to end against a mock Supabase Auth server, and the owner has created an account on the real project.

### Day 2: The Search & Generation Wizard UI
*   **Prompt to Claude Code:** 
    ```text
    Create the dashboard view at `/dashboard/page.tsx`. Build an elegant form wizard component that collects: 'City' (text input), 'State' (dropdown select), and 'Business Type' (text input, e.g., Food Truck, Home Bakery). Style the submission button with clean Tailwind CSS transitions and implement a full-screen loading skeleton that mimics an analytical process when submitted.
    ```

> **Status (added):** ✅ Done. `/dashboard` has a 3-step wizard (`components/PermitWizard.tsx`) and a full-screen analysis overlay. Since Day 4 it submits to `/api/generate-roadmap` and opens the saved roadmap.

### Day 3: Backend AI Integration Route
*   **Prompt to Claude Code:** 
    ```text
    Install the Vercel AI SDK or official `openai` library. Create a Next.js API route at `app/api/generate-roadmap/route.ts`. The AI endpoint must take the city, state, and business type, act as a US Municipal Licensing Expert, and output a structured JSON array containing objects with:
    - `step_number` (int)
    - `title` (string)
    - `department` (string)
    - `estimated_cost` (string)
    - `difficulty` (string: Low/Medium/High)
    - `description` (text)
    Save this output array directly to the Supabase `roadmaps` table under the active user's ID before returning it to the client.
    ```

> **Status (added):** ✅ Built and tested, and confirmed with the owner's real OpenRouter key on **free models only** (`openrouter/free`, served by nvidia, xingchen, dots and others in testing: valid 7-10 step roadmaps in 13-39 s, reported cost $0, account spend $0). Uses the Vercel AI SDK with OpenRouter (it was Gemini until 2026-10-31), retries once, and falls back to the free built-in city data when the AI is missing or failing. The steps are split across two tables (first 3 in `roadmaps`, the rest in `roadmap_premium_steps`). Needs the three migrations run in Supabase.

### Day 4: Roadmap Dashboard & Premium Lock Layout
*   **Prompt to Claude Code:** 
    ```text
    Build the UI to display the generated permit timeline from the JSON data. Steps 1 through 3 should display all instructions and fields clearly. For steps 4 and beyond, check if the user's profile row has `is_premium: false`. If false, blur out the text using Tailwind's `blur-sm`, make the elements non-interactive, and overlay a modern premium upgrade card stating: 'Unlock your complete local permit guide for a one-time payment of $19'.
    ```

> **Status (added):** ✅ Done and tested. `/dashboard/roadmaps/[id]` shows the timeline, steps 4+ are blurred behind the $19 card for non-premium users, and the wizard saves through `/api/generate-roadmap`. The lock is enforced by the database (see "How the paywall is enforced"). The unlock button starts Paystack checkout (Day 5).

### Day 5: Stripe Paywall Integration
*   **Prompt to Claude Code:** 
    ```text
    Install `stripe`. Create a Stripe checkout session API route at `app/api/checkout/route.ts`. Connect the 'Unlock Now' button from the dashboard to trigger this checkout session. Create a webhook endpoint at `app/api/stripe/webhook/route.ts` that listens for `checkout.session.completed` events and programmatically toggles `is_premium = true` for the corresponding user in the Supabase `profiles` table.
    ```

> **Status (added):** ✅ Done with **Paystack instead of Stripe** (owner's decision, 2026-10-30; the prompt above is the original and mentions `stripe`). Checkout is `app/api/checkout/route.ts`, the webhook is `app/api/paystack/webhook/route.ts`, plus `app/api/paystack/verify/route.ts`. Tested against a fake Paystack server and fake Supabase (signatures, forged/tampered/replayed webhooks, wrong user/amount/product, cancel, decline, outage, misconfiguration). A real test request showed the owner's Paystack account can't take USD (see "Open items"), so a real payment still needs the currency decision; until then checkout shows a clear message and nobody is upgraded.

### Day 6: Data Polish & Mobile Responsiveness Review
*   **Prompt to Claude Code:** 
    ```text
    Scan the entire repository. Optimize the layout to be fully responsive on mobile viewports so users can check their business checklist on the go. Refactor any raw text alerts into elegant user notification snackbars, clean up unused imports, and ensure the state is preserved if a user refreshes their dashboard page.
    ```

> **Status (added):** ✅ Done 2026-10-31: responsive pass, snackbars, unused-import check (`tsc --noUnusedLocals` is clean) and dashboard draft persistence. Tested in headless Chrome against a fake Supabase (scratch folder, not in the repo).
