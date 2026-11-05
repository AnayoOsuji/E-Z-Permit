import assert from "node:assert/strict";
import { test } from "node:test";
import { communityStat, formatCommunity, median, parseDays, statsByStep } from "../lib/durations.ts";

test("parseDays accepts whole days from 0 to 365", () => {
  assert.deepEqual(parseDays("0"), { ok: true, days: 0 });
  assert.deepEqual(parseDays(" 23 "), { ok: true, days: 23 });
  assert.deepEqual(parseDays(365), { ok: true, days: 365 });
});

test("parseDays rejects blanks, decimals, negatives, text and out-of-range values", () => {
  for (const bad of ["", "  ", "1.5", "-1", "abc", "1e3", "366", "9999", 366, -5]) {
    const r = parseDays(bad);
    assert.equal(r.ok, false, String(bad));
  }
  const tooBig = parseDays("400");
  assert.equal(tooBig.ok === false && tooBig.error, "Enter a number from 0 to 365.");
});

test("median uses the middle value, so one outlier does not move it", () => {
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([10, 20, 30, 40]), 25);
  assert.equal(median([14, 15, 16, 17, 365]), 16);
  assert.ok(Number.isNaN(median([])));
});

test("communityStat stays hidden until 3 reports", () => {
  assert.equal(communityStat([]), null);
  assert.equal(communityStat([10, 20]), null);
  assert.deepEqual(communityStat([10, 20, 30]), { days: 20, reports: 3 });
});

test("communityStat ignores values outside 0-365 when counting", () => {
  assert.equal(communityStat([10, 20, 9999]), null);
  assert.equal(communityStat([10, 20, -4, 1.5]), null);
  assert.deepEqual(communityStat([10, 20, 30, 9999]), { days: 20, reports: 3 });
});

test("formatCommunity words the number and the report count", () => {
  assert.equal(formatCommunity({ days: 23, reports: 14 }), "Community average: 23 days (from 14 reports)");
  assert.equal(formatCommunity({ days: 1, reports: 3 }), "Community average: 1 day (from 3 reports)");
});

test("statsByStep keeps only steps with 3+ reports and rounds the median", () => {
  const stats = statsByStep([
    { step_id: "ein", median_days: "1.5", report_count: "5" },
    { step_id: "permit", median_days: 30, report_count: 2 },
  ]);
  assert.deepEqual(stats, { ein: { days: 2, reports: 5 } });
  assert.deepEqual(statsByStep(null), {});
});
