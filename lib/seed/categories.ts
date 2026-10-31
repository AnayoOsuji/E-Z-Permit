// Maps a free-text business description onto one of the seeded categories.

export const CATEGORIES = {
  "mobile-food": "Mobile food vending (food truck, trailer or cart)",
  "cottage-food": "Home-based food business (cottage food)",
  "home-salon": "Home-based salon or personal care",
  "food-storefront": "Food service storefront (café, restaurant, bakery shop)",
  general: "General small business",
} as const;

export type Category = keyof typeof CATEGORIES;

// Each term matches as a whole word (plural "s" allowed); a trailing "*"
// makes it a prefix match ("bak*" -> bakery, baked, baking).
function has(text: string, terms: string[]): boolean {
  return terms.some((t) => {
    const prefix = t.endsWith("*");
    const body = prefix ? t.slice(0, -1) : t;
    return new RegExp(`(?<![a-z])${body}${prefix ? "" : "s?(?![a-z])"}`, "i").test(text);
  });
}

const MOBILE = ["food truck", "truck", "trailer", "cart", "mobile", "street vend*", "pop-up", "popup", "kiosk", "stand"];
const FOOD = ["food*", "coffee", "espresso", "taco", "bbq", "barbecue", "burger", "hot dog", "ice cream", "lemonade", "juice", "smoothie", "crepe", "pizza", "kitchen", "bak*", "cake", "cupcake", "cookie", "bread*", "pastr*", "jam", "cand(?:y|ies)", "chocolate*", "tamale", "cater*", "caf[eé]", "restaurant", "deli", "donut", "doughnut", "tea", "boba", "snack", "sandwich", "meal", "brownie", "pie", "granola", "salsa"];
const HOME = ["home*", "house", "apartment", "garage", "my kitchen", "cottage", "basement", "spare room", "residence"];
const STOREFRONT = ["storefront", "store front", "shop", "restaurant", "retail space", "lease", "caf[eé]", "brick", "location", "dine-in", "diner", "bistro", "deli", "bar"];
const SALON = ["salon", "hair*", "barber*", "nail", "manicur*", "pedicur*", "lash*", "brow", "eyebrow*", "esthetic*", "facial", "makeup", "braid*", "cosmetolog*", "wax*", "spa"];
const HOME_BAKED = ["bak*", "cake", "cupcake", "cookie", "bread*", "pastr*", "jam", "cand(?:y|ies)", "brownie", "pie", "granola"];

export function classify(description: string): Category {
  const d = description.toLowerCase();
  if (has(d, SALON)) return "home-salon";
  const food = has(d, FOOD);
  if (has(d, MOBILE) && food) return "mobile-food";
  if (has(d, ["food truck", "truck", "food cart"])) return "mobile-food";
  if (food) {
    if (has(d, HOME)) return "cottage-food";
    if (has(d, STOREFRONT)) return "food-storefront";
    // A bare "bakery" / "baked goods" most often means a home start.
    if (has(d, HOME_BAKED)) return "cottage-food";
    return "food-storefront";
  }
  return "general";
}
