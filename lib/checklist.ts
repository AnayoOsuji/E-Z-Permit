import { z } from "zod";

// The single shape both the seeded database and live Claude research produce.
// The UI only ever renders a `Checklist`.

export const GovLevel = z.enum(["federal", "state", "county", "city"]);
export type GovLevel = z.infer<typeof GovLevel>;

export const Link = z.object({
  label: z.string(),
  url: z.string(),
});
export type Link = z.infer<typeof Link>;

export const Step = z.object({
  title: z.string(),
  agency: z.string(),
  level: GovLevel,
  description: z.string(),
  // Forms or applications to file in this step.
  forms: z.array(z.string()),
  costMin: z.number(),
  costMax: z.number(),
  costNote: z.string(),
  timeline: z.string(),
  links: z.array(Link),
});
export type Step = z.infer<typeof Step>;

export const Checklist = z.object({
  city: z.string(),
  state: z.string(),
  businessType: z.string(),
  summary: z.string(),
  // In order: earlier steps unblock later ones.
  steps: z.array(Step),
  caveats: z.array(z.string()),
  sources: z.array(Link),
});
export type Checklist = z.infer<typeof Checklist>;

export type ChecklistResult = Checklist & {
  source: "seed" | "live";
  generatedAt: string;
  // The public guide this checklist matches ("tx/austin/food-truck"), so it can be saved and tracked. Absent for AI drafts and generic checklists.
  guideId?: string | null;
};

export const ChecklistRequest = z.object({
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().length(2),
  description: z.string().trim().min(3).max(500),
  mode: z.enum(["auto", "live", "seed"]).default("auto"),
});
export type ChecklistRequest = z.infer<typeof ChecklistRequest>;

// Events streamed (as NDJSON) from /api/checklist to the browser.
export type StreamEvent =
  | { type: "status"; message: string }
  | { type: "result"; checklist: ChecklistResult }
  | { type: "error"; message: string };

export function totalCost(steps: Step[]): { min: number; max: number } {
  return steps.reduce(
    (acc, s) => ({ min: acc.min + s.costMin, max: acc.max + s.costMax }),
    { min: 0, max: 0 },
  );
}
