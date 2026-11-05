"use client";

import { usePathname } from "next/navigation";
import { MagicLinkForm } from "./MagicLinkForm.tsx";

/** The "Prefer no password?" card under the sign-in form. Hidden when the page is switched to the sign-up tab. */
export function MagicLinkCard({ next }: { next: string }) {
  // AuthForm switches tabs by changing the URL without a navigation, so the pathname is the source of truth.
  if (usePathname() === "/signup") return null;
  return (
    <section className="mx-auto mb-12 w-full max-w-md rounded-[14px] border border-rule bg-card p-4 sm:p-6" aria-labelledby="magic-title">
      <h2 id="magic-title" className="text-xl">
        Prefer no password?
      </h2>
      <p className="mb-4 mt-1 text-sm text-ink-2">We&rsquo;ll email you a link that signs you in (or creates your account).</p>
      <MagicLinkForm next={next} />
    </section>
  );
}
