import type { Link, Step } from "./checklist.ts";
import type { RoadmapRequest, RoadmapStep } from "./roadmap.ts";
import { seedSteps } from "./seed-roadmap.ts";

// Links for roadmap steps. They always come from the built-in city data, whose URLs are checked by
// `npm run check-links`. The AI never supplies a link, because a free model can't verify that a URL is real.
// Each roadmap step is matched to the built-in step it most resembles; no confident match means no links.

const STOP = new Set(["a", "an", "and", "the", "of", "for", "to", "in", "your", "or", "with", "city", "state", "county", "get", "apply", "register", "obtain"]);

const tokens = (text: string): Set<string> =>
  new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOP.has(t)),
  );

function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared);
}

const MIN_MATCH = 0.34;
const MAX_LINKS = 4;

const isWebUrl = (url: string) => /^https?:\/\//i.test(url);

export function linksForSteps(
  steps: Pick<RoadmapStep, "title" | "department">[],
  req: Pick<RoadmapRequest, "city" | "state" | "business_type">,
): Link[][] {
  const candidates: { step: Step; title: Set<string>; both: Set<string> }[] = seedSteps(req)
    .filter((s) => s.links.some((l) => isWebUrl(l.url)))
    .map((step) => ({ step, title: tokens(step.title), both: tokens(`${step.title} ${step.agency}`) }));

  const used = new Set<number>();
  return steps.map((roadmapStep) => {
    const title = tokens(roadmapStep.title);
    const both = tokens(`${roadmapStep.title} ${roadmapStep.department}`);
    let best = -1;
    let bestScore = 0;
    candidates.forEach((c, i) => {
      if (used.has(i)) return;
      const exact = roadmapStep.title.trim().toLowerCase() === c.step.title.trim().toLowerCase();
      const score = exact ? 2 : Math.max(similarity(title, c.title), similarity(both, c.both) * 0.9);
      if (score > bestScore) {
        best = i;
        bestScore = score;
      }
    });
    if (best < 0 || bestScore < MIN_MATCH) return [];
    used.add(best);
    return candidates[best].step.links.filter((l) => isWebUrl(l.url)).slice(0, MAX_LINKS);
  });
}
