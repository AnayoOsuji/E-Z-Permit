import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { generateText } from "ai";
import { liveProvider } from "../lib/live-research.ts";
import { UNVERIFIED_CAVEAT, researchChecklist } from "../lib/research.ts";
import { DEFAULT_OPENROUTER_MODEL, FREE_ROUTER, isFreeModel, openRouterConfigured, openRouterModel, roadmapModelId } from "../lib/openrouter.ts";

const KEY = "sk-or-v1-test";

test("only free models are accepted", () => {
  for (const ok of ["openrouter/free", "nvidia/nemotron-3.5-super-vl:free", "xingchen-agi/xing4.0-29b-a4b:free", "google/gemma-4-31b-it:free", "meta-llama/llama-3.3-70b-instruct:free"]) {
    assert.ok(isFreeModel(ok), ok);
  }
  for (const paid of [
    "openai/gpt-4o-mini", "anthropic/claude-haiku-4.5", "google/gemini-2.5-flash-lite", "openrouter/auto",
    "openai/gpt-4o-mini:online", "x/y:free:online", "x/y:free:nitro", "x/y:nitro", "x/y:floor", "x/y:free ", " x/y:free",
    "x/y:free\n", "free", ":free", "x:free", "openrouter/free:online", "openrouter/freebie", "", "../../x/y:free",
  ]) {
    assert.ok(!isFreeModel(paid), JSON.stringify(paid));
  }
});

test("the default model is OpenRouter's free router", () => {
  assert.equal(FREE_ROUTER, "openrouter/free");
  assert.equal(DEFAULT_OPENROUTER_MODEL, "openrouter/free");
  assert.equal(roadmapModelId({}), "openrouter/free");
  assert.equal(roadmapModelId({ OPENROUTER_MODEL: "" }), "openrouter/free");
});

test("OPENROUTER_MODEL can pick another FREE model but a paid one is ignored", () => {
  assert.equal(roadmapModelId({ OPENROUTER_MODEL: " dots-studio/dots-3-note-preview:free " }), "dots-studio/dots-3-note-preview:free");
  const quiet = console.error;
  const logged: string[] = [];
  console.error = (m: string) => logged.push(m);
  try {
    assert.equal(roadmapModelId({ OPENROUTER_MODEL: "openai/gpt-4o-mini" }), "openrouter/free");
    assert.equal(roadmapModelId({ OPENROUTER_MODEL: "anthropic/claude-haiku-4.5:online" }), "openrouter/free");
  } finally {
    console.error = quiet;
  }
  assert.ok(logged.some((m) => /not a free model/.test(m)), "the owner is told why it was ignored");
});

test("a model is only created with a key and a free model id", () => {
  assert.equal(openRouterConfigured({}), false);
  assert.equal(openRouterConfigured({ OPENROUTER_API_KEY: " " }), false);
  assert.equal(openRouterConfigured({ OPENROUTER_API_KEY: KEY }), true);
  assert.equal(openRouterModel("openrouter/free", {}), null, "no key");
  assert.equal(openRouterModel("openai/gpt-4o-mini", { OPENROUTER_API_KEY: KEY }), null, "paid model refused even with a key");
  assert.equal(openRouterModel("openai/gpt-4o-mini:online", { OPENROUTER_API_KEY: KEY }), null, "web search refused");
  assert.ok(openRouterModel("openrouter/free", { OPENROUTER_API_KEY: KEY }));
});

test("research mode runs on OpenRouter only; an Anthropic key does nothing", () => {
  assert.equal(liveProvider({}), null);
  assert.equal(liveProvider({ OPENROUTER_API_KEY: KEY }), "openrouter");
  assert.equal(liveProvider({ OPENROUTER_API_KEY: "  " }), null);
  assert.equal(liveProvider({ ANTHROPIC_API_KEY: "a" }), null, "an Anthropic key alone does not enable research");
});

test("research mode: free model, no web search, invented links stripped", async () => {
  const requests: Record<string, unknown>[] = [];
  const reply = {
    city: "Austin", state: "TX", businessType: "Food truck", summary: "Start here.",
    steps: [{ title: "Get an EIN", agency: "IRS", level: "federal", description: "Free.", forms: ["SS-4"], costMin: 0, costMax: 0, costNote: "Free", timeline: "1 day", links: [{ label: "Made up", url: "https://example.invalid/x" }] }],
    caveats: ["Check fees."], sources: [{ label: "Made up", url: "https://example.invalid/y" }],
  };
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    requests.push(JSON.parse(raw));
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: "gen-1", object: "chat.completion", created: 1, model: "free", choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(reply) }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
    const model = openRouterModel("openrouter/free", { OPENROUTER_API_KEY: KEY, OPENROUTER_API_BASE: base });
    assert.ok(model);
    const statuses: string[] = [];
    const checklist = await researchChecklist(model, { city: "Austin", state: "TX", description: "food truck" }, (m) => statuses.push(m));
    assert.equal(checklist.steps.length, 1);
    assert.deepEqual(checklist.steps[0].links, []);
    assert.deepEqual(checklist.sources, []);
    assert.equal(checklist.caveats[0], UNVERIFIED_CAVEAT);
    assert.ok(statuses.length > 0);
  } finally {
    server.close();
  }
  assert.equal(requests.length, 1);
  assert.equal(requests[0].model, "openrouter/free");
  assert.deepEqual((requests[0].provider as { max_price: unknown }).max_price, { prompt: 0, completion: 0 });
  assert.equal(requests[0].plugins, undefined);
});

test("the real HTTP request: free model, max price $0, no web search, key sent as a bearer token", async () => {
  const requests: { auth: string | undefined; body: Record<string, unknown> }[] = [];
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    requests.push({ auth: req.headers.authorization, body: JSON.parse(raw) });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: "gen-1", object: "chat.completion", created: 1, model: "free", choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
    // Even a paid OPENROUTER_MODEL ends up as the free router.
    const id = roadmapModelId({ OPENROUTER_MODEL: "openai/gpt-4o-mini" });
    const model = openRouterModel(id, { OPENROUTER_API_KEY: KEY, OPENROUTER_API_BASE: base });
    assert.ok(model);
    await generateText({ model, prompt: "hello", maxRetries: 0 });
  } finally {
    server.close();
  }
  assert.equal(requests.length, 1);
  const { auth, body } = requests[0];
  assert.equal(auth, `Bearer ${KEY}`);
  assert.equal(body.model, "openrouter/free");
  assert.deepEqual((body.provider as { max_price: unknown }).max_price, { prompt: 0, completion: 0 });
  assert.equal(body.plugins, undefined, "no web-search plugin");
  assert.ok(!String(body.model).includes(":online"));
});

// --- Static checks: nothing paid can sneak into the source ---
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (["node_modules", ".next", ".git", "tests", "scripts"].includes(name)) return [];
    const p = join(dir, name);
    return statSync(p).isDirectory() ? sourceFiles(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}
const files = () => sourceFiles(ROOT).map((f) => ({ path: relative(ROOT, f).replace(/\\/g, "/"), src: readFileSync(f, "utf8") }));

test("no source file names a paid OpenRouter model, a web-search suffix, or enables a plugin", () => {
  const using = (re: RegExp) => files().filter(({ src }) => re.test(src)).map(({ path }) => path);
  assert.deepEqual(using(/:online\b/), []);
  assert.deepEqual(using(/gpt-4o|gpt-5|claude-haiku|gemini-d/), [], "no paid model ids in the source");
  assert.deepEqual(using(/pluginss*:/), [], "no OpenRouter plugins (web search is billed)");
});

test("OpenRouter is created in exactly one module", () => {
  const using = (needle: string) => files().filter(({ src }) => src.includes(needle)).map(({ path }) => path).sort();
  assert.deepEqual(using("createOpenRouter"), ["lib/openrouter.ts"]);
  assert.deepEqual(using("process.env.OPENROUTER_API_KEY"), [], "the key is only read through the env parameter of lib/openrouter.ts");
});
