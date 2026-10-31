import type { Checklist } from "./checklist.ts";
import { openRouterConfigured, openRouterModel, roadmapModelId } from "./openrouter.ts";
import { researchChecklist } from "./research.ts";
import type { ResearchInput } from "./research-prompt.ts";

// Research mode runs through OpenRouter, free models only (lib/openrouter.ts enforces that). OpenRouter's web
// search is billed, so it is not used: the model drafts from what it knows. Without OPENROUTER_API_KEY the home
// page uses the free built-in city database.

export type LiveProvider = "openrouter";

/** The service that does research, or null when none is configured. */
export function liveProvider(env: Record<string, string | undefined> = process.env): LiveProvider | null {
  return openRouterConfigured(env) ? "openrouter" : null;
}

export function researchLive(
  _provider: LiveProvider,
  input: ResearchInput,
  onStatus: (message: string) => void,
  signal?: AbortSignal,
): Promise<Checklist> {
  const model = openRouterModel(roadmapModelId());
  if (!model) return Promise.reject(new Error("Research isn't configured on this server (set OPENROUTER_API_KEY)."));
  return researchChecklist(model, input, onStatus, { signal });
}
