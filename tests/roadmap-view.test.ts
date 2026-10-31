import assert from "node:assert/strict";
import { test } from "node:test";
import type { RoadmapStep } from "../lib/roadmap.ts";
import { FREE_STEP_LIMIT, LOCKED_PLACEHOLDER, UNLOCK_MESSAGE, buildDisplaySteps, isUuid, lockSteps } from "../lib/roadmap-view.ts";

const steps: RoadmapStep[] = Array.from({ length: 7 }, (_, i) => ({
  step_number: i + 1,
  title: `Secret title ${i + 1}`,
  department: `Secret department ${i + 1}`,
  estimated_cost: `$${(i + 1) * 111}`,
  difficulty: i % 2 ? "High" : "Low",
  description: `Secret description ${i + 1}`,
}));

test("free users see the first 3 steps in full", () => {
  const out = lockSteps(steps, false);
  assert.equal(FREE_STEP_LIMIT, 3);
  assert.equal(out.length, 7);
  assert.deepEqual(out.map((s) => s.locked), [false, false, false, true, true, true, true]);
  for (const i of [0, 1, 2]) assert.deepEqual({ ...out[i], locked: undefined }, { ...steps[i], locked: undefined });
});

test("locked steps keep only their number: none of the real text survives", () => {
  const out = lockSteps(steps, false);
  const serialized = JSON.stringify(out.slice(3));
  assert.ok(!/Secret|\$444|\$555|\$666|\$777/.test(serialized), serialized);
  for (const [i, s] of out.slice(3).entries()) {
    assert.equal(s.step_number, i + 4);
    assert.equal(s.title, LOCKED_PLACEHOLDER.title);
    assert.equal(s.locked, true);
  }
});

test("premium users see every step unlocked", () => {
  const out = lockSteps(steps, true);
  assert.ok(out.every((s) => !s.locked));
  assert.equal(out[6].title, "Secret title 7");
});

test("short roadmaps have nothing to lock", () => {
  assert.ok(lockSteps(steps.slice(0, 3), false).every((s) => !s.locked));
  assert.deepEqual(lockSteps([], false), []);
});

test("unlock message is the exact required text", () => {
  assert.equal(UNLOCK_MESSAGE, "Unlock your complete local permit guide for a one-time payment of $19");
});

test("isUuid accepts only real UUIDs", () => {
  assert.ok(isUuid("3f2b8c1e-9a4d-4e6f-8b1a-0c9d7e5f4a3b"));
  assert.ok(!isUuid("not-a-uuid"));
  assert.ok(!isUuid("../../etc/passwd"));
  assert.ok(!isUuid("3f2b8c1e-9a4d-4e6f-8b1a-0c9d7e5f4a3b' or 1=1"));
});

test("buildDisplaySteps: free users get the preview plus placeholders built from the step count alone", () => {
  const { steps: out, incomplete } = buildDisplaySteps({ preview: steps.slice(0, 3), premium: null, stepCount: 7, isPremium: false });
  assert.equal(incomplete, false);
  assert.deepEqual(out.map((s) => [s.step_number, s.locked]), [[1, false], [2, false], [3, false], [4, true], [5, true], [6, true], [7, true]]);
  assert.ok(!/Secret [4-7]/.test(JSON.stringify(out)));
  assert.equal(out[3].title, LOCKED_PLACEHOLDER.title);
});

test("buildDisplaySteps: a free user is never given premium text even if it is passed in", () => {
  const { steps: out } = buildDisplaySteps({ preview: steps.slice(0, 3), premium: steps.slice(3), stepCount: 7, isPremium: false });
  assert.ok(!/Secret [4-7]/.test(JSON.stringify(out)));
  assert.equal(out.filter((s) => s.locked).length, 4);
});

test("buildDisplaySteps: premium users get preview + locked steps, all unlocked", () => {
  const { steps: out, incomplete } = buildDisplaySteps({ preview: steps.slice(0, 3), premium: steps.slice(3), stepCount: 7, isPremium: true });
  assert.equal(incomplete, false);
  assert.equal(out.length, 7);
  assert.ok(out.every((s) => !s.locked));
  assert.equal(out[6].title, "Secret title 7");
});

test("buildDisplaySteps: a premium user whose locked steps are missing is flagged incomplete", () => {
  const { steps: out, incomplete } = buildDisplaySteps({ preview: steps.slice(0, 3), premium: null, stepCount: 7, isPremium: true });
  assert.equal(incomplete, true);
  assert.equal(out.length, 7);
});

test("buildDisplaySteps: short roadmaps and legacy rows without a count", () => {
  assert.equal(buildDisplaySteps({ preview: steps.slice(0, 2), premium: null, stepCount: 2, isPremium: false }).steps.length, 2);
  const legacy = buildDisplaySteps({ preview: steps.slice(0, 3), premium: null, stepCount: 0, isPremium: false });
  assert.equal(legacy.steps.length, 3);
  assert.equal(legacy.incomplete, false);
});
