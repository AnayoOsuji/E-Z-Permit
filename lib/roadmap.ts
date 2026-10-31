import { z } from "zod";

// Shapes and prompt for /api/generate-roadmap. Free of framework imports so it
// can be unit tested directly.

export const RoadmapStep = z.object({
  step_number: z.number().int().min(1).describe("1-based position in the order the founder should do the steps"),
  title: z.string().min(1).describe("Short name of the permit, license or task"),
  department: z.string().min(1).describe("The agency that issues it or handles it"),
  estimated_cost: z.string().min(1).describe('Estimated fee as text, for example "$50–$150 per year" or "Free"'),
  difficulty: z.enum(["Low", "Medium", "High"]).describe("How hard this step is for a first-time founder"),
  description: z.string().min(1).describe("1–3 plain-language sentences: what it is and what to do"),
});
export type RoadmapStep = z.infer<typeof RoadmapStep>;

export const MIN_STEPS = 3;
export const MAX_STEPS = 15;

// Caps AI spend: roadmaps each user can generate in any rolling 24 hours.
export const DAILY_LIMIT_FREE = 3;
export const DAILY_LIMIT_PREMIUM = 20;

export function dailyRoadmapLimit(isPremium: boolean): number {
  return isPremium ? DAILY_LIMIT_PREMIUM : DAILY_LIMIT_FREE;
}

const RequestShape = z.object({
  city: z.string().trim().min(2, "Enter a city.").max(80, "That city name is too long."),
  state: z
    .string()
    .trim()
    .length(2, "Use the two-letter state code, like TX.")
    .transform((s) => s.toUpperCase()),
  business_type: z.string().trim().min(3, "Describe the business, like “Food Truck”.").max(100, "Keep the business type under 100 characters."),
});

/** The request body. `businessType` is accepted as an alias for `business_type`. */
export const RoadmapRequest = z.preprocess((body) => {
  if (typeof body !== "object" || body === null) return body;
  const b = body as Record<string, unknown>;
  return { ...b, business_type: b.business_type ?? b.businessType };
}, RequestShape);
export type RoadmapRequest = z.infer<typeof RequestShape>;

export const ROADMAP_SYSTEM = `You are a US Municipal Licensing Expert. You help first-time founders work out exactly which permits, licenses and registrations they need to legally open a small local business in a specific US city, and in what order.

Produce an ordered roadmap:
- Cover every level of government that applies: federal (for example an EIN), state (entity formation, sales tax, state licensing boards), county (health department, where the county issues the permit) and city (business license, zoning or home-occupation approval, fire, signage, street vending).
- Order the steps so each one unblocks the next. Do not repeat a step.
- One step per distinct permit, license or registration. Name the real agency that issues it.
- estimated_cost is a short text estimate of the government fee, with its period when it recurs. Say "Varies" or "Free" when that is the honest answer. Never invent a precise figure you are unsure of: give a range instead.
- difficulty is Low, Medium or High for a first-time founder (paperwork effort, inspections, waiting, cost).
- description is 1–3 plain-language sentences for a non-expert: what the step is and what to do.
- Keep it to the steps that really apply to this business in this place. Aim for roughly 6 to 12 steps.
- You can't browse the web here, so rely on what you know of typical requirements and say "Check with the agency" in a description when a rule differs a lot by locality.`;

export function roadmapPrompt(req: RoadmapRequest): string {
  return `City: ${req.city}, ${req.state}\nBusiness type: ${req.business_type}\n\nBuild the permit roadmap for this founder.`;
}

/** Puts steps in order and renumbers them 1..n, so models that start at 0, skip or repeat numbers still give a clean list. */
export function normalizeSteps(steps: RoadmapStep[]): RoadmapStep[] {
  return steps
    .map((step, index) => ({ step, index }))
    .sort((a, b) => a.step.step_number - b.step.step_number || a.index - b.index)
    .map(({ step }, i) => ({ ...step, step_number: i + 1 }));
}
