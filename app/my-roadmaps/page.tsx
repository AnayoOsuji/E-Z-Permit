import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { guideFromId } from "../../lib/guides.ts";
import { summarizeProgress } from "../../lib/progress.ts";
import { createClient, getCurrentUser } from "../../lib/supabase/server.ts";
import { setReminderConsent } from "./actions.ts";

export const metadata: Metadata = { title: "My roadmaps — E-Z Permit", robots: { index: false } };

export default async function MyRoadmapsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/my-roadmaps");
  const supabase = await createClient();

  const [saved, progress, consent] = supabase
    ? await Promise.all([
        supabase.from("user_checklists").select("checklist_id, created_at").order("created_at", { ascending: false }),
        supabase.from("user_progress").select("checklist_id, step_id"),
        supabase.from("email_consents").select("opted_in").maybeSingle(),
      ])
    : [null, null, null];

  const doneByChecklist = new Map<string, string[]>();
  for (const row of progress?.data ?? []) doneByChecklist.set(row.checklist_id, [...(doneByChecklist.get(row.checklist_id) ?? []), row.step_id]);

  const items = (saved?.data ?? []).flatMap((row) => {
    const guide = guideFromId(row.checklist_id);
    return guide ? [{ guide, progress: summarizeProgress(doneByChecklist.get(guide.id) ?? [], guide.steps.map((s) => s.id)) }] : [];
  });
  const optedIn = consent?.data?.opted_in === true;

  return (
    <main className="wrap py-8 sm:py-12">
      <p className="eyebrow">My roadmaps</p>
      <h1 className="mt-1 text-3xl leading-tight sm:text-4xl">Your saved checklists</h1>
      <p className="mt-2 text-ink-2">
        Signed in as <strong className="text-ink">{user.email}</strong>. Tick off steps as you finish them.
      </p>

      {items.length === 0 ? (
        <div className="note mt-8" data-testid="no-saved">
          <p className="m-0 text-ink-2">
            Nothing saved yet. Browse the <Link href="/permits">permit guides</Link> and press &ldquo;Save my progress&rdquo; on one.
          </p>
        </div>
      ) : (
        <ul className="m-0 mt-8 grid list-none gap-3 p-0" data-testid="saved-list">
          {items.map(({ guide, progress: p }) => (
            <li key={guide.id}>
              <Link
                href={`/my-roadmaps/${guide.id}`}
                className="grid gap-2 rounded-[12px] border border-rule bg-card px-4 py-3 text-ink no-underline transition-colors duration-200 hover:border-stamp hover:text-ink"
              >
                <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <span className="font-semibold">{guide.heading}</span>
                  <span className="text-sm text-ink-3">{p.label}</span>
                </span>
                <span className="bar" aria-hidden="true">
                  <span style={{ width: `${p.percent}%` }} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <form action={setReminderConsent} className="note mt-10 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-ink-2">
          Reminder emails about unfinished steps: <strong className="text-ink">{optedIn ? "on" : "off"}</strong>
        </span>
        <input type="hidden" name="opted_in" value={optedIn ? "0" : "1"} />
        <button type="submit" className="btn-ghost">
          {optedIn ? "Turn off" : "Turn on"}
        </button>
      </form>
    </main>
  );
}
