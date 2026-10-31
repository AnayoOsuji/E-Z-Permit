import assert from "node:assert/strict";
import { test } from "node:test";
import { draftKey, parseDraft, serializeDraft } from "../lib/wizard-storage.ts";

const values = { city: "Austin", state: "TX", businessType: "Food Truck" };

test("a saved draft round-trips", () => {
  assert.deepEqual(parseDraft(serializeDraft({ step: 2, values })), { step: 2, values });
});

test("drafts are kept per user", () => {
  assert.notEqual(draftKey("a"), draftKey("b"));
});

test("missing, malformed or empty drafts give null", () => {
  for (const raw of [null, "", "not json", "null", "{}", '{"step":1}', '{"step":1,"values":{"city":1,"state":"","businessType":""}}']) {
    assert.equal(parseDraft(raw), null, String(raw));
  }
  assert.equal(parseDraft(serializeDraft({ step: 0, values: { city: "", state: "", businessType: "" } })), null);
});

test("the step is clamped and long values are cut", () => {
  assert.equal(parseDraft(serializeDraft({ step: 99, values }))?.step, 2);
  assert.equal(parseDraft(serializeDraft({ step: -3, values }))?.step, 0);
  assert.equal(parseDraft('{"step":"x","values":{"city":"A","state":"TXYZ","businessType":""}}')?.values.state, "TX");
  assert.equal(parseDraft(serializeDraft({ step: 0, values: { ...values, city: "x".repeat(500) } }))?.values.city.length, 80);
});
