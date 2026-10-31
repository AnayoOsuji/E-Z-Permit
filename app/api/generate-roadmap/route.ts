import { RoadmapRequest, RoadmapStep, dailyRoadmapLimit } from "../../../lib/roadmap.ts";
import { generateRoadmapSteps } from "../../../lib/roadmap-generate.ts";
import { FREE_STEP_LIMIT, lockSteps } from "../../../lib/roadmap-view.ts";
import { seedRoadmap } from "../../../lib/seed-roadmap.ts";
import { roadmapModel } from "../../../lib/roadmap-model.ts";
import { createClient } from "../../../lib/supabase/server.ts";

export const runtime = "nodejs";
export const maxDuration = 120;

const fail = (error: string, status: number) => Response.json({ error }, { status });

// Body: { city, state, business_type }. Returns { id, source, roadmap: RoadmapStep[] } after saving the
// roadmap for the signed-in user: the first 3 steps in `roadmaps`, the rest in `roadmap_premium_steps`
// (readable only by premium users). Free accounts get steps 4+ redacted in the response too.
// If the AI model is missing or fails, the roadmap is built from the built-in city data instead (free).
export async function POST(req: Request) {
  const supabase = await createClient();
  if (!supabase) return fail("Sign-in isn't configured on this server.", 503);

  // Check who is calling before spending anything on the model.
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return fail("Sign in to generate a roadmap.", 401);

  const parsed = RoadmapRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Enter a city, a state and a business type.", 400);

  // Daily cap per user, counted from saved roadmaps (failed generations aren't saved, so they don't count).
  const { data: profile } = await supabase.from("profiles").select("is_premium").eq("id", user.id).maybeSingle();
  const isPremium = profile?.is_premium === true;
  const limit = dailyRoadmapLimit(isPremium);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from("roadmaps")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);
  if (countError) {
    console.error("generate-roadmap: usage check failed", countError);
    return fail("We couldn't check your usage just now. Please try again.", 503);
  }
  if ((count ?? 0) >= limit) {
    return fail(
      `You've reached your limit of ${limit} roadmaps in 24 hours.${isPremium ? "" : " Premium accounts get more."} Try again later.`,
      429,
    );
  }

  // Generate with the AI model; if that's unavailable or fails, fall back to the free built-in data.
  let steps: RoadmapStep[] | null = null;
  let source: "ai" | "built-in" = "ai";
  const model = roadmapModel();
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

  return Response.json({ id: saved.id, source, roadmap: isPremium ? steps : lockSteps(steps, false) }, { status: 201 });
}
