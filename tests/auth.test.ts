import assert from "node:assert/strict";
import { test } from "node:test";
import { validatePasswordChange, authErrorMessage, checkPassword, isStrongPassword, isValidEmail, safeNextPath, validateAuthForm } from "../lib/auth.ts";

test("password criteria", () => {
  const unmet = (p: string) => checkPassword(p).filter((r) => !r.met).map((r) => r.id);
  assert.deepEqual(unmet(""), ["length", "upper", "lower", "number", "symbol"]);
  assert.deepEqual(unmet("password"), ["upper", "number", "symbol"]);
  assert.deepEqual(unmet("Passw0rd"), ["symbol"]);
  assert.deepEqual(unmet("Pa0!"), ["length"]);
  assert.equal(isStrongPassword("Passw0rd!"), true);
  assert.equal(isStrongPassword("Passw0rd"), false);
});

test("email validation", () => {
  assert.equal(isValidEmail("founder@example.com"), true);
  assert.equal(isValidEmail("  founder@example.com "), true);
  assert.equal(isValidEmail("founder@example"), false);
  assert.equal(isValidEmail("founder example.com"), false);
  assert.equal(isValidEmail(""), false);
});

test("form validation differs between sign in and sign up", () => {
  assert.equal(validateAuthForm("signin", "", "x", ""), "Enter your email address.");
  assert.match(validateAuthForm("signin", "bad", "x", "") ?? "", /doesn't look right/);
  assert.equal(validateAuthForm("signin", "a@b.co", "", ""), "Enter your password.");
  // Sign in doesn't enforce strength, so older or simpler passwords still work.
  assert.equal(validateAuthForm("signin", "a@b.co", "weak", ""), null);
  assert.match(validateAuthForm("signup", "a@b.co", "weak", "weak") ?? "", /requirements/);
  assert.equal(validateAuthForm("signup", "a@b.co", "Passw0rd!", "Passw0rd?"), "Passwords don't match.");
  assert.equal(validateAuthForm("signup", "a@b.co", "Passw0rd!", "Passw0rd!"), null);
});

test("auth error messages", () => {
  assert.equal(authErrorMessage({ code: "invalid_credentials", message: "Invalid login credentials" }), "Incorrect email or password.");
  assert.match(authErrorMessage({ code: "email_not_confirmed" }), /Confirm your email/);
  assert.match(authErrorMessage({ code: "user_already_exists" }), /already exists/);
  assert.match(authErrorMessage({ code: "over_request_rate_limit" }), /Too many attempts/);
  assert.match(authErrorMessage({ code: "over_email_send_rate_limit" }), /too many emails/);
  assert.match(authErrorMessage({ name: "AuthRetryableFetchError", message: "Failed to fetch", status: 0 }), /couldn't reach/);
  assert.match(authErrorMessage(new TypeError("Failed to fetch")), /couldn't reach/);
  assert.equal(authErrorMessage({ message: "Custom server message" }), "Custom server message");
  assert.equal(authErrorMessage(null), "Something went wrong. Please try again.");
});

test("post-login redirects stay on this site", () => {
  assert.equal(safeNextPath("/dashboard?tab=1"), "/dashboard?tab=1");
  assert.equal(safeNextPath(undefined), "/dashboard");
  assert.equal(safeNextPath("https://evil.example"), "/dashboard");
  assert.equal(safeNextPath("//evil.example"), "/dashboard");
  assert.equal(safeNextPath("/\\evil.example"), "/dashboard");
});

test("validatePasswordChange checks strength and confirmation", () => {
  assert.equal(validatePasswordChange("", ""), "Enter a new password.");
  assert.match(validatePasswordChange("weak", "weak")!, /requirements/);
  assert.equal(validatePasswordChange("Passw0rd!", "Passw0rd?"), "Passwords don't match.");
  assert.equal(validatePasswordChange("Passw0rd!", "Passw0rd!"), null);
});

test("password reset errors are friendly", () => {
  assert.match(authErrorMessage({ code: "same_password" }), /different/);
  assert.match(authErrorMessage({ code: "reauthentication_needed" }), /sign in again/);
});
