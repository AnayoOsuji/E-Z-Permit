"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { authErrorMessage, checkPassword, validatePasswordChange } from "../lib/auth.ts";
import { createClient } from "../lib/supabase/client.ts";
import { useSnackbar } from "./Snackbar.tsx";

const inputClass =
  "w-full rounded-[10px] border border-rule bg-paper px-3.5 py-3 outline-none focus:border-navy focus:ring-3 focus:ring-navy/20";

/** Sets a new password for the signed-in user. Used after a reset link (`reset`) and for changing it later. */
export function PasswordForm({ reset }: { reset: boolean }) {
  const router = useRouter();
  const notify = useSnackbar();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [navigating, startNavigation] = useTransition();

  const rules = checkPassword(password);
  const mismatch = confirm.length > 0 && confirm !== password;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validatePasswordChange(password, confirm);
    if (problem) {
      notify(problem, "error");
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      notify("Sign-in isn't configured yet. Add the Supabase URL and anon key to .env.local.", "error");
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      notify(authErrorMessage(error), "error");
      return;
    }
    setPassword("");
    setConfirm("");
    notify("Your password has been updated.", "success");
    if (reset) startNavigation(() => router.replace("/dashboard"));
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6 grid gap-4 rounded-[14px] border border-rule bg-card p-4 shadow-sm sm:p-6">
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="new-password" className="text-sm font-semibold">
            New password
          </label>
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-navy hover:text-stamp"
            onClick={() => setShow((s) => !s)}
            aria-controls="new-password"
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>
        <input
          id="new-password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          className={inputClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby="password-rules"
        />
        <ul id="password-rules" className="m-0 grid list-none grid-cols-1 gap-1 p-0 text-sm sm:grid-cols-2" aria-live="polite">
          {rules.map((r) => (
            <li key={r.id} className={`flex items-center gap-2 ${r.met ? "text-ok" : "text-ink-3"}`}>
              <span aria-hidden="true" className="w-3 text-center font-bold">
                {r.met ? "✓" : "•"}
              </span>
              {r.label}
              <span className="sr-only">{r.met ? "(met)" : "(not met)"}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="confirm-new-password" className="text-sm font-semibold">
          Confirm new password
        </label>
        <input
          id="confirm-new-password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          className={inputClass}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={mismatch}
        />
        {mismatch && <span className="text-sm text-stamp">Passwords don&rsquo;t match.</span>}
      </div>

      <button className="btn w-full" type="submit" disabled={saving || navigating}>
        {saving || navigating ? "Saving…" : reset ? "Set new password" : "Change password"}
      </button>
    </form>
  );
}
