import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

// The one place an OpenRouter model is created, for roadmap generation.
// STRICTLY FREE: only free models can be used, so no user (and nobody running the app) ever pays for an OpenRouter call.
//   1. Only "openrouter/free" (OpenRouter's router over its free models) or a model id ending in ":free" is accepted.
//   2. Every request also tells OpenRouter the maximum price is $0, so it can't route to a paid endpoint.
//   3. There is no web search: OpenRouter's web-search add-on is billed per request, even on a free model.
// Server only: it uses OPENROUTER_API_KEY. OPENROUTER_API_BASE points it at a fake server for testing.

const DEFAULT_BASE = "https://openrouter.ai/api/v1";

/** Picks whichever free model is available, so a rate-limited one doesn't break roadmaps. */
export const FREE_ROUTER = "openrouter/free";
export const DEFAULT_OPENROUTER_MODEL = FREE_ROUTER;

type Env = Record<string, string | undefined>;

/** True only for models OpenRouter serves at no cost. Anything else (paid models, web-search or speed-tier suffixes) is refused. */
export const isFreeModel = (id: string) => id === FREE_ROUTER || /^[\w.-]+\/[\w.:-]+:free$/.test(id);

export const openRouterConfigured = (env: Env = process.env) => Boolean(env.OPENROUTER_API_KEY?.trim());

const warned = new Set<string>();

/** The model for roadmaps. OPENROUTER_MODEL may only name a free model; anything else is ignored. */
export function roadmapModelId(env: Env = process.env): string {
  const wanted = env.OPENROUTER_MODEL?.trim();
  if (!wanted) return DEFAULT_OPENROUTER_MODEL;
  if (isFreeModel(wanted)) return wanted;
  if (!warned.has(wanted)) {
    warned.add(wanted);
    console.error(`OPENROUTER_MODEL "${wanted}" is not a free model, so it is ignored. Using ${DEFAULT_OPENROUTER_MODEL}. Only "${FREE_ROUTER}" and ids ending in ":free" are allowed.`);
  }
  return DEFAULT_OPENROUTER_MODEL;
}

/** A free language model on OpenRouter, or null when there's no OPENROUTER_API_KEY or the model isn't free. */
export function openRouterModel(modelId: string, env: Env = process.env): LanguageModel | null {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey || !isFreeModel(modelId)) return null;
  const openrouter = createOpenRouter({
    apiKey,
    baseURL: env.OPENROUTER_API_BASE?.trim() || DEFAULT_BASE,
    compatibility: "strict",
    // Optional attribution OpenRouter shows in its dashboard.
    headers: { "HTTP-Referer": env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000", "X-Title": "E-Z Permit" },
    // Never route to an endpoint that charges for prompt or completion tokens.
    // The free router often picks "reasoning" models that think for thousands of tokens (45-60 s) before answering;
    // low effort cuts that to a few hundred (~20 s). It can't be switched off: some free models require reasoning.
    extraBody: { provider: { max_price: { prompt: 0, completion: 0 } }, reasoning: { effort: "low" } },
  });
  return openrouter.chat(modelId);
}
