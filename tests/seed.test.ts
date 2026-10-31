import assert from "node:assert/strict";
import { test } from "node:test";
import { Checklist } from "../lib/checklist.ts";
import { placeFromSentence, parsePlace } from "../lib/places.ts";
import { classify } from "../lib/seed/categories.ts";
import { buildGenericChecklist, buildSeedChecklist, findSeedCity, SEED_CITIES } from "../lib/seed/index.ts";

test("classify maps common descriptions to categories", () => {
  const cases: [string, string][] = [
    ["Starting a coffee cart", "mobile-food"],
    ["taco food truck", "mobile-food"],
    ["Selling cakes and cookies I bake at home", "cottage-food"],
    ["home bakery", "cottage-food"],
    ["Opening a hair salon in my home", "home-salon"],
    ["nail studio", "home-salon"],
    ["coffee shop with seating", "food-storefront"],
    ["bakery storefront downtown", "food-storefront"],
    ["math tutoring for my team", "general"],
    ["dog walking", "general"],
  ];
  for (const [text, expected] of cases) assert.equal(classify(text), expected, text);
});

test("place parsing", () => {
  assert.deepEqual(parsePlace("Austin, TX"), { city: "Austin", state: "TX" });
  assert.deepEqual(parsePlace("Austin, Texas"), { city: "Austin", state: "TX" });
  assert.equal(parsePlace("Austin"), undefined);
  assert.deepEqual(placeFromSentence("Starting a coffee cart in Austin, Texas"), { city: "Austin", state: "TX" });
  assert.deepEqual(placeFromSentence("home bakery in New York, NY."), { city: "New York", state: "NY" });
});

test("findSeedCity matches names and aliases", () => {
  assert.equal(findSeedCity("austin", "tx")?.city, "Austin");
  assert.equal(findSeedCity("NYC", "NY")?.city, "New York");
  assert.equal(findSeedCity("Austin", "MN"), undefined);
});

test("every seeded city x category builds a valid, ordered checklist", () => {
  const categories = ["mobile-food", "cottage-food", "home-salon", "food-storefront", "general"] as const;
  for (const city of SEED_CITIES) {
    for (const cat of categories) {
      const c = buildSeedChecklist(city, cat);
      assert.ok(Checklist.safeParse(c).success, `${city.city}/${cat}`);
      assert.ok(c.steps.length >= 3, `${city.city}/${cat} has steps`);
      assert.equal(c.steps[1].agency, "Internal Revenue Service", "EIN comes right after formation");
      for (const s of c.steps) {
        assert.ok(s.costMin <= s.costMax, `${city.city}/${cat}: ${s.title} cost range`);
        assert.ok(s.links.every((l) => l.url.startsWith("http")), `${s.title} links`);
      }
    }
  }
});

test("generic checklist covers unseeded cities", () => {
  const c = buildGenericChecklist("Boise", "ID", "mobile-food");
  assert.ok(Checklist.safeParse(c).success);
  assert.ok(c.steps.some((s) => s.level === "county"));
});
