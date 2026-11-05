import type { Link } from "./checklist.ts";
import type { RoadmapStep } from "./roadmap.ts";

// Which roadmap steps a user may see. Free accounts get the first FREE_STEP_LIMIT steps in full.
// The rest are stored separately (roadmap_premium_steps) and only premium users can read them;
// for everyone else the page shows placeholders, so locked text never reaches the browser
// (the blur is only the look).

export const FREE_STEP_LIMIT = 3;

// Master switch for the paywall. While false (since 2026-11-05) everyone sees every step and no payment
// prompt is shown. The split storage and RLS stay in place, so turning it back on needs no migration.
export const PAYWALL_ENABLED = false;
export const UNLOCK_MESSAGE = "Unlock your complete local permit guide for a one-time payment of $19";

export type DisplayStep = RoadmapStep & { locked: boolean; links?: Link[] };

export const LOCKED_PLACEHOLDER = {
  title: "Locked permit step",
  department: "Issuing department",
  estimated_cost: "$000 – $000",
  difficulty: "Medium" as const,
  description:
    "Unlock the complete guide to see what this step involves, which office handles it, what it costs and exactly what to do next so you stay compliant.",
};

export function lockSteps(steps: RoadmapStep[], isPremium: boolean, freeLimit = FREE_STEP_LIMIT): DisplayStep[] {
  return steps.map((step, index) =>
    isPremium || index < freeLimit ? { ...step, locked: false } : { step_number: step.step_number, ...LOCKED_PLACEHOLDER, locked: true },
  );
}

export const lockedPlaceholder = (stepNumber: number): DisplayStep => ({ step_number: stepNumber, ...LOCKED_PLACEHOLDER, locked: true });

/**
 * Combines what the database returned into the steps to display.
 * `preview` is the free steps, `premium` the locked ones (null when this user can't read them),
 * and `stepCount` the total, so locked placeholders can be shown without knowing their content.
 */
export function buildDisplaySteps(args: {
  preview: RoadmapStep[];
  premium: RoadmapStep[] | null;
  stepCount: number;
  isPremium: boolean;
}): { steps: DisplayStep[]; incomplete: boolean } {
  const open: DisplayStep[] = args.preview.map((s) => ({ ...s, locked: false }));
  if (args.isPremium && args.premium) {
    return { steps: [...open, ...args.premium.map((s) => ({ ...s, locked: false }))], incomplete: false };
  }
  const missing = Math.max(0, args.stepCount - open.length);
  const placeholders = Array.from({ length: missing }, (_, i) => lockedPlaceholder(open.length + i + 1));
  // A premium user whose locked steps are missing gets an "incomplete" warning instead of an upgrade prompt.
  return { steps: [...open, ...placeholders], incomplete: args.isPremium && missing > 0 };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);
