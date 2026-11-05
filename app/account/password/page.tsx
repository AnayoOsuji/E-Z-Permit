import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PasswordForm } from "../../../components/PasswordForm.tsx";
import { getCurrentUser } from "../../../lib/supabase/server.ts";

export const metadata: Metadata = { title: "Password — E-Z Permit", robots: { index: false } };

export default async function PasswordPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const { reset } = await searchParams;
  const user = await getCurrentUser();
  // A reset link signs the person in first, so this page needs a session either way.
  if (!user) redirect("/login?next=/account/password");
  const isReset = reset === "1";

  return (
    <main className="wrap">
      <div className="mx-auto w-full max-w-md py-8 sm:py-12">
        <h1 className="text-3xl leading-tight sm:text-4xl">{isReset ? "Choose a new password" : "Change your password"}</h1>
        <p className="mt-2 text-ink-2">
          {isReset ? "You're signed in as" : "Signed in as"} <strong className="text-ink">{user.email}</strong>.
        </p>
        <PasswordForm reset={isReset} />
      </div>
    </main>
  );
}
