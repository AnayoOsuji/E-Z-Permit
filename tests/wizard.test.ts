import assert from "node:assert/strict";
import { test } from "node:test";
import { STATE_OPTIONS, firstInvalidStep, validateStep } from "../lib/wizard.ts";

const valid = { city: "Austin", state: "TX", businessType: "Food Truck" };

test("location step requires a plausible city and a real state", () => {
  assert.deepEqual(validateStep(0, valid), {});
  assert.deepEqual(Object.keys(validateStep(0, { ...valid, city: "", state: "" })).sort(), ["city", "state"]);
  assert.ok(validateStep(0, { ...valid, city: "A" }).city);
  assert.ok(validateStep(0, { ...valid, city: "Austin123" }).city);
  assert.ok(validateStep(0, { ...valid, city: "<script>" }).city);
  assert.deepEqual(validateStep(0, { ...valid, city: "St. John's" }), {});
  assert.deepEqual(validateStep(0, { ...valid, city: "Winston-Salem" }), {});
  assert.deepEqual(validateStep(0, { ...valid, city: "  Saint Paul  " }), {});
  assert.ok(validateStep(0, { ...valid, state: "ZZ" }).state);
});

test("business step needs 3 to 100 characters", () => {
  assert.deepEqual(validateStep(1, valid), {});
  assert.ok(validateStep(1, { ...valid, businessType: "   " }).businessType);
  assert.ok(validateStep(1, { ...valid, businessType: "ab" }).businessType);
  assert.ok(validateStep(1, { ...valid, businessType: "x".repeat(101) }).businessType);
});

test("each step only reports its own fields", () => {
  const empty = { city: "", state: "", businessType: "" };
  assert.deepEqual(Object.keys(validateStep(0, empty)).sort(), ["city", "state"]);
  assert.deepEqual(Object.keys(validateStep(1, empty)), ["businessType"]);
  assert.deepEqual(validateStep(2, empty), {});
});

test("firstInvalidStep points at the earliest problem", () => {
  assert.equal(firstInvalidStep(valid), null);
  assert.equal(firstInvalidStep({ ...valid, businessType: "" })?.step, 1);
  assert.equal(firstInvalidStep({ ...valid, city: "", businessType: "" })?.step, 0);
});

test("state dropdown lists all 50 states plus DC, each accepted by the validator", () => {
  assert.equal(STATE_OPTIONS.length, 51);
  for (const { code } of STATE_OPTIONS) assert.deepEqual(validateStep(0, { ...valid, state: code }), {});
});
