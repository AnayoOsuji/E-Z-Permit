import assert from "node:assert/strict";
import { test } from "node:test";
import { MIN_STEPS, RoadmapStep } from "../lib/roadmap.ts";
import { estimateDifficulty, formatCost, seedRoadmap, hasCityData } from "../lib/seed-roadmap.ts";
import { SEED_CITIES } from "../lib/seed/index.ts";

const BUSINESSES = ["Food Truck", "Home Bakery", "Hair Salon", "Coffee Shop restaurant", "Dog Grooming", "Retail Shop"];

test("every seeded city x business type builds a valid, numbered roadmap", () => {
  for (const city of SEED_CITIES) {
    for (const business_type of BUSINESSES) {
      const steps = seedRoadmap({ city: city.city, state: city.state, business_type });
      assert.ok(steps.length >= MIN_STEPS, `${city.city} / ${business_type}: ${steps.length} steps`);
      steps.forEach((s, i) => {
        assert.equal(s.step_number, i + 1);
        const parsed = RoadmapStep.safeParse(s);
        assert.ok(parsed.success, `${city.city} / ${business_type} step ${i + 1}: ${JSON.stringify(parsed.error?.issues)}`);
      });
    }
  }
});

test("cities with no seed data still get a general roadmap", () => {
  const steps = seedRoadmap({ city: "Smallville", state: "KS", business_type: "Food Truck" });
  assert.ok(steps.length >= MIN_STEPS);
  assert.ok(steps.every((s) => RoadmapStep.safeParse(s).success));
});

test("the roadmap is specific to the city and business", () => {
  const austin = seedRoadmap({ city: "Austin", state: "TX", business_type: "Food Truck" });
  const seattle = seedRoadmap({ city: "Seattle", state: "WA", business_type: "Food Truck" });
  const bakery = seedRoadmap({ city: "Austin", state: "TX", business_type: "Home Bakery" });
  assert.notDeepEqual(austin.map((s) => s.title), seattle.map((s) => s.title));
  assert.notDeepEqual(austin.map((s) => s.title), bakery.map((s) => s.title));
});

test("cost labels", () => {
  assert.equal(formatCost({ costMin: 0, costMax: 0, costNote: "Free to file." }), "Free");
  assert.equal(formatCost({ costMin: 50, costMax: 50, costNote: "" }), "$50");
  assert.equal(formatCost({ costMin: 25, costMax: 300, costNote: "" }), "$25–$300");
  assert.equal(formatCost({ costMin: 1000, costMax: 1500, costNote: "per year." }), "$1,000–$1,500 (per year)");
  assert.equal(formatCost({ costMin: 10, costMax: 20, costNote: "A long explanation of how the fee is calculated that doesn't fit" }), "$10–$20");
});

test("difficulty estimate", () => {
  assert.equal(estimateDifficulty({ costMax: 0, forms: [] }), "Low");
  assert.equal(estimateDifficulty({ costMax: 50, forms: ["A"] }), "Low");
  assert.equal(estimateDifficulty({ costMax: 100, forms: [] }), "Medium");
  assert.equal(estimateDifficulty({ costMax: 20, forms: ["A", "B"] }), "Medium");
  assert.equal(estimateDifficulty({ costMax: 500, forms: [] }), "Medium");
  assert.equal(estimateDifficulty({ costMax: 600, forms: [] }), "High");
});

test("hasCityData is true only for cities with built-in data", () => {
  assert.equal(hasCityData({ city: "Austin", state: "TX" }), true);
  assert.equal(hasCityData({ city: "new york", state: "ny" }), true);
  assert.equal(hasCityData({ city: "Boise", state: "ID" }), false);
  assert.equal(hasCityData({ city: "Austin", state: "CA" }), false);
});
