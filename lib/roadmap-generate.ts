import { Output, generateText, type LanguageModel } from "ai";
import { MAX_STEPS, MIN_STEPS, ROADMAP_SYSTEM, RoadmapStep, normalizeSteps, roadmapPrompt, type RoadmapRequest } from "./roadmap.ts";

// Free models are occasionally slow or return JSON that doesn't parse. A retry costs nothing, so try again
// once (the free router may pick a different model) before the caller falls back to the built-in city data.
export const ATTEMPTS = 2;
// The whole AI step gets this long, so the founder never sits on the loading screen for minutes: a good answer
// typically takes ~20 s (with low reasoning effort, see openrouter.ts), while a stalled free model can hang for
// 90 s or more. When time runs out, the built-in city data is used instead.
export const TOTAL_BUDGET_MS = 30_000;
// A retry only starts if this much of the budget is left (a quick bad-JSON reply leaves room; a slow one doesn't).
export const MIN_RETRY_MS = 8_000;
// Roughly 15 steps of JSON; stops a model that rambles from eating the budget.
const MAX_OUTPUT_TOKENS = 3_000;

export async function generateRoadmapSteps(
  model: LanguageModel,
  req: Pick<RoadmapRequest, "city" | "state" | "business_type">,
  options: { signal?: AbortSignal; attempts?: number; budgetMs?: number } = {},
): Promise<RoadmapStep[]> {
  const attempts = options.attempts ?? ATTEMPTS;
  const budget = options.budgetMs ?? TOTAL_BUDGET_MS;
  const deadline = Date.now() + budget;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const remaining = deadline - Date.now();
    if (attempt > 1 && remaining < Math.min(MIN_RETRY_MS, budget / 3)) break; // not enough time left for a real second try
    const timeout = AbortSignal.timeout(Math.max(remaining, 1));
    try {
      const { output } = await generateText({
        model,
        output: Output.array({ element: RoadmapStep, minItems: MIN_STEPS, maxItems: MAX_STEPS }),
        system: ROADMAP_SYSTEM,
        prompt: roadmapPrompt(req),
        temperature: 0.2,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        // Our own loop retries; the SDK's extra retry (with backoff) would only spend the budget waiting.
        maxRetries: 0,
        abortSignal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
      });
      return normalizeSteps(output);
    } catch (err) {
      if (options.signal?.aborted) throw err; // the visitor left: stop, don't retry
      lastError = err;
      console.error(`generate-roadmap: AI attempt ${attempt}/${attempts} failed`, (err as Error)?.message ?? err);
    }
  }
  throw lastError;
}
