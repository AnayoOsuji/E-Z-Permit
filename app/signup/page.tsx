import type { Metadata } from "next";
import { AuthForm } from "../../components/AuthForm.tsx";
import { safeNextPath } from "../../lib/auth.ts";

export const metadata: Metadata = { title: "Create account — E-Z Permit" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="wrap">
      <AuthForm next={safeNextPath(next)} />
    </main>
  );
}
