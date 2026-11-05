"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "./useUser.ts";

const MAIN = [
  { href: "/", label: "Home" },
  { href: "/permits", label: "Permit guides" },
  { href: "/about", label: "About" },
  { href: "/how-it-works", label: "How it works" },
];

const linkClass = "rounded-lg px-3 py-3 text-sm sm:py-1.5 font-semibold no-underline";

// Who is signed in is read in the browser, not on the server, so the navbar doesn't force every page
// (including the statically generated guides) to render per request. `children` is the sign-out button.
export function NavLinks({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();
  const signedIn = !!useUser(pathname);
  const active = (href: string) => {
    const on = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
    return on ? `${linkClass} bg-paper-2 text-ink` : `${linkClass} text-ink-2 hover:text-stamp`;
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {MAIN.map((l) => (
        <Link key={l.href} href={l.href} className={active(l.href)} aria-current={pathname === l.href ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
      <span className="mx-1 hidden h-5 w-px bg-rule sm:block" aria-hidden="true" />
      {signedIn ? (
        <>
          <Link href="/my-roadmaps" className={active("/my-roadmaps")}>
            My roadmaps
          </Link>
          <Link href="/dashboard" className={active("/dashboard")}>
            Dashboard
          </Link>
          <Link href="/account/password" className={active("/account")}>
            Account
          </Link>
          {children}
        </>
      ) : (
        <>
          <Link href="/login" className={active("/login")}>
            Log in
          </Link>
          <Link href="/signup" className={`${linkClass} bg-ink text-paper hover:bg-stamp hover:text-paper`}>
            Sign up
          </Link>
        </>
      )}
    </div>
  );
}
