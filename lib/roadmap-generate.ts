import { Output, generateText, type LanguageModel } from "ai";
import { MAX_STEPS, MIN_STEPS, ROADMAP_SYSTEM, RoadmapStep, normalizeSteps, roadmapPrompt, type RoadmapRequest } from "./roadmap.ts";

// Free models are occasionally slow or return JSON that doesn't parse. A retry costs nothing, so try again
// once (the free router may pick a different model) before the caller falls back to the built-in city data.
export const ATTEMPTS = 2;
export const ATTEMPT_TIMEOUT_MS = 50_000;

export async function generateRoadmapSteps(
  model: LanguageModel,
  req: Pick<RoadmapRequest, "city" | "state" | "business_type">,
  options: { signal?: AbortSignal; attempts?: number; attemptTimeoutMs?: number } = {},
): Promise<RoadmapStep[]> {
  const attempts = options.attempts ?? ATTEMPTS;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const timeout = AbortSignal.timeout(options.attemptTimeoutMs ?? ATTEMPT_TIMEOUT_MS);
    try {
      const { output } = await generateText({
        model,
        output: Output.array({ element: RoadmapStep, minItems: MIN_STEPS, maxItems: MAX_STEPS }),
        system: ROADMAP_SYSTEM,
        prompt: roadmapPrompt(req),
        temperature: 0.2,
        maxRetries: 1,
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
