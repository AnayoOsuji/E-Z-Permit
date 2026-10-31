import Link from "next/link";
import { signOut } from "../app/auth/actions.ts";
import { getCurrentUser } from "../lib/supabase/server.ts";
import { NavLinks } from "./NavLinks.tsx";

export async function Navbar() {
  const user = await getCurrentUser();

  return (
    <header className="no-print border-b border-rule">
      <nav className="wrap flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4" aria-label="Main">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">EZ</span>
          E-Z Permit
        </Link>
        <NavLinks signedIn={!!user}>
          {user && (
            <form action={signOut}>
              <button
                type="submit"
                className="cursor-pointer rounded-lg border border-rule bg-transparent px-3 py-3 text-sm font-semibold text-ink hover:border-ink sm:py-1.5"
              >
                Sign out
              </button>
            </form>
          )}
        </NavLinks>
      </nav>
    </header>
  );
}
