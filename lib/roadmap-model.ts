import type { LanguageModel } from "ai";
import { openRouterModel, roadmapModelId } from "./openrouter.ts";

/** The model behind /api/generate-roadmap (through OpenRouter), or null when there's no OPENROUTER_API_KEY. */
export function roadmapModel(): LanguageModel | null {
  return openRouterModel(roadmapModelId());
}
