import { RoadmapRequest, RoadmapStep, dailyRoadmapLimit } from "../../../lib/roadmap.ts";
import { generateRoadmapSteps } from "../../../lib/roadmap-generate.ts";
import { FREE_STEP_LIMIT, PAYWALL_ENABLED, lockSteps } from "../../../lib/roadmap-view.ts";
import { hasCityData, seedRoadmap } from "../../../lib/seed-roadmap.ts";
import { roadmapModel } from "../../../lib/roadmap-model.ts";
import { createClient } from "../../../lib/supabase/server.ts";

export const runtime = "nodejs";
export const maxDuration = 120;

const fail = (error: string, status: number) => Response.json({ error }, { status });

// Body: { city, state, business_type }. Returns { id, source, roadmap: RoadmapStep[] } after saving the
// roadmap for the signed-in user: the first 3 steps in `roadmaps`, the rest in `roadmap_premium_steps`
// (readable only by premium users). Free accounts get steps 4+ redacted in the response too.
// Cities with built-in data skip the AI entirely (instant); elsewhere, if the AI model is missing, too slow or fails,
// the roadmap is built from the built-in general data instead (free).
export async function POST(req: Request) {
  const supabase = await createClient();
  if (!supabase) return fail("Sign-in isn't configured on this server.", 503);

  // Check who is calling before spending anything on the model. getClaims verifies the token locally (no auth round trip).
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return fail("Sign in to generate a roadmap.", 401);
  const user = { id: userId };

  const parsed = RoadmapRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Enter a city, a state and a business type.", 400);

  // Daily cap per user, counted from saved roadmaps (failed generations aren't saved, so they don't count).
  // The two lookups are independent, so they run together.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ data: profile }, { count, error: countError }] = await Promise.all([
    supabase.from("profiles").select("is_premium").eq("id", user.id).maybeSingle(),
    supabase.from("roadmaps").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since),
  ]);
  const isPremium = profile?.is_premium === true;
  const limit = dailyRoadmapLimit(isPremium);
  if (countError) {
    console.error("generate-roadmap: usage check failed", countError);
    return fail("We couldn't check your usage just now. Please try again.", 503);
  }
  if ((count ?? 0) >= limit) {
    return fail(
      `You've reached your limit of ${limit} roadmaps in 24 hours.${isPremium || !PAYWALL_ENABLED ? "" : " Premium accounts get more."} Try again later.`,
      429,
    );
  }

  // Cities with verified built-in data get it instantly. Elsewhere, try the AI model (within its time budget);
  // if that's unavailable, slow or fails, fall back to the free built-in general roadmap.
  let steps: RoadmapStep[] | null = null;
  let source: "ai" | "built-in" = "ai";
  const model = hasCityData(parsed.data) ? null : roadmapModel();
  if (model) {
    try {
      steps = await generateRoadmapSteps(model, parsed.data, { signal: req.signal });
    } catch (err) {
      if (req.signal.aborted) return new Response(null, { status: 499 });
      console.error("generate-roadmap: AI generation failed, using the built-in city data", err);
    }
  }
  if (!steps) {
    steps = seedRoadmap(parsed.data);
    source = "built-in";
  }

  // Row Level Security applies to both inserts: they run as the signed-in user.
  // The free preview goes in `roadmaps`; steps 4+ go where only premium users can read them.
  const { data: saved, error } = await supabase
    .from("roadmaps")
    .insert({
      user_id: user.id,
      city: parsed.data.city,
      state: parsed.data.state,
      business_type: parsed.data.business_type,
      steps: steps.slice(0, FREE_STEP_LIMIT),
      step_count: steps.length,
      source,
    })
    .select("id")
    .single();
  if (error || !saved) {
    console.error("generate-roadmap: save failed", error);
    return fail("We generated your roadmap but couldn't save it. Please try again.", 500);
  }
  const locked = steps.slice(FREE_STEP_LIMIT);
  if (locked.length > 0) {
    const { error: lockedError } = await supabase.from("roadmap_premium_steps").insert({ roadmap_id: saved.id, user_id: user.id, steps: locked });
    if (lockedError) {
      console.error("generate-roadmap: saving locked steps failed", lockedError);
      await supabase.from("roadmaps").delete().eq("id", saved.id); // don't leave a half-saved roadmap behind
      return fail("We generated your roadmap but couldn't save it. Please try again.", 500);
    }
  }

  return Response.json({ id: saved.id, source, roadmap: isPremium || !PAYWALL_ENABLED ? steps : lockSteps(steps, false) }, { status: 201 });
}
