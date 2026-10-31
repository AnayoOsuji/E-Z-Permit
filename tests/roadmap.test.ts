import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DAILY_LIMIT_FREE,
  DAILY_LIMIT_PREMIUM,
  MAX_STEPS,
  MIN_STEPS,
  ROADMAP_SYSTEM,
  RoadmapRequest,
  RoadmapStep,
  dailyRoadmapLimit,
  normalizeSteps,
  roadmapPrompt,
} from "../lib/roadmap.ts";

const step = (n: number, title = `Step ${n}`): RoadmapStep => ({
  step_number: n,
  title,
  department: "City Clerk",
  estimated_cost: "$50",
  difficulty: "Low",
  description: "Do the thing.",
});

test("step schema enforces the documented fields and types", () => {
  assert.ok(RoadmapStep.safeParse(step(1)).success);
  assert.ok(!RoadmapStep.safeParse({ ...step(1), difficulty: "Easy" }).success);
  assert.ok(!RoadmapStep.safeParse({ ...step(1), step_number: 1.5 }).success);
  assert.ok(!RoadmapStep.safeParse({ ...step(1), step_number: 0 }).success);
  assert.ok(!RoadmapStep.safeParse({ ...step(1), estimated_cost: 50 }).success);
  for (const difficulty of ["Low", "Medium", "High"]) assert.ok(RoadmapStep.safeParse({ ...step(1), difficulty }).success);
  assert.deepEqual(Object.keys(step(1)), ["step_number", "title", "department", "estimated_cost", "difficulty", "description"]);
});

test("request parsing trims, uppercases the state and accepts businessType", () => {
  const ok = RoadmapRequest.safeParse({ city: " Austin ", state: "tx", business_type: " Food Truck " });
  assert.ok(ok.success);
  assert.deepEqual(ok.data, { city: "Austin", state: "TX", business_type: "Food Truck" });
  const alias = RoadmapRequest.safeParse({ city: "Austin", state: "TX", businessType: "Home Bakery" });
  assert.ok(alias.success && alias.data.business_type === "Home Bakery");
});

test("request parsing rejects bad input with a readable message", () => {
  const msg = (body: unknown) => {
    const r = RoadmapRequest.safeParse(body);
    return r.success ? null : r.error.issues[0].message;
  };
  assert.match(msg({ state: "TX", business_type: "Food Truck" }) ?? "", /./);
  assert.match(msg({ city: "A", state: "TX", business_type: "Food Truck" }) ?? "", /city/i);
  assert.match(msg({ city: "Austin", state: "Texas", business_type: "Food Truck" }) ?? "", /two-letter/);
  assert.match(msg({ city: "Austin", state: "TX", business_type: "ab" }) ?? "", /business/i);
  assert.match(msg({ city: "Austin", state: "TX", business_type: "x".repeat(101) }) ?? "", /100/);
  assert.ok(msg(null));
  assert.ok(msg("string"));
});

test("normalizeSteps orders and renumbers from 1", () => {
  const out = normalizeSteps([step(3, "c"), step(0, "a"), step(3, "d"), step(1, "b")]);
  assert.deepEqual(out.map((s) => [s.step_number, s.title]), [[1, "a"], [2, "b"], [3, "c"], [4, "d"]]);
  assert.deepEqual(normalizeSteps([]), []);
});

test("daily limits: premium users get more than free users", () => {
  assert.equal(dailyRoadmapLimit(false), DAILY_LIMIT_FREE);
  assert.equal(dailyRoadmapLimit(true), DAILY_LIMIT_PREMIUM);
  assert.ok(DAILY_LIMIT_FREE >= 1 && DAILY_LIMIT_PREMIUM > DAILY_LIMIT_FREE);
});

test("prompt and system instructions", () => {
  assert.match(ROADMAP_SYSTEM, /US Municipal Licensing Expert/);
  assert.match(roadmapPrompt({ city: "Austin", state: "TX", business_type: "Food Truck" }), /Austin, TX[\s\S]*Food Truck/);
  assert.ok(MIN_STEPS >= 1 && MAX_STEPS > MIN_STEPS);
});
