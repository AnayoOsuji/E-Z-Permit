"use client";

import { useState } from "react";
import { authErrorMessage, isValidEmail } from "../lib/auth.ts";
import { savePath } from "../lib/save-link.ts";
import { createClient } from "../lib/supabase/client.ts";
import { useSnackbar } from "./Snackbar.tsx";

const inputClass =
  "w-full rounded-[10px] border border-rule bg-paper px-3.5 py-3 outline-none focus:border-navy focus:ring-3 focus:ring-navy/20";

/**
 * Email a one-time sign-in link (no password). With `guideId` the link also saves that checklist to the
 * account; with `showConsent` the person can opt in to reminder emails. Creates the account if the email is new.
 */
export function MagicLinkForm({
  guideId,
  next = "/dashboard",
  showConsent = false,
  submitLabel = "Email me a sign-in link",
}: {
  guideId?: string;
  next?: string;
  showConsent?: boolean;
  submitLabel?: string;
}) {
  const notify = useSnackbar();
  const [email, setEmail] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

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

    const after = guideId ? savePath(guideId, optIn) : next;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(after)}` },
    });
    setLoading(false);
    if (error) notify(authErrorMessage(error), "error");
    else setSentTo(address);
  }

  if (sentTo) {
    return (
      <div className="rounded-lg border-l-3 border-ok bg-ok-soft px-3.5 py-3" role="status">
        Check <strong>{sentTo}</strong> for your sign-in link. Open it in this browser to {guideId ? "save your checklist" : "sign in"}.
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-3">
      <div className="grid gap-1.5">
        <label htmlFor={`magic-email-${guideId ?? "login"}`} className="text-sm font-semibold">
          Your email
        </label>
        <input
          id={`magic-email-${guideId ?? "login"}`}
          type="email"
          autoComplete="email"
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      {showConsent && (
        <label className="flex items-start gap-2 text-sm text-ink-2">
          <input type="checkbox" className="mt-1 size-4 accent-ok" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
          <span>Email me occasional reminders about my unfinished permit steps (optional, you can say no and still save).</span>
        </label>
      )}
      <button className="btn" type="submit" disabled={loading}>
        {loading ? "Sending…" : submitLabel}
      </button>
    </form>
  );
}
