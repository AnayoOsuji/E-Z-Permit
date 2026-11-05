import type { Step } from "./checklist.ts";
import type { RoadmapRequest, RoadmapStep } from "./roadmap.ts";
import { buildGenericChecklist, buildSeedChecklist, classify, findSeedCity } from "./seed/index.ts";

// The free fallback for /api/generate-roadmap: when the AI model isn't available, build the
// roadmap from the built-in city data (no API call, no cost) in the same shape.

// The seed data has no difficulty rating, so this is a rough estimate from fee size and paperwork.
export function estimateDifficulty(step: Pick<Step, "costMax" | "forms">): RoadmapStep["difficulty"] {
  if (step.costMax >= 600) return "High";
  if (step.costMax >= 75 || step.forms.length >= 2) return "Medium";
  return "Low";
}

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

export function formatCost(step: Pick<Step, "costMin" | "costMax" | "costNote">): string {
  const range = step.costMax === 0 ? "Free" : step.costMin === step.costMax ? money(step.costMax) : `${money(step.costMin)}–${money(step.costMax)}`;
  const note = step.costNote.trim().replace(/\.$/, "");
  // Keep short notes ("per year"); long ones are explanations that don't fit a cost label.
  return note && note.length <= 40 && step.costMax > 0 ? `${range} (${note})` : range;
}

export function seedStepToRoadmapStep(step: Step, stepNumber: number): RoadmapStep {
  const extras = [step.timeline && `Typical time: ${step.timeline}.`, step.forms.length > 0 && `Forms: ${step.forms.join(", ")}.`].filter(Boolean);
  return {
    step_number: stepNumber,
    title: step.title,
    department: step.agency,
    estimated_cost: formatCost(step),
    difficulty: estimateDifficulty(step),
    description: [step.description.trim(), ...extras].join(" "),
  };
}

/** The built-in checklist steps (with their verified links) for a city and business. */
export function seedSteps(req: Pick<RoadmapRequest, "city" | "state" | "business_type">): Step[] {
  const category = classify(req.business_type);
  const seeded = findSeedCity(req.city, req.state);
  return (seeded ? buildSeedChecklist(seeded, category) : buildGenericChecklist(req.city, req.state, category)).steps;
}

/** True for the cities with verified built-in data. Their roadmaps skip the AI: it is slow (20-90 s) and no more accurate. */
export function hasCityData(req: Pick<RoadmapRequest, "city" | "state">): boolean {
  return findSeedCity(req.city, req.state) !== undefined;
}

export function seedRoadmap(req: Pick<RoadmapRequest, "city" | "state" | "business_type">): RoadmapStep[] {
  return seedSteps(req).map((step, i) => seedStepToRoadmapStep(step, i + 1));
}
