import { ChecklistRequest, type Checklist, type StreamEvent } from "../../../lib/checklist.ts";
import { guideIdForChecklist } from "../../../lib/guides.ts";
import { liveProvider, researchLive } from "../../../lib/live-research.ts";
import { buildGenericChecklist, buildSeedChecklist, classify, findSeedCity } from "../../../lib/seed/index.ts";

export const runtime = "nodejs";
// Live research can take a few minutes of searching.
export const maxDuration = 300;

// Streams NDJSON `StreamEvent`s: status updates while researching, then one
// `result` (or `error`).
export async function POST(req: Request) {
  const parsed = ChecklistRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Enter a city, a two-letter state and a short business description." }, { status: 400 });
  }
  const { city, state, description, mode } = parsed.data;
  const provider = liveProvider();
  const liveAvailable = provider !== null;
  const useLive = mode === "live" || (mode === "auto" && liveAvailable);

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: StreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      const finish = (checklist: Checklist, source: "seed" | "live") =>
        send({
          type: "result",
          checklist: { ...checklist, source, generatedAt: new Date().toISOString(), guideId: source === "seed" ? guideIdForChecklist(checklist) : null },
        });

      const finishFromSeed = () => {
        const category = classify(description);
        const seeded = findSeedCity(city, state);
        finish(seeded ? buildSeedChecklist(seeded, category) : buildGenericChecklist(city, state, category), "seed");
      };

      try {
        if (useLive) {
          if (!provider) {
            send({ type: "error", message: "Live research isn't configured on this server (set OPENROUTER_API_KEY). Switch to the built-in database." });
            return;
          }
          send({ type: "status", message: `Drafting requirements for ${city}, ${state}…` });
          try {
            const checklist = await researchLive(provider, { city, state, description }, (message) => send({ type: "status", message }), req.signal);
            finish(checklist, "live");
          } catch (err) {
            // Automatic mode never leaves the user empty-handed: fall back to the built-in database.
            if (mode !== "auto" || req.signal.aborted) throw err;
            console.error("live research failed, using the built-in database", err);
            send({ type: "status", message: "Live research isn't available right now. Using the built-in database instead." });
            finishFromSeed();
          }
        } else {
          finishFromSeed();
        }
      } catch (err) {
        if (req.signal.aborted) return;
        console.error("checklist error", err);
        // Provider errors can carry request details; show a plain message instead of err.message.
        const message = useLive
          ? "AI research is unavailable or busy right now (free models have limits). Try again in a minute, or use the built-in database."
          : "Something went wrong. Please try again.";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET() {
  return Response.json({ liveAvailable: liveProvider() !== null });
}
