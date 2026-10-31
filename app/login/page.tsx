import type { Metadata } from "next";
import { AuthForm } from "../../components/AuthForm.tsx";
import { safeNextPath } from "../../lib/auth.ts";

export const metadata: Metadata = { title: "Sign in — E-Z Permit" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="wrap">
      <AuthForm
        next={safeNextPath(next)}
        initialError={error === "confirm" ? "That confirmation link is invalid or has expired. Sign in or create your account again." : undefined}
      />
    </main>
  );
}
