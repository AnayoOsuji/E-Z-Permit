import assert from "node:assert/strict";
import { test } from "node:test";
import { buildGuide, formatTimeline, guideFromId, guideIdForChecklist, listGuideRefs, parseTimeline, slugify, stepIds, totalTimeline } from "../lib/guides.ts";
import { savePath } from "../lib/save-link.ts";

test("every guide ref builds a guide with unique step ids", () => {
  const refs = listGuideRefs();
  assert.equal(refs.length, 35);
  for (const r of refs) {
    const g = buildGuide(r.state, r.city, r.business);
    assert.ok(g, JSON.stringify(r));
    assert.ok(g.steps.length >= 4, g.id);
    assert.equal(new Set(g.steps.map((s) => s.id)).size, g.steps.length, g.id);
    assert.equal(g.path, `/permits/${g.id}`);
  }
});

test("the Austin food truck example is complete", () => {
  const g = buildGuide("tx", "austin", "food-truck");
  assert.ok(g);
  assert.equal(g.heading, "Food Truck Permits in Austin, TX");
  assert.equal(g.cityKey, "tx/austin");
  assert.ok(g.cost.max > g.cost.min);
  assert.ok(g.timeline && g.timeline.max >= g.timeline.min);
  assert.ok(g.steps.every((s) => s.links.length > 0));
});

test("unknown guides are not found", () => {
  assert.equal(buildGuide("tx", "atlantis", "food-truck"), null);
  assert.equal(buildGuide("tx", "austin", "spaceship"), null);
  assert.equal(guideFromId("tx/austin"), null);
  assert.equal(guideFromId("../../etc/passwd"), null);
  assert.equal(guideFromId(null), null);
  assert.ok(guideFromId("tx/austin/food-truck"));
});

test("slugify and stepIds", () => {
  assert.equal(slugify("New York"), "new-york");
  assert.equal(slugify("Café & Bar!"), "cafe-bar");
  assert.deepEqual(stepIds([{ title: "Get a permit" }, { title: "Get a permit" }, { title: "Other" }]), ["get-a-permit", "get-a-permit-2", "other"]);
});

test("parseTimeline reads the formats used in the city data", () => {
  assert.deepEqual(parseTimeline("1–3 business days online (SOSDirect)"), { min: 1, max: 3 });
  assert.deepEqual(parseTimeline("2–6 weeks including inspection"), { min: 14, max: 42 });
  assert.deepEqual(parseTimeline("1–4 months"), { min: 30, max: 120 });
  assert.deepEqual(parseTimeline("About 2–3 weeks"), { min: 14, max: 21 });
  assert.deepEqual(parseTimeline("1 day"), { min: 1, max: 1 });
  assert.deepEqual(parseTimeline("Same day online"), { min: 0, max: 1 });
  assert.equal(parseTimeline("Varies a lot"), null);
});

test("totalTimeline adds steps and skips unreadable ones; formatTimeline words it", () => {
  assert.deepEqual(totalTimeline([{ timeline: "1 week" }, { timeline: "Varies" }, { timeline: "2–3 weeks" }]), { min: 21, max: 28 });
  assert.equal(totalTimeline([{ timeline: "Varies" }]), null);
  assert.equal(formatTimeline(null), "Varies");
  assert.equal(formatTimeline({ min: 21, max: 49 }), "About 3–7 weeks");
  assert.equal(formatTimeline({ min: 1, max: 3 }), "About 1–3 days");
});

test("guideIdForChecklist matches built-in checklists to their guide", () => {
  const g = buildGuide("tx", "austin", "food-truck")!;
  assert.equal(guideIdForChecklist(g.checklist), "tx/austin/food-truck");
  assert.equal(guideIdForChecklist({ city: "Smallville", state: "KS", businessType: g.checklist.businessType }), null);
  assert.equal(guideIdForChecklist({ city: "Austin", state: "TX", businessType: "Something an AI made up" }), null);
});

test("savePath encodes the checklist and the reminder opt-in", () => {
  assert.equal(savePath("tx/austin/food-truck"), "/my-roadmaps/save?c=tx%2Faustin%2Ffood-truck");
  assert.equal(savePath("tx/austin/food-truck", true), "/my-roadmaps/save?c=tx%2Faustin%2Ffood-truck&optin=1");
});
