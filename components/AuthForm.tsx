"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authErrorMessage, checkPassword, validateAuthForm, type AuthMode } from "../lib/auth.ts";
import { createClient } from "../lib/supabase/client.ts";
import { useSnackbar } from "./Snackbar.tsx";

const COPY: Record<AuthMode, { title: string; lede: string; submit: string; busy: string; switchPrompt: string; switchLabel: string }> = {
  signin: {
    title: "Welcome back",
    lede: "Sign in to see your saved permit roadmaps.",
    submit: "Sign in",
    busy: "Signing in…",
    switchPrompt: "New to E-Z Permit?",
    switchLabel: "Create an account",
  },
  signup: {
    title: "Create your account",
    lede: "Save checklists and track your progress toward opening day.",
    submit: "Create account",
    busy: "Creating account…",
    switchPrompt: "Already have an account?",
    switchLabel: "Sign in",
  },
};

const inputClass =
  "w-full rounded-[10px] border border-rule bg-paper px-3.5 py-3 outline-none focus:border-navy focus:ring-3 focus:ring-navy/20";

export function AuthForm({ next, initialError }: { next: string; initialError?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const notify = useSnackbar();
  // The URL is the source of truth for the mode, so /login and /signup both work and the toggle is shareable.
  const mode: AuthMode = pathname === "/signup" ? "signup" : "signin";
  const copy = COPY[mode];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // A problem handed over by the server (e.g. a bad confirmation link) is shown once, as a snackbar.
  useEffect(() => {
    if (initialError) notify(initialError, "error");
  }, [initialError, notify]);

  const rules = checkPassword(password);
  const confirmMismatch = mode === "signup" && confirm.length > 0 && confirm !== password;

  function toggleMode() {
    const target = mode === "signin" ? "/signup" : "/login";
    // Swap the URL without a navigation so the email the user typed is kept.
    window.history.replaceState(null, "", `${target}${window.location.search}`);
    setNotice(null);
    setPassword("");
    setConfirm("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    const problem = validateAuthForm(mode, email, password, confirm);
    if (problem) {
      notify(problem, "error");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      notify("Sign-in isn't configured yet. Add the Supabase URL and anon key to .env.local.", "error");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.replace(next);
        router.refresh();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}` },
      });
      if (error) throw error;
      // With email confirmation on, Supabase returns a user with no identities for an existing email.
      if (data.user && data.user.identities?.length === 0) {
        notify(authErrorMessage({ code: "user_already_exists" }), "error");
      } else if (data.session) {
        router.replace(next);
        router.refresh();
        return;
      } else {
        setNotice(`Check ${email.trim()} for a confirmation link to finish creating your account.`);
        setPassword("");
        setConfirm("");
      }
    } catch (err) {
      notify(authErrorMessage(err), "error");
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto w-full max-w-md py-8 sm:py-12">
      <h1 className="text-3xl leading-tight sm:text-4xl">{copy.title}</h1>
      <p className="mt-2 text-ink-2">{copy.lede}</p>

      <div className="mt-6 grid grid-cols-2 rounded-[10px] border border-rule bg-paper p-1" role="tablist" aria-label="Account">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => mode !== m && toggleMode()}
            className={`cursor-pointer rounded-lg border-0 py-2 text-sm font-semibold ${
              mode === m ? "bg-card text-ink shadow-sm" : "bg-transparent text-ink-2 hover:text-ink"
            }`}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} noValidate className="mt-4 grid gap-4 rounded-[14px] border border-rule bg-card p-4 shadow-sm sm:p-6">
        <div className="grid gap-1.5">
          <label htmlFor="email" className="text-sm font-semibold">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-semibold">
              Password
            </label>
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-navy hover:text-stamp"
              onClick={() => setShowPassword((s) => !s)}
              aria-controls="password"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={mode === "signup" ? "password-rules" : undefined}
          />
          {mode === "signup" && (
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
          )}
        </div>

        {mode === "signup" && (
          <div className="grid gap-1.5">
            <label htmlFor="confirm" className="text-sm font-semibold">
              Confirm password
            </label>
            <input
              id="confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className={inputClass}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={confirmMismatch}
            />
            {confirmMismatch && <span className="text-sm text-stamp">Passwords don&rsquo;t match.</span>}
          </div>
        )}

        {notice && (
          <div className="rounded-lg border-l-3 border-ok bg-ok-soft px-3.5 py-3" role="status">
            {notice}
          </div>
        )}

        <button className="btn w-full" type="submit" disabled={loading}>
          {loading ? copy.busy : copy.submit}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-ink-2">
        {copy.switchPrompt}{" "}
        <button
          type="button"
          onClick={toggleMode}
          className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-navy underline hover:text-stamp"
        >
          {copy.switchLabel}
        </button>
      </p>
    </div>
  );
}
