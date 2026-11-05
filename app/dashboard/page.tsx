import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PermitWizard } from "../../components/PermitWizard.tsx";
import { STATES } from "../../lib/places.ts";
import type { WizardValues } from "../../lib/wizard.ts";
import { createClient, getCurrentUser } from "../../lib/supabase/server.ts";

export const metadata: Metadata = { title: "Dashboard — E-Z Permit" };

// Public guide pages link here with ?city=Austin&state=TX&business=Food+Truck to pre-fill the wizard.
function prefill(query: { city?: string; state?: string; business?: string }): WizardValues | undefined {
  const state = (query.state ?? "").toUpperCase();
  if (!query.city && !query.business) return undefined;
  return { city: (query.city ?? "").slice(0, 80), state: STATES[state] ? state : "", businessType: (query.business ?? "").slice(0, 100) };
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ city?: string; state?: string; business?: string }> }) {
  const initial = prefill(await searchParams);
  // proxy.ts already redirects signed-out visitors; this guards direct renders too.
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  const supabase = await createClient();
  const { data: recent } = supabase
    ? await supabase.from("roadmaps").select("id, city, state, business_type, created_at").order("created_at", { ascending: false }).limit(8)
    : { data: null };

  return (
    <main className="wrap py-8 sm:py-12">
      <p className="eyebrow">Dashboard</p>
      <h1 className="mt-1 text-3xl leading-tight sm:text-4xl">Plan your permits</h1>
      <p className="mt-2 text-ink-2">
        Signed in as <strong className="text-ink">{user.email}</strong>. Answer three quick questions and we&rsquo;ll build
        your roadmap.
      </p>

      <div className="mt-8">
        <PermitWizard userId={user.id} initial={initial} />
      </div>

      {recent && recent.length > 0 && (
        <section className="mt-12" aria-labelledby="recent-title" data-testid="recent-roadmaps">
          <h2 id="recent-title" className="text-2xl">
            Your roadmaps
          </h2>
          <ul className="m-0 mt-4 grid list-none gap-3 p-0">
            {recent.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/dashboard/roadmaps/${r.id}`}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-[12px] border border-rule bg-card px-4 py-3 text-ink no-underline transition-colors duration-200 hover:border-stamp hover:text-ink"
                >
                  <span className="font-semibold">
                    {r.business_type} <span className="font-normal text-ink-2">in {r.city}, {r.state}</span>
                  </span>
                  <span className="text-sm text-ink-3">
                    {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
