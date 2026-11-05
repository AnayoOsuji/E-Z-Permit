import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS_LABELS, BUSINESS_SLUGS, slugify } from "../../lib/guides.ts";
import type { Category } from "../../lib/seed/categories.ts";
import { SEED_CITIES } from "../../lib/seed/index.ts";
import { SITE_URL } from "../../lib/site.ts";

export const metadata: Metadata = {
  title: "Business Permit Guides by City",
  description: "Step-by-step permit and license guides with costs, timelines and official links for food trucks, home businesses, restaurants and small businesses in major US cities.",
  alternates: { canonical: `${SITE_URL}/permits` },
};

const CATEGORIES = Object.keys(BUSINESS_SLUGS) as Category[];

export default function PermitsIndex() {
  const cities = [...SEED_CITIES].sort((a, b) => a.city.localeCompare(b.city));
  return (
    <main className="wrap py-8 sm:py-12">
      <h1 className="text-3xl leading-tight sm:text-4xl">Business permit guides by city</h1>
      <p className="summary">
        Pick your city and the kind of business. Each guide lists every permit in the order to get it, with fees, timelines and links to the
        official forms.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {cities.map((c) => (
          <section key={`${c.state}-${c.city}`} className="note" aria-labelledby={`city-${slugify(c.city)}`}>
            <h2 id={`city-${slugify(c.city)}`} className="text-xl">
              {c.city}, {c.state}
            </h2>
            <ul className="mt-3">
              {CATEGORIES.map((cat) => (
                <li key={cat}>
                  <Link href={`/permits/${c.state.toLowerCase()}/${slugify(c.city)}/${BUSINESS_SLUGS[cat]}`}>{BUSINESS_LABELS[cat]} permits</Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-8 text-ink-2">
        Don&rsquo;t see your city? <Link href="/">Build a general checklist</Link> for any US city.
      </p>
    </main>
  );
}
