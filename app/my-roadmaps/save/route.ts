import { NextResponse, type NextRequest } from "next/server";
import { guideFromId } from "../../../lib/guides.ts";
import { createClient, getCurrentUser } from "../../../lib/supabase/server.ts";

// Where a "Save my progress" link lands (straight from the button when signed in, or after the
// magic link): saves the guide to the account, records the reminder opt-in if one was given, then
// opens the tracker. Safe to repeat.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const guide = guideFromId(params.get("c"));
  if (!guide) return NextResponse.redirect(new URL("/permits", request.url));

  const user = await getCurrentUser();
  const supabase = await createClient();
  if (!user || !supabase) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`, request.url));
  }

  const { error } = await supabase
    .from("user_checklists")
    .upsert({ user_id: user.id, checklist_id: guide.id }, { onConflict: "user_id,checklist_id", ignoreDuplicates: true });
  if (error) return NextResponse.redirect(new URL("/my-roadmaps", request.url));

  if (params.get("optin") === "1") {
    const now = new Date().toISOString();
    // A failed opt-in shouldn't block saving the checklist; they can set it again on My roadmaps.
    await supabase.from("email_consents").upsert({ user_id: user.id, opted_in: true, consented_at: now, updated_at: now }, { onConflict: "user_id" });
  }

  return NextResponse.redirect(new URL(`/my-roadmaps/${guide.id}`, request.url));
}
