import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { HideableRoadmap } from "../../../../components/HideableRoadmap.tsx";
import { RoadmapTimeline } from "../../../../components/RoadmapTimeline.tsx";
import { UpgradePending, UpgradeSuccess } from "../../../../components/UpgradeStatus.tsx";
import { isReference } from "../../../../lib/paystack.ts";
import { linksForSteps } from "../../../../lib/roadmap-links.ts";
import { RoadmapStep } from "../../../../lib/roadmap.ts";
import { FREE_STEP_LIMIT, PAYWALL_ENABLED, buildDisplaySteps, isUuid } from "../../../../lib/roadmap-view.ts";
import { createAdminClient } from "../../../../lib/supabase/admin.ts";
import { createClient, getCurrentUser } from "../../../../lib/supabase/server.ts";

export const metadata: Metadata = { title: "Your roadmap — E-Z Permit" };

export default async function RoadmapPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  // Paystack sends the buyer back with ?reference=… (and trxref=…) after a payment attempt.
  const returned = query.reference ?? query.trxref;
  const reference = returned && isReference(returned) ? returned : null;
  if (!isUuid(id)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/dashboard/roadmaps/${id}`);

  const supabase = await createClient();
  if (!supabase) notFound();

  // Row Level Security means this only finds the roadmap if it belongs to the signed-in user.
  // The profile is read at the same time; neither lookup needs the other. With the paywall off, steps 4+ are needed
  // whatever the profile says, so they're fetched in the same round (with the service role, since RLS only lets
  // premium users read that table) and only used below once the RLS lookup has confirmed the roadmap is theirs.
  const earlyReader = PAYWALL_ENABLED ? null : createAdminClient() ?? supabase;
  const [{ data: roadmap }, { data: profile }, early] = await Promise.all([
    supabase.from("roadmaps").select("id, city, state, business_type, steps, step_count, source, created_at").eq("id", id).maybeSingle(),
    supabase.from("profiles").select("is_premium").eq("id", user.id).maybeSingle(),
    earlyReader ? earlyReader.from("roadmap_premium_steps").select("steps").eq("roadmap_id", id).maybeSingle() : null,
  ]);
  if (!roadmap) notFound();
  const isPremium = profile?.is_premium === true;
  const unlocked = isPremium || !PAYWALL_ENABLED;

  // The free preview comes with the roadmap. Steps 4+ live in a table the database only lets premium users read.
  const parsed = z.array(RoadmapStep).safeParse(roadmap.steps);
  let premiumSteps: RoadmapStep[] | null = null;
  if (unlocked) {
    // Ownership was already checked above (RLS). With the paywall off, free users' steps 4+ are read with
    // the service role, because RLS only lets premium users read that table.
    const { data: locked } = early ?? (await ((!isPremium && createAdminClient()) || supabase).from("roadmap_premium_steps").select("steps").eq("roadmap_id", id).maybeSingle());
    const lockedParsed = z.array(RoadmapStep).safeParse(locked?.steps);
    premiumSteps = lockedParsed.success ? lockedParsed.data : null;
  }
  const { steps: built, incomplete } = parsed.success
    ? buildDisplaySteps({ preview: parsed.data, premium: premiumSteps, stepCount: roadmap.step_count ?? 0, isPremium: unlocked })
    : { steps: [], incomplete: false };
  // Links come from the built-in city data (verified), matched to each step; the AI never supplies a URL.
  const stepLinks = linksForSteps(built, { city: roadmap.city, state: roadmap.state, business_type: roadmap.business_type });
  const steps = built.map((s, i) => (s.locked ? s : { ...s, links: stepLinks[i] }));
  const created = new Date(roadmap.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <main className="wrap py-8 sm:py-12">
      <Link href="/dashboard" className="text-sm font-semibold no-underline">
        ← Back to dashboard
      </Link>

      <header className="mt-4">
        <p className="eyebrow">
          Your permit roadmap{isPremium && (
            <>
              {" "}
              <span className="ml-1 rounded-full bg-ok-soft px-2 py-0.5 text-ok">Premium</span>
            </>
          )}
        </p>
        <h1 className="mt-1 break-words text-3xl leading-tight sm:text-4xl">
          {roadmap.business_type} in {roadmap.city}, {roadmap.state}
        </h1>
        <p className="mt-2 text-ink-2" data-testid="roadmap-summary">
          {parsed.success
            ? unlocked || steps.length <= FREE_STEP_LIMIT
              ? `${steps.length} steps, in the order to do them. Created ${created}.`
              : `${steps.length} steps, in the order to do them. You can see the first ${FREE_STEP_LIMIT}. Created ${created}.`
            : "We couldn't read this roadmap."}
        </p>
      </header>

      {roadmap.source === "built-in" && (
        <div className="mt-6 rounded-[12px] border border-rule bg-paper-2 px-4 py-3 text-sm text-ink-2" role="note" data-testid="builtin-notice">
          <strong className="text-ink">From our built-in city guide.</strong> This roadmap was built from E-Z Permit&rsquo;s own city data rather than live AI
          research, so fees and forms may be out of date or general. Confirm each step with the department.
        </div>
      )}
      {reference && (isPremium ? <UpgradeSuccess /> : <UpgradePending reference={reference} />)}
      {incomplete && (
        <div className="error mt-6" role="alert" data-testid="incomplete-notice">
          Some of your premium steps couldn&rsquo;t be loaded. Refresh the page, or contact support if this keeps happening.
        </div>
      )}

      <div className="mt-8 sm:mt-10">
        {steps.length > 0 ? (
          <HideableRoadmap>
            <RoadmapTimeline steps={steps} isPremium={isPremium} roadmapId={id} />
          </HideableRoadmap>
        ) : (
          <div className="error" role="alert">
            This roadmap&rsquo;s data looks damaged. Try creating a new one from the dashboard.
          </div>
        )}
      </div>

      <p className="disclaimer">A planning aid, not legal advice. Fees and requirements change, so confirm each step with the issuing department.</p>
    </main>
  );
}
