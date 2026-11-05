import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeProgress, toggleStep } from "../lib/progress.ts";

const IDS = ["a", "b", "c", "d"];

test("summarizeProgress counts done steps and builds the label", () => {
  assert.deepEqual(summarizeProgress([], IDS), { done: 0, total: 4, percent: 0, label: "0 of 4 steps done" });
  assert.deepEqual(summarizeProgress(["a", "c"], IDS), { done: 2, total: 4, percent: 50, label: "2 of 4 steps done" });
  assert.equal(summarizeProgress(IDS, IDS).percent, 100);
  assert.equal(summarizeProgress(["a"], ["a"]).label, "1 of 1 step done");
});

test("summarizeProgress ignores unknown and repeated ids", () => {
  const p = summarizeProgress(["a", "a", "gone-step"], IDS);
  assert.equal(p.done, 1);
  assert.equal(p.percent, 25);
});

test("summarizeProgress handles an empty checklist", () => {
  assert.deepEqual(summarizeProgress(["a"], []), { done: 0, total: 0, percent: 0, label: "0 of 0 steps done" });
});

test("toggleStep flips a step without changing the original set", () => {
  const start = new Set(["a"]);
  const added = toggleStep(start, "b");
  assert.deepEqual([...added].sort(), ["a", "b"]);
  const removed = toggleStep(added, "a");
  assert.deepEqual([...removed], ["b"]);
  assert.deepEqual([...start], ["a"]);
});
