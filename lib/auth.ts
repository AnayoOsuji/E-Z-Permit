// Validation and error copy for the email/password auth form. Kept free of
// Supabase and React imports so it can be unit tested directly.

export type AuthMode = "signin" | "signup";

export type PasswordRule = { id: string; label: string; test: (password: string) => boolean };

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { id: "upper", label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { id: "lower", label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { id: "number", label: "One number", test: (p) => /\d/.test(p) },
  { id: "symbol", label: "One symbol (!@#$…)", test: (p) => /[^A-Za-z0-9\s]/.test(p) },
];

export function checkPassword(password: string) {
  return PASSWORD_RULES.map((rule) => ({ id: rule.id, label: rule.label, met: rule.test(password) }));
}

export function isStrongPassword(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** Returns the first problem with the form, or null when it can be submitted. */
export function validateAuthForm(mode: AuthMode, email: string, password: string, confirm: string): string | null {
  if (!email.trim()) return "Enter your email address.";
  if (!isValidEmail(email)) return "That email address doesn't look right.";
  if (!password) return "Enter your password.";
  if (mode === "signup") {
    if (!isStrongPassword(password)) return "Your password doesn't meet all of the requirements yet.";
    if (password !== confirm) return "Passwords don't match.";
  }
  return null;
}

type AuthErrorLike = { code?: string; message?: string; status?: number; name?: string };

/** Turns a Supabase auth error (or a network failure) into a message for the user. */
export function authErrorMessage(error: unknown): string {
  const e = (typeof error === "object" && error !== null ? error : {}) as AuthErrorLike;
  switch (e.code) {
    case "invalid_credentials":
      return "Incorrect email or password.";
    case "email_not_confirmed":
      return "Confirm your email first. Check your inbox for the link we sent.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Sign in instead.";
    case "weak_password":
      return "That password is too weak. Choose a stronger one.";
    case "email_address_invalid":
      return "That email address isn't accepted. Try a different one.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Wait a minute and try again.";
    case "signup_disabled":
      return "New sign-ups are turned off right now.";
  }
  if (e.name === "AuthRetryableFetchError" || e.status === 0 || /fetch|network/i.test(e.message ?? "")) {
    return "We couldn't reach the sign-in service. Check your connection and try again.";
  }
  return e.message || "Something went wrong. Please try again.";
}

/** Only allow same-site relative paths as post-login redirects. */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
