import { Output, generateText, type LanguageModel } from "ai";
import { Checklist } from "./checklist.ts";
import { researchSystemPrompt, researchUserMessage, type ResearchInput } from "./research-prompt.ts";

// Research mode: a FREE OpenRouter model drafts the checklist from what it knows (no web search, which isn't free).
// Because it can't look anything up, it is told not to give links, and any links or sources it returns anyway are
// dropped, so an invented URL never reaches a founder. A caveat says the draft must be confirmed with each agency.

// Free models are sometimes slow or return JSON that doesn't parse; a retry costs nothing.
export const ATTEMPTS = 2;
export const ATTEMPT_TIMEOUT_MS = 60_000;

export const UNVERIFIED_CAVEAT =
  "This checklist was drafted by an AI model from general knowledge, without searching the web. Fees, forms and rules change, so confirm each step with the agency before you pay or file.";

export type { ResearchInput };

export async function researchChecklist(
  model: LanguageModel,
  input: ResearchInput,
  onStatus: (message: string) => void,
  options: { signal?: AbortSignal; attempts?: number; attemptTimeoutMs?: number } = {},
): Promise<Checklist> {
  const attempts = options.attempts ?? ATTEMPTS;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    onStatus(attempt === 1 ? "Drafting your checklist with a free AI model…" : "Trying again with another free model…");
    const timeout = AbortSignal.timeout(options.attemptTimeoutMs ?? ATTEMPT_TIMEOUT_MS);
    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: Checklist }),
        system: researchSystemPrompt(),
        prompt: researchUserMessage(input),
        temperature: 0.2,
        maxRetries: 1,
        abortSignal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
      });
      return withoutUnverifiedLinks(output);
    } catch (err) {
      if (options.signal?.aborted) throw err; // the visitor left: stop, don't retry
      lastError = err;
      console.error(`checklist: AI attempt ${attempt}/${attempts} failed`, (err as Error)?.message ?? err);
    }
  }
  throw lastError;
}

/** Drops every link and source (the model can't have checked them) and adds the "confirm with the agency" caveat. */
export function withoutUnverifiedLinks(checklist: Checklist): Checklist {
  return {
    ...checklist,
    steps: checklist.steps.map((s) => ({ ...s, links: [] })),
    sources: [],
    caveats: [UNVERIFIED_CAVEAT, ...checklist.caveats],
  };
}
