import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommunityLine } from "../../../../../components/CommunityLine.tsx";
import { SaveProgress } from "../../../../../components/SaveProgress.tsx";
import { StepDetails } from "../../../../../components/StepDetails.tsx";
import { fetchCommunityStats } from "../../../../../lib/community.ts";
import { costRange } from "../../../../../lib/format.ts";
import { buildGuide, formatTimeline, listGuideRefs, type Guide } from "../../../../../lib/guides.ts";
import { SITE_URL } from "../../../../../lib/site.ts";
import { createPublicClient } from "../../../../../lib/supabase/public.ts";

// Built once per guide at build time, then refreshed daily (so community numbers stay current).
export const revalidate = 86400;
export const dynamicParams = false;

type Params = { state: string; city: string; business: string };

export function generateStaticParams(): Params[] {
  return listGuideRefs();
}

async function load(params: Promise<Params>): Promise<Guide> {
  const { state, city, business } = await params;
  const guide = buildGuide(state, city, business);
  if (!guide) notFound();
  return guide;
}

function descriptionFor(g: Guide): string {
  return `${g.steps.length} steps to open a ${g.businessLabel.toLowerCase()} in ${g.city}, ${g.stateCode}: permits, fees (${costRange(g.cost.min, g.cost.max)}), timeline (${formatTimeline(g.timeline).toLowerCase()}) and official links.`;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const g = await load(params);
  const title = `${g.heading}: Costs, Steps & Timeline`;
  const description = descriptionFor(g);
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}${g.path}` },
    openGraph: { title, description, url: `${SITE_URL}${g.path}`, type: "article", siteName: "E-Z Permit" },
  };
}

const wizardLink = (g: Guide) => `/dashboard?${new URLSearchParams({ city: g.city, state: g.stateCode, business: g.businessLabel })}`;

function howToJsonLd(g: Guide) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `How to get the permits for a ${g.businessLabel.toLowerCase()} in ${g.city}, ${g.stateCode}`,
    description: descriptionFor(g),
    estimatedCost: { "@type": "MonetaryAmount", currency: "USD", value: g.cost.max === 0 ? "0" : `${g.cost.min}-${g.cost.max}` },
    ...(g.timeline ? { totalTime: `P${Math.max(1, g.timeline.max)}D` } : {}),
    step: g.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.title,
      text: s.description,
      url: s.links[0]?.url ?? `${SITE_URL}${g.path}#${s.id}`,
    })),
  };
}

function Cta({ guide, where }: { guide: Guide; where: "top" | "bottom" }) {
  return (
    <div className="flex flex-wrap items-center gap-3 no-print" data-testid={`cta-${where}`}>
      <Link href={wizardLink(guide)} className="btn inline-block no-underline hover:text-paper">
        Get your personalized roadmap
      </Link>
      <span className="text-sm text-ink-3">Free. Takes about a minute.</span>
    </div>
  );
}

export default async function GuidePage({ params }: { params: Promise<Params> }) {
  const guide = await load(params);
  // A cookie-free client keeps this page static; it only ever receives the 3+-report medians.
  const community = await fetchCommunityStats(createPublicClient(), guide.cityKey);
  // "<" is escaped so no text in the data can close the script tag.
  const jsonLd = JSON.stringify(howToJsonLd(guide)).replace(/</g, "\\u003c");

  return (
    <main className="wrap py-8 sm:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <nav aria-label="Breadcrumb" className="text-sm text-ink-3">
        <Link href="/permits">Permit guides</Link> / {guide.city}, {guide.stateCode}
      </nav>

      <header className="mt-3">
        <h1 className="break-words text-3xl leading-tight sm:text-4xl">{guide.heading}</h1>
        <p className="summary">{guide.checklist.summary}</p>
        <div className="mt-5">
          <Cta guide={guide} where="top" />
        </div>
      </header>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Steps</div>
          <div className="stat-value">{guide.steps.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Estimated government fees</div>
          <div className="stat-value">{costRange(guide.cost.min, guide.cost.max)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total timeline, done in order</div>
          <div className="stat-value">{formatTimeline(guide.timeline)}</div>
        </div>
      </div>

      <ol className="steps">
        {guide.steps.map((step, i) => (
          <li key={step.id} id={step.id} className="step">
            <div className="step-check">
              <span className="step-num">{String(i + 1).padStart(2, "0")}</span>
            </div>
            <div>
              <h2 className="text-[1.15rem] leading-snug">{step.title}</h2>
              <div className="step-meta">
                <span className={`level level-${step.level}`}>{step.level}</span>
                <span>{step.agency}</span>
              </div>
            </div>
            <StepDetails step={step}>
              <CommunityLine stat={community[step.id]} />
              <p className="verified">Last verified {guide.lastVerified}</p>
            </StepDetails>
          </li>
        ))}
      </ol>

      <div className="notes">
        <div className="note warn">
          <h2 className="text-base">Watch out for</h2>
          <ul>
            {guide.checklist.caveats.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
        <div className="note">
          <h2 className="text-base">Official sources</h2>
          <ul>
            {guide.checklist.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section className="mt-10 rounded-[14px] border border-rule bg-card p-5 sm:p-6" aria-labelledby="next-title">
        <h2 id="next-title" className="text-2xl">
          Ready to open?
        </h2>
        <p className="mt-2 text-ink-2">
          Tick off steps as you finish them and come back any time. No password needed, just your email.
        </p>
        <div className="mt-4 grid gap-5">
          <SaveProgress guideId={guide.id} />
          <Cta guide={guide} where="bottom" />
        </div>
      </section>
    </main>
  );
}
