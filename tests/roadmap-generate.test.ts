import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { openRouterModel } from "../lib/openrouter.ts";
import { generateRoadmapSteps } from "../lib/roadmap-generate.ts";

const REQ = { city: "Austin", state: "TX", business_type: "Food Truck" };
const goodSteps = [3, 1, 2].map((n) => ({ step_number: n, title: `Step ${n}`, department: "Dept", estimated_cost: "$10", difficulty: "Low", description: "Do it." }));

// A fake OpenRouter that answers each request with the next entry of `replies`.
async function withServer<T>(replies: (string | { status: number; body: unknown })[], fn: (model: NonNullable<ReturnType<typeof openRouterModel>>, requests: () => number) => Promise<T>) {
  let n = 0;
  const server = createServer(async (req, res) => {
    for await (const _ of req) void _;
    const reply = replies[Math.min(n++, replies.length - 1)];
    if (typeof reply !== "string") {
      res.writeHead(reply.status, { "content-type": "application/json" });
      return res.end(JSON.stringify(reply.body));
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: "g", object: "chat.completion", created: 1, model: "free", choices: [{ index: 0, message: { role: "assistant", content: reply }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
    const model = openRouterModel("openrouter/free", { OPENROUTER_API_KEY: "sk-or-test", OPENROUTER_API_BASE: base });
    assert.ok(model);
    return await fn(model, () => n);
  } finally {
    server.close();
  }
}

const quiet = async <T>(fn: () => Promise<T>) => {
  const q = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = q;
  }
};

test("a good first answer is used and needs one request; steps come back ordered and numbered", async () => {
  await withServer([JSON.stringify({ elements: goodSteps })], async (model, requests) => {
    const steps = await generateRoadmapSteps(model, REQ);
    assert.deepEqual(steps.map((s) => [s.step_number, s.title]), [[1, "Step 1"], [2, "Step 2"], [3, "Step 3"]]);
    assert.equal(requests(), 1);
  });
});

test("unparseable JSON on the first try is retried, and the second answer is used", async () => {
  await quiet(() =>
    withServer(["this is not json at all", JSON.stringify({ elements: goodSteps })], async (model, requests) => {
      const steps = await generateRoadmapSteps(model, REQ);
      assert.equal(steps.length, 3);
      assert.equal(requests(), 2);
    }),
  );
});

test("an answer with too few steps is retried too", async () => {
  await quiet(() =>
    withServer([JSON.stringify({ elements: goodSteps.slice(0, 1) }), JSON.stringify({ elements: goodSteps })], async (model, requests) => {
      assert.equal((await generateRoadmapSteps(model, REQ)).length, 3);
      assert.equal(requests(), 2);
    }),
  );
});

test("after the last attempt fails it throws, so the caller can use the free built-in data", async () => {
  await quiet(() =>
    withServer(["nope", "still nope"], async (model, requests) => {
      await assert.rejects(generateRoadmapSteps(model, REQ));
      assert.equal(requests(), 2, "exactly two attempts, never more");
    }),
  );
});

test("a slow model is cut off by the per-attempt timeout", async () => {
  const server = createServer(() => {
    /* never answers */
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
    const model = openRouterModel("openrouter/free", { OPENROUTER_API_KEY: "sk-or-test", OPENROUTER_API_BASE: base });
    assert.ok(model);
    const started = Date.now();
    await quiet(() => assert.rejects(generateRoadmapSteps(model, REQ, { attempts: 2, attemptTimeoutMs: 300 })));
    assert.ok(Date.now() - started < 5000, "gave up quickly instead of hanging");
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});

test("if the visitor leaves, it stops immediately without retrying", async () => {
  await withServer(["nope"], async (model, requests) => {
    const controller = new AbortController();
    controller.abort();
    await quiet(() => assert.rejects(generateRoadmapSteps(model, REQ, { signal: controller.signal })));
    assert.ok(requests() <= 1);
  });
});
