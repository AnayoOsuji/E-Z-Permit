import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TrackedChecklist } from "../../../../../components/TrackedChecklist.tsx";
import { fetchCommunityStats } from "../../../../../lib/community.ts";
import { guideFromId } from "../../../../../lib/guides.ts";
import { savePath } from "../../../../../lib/save-link.ts";
import { createClient, getCurrentUser } from "../../../../../lib/supabase/server.ts";

export const metadata: Metadata = { title: "My roadmap — E-Z Permit", robots: { index: false } };

export default async function TrackedRoadmapPage({ params }: { params: Promise<{ state: string; city: string; business: string }> }) {
  const { state, city, business } = await params;
  const guide = guideFromId(`${state}/${city}/${business}`);
  if (!guide) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/my-roadmaps/${guide.id}`)}`);
  const supabase = await createClient();
  if (!supabase) notFound();

  // RLS limits every one of these to the signed-in user's own rows.
  const [saved, progress, reports, community] = await Promise.all([
    supabase.from("user_checklists").select("id").eq("checklist_id", guide.id).maybeSingle(),
    supabase.from("user_progress").select("step_id").eq("checklist_id", guide.id),
    supabase.from("step_duration_reports").select("step_id, days").eq("city", guide.cityKey),
    fetchCommunityStats(supabase, guide.cityKey),
  ]);
  // Not saved yet (e.g. a typed-in URL): saving is one redirect away.
  if (!saved.data) redirect(savePath(guide.id));

  return (
    <main className="wrap py-8 sm:py-12">
      <Link href="/my-roadmaps" className="text-sm font-semibold no-underline">
        ← My roadmaps
      </Link>
      <h1 className="mt-4 break-words text-3xl leading-tight sm:text-4xl">{guide.heading}</h1>
      <p className="summary">
        Tick a step when it&rsquo;s done. <Link href={guide.path}>View the public guide</Link>
      </p>

      <div className="mt-6">
        <TrackedChecklist
          userId={user.id}
          guideId={guide.id}
          cityKey={guide.cityKey}
          steps={guide.steps}
          initialDone={(progress.data ?? []).map((r) => r.step_id)}
          initialReports={Object.fromEntries((reports.data ?? []).map((r) => [r.step_id, r.days]))}
          community={community}
        />
      </div>
    </main>
  );
}
