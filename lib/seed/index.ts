import type { Checklist, Step } from "../checklist.ts";
import { CATEGORIES, classify, type Category } from "./categories.ts";
import { EIN_STEP, SEED_CITIES, SEED_COMPILED, type SeedCity } from "./cities.ts";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "").trim();

export function findSeedCity(city: string, state: string): SeedCity | undefined {
  const c = norm(city);
  return SEED_CITIES.find(
    (s) => s.state === state.toUpperCase() && (norm(s.city) === c || s.aliases.includes(c)),
  );
}

// Steps run in this order: entity -> EIN -> tax registration -> city license
// -> category-specific permits (already ordered in the seed) -> zoning check.
export function buildSeedChecklist(city: SeedCity, category: Category): Checklist {
  const s = city.steps;
  const homeBased = category === "cottage-food" || category === "home-salon" || category === "general";
  const steps: Step[] = [
    ...(s.formation ?? []),
    EIN_STEP,
    ...(s.salesTax ?? []),
    ...(s.cityLicense ?? []),
    ...(category === "general" ? [] : (s[category] ?? [])),
    ...(homeBased ? (s.homeOccupation ?? []) : []),
  ];
  return {
    city: city.city,
    state: city.state,
    businessType: CATEGORIES[category],
    summary: `${steps.length} steps to legally launch a ${CATEGORIES[category].toLowerCase()} in ${city.city}, ${city.stateName}, in the order you should tackle them.`,
    steps,
    caveats: [
      ...(city.caveats.all ?? []),
      ...(city.caveats[category] ?? []),
      `From E-Z Permit's built-in database (compiled ${SEED_COMPILED}). Fees and forms change—confirm with each agency before paying or filing.`,
    ],
    sources: city.sources,
  };
}

// For cities we have no data on: the universal skeleton plus pointers on
// where to find the city- and county-specific pieces.
export function buildGenericChecklist(cityName: string, state: string, category: Category): Checklist {
  const food = category === "mobile-food" || category === "food-storefront" || category === "cottage-food";
  const steps: Step[] = [
    {
      title: "Choose a structure and register your business name",
      agency: `${state} Secretary of State / county clerk`,
      level: "state",
      description: "Form an LLC or corporation with your Secretary of State, or file a DBA (assumed/fictitious name) with your county if you operate under a name other than your own.",
      forms: ["Articles of Organization (LLC) or DBA filing"],
      costMin: 10,
      costMax: 500,
      costNote: "State LLC fees range from about $40 to $500.",
      timeline: "1–2 weeks",
      links: [{ label: "SBA: register your business", url: "https://www.sba.gov/business-guide/launch-your-business/register-your-business" }],
    },
    EIN_STEP,
    {
      title: "Register for state taxes (sales tax permit)",
      agency: `${state} Department of Revenue`,
      level: "state",
      description: "Most states require a seller's permit before you sell taxable goods, including prepared food.",
      forms: ["State sales tax / seller's permit application"],
      costMin: 0,
      costMax: 100,
      costNote: "Often free; some states charge a small fee or deposit.",
      timeline: "1–3 weeks",
      links: [{ label: "SBA: get federal and state tax IDs", url: "https://www.sba.gov/business-guide/launch-your-business/get-federal-state-tax-id-numbers" }],
    },
    {
      title: `Get a ${cityName} business license and confirm zoning`,
      agency: `City of ${cityName}`,
      level: "city",
      description: "Most cities require a general business license or tax registration, and a zoning check for your location (or a home occupation permit if you work from home).",
      forms: ["City business license application", "Home occupation permit (if home-based)"],
      costMin: 0,
      costMax: 300,
      costNote: "Typical range for city business licenses.",
      timeline: "1–4 weeks",
      links: [{ label: "SBA: apply for licenses and permits", url: "https://www.sba.gov/business-guide/launch-your-business/apply-licenses-permits" }],
    },
  ];
  if (food) {
    steps.push({
      title: category === "cottage-food" ? "Check your state's cottage food law" : "Get a health permit for your food operation",
      agency: "County or city health department",
      level: "county",
      description:
        category === "cottage-food"
          ? "Most states let you sell certain non-perishable foods made at home with light or no permitting, but rules on registration, labeling and sales caps vary widely."
          : "Food trucks, carts and restaurants need plan review, a commissary (for mobile units), a food manager certificate and a health inspection.",
      forms: ["Health permit / plan review application", "Food handler or food manager certificate"],
      costMin: category === "cottage-food" ? 0 : 300,
      costMax: category === "cottage-food" ? 300 : 2000,
      costNote: "Typical ranges; varies widely.",
      timeline: "2–8 weeks",
      links: [{ label: "SBA: apply for licenses and permits", url: "https://www.sba.gov/business-guide/launch-your-business/apply-licenses-permits" }],
    });
  }
  if (category === "home-salon") {
    steps.push({
      title: "Get state cosmetology / barber licenses",
      agency: `${state} board of cosmetology`,
      level: "state",
      description: "Practitioners need individual licenses, and most states also license the salon location—including home salons, which usually must be separate from living space.",
      forms: ["Salon/establishment license", "Individual practitioner license"],
      costMin: 50,
      costMax: 250,
      costNote: "Typical range.",
      timeline: "2–6 weeks",
      links: [{ label: "SBA: apply for licenses and permits", url: "https://www.sba.gov/business-guide/launch-your-business/apply-licenses-permits" }],
    });
  }
  return {
    city: cityName,
    state: state.toUpperCase(),
    businessType: CATEGORIES[category],
    summary: `We don't have ${cityName}-specific data yet, so this is the general roadmap most US cities follow. Turn on Live research for exact local forms, fees and links.`,
    steps,
    caveats: ["Generic template — local requirements differ. Use Live research or contact your city clerk to confirm."],
    sources: [{ label: "SBA business guide", url: "https://www.sba.gov/business-guide" }],
  };
}

export { classify, SEED_CITIES };
