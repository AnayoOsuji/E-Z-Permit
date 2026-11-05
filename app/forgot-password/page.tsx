import type { Metadata } from "next";
import { ForgotPasswordForm } from "../../components/ForgotPasswordForm.tsx";

export const metadata: Metadata = { title: "Reset your password — E-Z Permit", robots: { index: false } };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="wrap">
      <ForgotPasswordForm
        initialError={error === "link" ? "That reset link is invalid or has expired. Enter your email to get a new one." : undefined}
      />
    </main>
  );
}
