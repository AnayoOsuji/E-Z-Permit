import assert from "node:assert/strict";
import { test } from "node:test";
import { linksForSteps } from "../lib/roadmap-links.ts";
import { seedRoadmap } from "../lib/seed-roadmap.ts";

const req = { city: "Austin", state: "TX", business_type: "Food Truck" };

test("built-in roadmap steps each get their own links, all web URLs", () => {
  const steps = seedRoadmap(req);
  const links = linksForSteps(steps, req);
  assert.equal(links.length, steps.length);
  assert.ok(links.filter((l) => l.length > 0).length >= steps.length - 1);
  for (const l of links.flat()) assert.match(l.url, /^https?:\/\//);
});

test("an AI-style step gets links from the matching built-in step", () => {
  const [links] = linksForSteps([{ title: "Apply for an EIN", department: "IRS (Internal Revenue Service)" }], req);
  assert.ok(links.some((l) => l.url.includes("irs.gov")));
});

test("a step with no real match gets no links", () => {
  const [links] = linksForSteps([{ title: "Register a trademark for the logo", department: "USPTO" }], req);
  assert.deepEqual(links, []);
});
