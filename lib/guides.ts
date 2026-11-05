import { totalCost, type Checklist, type Step } from "./checklist.ts";
import { CATEGORIES, type Category } from "./seed/categories.ts";
import { SEED_COMPILED } from "./seed/cities.ts";
import { SEED_CITIES, buildSeedChecklist, findSeedCity } from "./seed/index.ts";

// The public guide pages (/permits/[state]/[city]/[business]) and the saved, tracked
// copies of them (/my-roadmaps/...). Both are built from the built-in city data.

export const BUSINESS_SLUGS: Record<Category, string> = {
  "mobile-food": "food-truck",
  "cottage-food": "cottage-food",
  "home-salon": "home-salon",
  "food-storefront": "restaurant",
  general: "small-business",
};

// Short names for headings: "Food Truck Permits in Austin, TX".
export const BUSINESS_LABELS: Record<Category, string> = {
  "mobile-food": "Food Truck",
  "cottage-food": "Cottage Food Business",
  "home-salon": "Home Salon",
  "food-storefront": "Restaurant & Café",
  general: "Small Business",
};

const CATEGORY_LIST = Object.keys(BUSINESS_SLUGS) as Category[];

export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export type GuideStep = Step & { id: string };

export type DayRange = { min: number; max: number };

export type Guide = {
  /** "tx/austin/food-truck": the checklist id stored with progress. */
  id: string;
  /** "tx/austin": the key community duration reports are grouped by. */
  cityKey: string;
  path: string;
  city: string;
  stateCode: string;
  stateName: string;
  category: Category;
  businessLabel: string;
  heading: string;
  checklist: Checklist;
  steps: GuideStep[];
  cost: { min: number; max: number };
  timeline: DayRange | null;
  lastVerified: string;
};

export type GuideRef = { state: string; city: string; business: string };

/** Stable ids for steps: the slugged title, numbered when two steps share one. */
export function stepIds(steps: Pick<Step, "title">[]): string[] {
  const seen = new Map<string, number>();
  return steps.map((s) => {
    const base = slugify(s.title).slice(0, 80) || "step";
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}

// ------------------------------------------------------------ timelines ---

const UNIT_DAYS: [RegExp, number][] = [
  [/^month/, 30],
  [/^week/, 7],
  [/^(business )?day/, 1],
];

/** Reads the first duration in text like "1–3 weeks" or "Same day online". Null when there isn't one. */
export function parseTimeline(text: string): DayRange | null {
  if (/^\W*(often )?(same day|instant)/i.test(text)) return { min: 0, max: 1 };
  const m = text.match(/(\d+)\s*(?:[–-]\s*(\d+))?\s*\+?\s*(months?|weeks?|business days?|days?)/i);
  if (!m) return null;
  const unit = UNIT_DAYS.find(([re]) => re.test(m[3].toLowerCase()))?.[1];
  if (!unit) return null;
  const lo = Number(m[1]);
  const hi = m[2] ? Number(m[2]) : lo;
  return { min: lo * unit, max: hi * unit };
}

/** Adds up the steps' timelines as if done one after another. Steps with no readable timeline are left out. */
export function totalTimeline(steps: Pick<Step, "timeline">[]): DayRange | null {
  let total = null as DayRange | null;
  for (const s of steps) {
    const r = parseTimeline(s.timeline);
    if (r) total = { min: (total?.min ?? 0) + r.min, max: (total?.max ?? 0) + r.max };
  }
  return total;
}

function approx(days: number): string {
  if (days < 14) return `${days} day${days === 1 ? "" : "s"}`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  return `${Math.round(days / 30)} months`;
}

export function formatTimeline(range: DayRange | null): string {
  if (!range) return "Varies";
  const lo = approx(range.min);
  const hi = approx(range.max);
  if (lo === hi) return `About ${hi}`;
  // "3–9 weeks" reads better than "3 weeks – 9 weeks" when the units match.
  const [loNum, loUnit] = lo.split(" ");
  const [, hiUnit] = hi.split(" ");
  return loUnit.replace(/s$/, "") === hiUnit.replace(/s$/, "") ? `About ${loNum}–${hi}` : `About ${lo} – ${hi}`;
}

// --------------------------------------------------------------- guides ---

export function buildGuide(state: string, citySlug: string, businessSlug: string): Guide | null {
  const seedCity = SEED_CITIES.find((c) => c.state.toLowerCase() === state.toLowerCase() && slugify(c.city) === citySlug);
  const category = CATEGORY_LIST.find((c) => BUSINESS_SLUGS[c] === businessSlug);
  if (!seedCity || !category) return null;

  const checklist = buildSeedChecklist(seedCity, category);
  const ids = stepIds(checklist.steps);
  const stateLower = seedCity.state.toLowerCase();
  const id = `${stateLower}/${citySlug}/${businessSlug}`;
  return {
    id,
    cityKey: `${stateLower}/${citySlug}`,
    path: `/permits/${id}`,
    city: seedCity.city,
    stateCode: seedCity.state,
    stateName: seedCity.stateName,
    category,
    businessLabel: BUSINESS_LABELS[category],
    heading: `${BUSINESS_LABELS[category]} Permits in ${seedCity.city}, ${seedCity.state}`,
    checklist,
    steps: checklist.steps.map((s, i) => ({ ...s, id: ids[i] })),
    cost: totalCost(checklist.steps),
    timeline: totalTimeline(checklist.steps),
    lastVerified: SEED_COMPILED,
  };
}

export function listGuideRefs(): GuideRef[] {
  return SEED_CITIES.flatMap((c) =>
    CATEGORY_LIST.map((cat) => ({ state: c.state.toLowerCase(), city: slugify(c.city), business: BUSINESS_SLUGS[cat] })),
  );
}

/** A checklist id like "tx/austin/food-truck" -> its guide, or null when it isn't a real guide. */
export function guideFromId(id: string | null | undefined): Guide | null {
  const parts = (id ?? "").split("/");
  return parts.length === 3 ? buildGuide(parts[0], parts[1], parts[2]) : null;
}

/** The guide behind a built-in checklist (matched by city and the category label), or null for AI drafts and generic ones. */
export function guideIdForChecklist(c: Pick<Checklist, "city" | "state" | "businessType">): string | null {
  const seed = findSeedCity(c.city, c.state);
  const category = CATEGORY_LIST.find((k) => CATEGORIES[k] === c.businessType);
  return seed && category ? `${seed.state.toLowerCase()}/${slugify(seed.city)}/${BUSINESS_SLUGS[category]}` : null;
}
