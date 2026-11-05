"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authErrorMessage, isValidEmail } from "../lib/auth.ts";
import { createClient } from "../lib/supabase/client.ts";
import { useSnackbar } from "./Snackbar.tsx";

const inputClass =
  "w-full rounded-[10px] border border-rule bg-paper px-3.5 py-3 outline-none focus:border-navy focus:ring-3 focus:ring-navy/20";

export function ForgotPasswordForm({ initialError }: { initialError?: string }) {
  const notify = useSnackbar();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (initialError) notify(initialError, "error");
  }, [initialError, notify]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (!isValidEmail(address)) {
      notify("That email address doesn't look right.", "error");
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      notify("Sign-in isn't configured yet. Add the Supabase URL and anon key to .env.local.", "error");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent("/account/password?reset=1")}`,
    });
    setLoading(false);
    if (error) notify(authErrorMessage(error), "error");
    // The same message whether or not the email has an account, so this can't be used to find out who is registered.
    else setSentTo(address);
  }

  return (
    <div className="mx-auto w-full max-w-md py-8 sm:py-12">
      <h1 className="text-3xl leading-tight sm:text-4xl">Reset your password</h1>
      <p className="mt-2 text-ink-2">Enter your email and we&rsquo;ll send you a link to choose a new password.</p>

      {sentTo ? (
        <div className="mt-6 rounded-lg border-l-3 border-ok bg-ok-soft px-3.5 py-3" role="status">
          If an account exists for <strong>{sentTo}</strong>, a reset link is on its way. Open it in this browser. It expires after a short time.
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-6 grid gap-4 rounded-[14px] border border-rule bg-card p-4 shadow-sm sm:p-6">
          <div className="grid gap-1.5">
            <label htmlFor="reset-email" className="text-sm font-semibold">
              Email
            </label>
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <button className="btn w-full" type="submit" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <p className="mt-4 text-center text-sm text-ink-2">
        <Link href="/login" className="font-semibold">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
